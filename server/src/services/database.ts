import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { KioskSession, PrintOptions, PriceBreakdown } from "../types/session";

const DATA_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "printatm.db");

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_PATH);

export interface DbDocumentRecord {
  id: string;
  access_code: string;
  session_id: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  size_bytes: number;
  page_count: number;
  color_page_count: number;
  bw_page_count: number;
  blank_page_count: number;
  orientation: string;
  detected_paper_size: string;
  options_json?: string;
  price_json?: string;
  payment_status: string;
  print_status: string;
  created_at: number;
  updated_at: number;
}

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS uploaded_documents (
        id TEXT PRIMARY KEY,
        access_code TEXT UNIQUE NOT NULL,
        session_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        color_page_count INTEGER NOT NULL,
        bw_page_count INTEGER NOT NULL,
        blank_page_count INTEGER NOT NULL,
        orientation TEXT NOT NULL,
        detected_paper_size TEXT NOT NULL,
        options_json TEXT,
        price_json TEXT,
        payment_status TEXT DEFAULT 'NONE',
        print_status TEXT DEFAULT 'AWAITING',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      (err: any) => {
        if (err) {
          console.error("[Database] Error creating uploaded_documents table:", err);
          reject(err);
        } else {
          console.log("[Database] SQLite database initialized at:", DB_PATH);
          resolve();
        }
      }
    );
  });
}

export function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function saveDocumentRecord(session: KioskSession, accessCode: string): Promise<DbDocumentRecord> {
  const file = session.file;
  if (!file) {
    return Promise.reject(new Error("Cannot save document record without file metadata"));
  }

  const now = Date.now();
  const record: DbDocumentRecord = {
    id: session.id,
    access_code: accessCode,
    session_id: session.id,
    original_name: file.originalName,
    stored_path: file.storedPath,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    page_count: file.pageCount,
    color_page_count: file.colorPageCount,
    bw_page_count: file.bwPageCount,
    blank_page_count: file.blankPageCount,
    orientation: file.orientation,
    detected_paper_size: file.detectedPaperSize,
    options_json: session.options ? JSON.stringify(session.options) : undefined,
    price_json: session.price ? JSON.stringify(session.price) : undefined,
    payment_status: session.payment?.status ?? "NONE",
    print_status: session.stage === "COMPLETED" ? "COMPLETED" : "READY",
    created_at: session.createdAt || now,
    updated_at: now,
  };

  const sql = `
    INSERT OR REPLACE INTO uploaded_documents (
      id, access_code, session_id, original_name, stored_path, mime_type,
      size_bytes, page_count, color_page_count, bw_page_count, blank_page_count,
      orientation, detected_paper_size, options_json, price_json, payment_status,
      print_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    record.id,
    record.access_code,
    record.session_id,
    record.original_name,
    record.stored_path,
    record.mime_type,
    record.size_bytes,
    record.page_count,
    record.color_page_count,
    record.bw_page_count,
    record.blank_page_count,
    record.orientation,
    record.detected_paper_size,
    record.options_json || null,
    record.price_json || null,
    record.payment_status,
    record.print_status,
    record.created_at,
    record.updated_at,
  ];

  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err: any) {
      if (err) {
        console.error("[Database] Error saving document record:", err);
        reject(err);
      } else {
        resolve(record);
      }
    });
  });
}

export function getDocumentByAccessCode(accessCode: string): Promise<DbDocumentRecord | undefined> {
  const cleanCode = accessCode.replace(/\s+/g, "");
  const sql = `SELECT * FROM uploaded_documents WHERE access_code = ?`;
  return new Promise((resolve, reject) => {
    db.get(sql, [cleanCode], (err: any, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as DbDocumentRecord | undefined);
      }
    });
  });
}

export function getDocumentById(id: string): Promise<DbDocumentRecord | undefined> {
  const sql = `SELECT * FROM uploaded_documents WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err: any, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as DbDocumentRecord | undefined);
      }
    });
  });
}

export function listPendingDocuments(): Promise<DbDocumentRecord[]> {
  const sql = `SELECT * FROM uploaded_documents ORDER BY updated_at DESC LIMIT 50`;
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err: any, rows: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as DbDocumentRecord[]);
      }
    });
  });
}

export function updateDocumentStatus(
  id: string,
  patch: {
    options?: PrintOptions;
    price?: PriceBreakdown;
    paymentStatus?: string;
    printStatus?: string;
  }
): Promise<void> {
  const fields: string[] = [];
  const params: any[] = [];

  if (patch.options !== undefined) {
    fields.push("options_json = ?");
    params.push(JSON.stringify(patch.options));
  }
  if (patch.price !== undefined) {
    fields.push("price_json = ?");
    params.push(JSON.stringify(patch.price));
  }
  if (patch.paymentStatus !== undefined) {
    fields.push("payment_status = ?");
    params.push(patch.paymentStatus);
  }
  if (patch.printStatus !== undefined) {
    fields.push("print_status = ?");
    params.push(patch.printStatus);
  }

  if (fields.length === 0) return Promise.resolve();

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  const sql = `UPDATE uploaded_documents SET ${fields.join(", ")} WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function deleteDocumentRecord(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM uploaded_documents WHERE id = ?`, [id], (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
