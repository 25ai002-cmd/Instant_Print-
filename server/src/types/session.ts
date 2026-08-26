export type PaperSize = "A4" | "A3" | "Legal" | "Letter";
export type ColorMode = "BW" | "COLOR";
export type SidesMode = "SINGLE" | "DOUBLE";
export type PageRangeMode = "ALL" | "CUSTOM";

export type SessionStage =
  | "CREATED" // kiosk generated a session, waiting for phone to attach
  | "AWAITING_UPLOAD" // phone connected, waiting for file
  | "FILE_UPLOADED" // file analyzed, choosing options
  | "AWAITING_PAYMENT" // Razorpay UPI QR generated
  | "PAYMENT_FAILED"
  | "PRINTING"
  | "COMPLETED"
  | "ERROR"
  | "EXPIRED";

export interface FileMeta {
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  colorPageCount: number;
  bwPageCount: number;
  blankPageCount: number;
  orientation: "PORTRAIT" | "LANDSCAPE" | "MIXED";
  detectedPaperSize: PaperSize;
  accessCode?: string;
}

export interface PrintOptions {
  paperSize: PaperSize;
  copies: number;
  colorMode: ColorMode;
  sides: SidesMode;
  pageRangeMode: PageRangeMode;
  customPageRange?: string; // e.g. "1-3,5"
  pagesToPrint: number; // resolved count after applying range x copies is computed separately
}

export interface PriceBreakdown {
  bwPages: number;
  colorPages: number;
  bwRate: number;
  colorRate: number;
  copies: number;
  subtotal: number;
  doubleSidedDiscount: number;
  bulkDiscount: number;
  total: number;
  currency: "INR";
}

export type PaymentStatus =
  | "NONE"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "TIMED_OUT";

export interface PaymentInfo {
  orderId: string;
  qrImageDataUrl: string;
  upiIntentUrl: string;
  amount: number;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
}

export type PrinterState =
  | "IDLE"
  | "RECEIVING"
  | "PRINTING"
  | "COMPLETED"
  | "PAPER_EMPTY"
  | "OUT_OF_INK"
  | "OFFLINE"
  | "ERROR"
  | "PAUSED";

export interface PrintJobInfo {
  state: PrinterState;
  progressPercent: number;
  estimatedSecondsRemaining: number;
  error?: string;
}

export interface KioskSession {
  id: string;
  stage: SessionStage;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  attachedClientToken?: string;
  accessCode?: string;
  file?: FileMeta;
  options?: PrintOptions;
  price?: PriceBreakdown;
  payment?: PaymentInfo;
  printJob?: PrintJobInfo;
  errorMessage?: string;
}
