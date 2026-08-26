import { Router } from "express";
import { sessionManager } from "../services/sessionManager";
import { printerDriver } from "../services/printerSimulator";
import { realBrotherPrinterDriver } from "../services/realPrinterDriver";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Endpoint to list all installed hardware physical printers
router.get(
  "/printers",
  asyncHandler(async (_req, res) => {
    const list = await realBrotherPrinterDriver.refreshPrinters();
    res.json({
      availablePrinters: list,
      activePrinter: realBrotherPrinterDriver.detectedPrinterName,
    });
  })
);

// Endpoint to check active printer status
router.get(
  "/printer-info",
  asyncHandler(async (_req, res) => {
    const list = await realBrotherPrinterDriver.refreshPrinters();
    const active = realBrotherPrinterDriver.detectedPrinterName;
    res.json({
      connected: !!active,
      printerName: active || "No physical printer detected (simulation active)",
      availablePrinters: list,
    });
  })
);

// Endpoint to select specific printer by name
router.post(
  "/printer/select",
  asyncHandler(async (req, res) => {
    const { printerName } = req.body as { printerName: string };
    if (!printerName) {
      res.status(400).json({ error: "printerName is required" });
      return;
    }
    realBrotherPrinterDriver.setPrinter(printerName);
    res.json({ success: true, activePrinter: printerName });
  })
);

// Endpoint for Local Printer Bridge to query active print jobs waiting to be spooled
router.get(
  "/pending-print-jobs",
  asyncHandler(async (req, res) => {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const baseUrl = `${proto}://${host}`;

    const activeSessions = sessionManager.getAllSessions();
    const pendingJobs = activeSessions
      .filter((s) => (s.stage === "PRINTING" || s.stage === "COMPLETED" || s.payment?.status === "PAID") && s.file && !s.spooledToPhysical)
      .map((s) => ({
        sessionId: s.id,
        originalName: s.file!.originalName,
        fileUrl: `${baseUrl}/api/file/${s.id}/preview`,
        totalPages: (s.price?.bwPages || 0) + (s.price?.colorPages || 0) || s.file!.pageCount,
        colorMode: s.options?.colorMode || "BW",
        copies: s.options?.copies || 1,
        sides: s.options?.sides || "SINGLE",
        pageRangeMode: s.options?.pageRangeMode || "ALL",
        customPageRange: s.options?.pageRangeMode === "CUSTOM" ? s.options?.customPageRange : undefined,
        pagesPerSheet: s.options?.pagesPerSheet || 1,
      }));

    res.json(pendingJobs);
  })
);

router.post(
  "/mark-spooled",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    if (sessionId) {
      sessionManager.update(sessionId, { spooledToPhysical: true });
    }
    res.json({ success: true });
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

    // Use Universal Physical Printer Driver if printer detected, otherwise fallback to simulator
    const activeDriver = realBrotherPrinterDriver.detectedPrinterName
      ? realBrotherPrinterDriver
      : printerDriver;

    activeDriver.startJob(session.id, totalPhysicalPages, filePath, session.options);

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
