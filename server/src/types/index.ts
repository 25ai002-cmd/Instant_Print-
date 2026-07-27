// ============================================================
// PrintATM — Shared TypeScript Types
// Server-side type definitions for sessions, documents,
// payments, and printer jobs.
// ============================================================

/** Lifecycle states of a customer print session */
export type SessionStatus =
  | 'created'         // Session initialized
  | 'uploaded'        // File uploaded
  | 'analyzed'        // Document analyzed
  | 'configured'      // Print settings selected
  | 'payment_pending' // Awaiting payment
  | 'payment_verified'// Payment confirmed on backend
  | 'printing'        // Print job in progress
  | 'completed'       // Print done, session being cleaned
  | 'failed'          // Terminal error
  | 'cancelled';      // User cancelled

export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type ColorMode = 'bw' | 'color';
export type SideMode = 'single' | 'double';
export type Orientation = 'portrait' | 'landscape' | 'mixed';
export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';

/** Result of analyzing the uploaded document */
export interface DocumentAnalysis {
  pageCount: number;
  colorPages: number;
  bwPages: number;
  orientation: Orientation;
  paperSize: PaperSize;
  /** True if the count is estimated (e.g. for DOCX/PPTX) */
  isEstimate: boolean;
}

/** Individual file metadata in a multi-file session */
export interface UploadedFile {
  id: string;
  filePath: string;
  pdfFilePath?: string;
  url?: string;
  previewUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  colorPages: number;
  bwPages: number;
  orientation: Orientation;
  paperSize: PaperSize;
  isEstimate: boolean;
}

/** A single inclusive page range, e.g. { from: 1, to: 5 } */
export interface PageRange {
  from: number; // 1-indexed, inclusive
  to: number;   // 1-indexed, inclusive
}

/** Customer's selected print preferences */
export interface PrintSettings {
  copies: number;
  sides: SideMode;
  colorMode: ColorMode;
  paperSize: PaperSize;
  /** Optional page ranges. If empty/undefined, all pages are printed. */
  pageRanges?: PageRange[];
}

/** Itemized price calculation */
export interface PriceBreakdown {
  baseRatePerPage: number;
  colorSurchargePerPage: number;
  doubleSideDiscountFactor: number;
  paperSizeMultiplier: number;
  copies: number;
  totalPages: number;
  effectivePages: number; // after double-side reduction
  subtotal: number;       // before rounding
  total: number;          // final amount in INR
  currency: 'INR';
}

/** Razorpay payment details */
export interface PaymentInfo {
  orderId: string;
  amount: number;   // in paise (₹1 = 100 paise)
  currency: string;
  status: 'pending' | 'success' | 'failed';
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  /** UPI deep-link string for QR code */
  upiString?: string;
  createdAt: Date;
}

/** State of a print job */
export interface PrintJob {
  jobId: string;
  status: PrintJobStatus;
  progress: number;       // 0–100
  totalPages: number;
  printedPages: number;
  startedAt?: Date;
  completedAt?: Date;
  estimatedSeconds?: number;
  error?: string;
}

/** The full in-memory session object */
export interface PrintSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  scannedAt?: Date;
  status: SessionStatus;
  // Multi-file support
  files?: UploadedFile[];
  // Primary File (backwards compatible)
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  // Derived
  analysis?: DocumentAnalysis;
  settings?: PrintSettings;
  priceBreakdown?: PriceBreakdown;
  payment?: PaymentInfo;
  printJob?: PrintJob;
}

/** Standard API error shape */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/** Pricing rate table */
export interface PricingConfig {
  bwRatePerPage: number;       // ₹ per page B&W
  colorRatePerPage: number;    // ₹ per page color
  doubleSideFactor: number;    // multiplier for double-sided (e.g. 0.6)
  a3Multiplier: number;
  legalMultiplier: number;
  letterMultiplier: number;
  minimumCharge: number;       // minimum total in ₹
}
