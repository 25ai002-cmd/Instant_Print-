import { Router } from "express";
import { sessionManager } from "../services/sessionManager";
import {
  checkPaymentStatus,
  createPayment,
  devSimulatePaymentResult,
  isLiveMode,
} from "../services/paymentService";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.post(
  "/create-payment",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const session = sessionManager.requireSession(sessionId);

    if (!session.price) {
      const err = new Error("Calculate a price before creating a payment");
      (err as any).statusCode = 400;
      throw err;
    }

    const payment = await createPayment(session.id, session.price.total);
    const updated = sessionManager.update(session.id, {
      payment,
      stage: "AWAITING_PAYMENT",
    });

    res.json({ session: updated, devMode: !isLiveMode() });
  })
);

/**
 * Polled by the phone UI while waiting on the QR. In production, Razorpay's
 * webhook would also hit this same session's payment status independently —
 * this endpoint just reports current truth from paymentService.
 */
router.post(
  "/verify-payment",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const session = sessionManager.requireSession(sessionId);

    if (!session.payment) {
      const err = new Error("No payment has been created for this session");
      (err as any).statusCode = 400;
      throw err;
    }

    const status = await checkPaymentStatus(session.payment);
    const payment = { ...session.payment, status };

    const stage =
      status === "PAID"
        ? "AWAITING_PAYMENT" // move to PRINTING only once /start-print is explicitly called
        : status === "FAILED" || status === "TIMED_OUT"
        ? "PAYMENT_FAILED"
        : session.stage;

    const updated = sessionManager.update(session.id, { payment, stage });
    res.json(updated);
  })
);

router.post(
  "/create-payment/retry",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const session = sessionManager.requireSession(sessionId);

    if (!session.price) {
      const err = new Error("Missing price for retry");
      (err as any).statusCode = 400;
      throw err;
    }

    const payment = await createPayment(session.id, session.price.total);
    const updated = sessionManager.update(session.id, { payment, stage: "AWAITING_PAYMENT" });
    res.json({ session: updated, devMode: !isLiveMode() });
  })
);

/**
 * Local-only convenience so the flow can be demoed end-to-end without live
 * Razorpay keys. Disabled automatically the moment RAZORPAY_KEY_ID/SECRET are set.
 */
router.post(
  "/dev/simulate-payment",
  asyncHandler(async (req, res) => {
    if (isLiveMode()) {
      res.status(403).json({ error: { message: "Simulation is disabled in live mode", code: "LIVE_MODE" } });
      return;
    }
    const { sessionId, result } = req.body as { sessionId: string; result: "PAID" | "FAILED" };
    const session = sessionManager.requireSession(sessionId);
    if (!session.payment) {
      const err = new Error("No payment to simulate");
      (err as any).statusCode = 400;
      throw err;
    }
    devSimulatePaymentResult(session.payment.orderId, result);
    res.status(204).send();
  })
);

export default router;
