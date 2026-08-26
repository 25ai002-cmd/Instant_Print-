import { Router } from "express";
import QRCode from "qrcode";
import { sessionManager } from "../services/sessionManager";
import { printerDriver } from "../services/printerSimulator";
import { asyncHandler } from "../middleware/errorHandler";
import { getLocalWifiIp } from "../utils/network";

const router = Router();

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
      
      if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
        baseUrl = `${proto}://${host}`;
      } else {
        const wifiIp = getLocalWifiIp();
        baseUrl = wifiIp ? `http://${wifiIp}:4000` : host ? `${proto}://${host}` : "http://localhost:5173";
      }
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

/** Phone calls this when it first opens the upload link, locking the kiosk to 1 connected phone. */
router.post(
  "/session/:id/attach",
  asyncHandler(async (req, res) => {
    const { clientToken } = req.body as { clientToken?: string };
    const session = sessionManager.requireSession(req.params.id);

    // Single-user lock check: if another device is already attached, reject extra connections
    if (session.attachedClientToken && clientToken && session.attachedClientToken !== clientToken) {
      res.status(409).json({
        error: "Kiosk Busy: Another phone is currently connected to this PrintATM machine.",
        stage: "BUSY",
      });
      return;
    }

    const token = clientToken || session.attachedClientToken || req.ip || "phone_client";
    const updated = sessionManager.update(session.id, {
      stage: "AWAITING_UPLOAD",
      attachedClientToken: token,
    });

    res.json(updated);
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
