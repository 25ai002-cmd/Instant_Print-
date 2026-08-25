import QRCode from "qrcode";
import { v4 as uuid } from "uuid";
import { PaymentInfo, PaymentStatus } from "../types/session";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require("razorpay");

const PAYMENT_WINDOW_MS = 3 * 60 * 1000; // 3 minute UPI payment window
const UPI_PAYEE_VPA = process.env.UPI_PAYEE_VPA ?? "printatm@upi";
const UPI_PAYEE_NAME = process.env.UPI_PAYEE_NAME ?? "PrintATM Kiosk";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const LIVE_MODE = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

const razorpayClient = LIVE_MODE
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

// In simulation mode we keep status in memory keyed by orderId so /verify-payment
// and a local dev-only "simulate" endpoint can flip it.
const simulatedStatuses = new Map<string, PaymentStatus>();

export async function createPayment(sessionId: string, amount: number): Promise<PaymentInfo> {
  const orderId = LIVE_MODE ? await createRazorpayOrder(amount) : `sim_order_${uuid()}`;
  const upiIntentUrl = buildUpiIntentUrl(orderId, amount);
  const qrImageDataUrl = await QRCode.toDataURL(upiIntentUrl, { margin: 1, width: 360 });

  if (!LIVE_MODE) {
    simulatedStatuses.set(orderId, "PENDING");
  }

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

async function createRazorpayOrder(amount: number): Promise<string> {
  const order = await razorpayClient.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    payment_capture: 1,
  });
  return order.id;
}

function buildUpiIntentUrl(orderId: string, amount: number): string {
  const params = new URLSearchParams({
    pa: UPI_PAYEE_VPA,
    pn: UPI_PAYEE_NAME,
    tr: orderId,
    am: amount.toFixed(2),
    cu: "INR",
    tn: "PrintATM kiosk print job",
  });
  return `upi://pay?${params.toString()}`;
}

export async function checkPaymentStatus(payment: PaymentInfo): Promise<PaymentStatus> {
  if (Date.now() > payment.expiresAt && payment.status === "PENDING") {
    return "TIMED_OUT";
  }

  if (LIVE_MODE) {
    // In production, Razorpay's webhook (POST /verify-payment) is the source of
    // truth. Polling here re-checks order status server-side as a fallback in
    // case a webhook delivery was delayed or missed.
    const order = await razorpayClient.orders.fetch(payment.orderId);
    if (order.status === "paid") return "PAID";
    if (order.status === "attempted") return "PENDING";
    return payment.status;
  }

  return simulatedStatuses.get(payment.orderId) ?? payment.status;
}

/** Dev-only helper — lets the mobile web UI's "simulate payment" button (non-production) resolve a fake order. */
export function devSimulatePaymentResult(orderId: string, result: "PAID" | "FAILED"): void {
  if (LIVE_MODE) return;
  simulatedStatuses.set(orderId, result);
}

export function isLiveMode(): boolean {
  return LIVE_MODE;
}

/** Verifies a Razorpay webhook/callback signature. Only meaningful in live mode. */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!LIVE_MODE) return true;
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");
  return expected === signature;
}
