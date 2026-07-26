// ============================================================
// PrintATM — Session Controller
// Handles session creation and deletion.
// ============================================================

import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { deleteSessionFiles } from '../services/fileService.js';
import { cleanupJob } from '../services/printerService.js';
import type { ApiResponse } from '../types/index.js';

import os from 'os';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Check for IPv4 and ensure it's not a loopback address
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * POST /api/sessions
 * Create a new print session.
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  const session = sessionService.create();
  const localIp = getLocalIpAddress();

  const response: ApiResponse = {
    success: true,
    data: {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      localIp,
    },
  };
  res.status(201).json(response);
}

/**
 * GET /api/sessions/:sessionId
 * Get the current state of a session.
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  let session = sessionService.get(sessionId);

  if (!session) {
    console.warn(`[Session Lookup FAIL] ID: "${sessionId}" not found. Active sessions in memory: ${sessionService.getAll().length}`);
    const response: ApiResponse = {
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    };
    res.status(404).json(response);
    return;
  }

  // Detect mobile scan request and mark scannedAt timestamp
  const isMobileReq = req.query.isMobile === 'true' || Boolean(req.headers['x-mobile-scan']);
  if (isMobileReq && !session.scannedAt) {
    session = sessionService.update(sessionId, { scannedAt: new Date() }) || session;
    console.log(`[Session] Phone scanned QR for session: ${sessionId}`);
  }

  console.log(`[Session Lookup OK] ID: "${sessionId}" - status: ${session.status}${session.scannedAt ? ' (Phone Connected)' : ''}`);

  const response: ApiResponse = {
    success: true,
    data: {
      sessionId: session.id,
      status: session.status,
      scannedAt: session.scannedAt,
      files: session.files,
      fileName: session.fileName,
      fileSize: session.fileSize,
      analysis: session.analysis,
      settings: session.settings,
      priceBreakdown: session.priceBreakdown,
      payment: session.payment
        ? {
            orderId: session.payment.orderId,
            amount: session.payment.amount,
            status: session.payment.status,
            upiString: session.payment.upiString,
          }
        : undefined,
      printJob: session.printJob,
      expiresAt: session.expiresAt,
    },
  };
  res.json(response);
}

/**
 * DELETE /api/sessions/:sessionId
 * Manually delete a session and all its files.
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const session = sessionService.get(sessionId);

  if (session?.printJob?.jobId) {
    cleanupJob(session.printJob.jobId);
  }

  await deleteSessionFiles(sessionId);
  sessionService.delete(sessionId);

  const response: ApiResponse = {
    success: true,
    data: { message: 'Session deleted successfully' },
  };
  res.json(response);
}
