// ============================================================
// PrintATM Cloud SaaS Platform — Payment Controller
// Razorpay / UPI Order Creation, Server-Side Verification,
// PostgreSQL Persistence & Socket.IO Machine Real-Time Dispatch.
// ============================================================

import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { createOrder, verifyPaymentSignature } from '../services/paymentService.js';
import { inrToPaise } from '../services/priceService.js';
import { notifyMachineNewJob } from '../services/socketService.js';
import { prisma } from '../db/prisma.js';
import type { ApiResponse } from '../types/index.js';

/**
 * POST /api/create-payment
 */
export async function createPayment(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body as { sessionId: string };

  const session = sessionService.get(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    } satisfies ApiResponse);
    return;
  }

  if (!session.priceBreakdown) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_PRICE', message: 'Price not calculated. Please configure print settings first.' },
    } satisfies ApiResponse);
    return;
  }

  if (session.payment && session.payment.status === 'success') {
    res.status(409).json({
      success: false,
      error: { code: 'ALREADY_PAID', message: 'Payment already completed for this session.' },
    } satisfies ApiResponse);
    return;
  }

  try {
    const amountPaise = inrToPaise(session.priceBreakdown.total);
    const paymentInfo = await createOrder({ amount: amountPaise, sessionId });

    sessionService.update(sessionId, {
      status: 'payment_pending',
      payment: paymentInfo,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        orderId: paymentInfo.orderId,
        amount: paymentInfo.amount,
        amountInr: session.priceBreakdown.total,
        currency: paymentInfo.currency,
        upiString: paymentInfo.upiString,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        isDemoMode: process.env.ENABLE_RAZORPAY_LIVE !== 'true',
      },
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'PAYMENT_CREATE_FAILED', message: (err as Error).message },
    };
    res.status(502).json(response);
  }
}

/**
 * POST /api/verify-payment
 */
export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const {
    sessionId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body as {
    sessionId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };

  const session = sessionService.get(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
    } satisfies ApiResponse);
    return;
  }

  if (session.payment?.status === 'success') {
    res.json({ success: true, data: { alreadyVerified: true } } satisfies ApiResponse);
    return;
  }

  if (!session.payment || session.payment.orderId !== razorpayOrderId) {
    res.status(400).json({
      success: false,
      error: { code: 'ORDER_MISMATCH', message: 'Order ID does not match session' },
    } satisfies ApiResponse);
    return;
  }

  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isValid) {
    sessionService.update(sessionId, {
      payment: { ...session.payment, status: 'failed' },
      status: 'failed',
    });
    res.status(402).json({
      success: false,
      error: { code: 'PAYMENT_VERIFICATION_FAILED', message: 'Payment verification failed.' },
    } satisfies ApiResponse);
    return;
  }

  // 1. Mark session as verified
  sessionService.update(sessionId, {
    status: 'payment_verified',
    payment: {
      ...session.payment,
      status: 'success',
      razorpayPaymentId,
      razorpaySignature,
    },
  });

  // 2. Persist to PostgreSQL Database
  const targetMachineCode = process.env.DEFAULT_MACHINE_CODE || 'ATM001';
  let dbJobId = sessionId;

  try {
    const machine = await prisma.machine.findFirst({
      where: { machineCode: targetMachineCode },
    });

    if (machine && session.analysis && session.settings && session.priceBreakdown) {
      const jobCode = 'JOB-' + sessionId.slice(0, 6).toUpperCase();
      const fileUrl = session.filePath
        ? `${process.env.PUBLIC_API_URL || 'http://localhost:3002'}/api/machine/jobs/${sessionId}/file`
        : '';

      const createdJob = await prisma.printJob.create({
        data: {
          jobCode,
          sessionId,
          machineId: machine.id,
          fileUrl: session.filePath || '',
          fileName: session.fileName || 'document.pdf',
          fileSize: session.fileSize || 0,
          mimeType: session.mimeType || 'application/pdf',
          pageCount: session.analysis.pageCount,
          selectedPages: session.priceBreakdown.totalPages,
          pageRanges: session.settings.pageRanges ? JSON.stringify(session.settings.pageRanges) : null,
          colorMode: session.settings.colorMode,
          sides: session.settings.sides,
          paperSize: session.settings.paperSize,
          copies: session.settings.copies,
          totalPrice: session.priceBreakdown.total,
          status: 'PAYMENT_SUCCESS',
          payments: {
            create: {
              orderId: razorpayOrderId,
              paymentId: razorpayPaymentId,
              signature: razorpaySignature,
              amount: inrToPaise(session.priceBreakdown.total),
              status: 'SUCCESS',
            },
          },
        },
      });

      dbJobId = createdJob.id;

      // 3. Real-Time Push to ATM Machine via Socket.IO WebSockets!
      notifyMachineNewJob(targetMachineCode, {
        jobId: createdJob.id,
        jobCode: createdJob.jobCode,
        machineCode: targetMachineCode,
        downloadUrl: fileUrl,
        fileName: createdJob.fileName,
        pageCount: createdJob.pageCount,
        colorMode: createdJob.colorMode,
        sides: createdJob.sides,
        paperSize: createdJob.paperSize,
        copies: createdJob.copies,
        totalPrice: createdJob.totalPrice,
      });
    }
  } catch (dbErr) {
    console.warn('[Payment Controller] Database/Socket sync notice:', dbErr);
  }

  const response: ApiResponse = {
    success: true,
    data: { message: 'Payment verified successfully', jobId: dbJobId },
  };
  res.json(response);
}
