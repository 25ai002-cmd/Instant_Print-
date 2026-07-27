// Re-export shared types directly on client for consistency
export type SessionStatus =
  | 'created'
  | 'uploaded'
  | 'analyzed'
  | 'configured'
  | 'payment_pending'
  | 'payment_verified'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type ColorMode = 'bw' | 'color';
export type SideMode = 'single' | 'double';
export type Orientation = 'portrait' | 'landscape' | 'mixed';
export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface DocumentAnalysis {
  pageCount: number;
  colorPages: number;
  bwPages: number;
  orientation: Orientation;
  paperSize: PaperSize;
  isEstimate: boolean;
}

export interface UploadedFile {
  id: string;
  filePath?: string;
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

export interface PrintSettings {
  copies: number;
  sides: SideMode;
  colorMode: ColorMode;
  paperSize: PaperSize;
  /** Optional page ranges. If empty/undefined, all pages are printed. */
  pageRanges?: PageRange[];
}

export interface PriceBreakdown {
  baseRatePerPage: number;
  colorSurchargePerPage: number;
  doubleSideDiscountFactor: number;
  paperSizeMultiplier: number;
  copies: number;
  totalPages: number;
  effectivePages: number;
  subtotal: number;
  total: number;
  currency: 'INR';
}

export interface PaymentInfo {
  orderId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  upiString?: string;
  createdAt: string;
}

export interface PrintJob {
  jobId: string;
  status: PrintJobStatus;
  progress: number;
  totalPages: number;
  printedPages: number;
  startedAt?: string;
  completedAt?: string;
  estimatedSeconds?: number;
  error?: string;
}

export interface PrintSession {
  id: string;
  status: SessionStatus;
  scannedAt?: string;
  files?: UploadedFile[];
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  analysis?: DocumentAnalysis;
  settings?: PrintSettings;
  priceBreakdown?: PriceBreakdown;
  payment?: PaymentInfo;
  printJob?: PrintJob;
  expiresAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
