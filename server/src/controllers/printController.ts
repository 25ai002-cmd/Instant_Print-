// ============================================================
// PrintATM — Print Controller
// Handles print job submission and status polling.
// Triggers automatic session cleanup after completion.
// ============================================================

import path from 'path';
import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { submitPrintJob, getJobStatus, cancelJob } from '../services/printerService.js';
import { convertToPdf, deleteSessionFiles } from '../services/fileService.js';
import { notifyMachineNewJob } from '../services/socketService.js';
import { prisma } from '../db/prisma.js';
import type { ApiResponse } from '../types/index.js';

/**
 * POST /api/print
 * Submits the print job for a verified session.
 * Body: { sessionId }
 */
export async function startPrint(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body as { sessionId: string };

  const session = sessionService.get(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    } satisfies ApiResponse);
    return;
  }

  // Security: only allow printing after verified payment
  if (session.payment?.status !== 'success') {
    res.status(402).json({
      success: false,
      error: { code: 'PAYMENT_REQUIRED', message: 'Payment must be verified before printing' },
    } satisfies ApiResponse);
    return;
  }

  // Prevent duplicate print jobs
  if (session.printJob && ['queued', 'printing'].includes(session.printJob.status)) {
    res.json({
      success: true,
      data: { printJob: session.printJob, alreadyPrinting: true },
    } satisfies ApiResponse);
    return;
  }

  if (!session.filePath || !session.settings || !session.analysis) {
    res.status(400).json({
      success: false,
      error: { code: 'SESSION_INCOMPLETE', message: 'Session data is incomplete' },
    } satisfies ApiResponse);
    return;
  }

  // Gather all files (multi-file support)
  const filesToPrint = session.files && session.files.length > 0
    ? session.files
    : [{ filePath: session.filePath!, fileName: session.fileName ?? 'document', pageCount: session.analysis.pageCount }];

  try {
    // Print each file sequentially, converting non-PDF to PDF at print time
    let lastPrintJob: any = null;
    for (const f of filesToPrint) {
      // Use pre-converted PDF path if available, or convert at print time
      const effectivePath = (f as any).pdfFilePath || await convertToPdf(f.filePath, (f as any).mimeType ?? '');
      const printJob = await submitPrintJob({
        filePath: effectivePath,
        fileName: f.fileName,
        pageCount: f.pageCount,
        copies: session.settings.copies,
        colorMode: session.settings.colorMode,
        sides: session.settings.sides,
        paperSize: session.settings.paperSize,
        pageRanges: session.settings.pageRanges,
      });
      lastPrintJob = printJob;
    }

    sessionService.update(sessionId, {
      status: 'printing',
      printJob: lastPrintJob,
    });

    // Notify connected Kiosk Hardware Agent over WebSocket
    const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const fileBasename = path.basename(lastPrintJob?.filePath || session.filePath || '');
    const fileUrl = `${publicUrl}/uploads/${sessionId}/${fileBasename}`;

    notifyMachineNewJob('ATM001', {
      jobId: lastPrintJob.jobId,
      jobCode: lastPrintJob.jobId.slice(0, 8).toUpperCase(),
      fileUrl,
      filePath: lastPrintJob.filePath,
      fileName: session.fileName ?? 'document.pdf',
      copies: session.settings.copies,
      sides: session.settings.sides,
      colorMode: session.settings.colorMode,
      paperSize: session.settings.paperSize,
      pageRanges: session.settings.pageRanges,
    });

    const response: ApiResponse = {
      success: true,
      data: { printJob: lastPrintJob },
    };
    res.json(response);
  } catch (err) {
    res.status(503).json({
      success: false,
      error: { code: 'PRINTER_ERROR', message: (err as Error).message },
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/print-status?sessionId=xxx
 * Poll the current status of a print job.
 * Auto-cleans session when job is completed.
 */
export async function getPrintStatus(req: Request, res: Response): Promise<void> {
  const sessionId = req.query.sessionId as string;

  const session = sessionService.get(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    } satisfies ApiResponse);
    return;
  }

  if (!session.printJob) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_PRINT_JOB', message: 'No active print job for this session' },
    } satisfies ApiResponse);
    return;
  }

  // Get the latest job status from the printer service
  const liveJob = getJobStatus(session.printJob.jobId) ?? session.printJob;

  // Update session with latest job state
  sessionService.update(sessionId, { printJob: liveJob });

  // ──────────────────────────────────────────────────────────
  // AUTO-CLEANUP: When job completes, delete files & database entries
  // ──────────────────────────────────────────────────────────
  if (liveJob.status === 'completed') {
    sessionService.setStatus(sessionId, 'completed');
    // Non-blocking cleanup — runs after response is sent
    setImmediate(async () => {
      // 1. Delete uploaded files from disk
      await deleteSessionFiles(sessionId);

      // 2. Delete database records for session documents and print jobs
      try {
        await prisma.sessionDocument.deleteMany({ where: { sessionId } });
        await prisma.printJob.deleteMany({ where: { sessionId } });
        console.log(`[Print Controller] Deleted session documents & jobs from database for: ${sessionId}`);
      } catch (dbErr) {
        console.warn('[Print Controller] Database cleanup notice:', dbErr);
      }

      // 3. Clear session from memory
      sessionService.delete(sessionId);
      console.log(`[Print] Session fully ended & cleaned up after print: ${sessionId}`);
    });
  }

  const response: ApiResponse = {
    success: true,
    data: { printJob: liveJob },
  };
  res.json(response);
}

/**
 * POST /api/print/cancel
 * Cancel an in-progress print job.
 * Body: { sessionId }
 */
export async function cancelPrint(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body as { sessionId: string };
  const session = sessionService.get(sessionId);

  if (!session?.printJob) {
    res.status(404).json({
      success: false,
      error: { code: 'NO_JOB', message: 'No active print job found' },
    } satisfies ApiResponse);
    return;
  }

  cancelJob(session.printJob.jobId);
  sessionService.setStatus(sessionId, 'cancelled');

  const response: ApiResponse = {
    success: true,
    data: { message: 'Print job cancelled' },
  };
  res.json(response);
}
