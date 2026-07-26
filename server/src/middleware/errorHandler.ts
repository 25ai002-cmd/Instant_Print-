// ============================================================
// PrintATM — Global Error Handler Middleware
// Catches all unhandled errors and returns consistent JSON
// responses. Handles Multer errors specially.
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { ApiResponse } from '../types/index.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  // Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB ?? 100}MB`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Only one file is allowed per upload';
    }
    const response: ApiResponse = {
      success: false,
      error: { code: 'UPLOAD_ERROR', message },
    };
    res.status(400).json(response);
    return;
  }

  // Handle known application errors
  if (err.message.includes('not supported') || err.message.includes('Session ID')) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    };
    res.status(400).json(response);
    return;
  }

  // Generic server error
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : err.message,
    },
  };
  res.status(500).json(response);
}

/** 404 handler for unknown routes */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };
  res.status(404).json(response);
}
