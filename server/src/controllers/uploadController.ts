// ============================================================
// PrintATM — Upload Controller
// Handles single or multi-file uploads, magic-byte validation,
// document analysis, and session accumulation.
// ============================================================

import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../db/prisma.js';
import { sessionService } from '../services/sessionService.js';
import {
  analyzeDocument,
  convertToPdf,
  deleteSessionFiles,
  validateFileMagicBytes,
} from '../services/fileService.js';
import type { ApiResponse, UploadedFile, DocumentAnalysis } from '../types/index.js';

/**
 * POST /api/upload
 * Upload one or more documents for the current session.
 * Expects: multipart/form-data with file/files fields and `sessionId` in body/header/query.
 */
export async function uploadFile(req: Request, res: Response): Promise<void> {
  const sessionId = (req.body?.sessionId as string) || (req.headers['x-session-id'] as string);

  // Session validation
  const session = sessionService.get(sessionId);
  if (!session) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    };
    res.status(404).json(response);
    return;
  }

  // Collect uploaded files from req.files or req.file
  const rawFiles: Express.Multer.File[] = [];
  if (Array.isArray(req.files)) {
    rawFiles.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((fileArray) => {
      if (Array.isArray(fileArray)) rawFiles.push(...fileArray);
    });
  }
  if (req.file) {
    rawFiles.push(req.file);
  }

  if (rawFiles.length === 0) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'NO_FILE', message: 'No files were uploaded' },
    };
    res.status(400).json(response);
    return;
  }

  const newUploadedFiles: UploadedFile[] = [];

  for (const file of rawFiles) {
    // Security: validate magic bytes
    const isValidMagic = await validateFileMagicBytes(
      file.path,
      file.mimetype,
      file.originalname
    );

    if (!isValidMagic) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: `File "${file.originalname}" content does not match its declared type. Upload rejected.`,
        },
      };
      res.status(400).json(response);
      return;
    }

    // Process document and generate PDF preview version
    try {
      console.log(`[Upload] Generating PDF preview for "${file.originalname}"...`);
      const effectivePdfPath = await convertToPdf(file.path, file.mimetype);
      const pdfFileName = path.basename(effectivePdfPath);
      const pdfUrl = `/uploads/${sessionId}/${pdfFileName}`;
      const originalUrl = `/uploads/${sessionId}/${path.basename(file.path)}`;

      // Analyze the converted PDF document
      const analysis = await analyzeDocument(effectivePdfPath, 'application/pdf');

      const docItem: UploadedFile = {
        id: crypto.randomUUID(),
        filePath: file.path,           // Preserve 100% original file path
        pdfFilePath: effectivePdfPath, // Store converted PDF path for preview/print
        url: originalUrl,              // Preserve 100% original file URL
        previewUrl: pdfUrl,            // Converted PDF URL for preview
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,       // Preserve 100% original MIME type (e.g. .docx)
        pageCount: analysis.pageCount,
        colorPages: analysis.colorPages,
        bwPages: analysis.bwPages,
        orientation: analysis.orientation,
        paperSize: analysis.paperSize,
        isEstimate: false,
      };

      newUploadedFiles.push(docItem);

      // Persist document record into Database
      try {
        await prisma.sessionDocument.create({
          data: {
            id: docItem.id,
            sessionId,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            filePath: file.path,
            pageCount: analysis.pageCount,
            colorPages: analysis.colorPages,
            bwPages: analysis.bwPages,
            orientation: analysis.orientation,
            paperSize: analysis.paperSize,
            isEstimate: false,
          },
        });
        console.log(`[Upload] Document persisted to database: "${file.originalname}" (${file.mimetype}) -> PDF preview: ${pdfFileName}`);
      } catch (dbErr) {
        console.warn('[Upload] Database document log notice:', dbErr);
      }
    } catch (err) {
      console.error(`Failed to convert/analyze file ${file.originalname}`, err);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: `Could not process uploaded document: ${file.originalname}`,
        },
      };
      res.status(422).json(response);
      return;
    }
  }

  // Combine with existing session files (if any)
  const existingFiles = session.files || [];
  const allFiles = [...existingFiles, ...newUploadedFiles];

  // Calculate combined analysis
  const combinedPageCount = allFiles.reduce((sum, f) => sum + f.pageCount, 0);
  const combinedColorPages = allFiles.reduce((sum, f) => sum + f.colorPages, 0);
  const combinedBwPages = allFiles.reduce((sum, f) => sum + f.bwPages, 0);
  const hasEstimate = allFiles.some((f) => f.isEstimate);

  const combinedAnalysis: DocumentAnalysis = {
    pageCount: combinedPageCount,
    colorPages: combinedColorPages,
    bwPages: combinedBwPages,
    orientation: allFiles[0]?.orientation || 'portrait',
    paperSize: allFiles[0]?.paperSize || 'A4',
    isEstimate: hasEstimate,
  };

  const primaryFile = allFiles[0];
  const combinedFileName = allFiles.length > 1
    ? `${allFiles.length} files (${allFiles.map(f => f.fileName).join(', ')})`
    : primaryFile.fileName;
  const combinedFileSize = allFiles.reduce((sum, f) => sum + f.fileSize, 0);

  // Update session
  sessionService.update(sessionId, {
    status: 'analyzed',
    files: allFiles,
    filePath: primaryFile.filePath,
    fileName: combinedFileName,
    fileSize: combinedFileSize,
    mimeType: primaryFile.mimeType,
    analysis: combinedAnalysis,
  });

  const response: ApiResponse = {
    success: true,
    data: {
      fileName: combinedFileName,
      fileSize: combinedFileSize,
      files: allFiles,
      analysis: combinedAnalysis,
    },
  };
  res.status(200).json(response);
}
