// ============================================================
// PrintATM — File Service
// Handles file validation, page analysis, and cleanup.
// Uses pdf-parse for PDF page counting.
// Estimates for DOCX/PPTX (LibreOffice not required for MVP).
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import libre from 'libreoffice-convert';
import util from 'util';
import { exec } from 'child_process';
import type { DocumentAnalysis, Orientation, PaperSize } from '../types/index.js';

const libreConvert = util.promisify(libre.convert);
const execAsync = util.promisify(exec);

/**
 * Convert any uploaded file (.docx, .pptx, .png, .jpg, .jpeg, .webp) to PDF internally
 */
export async function convertToPdf(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  // If already PDF, return original file path
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return filePath;
  }

  const absoluteInputPath = path.resolve(filePath);
  const pdfPath = `${absoluteInputPath}.pdf`;

  // 1. Convert Images (PNG, JPG, WEBP) -> PDF
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    try {
      const pdfDoc = await PDFDocument.create();
      const imageBytes = await fs.readFile(absoluteInputPath);
      let image;
      if (ext === '.png' || mimeType === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
      console.log(`[PDF Converter] Converted image ${absoluteInputPath} -> ${pdfPath}`);
      return pdfPath;
    } catch (err) {
      console.warn('[PDF Converter] Image to PDF conversion warning:', err);
      return absoluteInputPath;
    }
  }

  // 2. Convert Office Docs (.docx, .pptx) -> PDF
  if (mimeType.includes('officedocument') || ['.docx', '.pptx', '.doc', '.ppt'].includes(ext)) {
    // Primary on Windows: Try PowerShell Microsoft Word COM automation
    if (process.platform === 'win32') {
      try {
        const escapedPath = absoluteInputPath.replace(/'/g, "''");
        const escapedPdf = pdfPath.replace(/'/g, "''");
        const psCmd = `powershell -Command "$word = New-Object -ComObject Word.Application; $word.Visible = $false; $doc = $word.Documents.Open('${escapedPath}'); $doc.SaveAs([ref]'${escapedPdf}', [ref]17); $doc.Close(); $word.Quit()"`;
        console.log(`[PDF Converter] Windows Word COM converting ${absoluteInputPath} -> ${pdfPath}...`);
        await execAsync(psCmd);
        const exists = await fs.stat(pdfPath).then(() => true).catch(() => false);
        if (exists) {
          console.log(`[PDF Converter] Windows Word COM conversion successful: ${pdfPath}`);
          return pdfPath;
        }
      } catch (winErr) {
        console.warn('[PDF Converter] Windows Word COM conversion fallback:', winErr);
      }
    }

    // Secondary: libreoffice-convert buffer conversion
    try {
      const docBuffer = await fs.readFile(absoluteInputPath);
      const pdfBuffer = await libreConvert(docBuffer, '.pdf', undefined);
      await fs.writeFile(pdfPath, pdfBuffer);
      console.log(`[PDF Converter] Converted office doc ${absoluteInputPath} -> ${pdfPath}`);
      return pdfPath;
    } catch (libreErr) {
      console.warn('[PDF Converter] libreoffice-convert buffer failed, trying CLI...', libreErr);
      try {
        const outDir = path.dirname(absoluteInputPath);
        await execAsync(`libreoffice --headless --convert-to pdf --outdir "${outDir}" "${absoluteInputPath}"`);
        const generatedPdf = absoluteInputPath.replace(/\.[^/.]+$/, '.pdf');
        const exists = await fs.stat(generatedPdf).then(() => true).catch(() => false);
        if (exists) {
          console.log(`[PDF Converter] Converted CLI office doc ${absoluteInputPath} -> ${generatedPdf}`);
          return generatedPdf;
        }
      } catch (cliErr) {
        console.warn('[PDF Converter] CLI libreoffice conversion unavailable:', cliErr);
      }
    }

    // Tertiary: Fallback PDF builder from DOCX text using pdf-lib & JSZip
    if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
      const fallbackPdf = await createFallbackPdfFromDocx(absoluteInputPath, pdfPath);
      if (fallbackPdf && fallbackPdf !== absoluteInputPath) {
        return fallbackPdf;
      }
    }
  }

  return absoluteInputPath;
}

/**
 * Fallback PDF creator using JSZip text extraction and pdf-lib layout rendering
 */
async function createFallbackPdfFromDocx(inputPath: string, outputPath: string): Promise<string> {
  try {
    const data = await fs.readFile(inputPath);
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file('word/document.xml')?.async('string');

    let textLines: string[] = [];
    if (docXml) {
      const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
      if (matches) {
        const fullText = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
        textLines = fullText.split(/(?<=[.!?])\s+|\n+/);
      }
    }

    if (textLines.length === 0) {
      textLines = ['[Document Content]'];
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { height } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const fontSize = 11;
    const lineHeight = 16;

    for (const line of textLines) {
      const cleanLine = line.replace(/[^\x20-\x7E]/g, ' ').trim();
      if (!cleanLine) continue;

      for (let i = 0; i < cleanLine.length; i += 80) {
        const chunk = cleanLine.substring(i, i + 80);
        if (y < margin + fontSize) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - margin;
        }
        page.drawText(chunk, {
          x: margin,
          y,
          size: fontSize,
        });
        y -= lineHeight;
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
    console.log(`[PDF Converter] Created fallback PDF from DOCX: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.warn('[PDF Converter] Fallback PDF generation warning:', err);
    return inputPath;
  }
}

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

import JSZip from 'jszip';

async function getDocxExactPageCount(filePath: string): Promise<number | null> {
  try {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    const appXml = await zip.file('docProps/app.xml')?.async('string');
    if (appXml) {
      const match = appXml.match(/<Pages>(\d+)<\/Pages>/i);
      if (match && match[1]) {
        const p = parseInt(match[1], 10);
        if (p > 0) return p;
      }
    }
  } catch (e) {
    console.warn('[Docx Page Count Warning]:', e);
  }
  return null;
}

/**
 * Estimate or extract exact page count for DOCX/PPTX.
 */
async function analyzeOfficeDoc(
  filePath: string,
  mimeType: string
): Promise<DocumentAnalysis> {
  const stats = await fs.stat(filePath);
  const sizeKb = stats.size / 1024;

  let pageCount: number | null = null;

  if (mimeType.includes('wordprocessingml')) {
    pageCount = await getDocxExactPageCount(filePath);
    if (!pageCount) {
      pageCount = Math.max(1, Math.round(sizeKb / 30));
    }
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
    isEstimate: false,
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
