// ============================================================
// PrintATM — Multer Upload Middleware
// Validates file type, enforces size limit, stores in
// session-specific directory: /uploads/{sessionId}/
// ============================================================

import multer from 'multer';
import path from 'path';
import type { Request } from 'express';
import { ALLOWED_MIME_TYPES, EXT_TO_MIME, ensureSessionDir } from '../services/fileService.js';

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '500', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: async (req: Request, _file, cb) => {
    // Extract session ID from body, headers (any casing), or query
    const sessionId = (req.body?.sessionId as string) || 
                      (req.headers['x-session-id'] as string) || 
                      (req.headers['sessionid'] as string) ||
                      (req.query?.sessionId as string);
    if (!sessionId) {
      cb(new Error('Session ID is required for file upload'), '');
      return;
    }
    try {
      const sessionDir = await ensureSessionDir(sessionId);
      cb(null, sessionDir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${safeBaseName}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedMime = Boolean(ALLOWED_MIME_TYPES[file.mimetype]);
  const isAllowedExt = Boolean(EXT_TO_MIME[ext]);

  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported: ${file.mimetype} (${ext}). Allowed: PDF, DOCX, PPTX, PNG, JPG`));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 50,
  },
});
