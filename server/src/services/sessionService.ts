// ============================================================
// PrintATM — Session Service with Disk Persistence
// In-memory session store backed by file persistence (.sessions.json)
// so sessions survive dev server restarts cleanly.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PrintSession, SessionStatus } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSIST_FILE = path.join(__dirname, '../../uploads/.sessions.json');

function getSessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_MINUTES;
  const mins = raw ? parseInt(raw, 10) : 15;
  return (isNaN(mins) || mins <= 0 ? 15 : mins) * 60 * 1000;
}

class SessionService {
  private readonly sessions = new Map<string, PrintSession>();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(PERSIST_FILE)) {
        const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
        const list: PrintSession[] = JSON.parse(raw);
        const now = new Date();
        let loaded = 0;
        for (const item of list) {
          const createdAt = new Date(item.createdAt);
          const expiresAt = new Date(item.expiresAt);
          if (now <= expiresAt) {
            this.sessions.set(item.id, {
              ...item,
              createdAt,
              expiresAt,
            });
            loaded++;
          }
        }
        if (loaded > 0) {
          console.log(`[Session] Restored ${loaded} active sessions from disk cache.`);
        }
      }
    } catch (err) {
      console.warn('[Session] Could not restore disk sessions:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(PERSIST_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(PERSIST_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Session] Failed to persist sessions to disk:', err);
    }
  }

  /**
   * Create a new blank session.
   */
  create(): PrintSession {
    const id = uuidv4();
    const now = new Date();
    const ttlMs = getSessionTtlMs();
    const session: PrintSession = {
      id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      status: 'created',
    };
    this.sessions.set(id, session);
    this.saveToDisk();
    console.log(`[Session] Created: ${id} (expires in ${ttlMs / 60000} min at ${session.expiresAt.toISOString()})`);
    return session;
  }

  /**
   * Retrieve a session by ID. Returns undefined if not found or expired.
   */
  get(id: string): PrintSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(id);
      this.saveToDisk();
      console.log(`[Session] Expired: ${id}`);
      return undefined;
    }

    return session;
  }

  /**
   * Partially update a session.
   */
  update(id: string, updates: Partial<PrintSession>): PrintSession | undefined {
    const session = this.get(id);
    if (!session) return undefined;
    const updated: PrintSession = { ...session, ...updates };
    this.sessions.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  /**
   * Update the status of a session.
   */
  setStatus(id: string, status: SessionStatus): PrintSession | undefined {
    return this.update(id, { status });
  }

  /**
   * Delete a session immediately.
   */
  delete(id: string): boolean {
    const existed = this.sessions.has(id);
    this.sessions.delete(id);
    if (existed) {
      this.saveToDisk();
      console.log(`[Session] Deleted: ${id}`);
    }
    return existed;
  }

  /**
   * Return all active sessions (for admin/monitoring).
   */
  getAll(): PrintSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Start a background interval to garbage-collect expired sessions.
   */
  startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      let cleaned = 0;
      for (const [id, session] of this.sessions.entries()) {
        if (now > new Date(session.expiresAt)) {
          this.sessions.delete(id);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        this.saveToDisk();
        console.log(`[Session] GC: removed ${cleaned} expired sessions`);
      }
    }, 60_000); // every 60 seconds
  }
}

export const sessionService = new SessionService();
