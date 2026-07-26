// ============================================================
// PrintATM — Convert Preview Controller
// On-demand server-side DOCX/PPTX → PDF conversion for preview.
// Uses Windows Word COM (fast, 100% fidelity) with LibreOffice fallback.
// The converted PDF is served via /uploads/<sessionId>/<filename>.pdf
// ============================================================

import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { sessionService } from '../services/sessionService.js';
import { convertToPdf } from '../services/fileService.js';
import type { ApiResponse } from '../types/index.js';

/**
 * POST /api/convert-preview
 * Body: { sessionId, fileId }
 * Converts the requested session file to PDF on demand and returns
 * the URL of the converted PDF.
 */
export async function convertPreview(req: Request, res: Response): Promise<void> {
  const { sessionId, fileId } = req.body as { sessionId: string; fileId: string };

  const session = sessionService.get(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    } satisfies ApiResponse);
    return;
  }

  const file = session.files?.find((f) => f.id === fileId);
  if (!file) {
    res.status(404).json({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: 'File not found in session' },
    } satisfies ApiResponse);
    return;
  }

  // Already a PDF — return the existing URL
  if (file.mimeType === 'application/pdf' || file.filePath.endsWith('.pdf')) {
    res.json({
      success: true,
      data: { pdfUrl: file.url },
    } satisfies ApiResponse);
    return;
  }

  // Check if we already have a converted PDF cached
  const cachedPdfPath = `${file.filePath}.pdf`;
  const cachedExists = await fs.stat(cachedPdfPath).then(() => true).catch(() => false);
  if (cachedExists) {
    const pdfUrl = `/uploads/${sessionId}/${path.basename(cachedPdfPath)}`;
    res.json({ success: true, data: { pdfUrl } } satisfies ApiResponse);
    return;
  }

  // Convert now (Word COM on Windows, LibreOffice on Linux)
  try {
    const pdfPath = await convertToPdf(file.filePath, file.mimeType);
    if (pdfPath === file.filePath) {
      // Conversion unavailable — return original file URL so client can fallback to docx-preview
      res.json({
        success: true,
        data: { pdfUrl: null, fallback: true },
      } satisfies ApiResponse);
      return;
    }

    const pdfUrl = `/uploads/${sessionId}/${path.basename(pdfPath)}`;
    res.json({ success: true, data: { pdfUrl } } satisfies ApiResponse);
  } catch (err) {
    console.error('[ConvertPreview] Conversion error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CONVERSION_FAILED', message: 'Could not convert document to PDF' },
    } satisfies ApiResponse);
  }
}
