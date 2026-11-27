import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import AdmZip from "adm-zip";
import { PDFDocument } from "pdf-lib";

type SessionStage =
  | "CREATED"
  | "AWAITING_UPLOAD"
  | "FILE_UPLOADED"
  | "AWAITING_PAYMENT"
  | "PAYMENT_FAILED"
  | "PRINTING"
  | "COMPLETED"
  | "EXPIRED";

type PaperSize = "A4" | "Letter" | "Legal" | "A3";
type ColorMode = "BW" | "COLOR";
type Sides = "SINGLE" | "DOUBLE";
type PageRangeMode = "ALL" | "CUSTOM";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "TIMED_OUT";
type PrinterState = "IDLE" | "RECEIVING" | "PRINTING" | "COMPLETED" | "ERROR";

interface FileMeta {
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  colorPageCount: number;
  bwPageCount: number;
  blankPageCount: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
  detectedPaperSize: PaperSize;
  accessCode?: string;
}

interface PrintOptions {
  paperSize: PaperSize;
  colorMode: ColorMode;
  sides: Sides;
  copies: number;
  pageRangeMode: PageRangeMode;
  customPageRange?: string;
  pagesPerSheet?: 1 | 2 | 4;
}

interface PriceBreakdown {
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

interface PaymentInfo {
  orderId: string;
  qrImageDataUrl: string;
  upiIntentUrl: string;
  amount: number;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
}

interface PrintJobInfo {
  state: PrinterState;
  progressPercent: number;
  estimatedSecondsRemaining: number;
  startedAt?: number;
  errorMessage?: string;
}

interface KioskSession {
  id: string;
  stage: SessionStage;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  attachedClientToken?: string;
  accessCode?: string;
  spooledToPhysical?: boolean;
  file?: FileMeta;
  options?: PrintOptions;
  price?: PriceBreakdown;
  payment?: PaymentInfo;
  printJob?: PrintJobInfo;
}

const SESSION_TTL_MS = 60 * 60 * 1000;
const PAYMENT_WINDOW_MS = 3 * 60 * 1000;
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024; // Netlify Function body limit safe cap

const SESSIONS_STORE = "printatm-sessions";
const FILES_STORE = "printatm-files";
const CODES_STORE = "printatm-codes";

function blobStore(name: string) {
  return getStore({ name, consistency: "strong" });
}

const RATES = {
  BW_PER_PAGE: 2,
  COLOR_PER_PAGE: 10,
  PAPER_SIZE_MULTIPLIER: {
    A4: 1,
    Letter: 1,
    Legal: 1.2,
    A3: 2,
  } as const,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: { message, ...(code ? { code } : {}) } }, status);
}

function getBaseUrl(req: Request, clientOrigin?: string): string {
  if (process.env.MOBILE_BASE_URL) return process.env.MOBILE_BASE_URL.replace(/\/+$/, "");
  if (clientOrigin && /^https?:\/\/.+/.test(clientOrigin)) {
    try {
      const parsed = new URL(clientOrigin);
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return parsed.origin;
      }
    } catch {
      // ignore invalid origin
    }
  }
  const url = new URL(req.url);
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host).split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

async function getSession(id: string): Promise<KioskSession | null> {
  const store = blobStore(SESSIONS_STORE);
  const session = (await store.get(id, { type: "json" })) as KioskSession | null;
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    await store.delete(id);
    return null;
  }
  return session;
}

async function saveSession(session: KioskSession): Promise<KioskSession> {
  const store = blobStore(SESSIONS_STORE);
  const updated: KioskSession = {
    ...session,
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  await store.setJSON(updated.id, updated);
  return updated;
}

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function analyzeFileBuffer(
  buffer: Uint8Array,
  originalName: string,
  mimeType: string
): Promise<FileMeta> {
  const sizeBytes = buffer.byteLength;
  const lower = originalName.toLowerCase();

  let pageCount = 1;
  let orientation: "PORTRAIT" | "LANDSCAPE" = "PORTRAIT";
  let detectedPaperSize: PaperSize = "A4";

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = Math.max(1, pdfDoc.getPageCount());
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();
      orientation = width > height ? "LANDSCAPE" : "PORTRAIT";
      const maxDim = Math.max(width, height);
      if (maxDim > 950) detectedPaperSize = "A3";
      else if (maxDim > 870) detectedPaperSize = "Legal";
      else detectedPaperSize = "A4";
    } catch {
      pageCount = 1;
    }
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    try {
      const zip = new AdmZip(Buffer.from(buffer));
      const appXml = zip.readAsText("docProps/app.xml");
      const match = appXml.match(/<Pages>(\d+)<\/Pages>/);
      pageCount = match ? Math.max(1, parseInt(match[1], 10)) : 1;
    } catch {
      pageCount = 1;
    }
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    lower.endsWith(".pptx")
  ) {
    try {
      const zip = new AdmZip(Buffer.from(buffer));
      const slides = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
      pageCount = Math.max(1, slides.length);
      orientation = "LANDSCAPE";
    } catch {
      pageCount = 1;
    }
  } else if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg|tiff)$/i.test(lower)) {
    pageCount = 1;
  } else {
    pageCount = Math.max(1, Math.ceil(sizeBytes / 2500));
  }

  return {
    originalName,
    storedPath: originalName,
    mimeType: mimeType || "application/octet-stream",
    sizeBytes,
    pageCount,
    colorPageCount: pageCount,
    bwPageCount: 0,
    blankPageCount: 0,
    orientation,
    detectedPaperSize,
  };
}

function parsePageRange(range: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = range.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(totalPages, parseInt(rangeMatch[2], 10));
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= totalPages) pages.add(p);
    } else {
      throw new Error(`Invalid page range segment: "${part}"`);
    }
  }
  if (pages.size === 0) {
    throw new Error("Page range resolved to zero pages");
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function calculatePrice(file: FileMeta, options: PrintOptions): PriceBreakdown {
  const selectedPages =
    options.pageRangeMode === "ALL"
      ? Array.from({ length: file.pageCount }, (_, i) => i + 1)
      : parsePageRange(options.customPageRange ?? "", file.pageCount);

  const bwPagesPerCopy = options.colorMode === "COLOR" ? 0 : selectedPages.length;
  const colorPagesPerCopy = options.colorMode === "COLOR" ? selectedPages.length : 0;

  const sizeMultiplier = RATES.PAPER_SIZE_MULTIPLIER[options.paperSize] || 1;
  const bwRate = +(RATES.BW_PER_PAGE * sizeMultiplier).toFixed(2);
  const colorRate = +(RATES.COLOR_PER_PAGE * sizeMultiplier).toFixed(2);

  const copies = Math.max(1, options.copies);
  const bwPages = bwPagesPerCopy * copies;
  const colorPages = colorPagesPerCopy * copies;
  const subtotal = +(bwPages * bwRate + colorPages * colorRate).toFixed(2);

  return {
    bwPages,
    colorPages,
    bwRate,
    colorRate,
    copies,
    subtotal,
    doubleSidedDiscount: 0,
    bulkDiscount: 0,
    total: subtotal,
    currency: "INR",
  };
}

function isRazorpayLive(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function createRazorpayOrder(amount: number): Promise<string> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const resp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      payment_capture: 1,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Razorpay order creation failed: HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { id: string };
  return data.id;
}

async function fetchRazorpayOrderStatus(orderId: string): Promise<PaymentStatus> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const resp = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!resp.ok) return "PENDING";
  const order = (await resp.json()) as { status: string };
  if (order.status === "paid") return "PAID";
  return "PENDING";
}

async function buildPaymentInfo(amount: number): Promise<PaymentInfo> {
  const live = isRazorpayLive();
  const orderId = live ? await createRazorpayOrder(amount) : `sim_order_${randomUUID()}`;
  const upiVpa = process.env.UPI_PAYEE_VPA ?? "6353874452@ibl";
  const upiName = process.env.UPI_PAYEE_NAME ?? "PrintATM Kiosk";
  const params = new URLSearchParams({
    pa: upiVpa,
    pn: upiName,
    tr: orderId,
    am: amount.toFixed(2),
    cu: "INR",
    tn: "PrintATM kiosk print job",
  });
  const upiIntentUrl = `upi://pay?${params.toString()}`;
  const qrImageDataUrl = await QRCode.toDataURL(upiIntentUrl, { margin: 1, width: 360 });
  const now = Date.now();
  return {
    orderId,
    qrImageDataUrl,
    upiIntentUrl,
    amount,
    status: "PENDING",
    createdAt: now,
    expiresAt: now + PAYMENT_WINDOW_MS,
  };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  // Normalize path whether invoked via /api/... or /.netlify/functions/api/...
  const route = url.pathname
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "") || "/";

  try {
    // Health
    if (req.method === "GET" && route === "/health") {
      return jsonResponse({ status: "ok", service: "printatm-netlify-blobs" });
    }

    // POST /session
    if (req.method === "POST" && route === "/session") {
      const body = await req.json().catch(() => ({})) as { clientOrigin?: string };
      const now = Date.now();
      const session: KioskSession = {
        id: randomUUID(),
        stage: "CREATED",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };
      await saveSession(session);
      const baseUrl = getBaseUrl(req, body.clientOrigin);
      const mobileUrl = `${baseUrl}/upload/${session.id}`;
      const qrImageDataUrl = await QRCode.toDataURL(mobileUrl, { margin: 1, width: 480 });
      return jsonResponse({
        sessionId: session.id,
        mobileUrl,
        qrImageDataUrl,
        stage: session.stage,
      });
    }

    // GET /session/:id
    const sessionGetMatch = route.match(/^\/session\/([^/]+)$/);
    if (req.method === "GET" && sessionGetMatch) {
      const session = await getSession(sessionGetMatch[1]);
      if (!session) return errorResponse("Session not found or has expired", 404);
      return jsonResponse(session);
    }

    // DELETE /session/:id
    if (req.method === "DELETE" && sessionGetMatch) {
      const id = sessionGetMatch[1];
      await blobStore(SESSIONS_STORE).delete(id);
      await blobStore(FILES_STORE).delete(id);
      return new Response(null, { status: 204 });
    }

    // POST /session/:id/attach
    const attachMatch = route.match(/^\/session\/([^/]+)\/attach$/);
    if (req.method === "POST" && attachMatch) {
      const id = attachMatch[1];
      const session = await getSession(id);
      if (!session) return errorResponse("Session not found or has expired", 404);
      const { clientToken } = (await req.json().catch(() => ({}))) as { clientToken?: string };

      if (!session.attachedClientToken) {
        const updated = await saveSession({
          ...session,
          stage: "AWAITING_UPLOAD",
          attachedClientToken: clientToken || "phone_client",
        });
        return jsonResponse(updated);
      }

      if (clientToken && session.attachedClientToken !== clientToken) {
        const idleTimeMs = Date.now() - session.updatedAt;
        if (idleTimeMs > 3 * 60 * 1000) {
          const updated = await saveSession({
            ...session,
            stage: "AWAITING_UPLOAD",
            attachedClientToken: clientToken,
          });
          return jsonResponse(updated);
        }
        return jsonResponse(
          {
            error: "Kiosk Busy: Another phone is currently connected to this PrintATM machine.",
            stage: "BUSY",
          },
          409
        );
      }

      const updated = await saveSession({
        ...session,
        stage: session.stage === "CREATED" ? "AWAITING_UPLOAD" : session.stage,
        attachedClientToken: clientToken || session.attachedClientToken,
      });
      return jsonResponse(updated);
    }

    // POST /upload
    if (req.method === "POST" && route === "/upload") {
      const formData = await req.formData();
      const sessionId = formData.get("sessionId") as string | null;
      const fileEntry = formData.get("file");

      if (!sessionId) return errorResponse("sessionId is required", 400);
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);

      if (!fileEntry || typeof fileEntry === "string") {
        return errorResponse("No file was uploaded", 400);
      }

      const arrayBuffer = await fileEntry.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
        return errorResponse("File is too large for cloud upload (max 4.5MB).", 400, "FILE_TOO_LARGE");
      }

      const buffer = new Uint8Array(arrayBuffer);
      const meta = await analyzeFileBuffer(buffer, fileEntry.name, fileEntry.type);
      const accessCode = generateAccessCode();
      meta.accessCode = accessCode;

      await blobStore(FILES_STORE).set(sessionId, arrayBuffer, {
        metadata: { originalName: fileEntry.name, mimeType: meta.mimeType },
      });
      await blobStore(CODES_STORE).set(accessCode, sessionId);

      const updated = await saveSession({
        ...session,
        file: meta,
        accessCode,
        stage: "FILE_UPLOADED",
      });
      return jsonResponse(updated);
    }

    // GET /file/:sessionId/preview
    const previewMatch = route.match(/^\/file\/([^/]+)\/preview$/);
    if (req.method === "GET" && previewMatch) {
      const id = previewMatch[1];
      const session = await getSession(id);
      const fileBlob = await blobStore(FILES_STORE).getWithMetadata(id, { type: "arrayBuffer" });
      if (!fileBlob || !fileBlob.data) {
        return new Response("File not found", { status: 404 });
      }
      const mimeType =
        session?.file?.mimeType ||
        (fileBlob.metadata?.mimeType as string) ||
        "application/octet-stream";
      const fileName =
        session?.file?.originalName ||
        (fileBlob.metadata?.originalName as string) ||
        "document";
      return new Response(fileBlob.data, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // POST /calculate-price
    if (req.method === "POST" && route === "/calculate-price") {
      const { sessionId, options } = (await req.json()) as { sessionId: string; options: PrintOptions };
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);
      if (!session.file) return errorResponse("Upload a document before selecting print options", 400);
      if (!options || !options.paperSize || !options.colorMode || !options.sides) {
        return errorResponse("Print options are incomplete", 400);
      }

      const price = calculatePrice(session.file, options);
      const updated = await saveSession({ ...session, options, price });
      return jsonResponse({ session: updated, price });
    }

    // POST /create-payment or /create-payment/retry
    if (req.method === "POST" && (route === "/create-payment" || route === "/create-payment/retry")) {
      const { sessionId } = (await req.json()) as { sessionId: string };
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);
      if (!session.price) return errorResponse("Calculate a price before creating a payment", 400);

      const payment = await buildPaymentInfo(session.price.total);
      const updated = await saveSession({
        ...session,
        payment,
        stage: "AWAITING_PAYMENT",
      });
      return jsonResponse({ session: updated, devMode: !isRazorpayLive() });
    }

    // POST /verify-payment
    if (req.method === "POST" && route === "/verify-payment") {
      const { sessionId } = (await req.json()) as { sessionId: string };
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);
      if (!session.payment) return errorResponse("No payment has been created for this session", 400);

      let status = session.payment.status;
      if (Date.now() > session.payment.expiresAt && status === "PENDING") {
        status = "TIMED_OUT";
      } else if (isRazorpayLive() && status === "PENDING") {
        status = await fetchRazorpayOrderStatus(session.payment.orderId);
      }

      const payment = { ...session.payment, status };
      const stage =
        status === "FAILED" || status === "TIMED_OUT" ? "PAYMENT_FAILED" : session.stage;
      const updated = await saveSession({ ...session, payment, stage });
      return jsonResponse(updated);
    }

    // POST /dev/simulate-payment
    if (req.method === "POST" && route === "/dev/simulate-payment") {
      const { sessionId, result } = (await req.json()) as { sessionId: string; result: "PAID" | "FAILED" };
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);
      if (!session.payment) return errorResponse("No payment has been created for this session", 400);

      const payment: PaymentInfo = { ...session.payment, status: result };
      const stage: SessionStage = result === "FAILED" ? "PAYMENT_FAILED" : "AWAITING_PAYMENT";
      await saveSession({ ...session, payment, stage });
      return jsonResponse({ ok: true });
    }

    // POST /start-print
    if (req.method === "POST" && route === "/start-print") {
      const { sessionId } = (await req.json()) as { sessionId: string };
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);
      if (!session.payment || session.payment.status !== "PAID") {
        return errorResponse("Payment must be completed before printing", 400);
      }
      if (!session.price) return errorResponse("Missing price breakdown", 400);

      const totalPages = Math.max(1, session.price.bwPages + session.price.colorPages);
      const estSeconds = Math.max(8, Math.ceil(6 + totalPages * 3));
      const printJob: PrintJobInfo = {
        state: "RECEIVING",
        progressPercent: 15,
        estimatedSecondsRemaining: estSeconds,
        startedAt: Date.now(),
      };
      const updated = await saveSession({
        ...session,
        stage: "PRINTING",
        printJob,
      });
      return jsonResponse(updated);
    }

    // GET /print-status
    if (req.method === "GET" && route === "/print-status") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return errorResponse("sessionId query parameter is required", 400);
      const session = await getSession(sessionId);
      if (!session) return errorResponse("Session not found or has expired", 404);

      if (session.spooledToPhysical || session.stage === "COMPLETED") {
        const completedJob: PrintJobInfo = {
          state: "COMPLETED",
          progressPercent: 100,
          estimatedSecondsRemaining: 0,
        };
        return jsonResponse({ stage: "COMPLETED", printJob: completedJob });
      }

      if (session.stage === "PRINTING" && session.printJob) {
        const startedAt = session.printJob.startedAt || session.updatedAt;
        const elapsed = (Date.now() - startedAt) / 1000;
        const totalEst = Math.max(10, session.printJob.estimatedSecondsRemaining || 12);
        const progress = Math.min(90, Math.round(15 + (elapsed / totalEst) * 75));
        const remaining = Math.max(1, Math.ceil(totalEst - elapsed));
        return jsonResponse({
          stage: "PRINTING",
          printJob: {
            state: "PRINTING",
            progressPercent: progress,
            estimatedSecondsRemaining: remaining,
          },
        });
      }

      return jsonResponse({ stage: session.stage, printJob: session.printJob });
    }

    // GET /pending-print-jobs (Polled by laptop's local printer bridge on any Wi-Fi)
    if (req.method === "GET" && route === "/pending-print-jobs") {
      const baseUrl = getBaseUrl(req);
      const store = blobStore(SESSIONS_STORE);
      const { blobs } = await store.list();
      const pendingJobs = [];

      for (const blob of blobs) {
        const s = await getSession(blob.key);
        if (!s) continue;
        if (
          (s.stage === "PRINTING" || s.stage === "COMPLETED" || s.payment?.status === "PAID") &&
          s.file &&
          !s.spooledToPhysical
        ) {
          pendingJobs.push({
            sessionId: s.id,
            originalName: s.file.originalName,
            fileUrl: `${baseUrl}/api/file/${s.id}/preview`,
            totalPages: (s.price?.bwPages || 0) + (s.price?.colorPages || 0) || s.file.pageCount,
            colorMode: s.options?.colorMode || "BW",
            copies: s.options?.copies || 1,
            sides: s.options?.sides || "SINGLE",
            pageRangeMode: s.options?.pageRangeMode || "ALL",
            customPageRange: s.options?.pageRangeMode === "CUSTOM" ? s.options?.customPageRange : undefined,
            pagesPerSheet: s.options?.pagesPerSheet || 1,
          });
        }
      }

      return jsonResponse(pendingJobs);
    }

    // POST /mark-spooled (Called by laptop's local printer bridge after spooling)
    if (req.method === "POST" && route === "/mark-spooled") {
      const { sessionId } = (await req.json()) as { sessionId?: string };
      if (sessionId) {
        const session = await getSession(sessionId);
        if (session) {
          await saveSession({
            ...session,
            spooledToPhysical: true,
            stage: "COMPLETED",
            printJob: {
              state: "COMPLETED",
              progressPercent: 100,
              estimatedSecondsRemaining: 0,
            },
          });
        }
      }
      return jsonResponse({ success: true });
    }

    // Printer info endpoints (cloud mode)
    if (req.method === "GET" && (route === "/printer-info" || route === "/printers")) {
      return jsonResponse({
        connected: true,
        printerName: "Netlify Cloud Queue -> Local Laptop Printer",
        availablePrinters: ["Netlify Cloud Queue -> Local Laptop Printer"],
        activePrinter: "Netlify Cloud Queue -> Local Laptop Printer",
      });
    }

    if (req.method === "POST" && route === "/printer/select") {
      const { printerName } = (await req.json()) as { printerName: string };
      return jsonResponse({ success: true, activePrinter: printerName });
    }

    // DB Document access code endpoints
    if (req.method === "GET" && route === "/db/documents") {
      const store = blobStore(SESSIONS_STORE);
      const { blobs } = await store.list();
      const docs = [];
      for (const blob of blobs) {
        const s = await getSession(blob.key);
        if (s?.file && s.accessCode) {
          docs.push({
            id: s.id,
            access_code: s.accessCode,
            original_name: s.file.originalName,
            stored_path: s.file.storedPath,
            mime_type: s.file.mimeType,
            size_bytes: s.file.sizeBytes,
            page_count: s.file.pageCount,
            color_page_count: s.file.colorPageCount,
            bw_page_count: s.file.bwPageCount,
            blank_page_count: s.file.blankPageCount,
            orientation: s.file.orientation,
            detected_paper_size: s.file.detectedPaperSize,
            options_json: s.options ? JSON.stringify(s.options) : null,
            price_json: s.price ? JSON.stringify(s.price) : null,
            payment_status: s.payment?.status || "PENDING",
            print_status: s.stage === "COMPLETED" ? "COMPLETED" : "PENDING",
            created_at: s.createdAt,
            updated_at: s.updatedAt,
          });
        }
      }
      return jsonResponse(docs);
    }

    const codeMatch = route.match(/^\/db\/document\/code\/([^/]+)$/);
    if (req.method === "GET" && codeMatch) {
      const sessionId = await blobStore(CODES_STORE).get(codeMatch[1], { type: "text" });
      if (!sessionId) {
        return errorResponse("No document found matching this access code.", 404, "DOCUMENT_NOT_FOUND");
      }
      const s = await getSession(sessionId);
      if (!s?.file) {
        return errorResponse("No document found matching this access code.", 404, "DOCUMENT_NOT_FOUND");
      }
      return jsonResponse({
        id: s.id,
        access_code: s.accessCode,
        original_name: s.file.originalName,
        stored_path: s.file.storedPath,
        mime_type: s.file.mimeType,
        size_bytes: s.file.sizeBytes,
        page_count: s.file.pageCount,
        color_page_count: s.file.colorPageCount,
        bw_page_count: s.file.bwPageCount,
        blank_page_count: s.file.blankPageCount,
        orientation: s.file.orientation,
        detected_paper_size: s.file.detectedPaperSize,
        options_json: s.options ? JSON.stringify(s.options) : null,
        price_json: s.price ? JSON.stringify(s.price) : null,
        payment_status: s.payment?.status || "PENDING",
        print_status: s.stage === "COMPLETED" ? "COMPLETED" : "PENDING",
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      });
    }

    if (req.method === "POST" && route === "/db/load-session") {
      const { accessCode, kioskSessionId } = (await req.json()) as { accessCode: string; kioskSessionId?: string };
      if (!accessCode) return errorResponse("Access code is required", 400);
      const sourceId = await blobStore(CODES_STORE).get(accessCode, { type: "text" });
      if (!sourceId) return errorResponse("Document code not found.", 404, "DOCUMENT_NOT_FOUND");
      const sourceSession = await getSession(sourceId);
      if (!sourceSession?.file) return errorResponse("Document code not found.", 404, "DOCUMENT_NOT_FOUND");

      if (kioskSessionId && kioskSessionId !== sourceId) {
        const target = await getSession(kioskSessionId);
        if (target) {
          const fileData = await blobStore(FILES_STORE).getWithMetadata(sourceId, { type: "arrayBuffer" });
          if (fileData?.data) {
            await blobStore(FILES_STORE).set(kioskSessionId, fileData.data, { metadata: fileData.metadata });
          }
          const updated = await saveSession({
            ...target,
            file: sourceSession.file,
            accessCode: sourceSession.accessCode,
            options: sourceSession.options,
            price: sourceSession.price,
            payment: sourceSession.payment,
            stage: sourceSession.stage,
          });
          return jsonResponse(updated);
        }
      }
      return jsonResponse(sourceSession);
    }

    return errorResponse(`Route not found: ${req.method} ${route}`, 404);
  } catch (err: any) {
    console.error("[Netlify API Error]", err);
    return errorResponse(err?.message || "Internal server error", 500);
  }
};

export const config: Config = {
  path: "/api/*",
};
