// ============================================================
// PrintATM — Price Controller
// Calculates and returns the price for a print job based
// on the session's analysis and the customer's settings.
// ============================================================

import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { calculatePrice } from '../services/priceService.js';
import type { ApiResponse, PrintSettings } from '../types/index.js';

/**
 * POST /api/calculate-price
 * Body: { sessionId, copies, sides, colorMode, paperSize, pageRanges? }
 */
export async function calculatePriceHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, copies, sides, colorMode, paperSize, pageRanges } = req.body as {
    sessionId: string;
    copies: number;
    sides: 'single' | 'double';
    colorMode: 'bw' | 'color';
    paperSize: 'A4' | 'A3' | 'Letter' | 'Legal';
    pageRanges?: Array<{ from: number; to: number }>;
  };

  const session = sessionService.get(sessionId);
  if (!session) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    };
    res.status(404).json(response);
    return;
  }

  if (!session.analysis) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'NO_ANALYSIS', message: 'Please upload a document first' },
    };
    res.status(400).json(response);
    return;
  }

  const settings: PrintSettings = {
    copies: Math.max(1, Math.min(50, Number(copies))),
    sides,
    colorMode,
    paperSize,
    // Only store valid, non-empty ranges
    pageRanges: Array.isArray(pageRanges) && pageRanges.length > 0 ? pageRanges : undefined,
  };

  const priceBreakdown = calculatePrice(session.analysis, settings);

  // Save settings and price in session
  sessionService.update(sessionId, {
    status: 'configured',
    settings,
    priceBreakdown,
  });

  const response: ApiResponse = {
    success: true,
    data: { settings, priceBreakdown },
  };
  res.json(response);
}
