// ============================================================
// PrintATM — Payment Service
// Razorpay integration for order creation and verification.
// In DEMO_MODE, payment can be simulated without real keys.
// ============================================================

import crypto from 'crypto';
import type { PaymentInfo } from '../types/index.js';

/** Create a Razorpay-like order */
export interface CreateOrderParams {
  amount: number;   // in paise
  currency?: string;
  sessionId: string;
}

/**
 * Creates a payment order via Razorpay.
 * Falls back to mock order in demo mode.
 */
export async function createOrder(params: CreateOrderParams): Promise<PaymentInfo> {
  const { amount, currency = 'INR', sessionId } = params;
  const isLiveMode = process.env.ENABLE_RAZORPAY_LIVE === 'true';
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';

  // --- Real Razorpay Integration ---
  if (isLiveMode && keyId && keySecret && !keyId.startsWith('rzp_test_xxx')) {
    try {
      // Dynamic import so the server starts even without real Razorpay keys
      const Razorpay = (await import('razorpay')).default;
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const order = await razorpay.orders.create({
        amount,
        currency,
        receipt: `session_${sessionId.substring(0, 8)}`,
        notes: { sessionId },
      });

      const upiString = buildUpiString(amount / 100, String(order.id));

      return {
        orderId: String(order.id),
        amount,
        currency,
        status: 'pending',
        upiString,
        createdAt: new Date(),
      };
    } catch (err) {
      console.error('[PaymentService] Razorpay error:', err);
      throw new Error('Payment gateway error. Please try again.');
    }
  }

  // --- Demo / Simulation Mode ---
  console.log('[PaymentService] Demo mode: creating mock order');
  const mockOrderId = `order_demo_${Date.now()}`;
  const upiString = buildUpiString(amount / 100, mockOrderId);

  return {
    orderId: mockOrderId,
    amount,
    currency,
    status: 'pending',
    upiString,
    createdAt: new Date(),
  };
}

/**
 * Verify Razorpay payment signature on the backend.
 * This is the critical security step — never trust the frontend.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const isLiveMode = process.env.ENABLE_RAZORPAY_LIVE === 'true';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';

  // If not in live mode (no real Razorpay keys configured), always allow payment.
  // This enables seamless testing and demo kiosk operation.
  if (!isLiveMode) {
    console.log('[PaymentService] Demo/Test mode: payment auto-approved ✓');
    return true;
  }

  // Live mode: HMAC-SHA256 signature verification
  if (!keySecret || keySecret.startsWith('xxxxxxxx')) {
    console.warn('[PaymentService] Live mode enabled but no key secret configured — rejecting.');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Build a UPI deep-link string for QR code display.
 * Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
 */
function buildUpiString(amountInr: number, orderId: string): string {
  const vpa = encodeURIComponent(process.env.UPI_VPA ?? '6353874452@fam');
  const name = encodeURIComponent(process.env.UPI_MERCHANT_NAME ?? 'PrintATM');
  const amount = amountInr.toFixed(2);
  const note = encodeURIComponent(`PrintATM-${orderId.substring(0, 10)}`);
  return `upi://pay?pa=${vpa}&pn=${name}&am=${amount}&cu=INR&tn=${note}&mode=02&purpose=00`;
}
