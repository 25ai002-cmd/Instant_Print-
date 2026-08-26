export type PaperSize = "A4" | "A3" | "Legal" | "Letter";
export type ColorMode = "BW" | "COLOR";
export type SidesMode = "SINGLE" | "DOUBLE";
export type PageRangeMode = "ALL" | "CUSTOM";

export type SessionStage =
  | "CREATED"
  | "AWAITING_UPLOAD"
  | "FILE_UPLOADED"
  | "AWAITING_PAYMENT"
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
  pagesPerSheet?: number;
  pageRangeMode: PageRangeMode;
  customPageRange?: string;
  pagesToPrint: number;
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

export type PaymentStatus = "NONE" | "PENDING" | "PAID" | "FAILED" | "TIMED_OUT";

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
  accessCode?: string;
  file?: FileMeta;
  options?: PrintOptions;
  price?: PriceBreakdown;
  payment?: PaymentInfo;
  printJob?: PrintJobInfo;
  spooledToPhysical?: boolean;
  errorMessage?: string;
}

export interface DbDocumentRecord {
  id: string;
  access_code: string;
  session_id: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  size_bytes: number;
  page_count: number;
  color_page_count: number;
  bw_page_count: number;
  blank_page_count: number;
  orientation: string;
  detected_paper_size: string;
  options_json?: string;
  price_json?: string;
  payment_status: string;
  print_status: string;
  created_at: number;
  updated_at: number;
}
