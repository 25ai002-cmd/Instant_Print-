import { Router } from "express";
import QRCode from "qrcode";
import { sessionManager } from "../services/sessionManager";
import { printerDriver } from "../services/printerSimulator";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

const MOBILE_BASE_URL = process.env.MOBILE_BASE_URL ?? "http://localhost:5173";

/**
 * Kiosk calls this on load (and again after every reset) to mint a fresh
 * session and get a QR code pointing the customer's phone at the upload page.
 */
router.post(
  "/session",
  asyncHandler(async (req, res) => {
    const session = sessionManager.create();
    
    let baseUrl = process.env.MOBILE_BASE_URL;
    if (!baseUrl) {
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
      baseUrl = host ? `${proto}://${host}` : "http://localhost:5173";
    }

    const mobileUrl = `${baseUrl}/upload/${session.id}`;
    const qrImageDataUrl = await QRCode.toDataURL(mobileUrl, { margin: 1, width: 480 });

    res.json({
      sessionId: session.id,
      mobileUrl,
      qrImageDataUrl,
      stage: session.stage,
    });
  })
);

/** Both the kiosk display and the phone poll this to stay in sync on session state. */
router.get(
  "/session/:id",
  asyncHandler(async (req, res) => {
    const session = sessionManager.requireSession(req.params.id);
    res.json(session);
  })
);

/** Phone calls this when it first opens the upload link, to move past CREATED. */
router.post(
  "/session/:id/attach",
  asyncHandler(async (req, res) => {
    const session = sessionManager.setStage(req.params.id, "AWAITING_UPLOAD");
    res.json(session);
  })
);

/**
 * Called after collection countdown finishes (or on explicit cancel). Wipes the
 * uploaded file, payment session, and all in-memory state for this customer.
 */
router.delete(
  "/session/:id",
  asyncHandler(async (req, res) => {
    printerDriver.cancelJob(req.params.id);
    sessionManager.destroy(req.params.id);
    res.status(204).send();
  })
);

export default router;
