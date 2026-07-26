// ============================================================
// PrintATM Cloud SaaS Platform — API Routing Matrix
// Aggregates Session, Machine, Admin, Upload, Payment & Print routes.
// ============================================================

import { Router } from 'express';
import { createSession, getSession, deleteSession, getSessionFile } from '../controllers/sessionController.js';
import { uploadFile } from '../controllers/uploadController.js';
import { calculatePriceHandler } from '../controllers/priceController.js';
import { createPayment, verifyPayment } from '../controllers/paymentController.js';
import { startPrint, getPrintStatus, cancelPrint } from '../controllers/printController.js';
import { authenticateMachine, getPendingJobs, downloadJobFile } from '../controllers/machineController.js';
import { getAdminDashboard, getMachines, updateMachinePricing } from '../controllers/adminController.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { validateBody, required, isOneOf } from '../middleware/validate.js';

const router = Router();

// ── Session Routes ──────────────────────────────────────────
router.post('/sessions', createSession);
router.get('/sessions/:sessionId', getSession);
router.get('/sessions/:sessionId/files/:fileName', getSessionFile);
router.delete('/sessions/:sessionId', deleteSession);

// ── Upload Routes ───────────────────────────────────────────
router.post('/upload', uploadMiddleware.any(), uploadFile);

// ── Price Calculation Routes ────────────────────────────────
router.post('/calculate-price', calculatePriceHandler);

// ── Payment Routes ──────────────────────────────────────────
router.post('/create-payment', createPayment);
router.post('/verify-payment', verifyPayment);

// ── Print Job Routes ────────────────────────────────────────
router.post('/print', startPrint);
router.get('/print-status', getPrintStatus);
router.post('/print/cancel', cancelPrint);

// ── Machine Kiosk APIs ──────────────────────────────────────
router.post('/machine/auth', authenticateMachine);
router.get('/machine/jobs/pending', getPendingJobs);
router.get('/machine/jobs/:jobId/file', downloadJobFile);

// ── Admin Dashboard SaaS APIs ───────────────────────────────
router.get('/admin/dashboard', getAdminDashboard);
router.get('/admin/machines', getMachines);
router.put('/admin/machines/:machineId/pricing', updateMachinePricing);

export default router;
