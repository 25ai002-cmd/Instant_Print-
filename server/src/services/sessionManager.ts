import fs from "fs";
import { v4 as uuid } from "uuid";
import { KioskSession, SessionStage } from "../types/session";
import {
  DbDocumentRecord,
  deleteDocumentRecord,
  saveDocumentRecord,
  updateDocumentStatus,
} from "./database";

const SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes TTL for active sessions
const CLEANUP_INTERVAL_MS = 30 * 1000;

class SessionManager {
  private sessions = new Map<string, KioskSession>();

  constructor() {
    setInterval(() => this.reapExpired(), CLEANUP_INTERVAL_MS).unref();
  }

  create(): KioskSession {
    const now = Date.now();
    const session: KioskSession = {
      id: uuid(),
      stage: "CREATED",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): KioskSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): KioskSession[] {
    return Array.from(this.sessions.values());
  }

  requireSession(id: string): KioskSession {
    const session = this.sessions.get(id);
    if (!session) {
      const err = new Error("Session not found or has expired");
      (err as any).statusCode = 404;
      throw err;
    }
    return session;
  }

  update(id: string, patch: Partial<KioskSession>): KioskSession {
    const session = this.requireSession(id);
    Object.assign(session, patch, {
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    // If session has an attached document, sync changes to SQLite database
    if (session.file && session.accessCode) {
      saveDocumentRecord(session, session.accessCode).catch((err) => {
        console.error("[SessionManager] Failed to sync document to DB:", err);
      });
    }

    return session;
  }

  setStage(id: string, stage: SessionStage): KioskSession {
    return this.update(id, { stage });
  }

  loadFromDbRecord(record: DbDocumentRecord): KioskSession {
    const now = Date.now();
    const session: KioskSession = {
      id: record.id,
      stage: record.print_status === "COMPLETED" ? "COMPLETED" : "FILE_UPLOADED",
      createdAt: record.created_at,
      updatedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      accessCode: record.access_code,
      file: {
        originalName: record.original_name,
        storedPath: record.stored_path,
        mimeType: record.mime_type,
        sizeBytes: record.size_bytes,
        pageCount: record.page_count,
        colorPageCount: record.color_page_count,
        bwPageCount: record.bw_page_count,
        blankPageCount: record.blank_page_count,
        orientation: record.orientation as any,
        detectedPaperSize: record.detected_paper_size as any,
        accessCode: record.access_code,
      },
      options: record.options_json ? JSON.parse(record.options_json) : undefined,
      price: record.price_json ? JSON.parse(record.price_json) : undefined,
      payment: record.payment_status === "PAID" ? {
        orderId: `db_order_${record.id}`,
        qrImageDataUrl: "",
        upiIntentUrl: "",
        amount: record.price_json ? JSON.parse(record.price_json).total : 0,
        status: "PAID",
        createdAt: now,
        expiresAt: now + 3600000,
      } : undefined,
    };

    if (session.options && session.price) {
      session.stage = session.payment?.status === "PAID" ? "AWAITING_PAYMENT" : "FILE_UPLOADED";
    }

    this.sessions.set(session.id, session);
    return session;
  }

  /** Deletes the uploaded file (if clean-up requested) and removes the session. */
  destroy(id: string, deleteDb = false): void {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    if (deleteDb) {
      this.deleteUploadedFile(session);
      deleteDocumentRecord(id).catch(() => undefined);
    }
  }

  private deleteUploadedFile(session: KioskSession): void {
    const path = session.file?.storedPath;
    if (path && fs.existsSync(path)) {
      fs.unlink(path, (err) => {
        if (err) {
          console.error(`[sessionManager] failed to delete temp file ${path}:`, err.message);
        }
      });
    }
  }

  private reapExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionManager = new SessionManager();
