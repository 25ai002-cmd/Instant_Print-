import { Router } from "express";
import { sessionManager } from "../services/sessionManager";
import { printerDriver } from "../services/printerSimulator";
import { realBrotherPrinterDriver } from "../services/realPrinterDriver";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Endpoint to check hardware printer status
router.get(
  "/printer-info",
  asyncHandler(async (_req, res) => {
    const printerName = await realBrotherPrinterDriver.checkConnectedBrotherPrinter();
    res.json({
      connected: !!printerName,
      printerName: printerName || "No physical printer detected (simulation active)",
      port: "USB001",
    });
  })
);

router.post(
  "/start-print",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const session = sessionManager.requireSession(sessionId);

    if (!session.payment || session.payment.status !== "PAID") {
      const err = new Error("Payment must be completed before printing");
      (err as any).statusCode = 400;
      throw err;
    }
    if (!session.price) {
      const err = new Error("Missing price breakdown");
      (err as any).statusCode = 400;
      throw err;
    }

    const totalPhysicalPages = session.price.bwPages + session.price.colorPages;
    const filePath = session.file?.storedPath;

    // Use Real Brother Printer Driver if connected, otherwise fallback to simulator
    const activeDriver = realBrotherPrinterDriver.detectedPrinterName
      ? realBrotherPrinterDriver
      : printerDriver;

    activeDriver.startJob(session.id, totalPhysicalPages, filePath);

    const updated = sessionManager.update(session.id, {
      stage: "PRINTING",
      printJob: activeDriver.getState(session.id),
    });

    res.json(updated);
  })
);

router.get(
  "/print-status",
  asyncHandler(async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      const err = new Error("sessionId query parameter is required");
      (err as any).statusCode = 400;
      throw err;
    }
    const session = sessionManager.requireSession(sessionId);
    const activeDriver = realBrotherPrinterDriver.detectedPrinterName
      ? realBrotherPrinterDriver
      : printerDriver;

    const jobState = activeDriver.getState(sessionId);

    if (jobState) {
      const stage = jobState.state === "COMPLETED" ? "COMPLETED" : session.stage;
      sessionManager.update(sessionId, { printJob: jobState, stage });
    }

    res.json({
      stage: session.stage,
      printJob: jobState ?? session.printJob,
    });
  })
);

export default router;
