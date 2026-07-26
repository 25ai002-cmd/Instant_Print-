// ============================================================
// PrintATM — File Service
// Handles file validation, page analysis, and cleanup.
// Uses pdf-parse for PDF page counting.
// Estimates for DOCX/PPTX (LibreOffice not required for MVP).
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import type { DocumentAnalysis, Orientation, PaperSize } from '../types/index.js';

/** Map extensions to canonical MIME types */
export const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Supported MIME types */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/x-pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/webp': '.webp',
  'application/octet-stream': '.pdf', // Fallback dynamically resolved by extension
};

/** File type magic bytes for security validation */
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // PK (ZIP)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [[0x50, 0x4B, 0x03, 0x04]], // PK (ZIP)
  'image/png': [[0x89, 0x50, 0x4E, 0x47]], // PNG
  'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WEBP)
};

/**
 * Validate a file's magic bytes against declared MIME type or file extension.
 * Reads first 1024 bytes to support PDFs with BOMs or comments before %PDF.
 */
export async function validateFileMagicBytes(
  filePath: string,
  declaredMimeType: string,
  originalName: string = ''
): Promise<boolean> {
  const ext = path.extname(originalName).toLowerCase();
  const canonicalMime = EXT_TO_MIME[ext] || declaredMimeType;
  
  const buffer = Buffer.alloc(1024);
  let fd: fs.FileHandle | undefined;
  try {
    fd = await fs.open(filePath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
    const headerStr = buffer.toString('latin1', 0, bytesRead);

    if (ext === '.pdf' || canonicalMime === 'application/pdf') {
      // PDF specification allows %PDF anywhere within the first 1024 bytes
      return headerStr.includes('%PDF');
    }
    if (ext === '.docx' || ext === '.pptx' || canonicalMime.includes('officedocument')) {
      // Zip container magic bytes (PK\x03\x04 or PK\x05\x06)
      return buffer[0] === 0x50 && buffer[1] === 0x4B;
    }
    if (ext === '.png' || canonicalMime === 'image/png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    if (ext === '.jpg' || ext === '.jpeg' || canonicalMime.includes('jpeg') || canonicalMime.includes('jpg')) {
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    if (ext === '.webp' || canonicalMime === 'image/webp') {
      return headerStr.includes('WEBP');
    }

    return true;
  } catch {
    return false;
  } finally {
    await fd?.close();
  }
}

/**
 * Analyze a PDF file: extract page count, color info, etc.
 */
async function analyzePdf(filePath: string): Promise<DocumentAnalysis> {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    pageCount: data.numpages,
    // PDF-parse doesn't detect color; default to mixed estimate
    colorPages: Math.floor(data.numpages * 0.3),
    bwPages: Math.ceil(data.numpages * 0.7),
    orientation: 'portrait' as Orientation,
    paperSize: 'A4' as PaperSize,
    isEstimate: false,
  };
}

/**
 * Estimate page count for DOCX/PPTX by file size heuristic.
 * Average DOCX page: ~30KB. Average PPTX slide: ~100KB.
 */
async function analyzeOfficeDoc(
  filePath: string,
  mimeType: string
): Promise<DocumentAnalysis> {
  const stats = await fs.stat(filePath);
  const sizeKb = stats.size / 1024;

  let pageCount: number;
  if (mimeType.includes('wordprocessingml')) {
    pageCount = Math.max(1, Math.round(sizeKb / 30));
  } else {
    // PPTX — each slide is a page
    pageCount = Math.max(1, Math.round(sizeKb / 100));
  }

  return {
    pageCount,
    colorPages: Math.floor(pageCount * 0.4),
    bwPages: Math.ceil(pageCount * 0.6),
    orientation: 'portrait',
    paperSize: 'A4',
    isEstimate: true,
  };
}

/**
 * Images are always 1 page.
 */
function analyzeImage(): DocumentAnalysis {
  return {
    pageCount: 1,
    colorPages: 1,
    bwPages: 0,
    orientation: 'portrait',
    paperSize: 'A4',
    isEstimate: false,
  };
}

/**
 * Analyze an uploaded file and return its document properties.
 */
export async function analyzeDocument(
  filePath: string,
  mimeType: string
): Promise<DocumentAnalysis> {
  switch (mimeType) {
    case 'application/pdf':
      return analyzePdf(filePath);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return analyzeOfficeDoc(filePath, mimeType);
    case 'image/png':
    case 'image/jpeg':
    case 'image/jpg':
      return analyzeImage();
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

/**
 * Delete a session's upload directory and all its contents.
 */
export async function deleteSessionFiles(sessionId: string): Promise<void> {
  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  const sessionDir = path.join(uploadDir, sessionId);

  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    console.log(`[FileService] Deleted files for session: ${sessionId}`);
  } catch (err) {
    console.error(`[FileService] Error deleting files for session ${sessionId}:`, err);
  }
}

/**
 * Ensure the upload directory for a session exists.
 */
export async function ensureSessionDir(sessionId: string): Promise<string> {
  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  const sessionDir = path.join(uploadDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  return sessionDir;
}
