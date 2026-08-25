import fs from "fs";
import AdmZip from "adm-zip";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
import { FileMeta, PaperSize } from "../types/session";

export class FileValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "image/png",
  "image/jpeg",
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB — plenty for a kiosk print job

export async function analyzeFile(params: {
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<FileMeta> {
  const { path, originalName, mimeType, sizeBytes } = params;

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `File is too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maximum allowed is 50MB.`
    );
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new FileValidationError(
      `Unsupported file type "${mimeType}". Please upload a PDF, DOCX, PPTX, PNG, or JPEG.`
    );
  }

  if (mimeType === "application/pdf") {
    return analyzePdf(path, originalName, mimeType, sizeBytes);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return analyzeDocx(path, originalName, mimeType, sizeBytes);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return analyzePptx(path, originalName, mimeType, sizeBytes);
  }
  // Images
  return analyzeImage(path, originalName, mimeType, sizeBytes);
}

async function analyzePdf(
  path: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number
): Promise<FileMeta> {
  const data = new Uint8Array(fs.readFileSync(path));

  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err: any) {
    if (err?.name === "PasswordException") {
      throw new FileValidationError("This PDF is password protected. Please upload an unlocked file.");
    }
    throw new FileValidationError("This PDF appears to be corrupted and could not be read.");
  }

  const pageCount = doc.numPages ?? 0;
  if (pageCount < 1) {
    throw new FileValidationError("This PDF has no readable pages.");
  }

  // Sample the first page's geometry for orientation; a full per-page pass isn't
  // needed for a kiosk-side estimate, and mixed orientation is rare in practice.
  let orientation: FileMeta["orientation"] = "PORTRAIT";
  let blankPageCount = 0;
  try {
    const firstPage = await doc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    orientation = viewport.width > viewport.height ? "LANDSCAPE" : "PORTRAIT";

    // Cheap blank-page heuristic: pages with (almost) no extractable text and no
    // operator list entries are very likely blank. This is a simulation-friendly
    // approximation — real hardware would rasterize and check pixel coverage.
    for (let i = 1; i <= pageCount; i++) {
      const page = i === 1 ? firstPage : await doc.getPage(i);
      const textContent = await page.getTextContent();
      const hasText = textContent.items.some((item: any) => (item.str ?? "").trim().length > 0);
      if (!hasText) blankPageCount++;
    }
  } catch {
    // Geometry/text sampling is best-effort; fall back to safe defaults.
  }

  return {
    originalName,
    storedPath: path,
    mimeType,
    sizeBytes,
    pageCount,
    colorPageCount: pageCount,
    bwPageCount: 0,
    blankPageCount,
    orientation,
    detectedPaperSize: "A4",
  };
}

async function analyzeDocx(
  path: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number
): Promise<FileMeta> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(path);
  } catch {
    throw new FileValidationError("This Word document appears to be corrupted.");
  }

  const docXmlEntry = zip.getEntry("word/document.xml");
  if (!docXmlEntry) {
    throw new FileValidationError("This file is not a valid DOCX document.");
  }

  const settingsEntry = zip.getEntry("word/settings.xml");
  const settingsXml = settingsEntry?.getData().toString("utf-8") ?? "";
  if (/w:documentProtection[^>]*w:enforcement="1"/.test(settingsXml)) {
    throw new FileValidationError("This document is protected/locked. Please upload an unlocked file.");
  }

  const xml = docXmlEntry.getData().toString("utf-8");

  // A true page count requires layout rendering (fonts, margins, etc.), which is
  // out of scope for a kiosk-side estimate. We approximate using explicit page
  // breaks (<w:br w:type="page"/>) plus a characters-per-page heuristic, and this
  // is clearly documented so it can be swapped for a real conversion pipeline
  // (e.g. LibreOffice headless) later without touching the frontend contract.
  const explicitBreaks = (xml.match(/<w:br[^>]*w:type="page"/g) ?? []).length;
  const textLength = xml.replace(/<[^>]+>/g, "").length;
  const CHARS_PER_PAGE = 3000;
  const estimatedByLength = Math.max(1, Math.ceil(textLength / CHARS_PER_PAGE));
  const pageCount = Math.max(explicitBreaks + 1, estimatedByLength);

  const orientationMatch = xml.match(/<w:pgSz[^>]*w:orient="landscape"/);

  return {
    originalName,
    storedPath: path,
    mimeType,
    sizeBytes,
    pageCount,
    colorPageCount: pageCount,
    bwPageCount: 0,
    blankPageCount: 0,
    orientation: orientationMatch ? "LANDSCAPE" : "PORTRAIT",
    detectedPaperSize: "A4",
  };
}

async function analyzePptx(
  path: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number
): Promise<FileMeta> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(path);
  } catch {
    throw new FileValidationError("This PowerPoint file appears to be corrupted.");
  }

  const slideEntries = zip
    .getEntries()
    .filter((e: any) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));

  if (slideEntries.length === 0) {
    throw new FileValidationError("This file is not a valid PPTX presentation.");
  }

  const presentationXmlEntry = zip.getEntry("ppt/presentation.xml");
  const presXml = presentationXmlEntry?.getData().toString("utf-8") ?? "";
  const sldSzMatch = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  let orientation: FileMeta["orientation"] = "LANDSCAPE";
  if (sldSzMatch) {
    const cx = parseInt(sldSzMatch[1], 10);
    const cy = parseInt(sldSzMatch[2], 10);
    orientation = cx >= cy ? "LANDSCAPE" : "PORTRAIT";
  }

  return {
    originalName,
    storedPath: path,
    mimeType,
    sizeBytes,
    pageCount: slideEntries.length,
    colorPageCount: slideEntries.length,
    bwPageCount: 0,
    blankPageCount: 0,
    orientation,
    detectedPaperSize: "A4",
  };
}

async function analyzeImage(
  path: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number
): Promise<FileMeta> {
  const buffer = fs.readFileSync(path);
  const dims = getImageDimensions(buffer, mimeType);
  if (!dims) {
    throw new FileValidationError("This image appears to be corrupted or unreadable.");
  }

  const orientation: FileMeta["orientation"] = dims.width >= dims.height ? "LANDSCAPE" : "PORTRAIT";
  const paperSize: PaperSize = "A4";

  return {
    originalName,
    storedPath: path,
    mimeType,
    sizeBytes,
    pageCount: 1,
    colorPageCount: 1, // photos default to color; user can force B/W at print time
    bwPageCount: 0,
    blankPageCount: 0,
    orientation,
    detectedPaperSize: paperSize,
  };
}

/** Minimal header-only dimension reader — no native deps required. */
function getImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  try {
    if (mimeType === "image/png") {
      if (buffer.length < 24) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    if (mimeType === "image/jpeg") {
      let offset = 2;
      if (buffer.readUInt16BE(0) !== 0xffd8) return null;
      while (offset < buffer.length) {
        if (buffer.readUInt16BE(offset) === 0xffc0 || buffer.readUInt16BE(offset) === 0xffc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
