// ============================================================
// PrintATM — Request Validation Middleware
// Lightweight validation helpers for request bodies.
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/index.js';

type Validator = (value: unknown) => string | undefined;

/**
 * Validate that required fields exist in req.body.
 * Returns 400 if any field fails validation.
 */
export function validateBody(
  schema: Record<string, Validator>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const errors: string[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      const err = validator(req.body?.[field]);
      if (err) errors.push(err);
    }

    if (errors.length > 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        },
      };
      res.status(400).json(response);
      return;
    }

    next();
  };
}

/** Common validators */
export const required =
  (name: string): Validator =>
  (val) => {
    if (val === undefined || val === null || val === '') {
      return `${name} is required`;
    }
    return undefined;
  };

export const isNumber =
  (name: string, min = 0, max = Infinity): Validator =>
  (val) => {
    const n = Number(val);
    if (isNaN(n)) return `${name} must be a number`;
    if (n < min) return `${name} must be at least ${min}`;
    if (n > max) return `${name} must be at most ${max}`;
    return undefined;
  };

export const isOneOf =
  (name: string, options: string[]): Validator =>
  (val) => {
    if (!options.includes(String(val))) {
      return `${name} must be one of: ${options.join(', ')}`;
    }
    return undefined;
  };

/** Ensure a session ID is present in body or headers */
export function requireSessionId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sessionId =
    (req.body?.sessionId as string | undefined) ||
    (req.query?.sessionId as string | undefined) ||
    (req.headers['x-session-id'] as string | undefined);

  if (!sessionId) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'SESSION_REQUIRED', message: 'Session ID is required' },
    };
    res.status(400).json(response);
    return;
  }

  // Attach to request for downstream handlers
  (req as Request & { sessionId: string }).sessionId = sessionId;
  next();
}
