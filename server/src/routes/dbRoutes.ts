import { Router } from "express";
import { getDocumentByAccessCode, listPendingDocuments } from "../services/database";
import { sessionManager } from "../services/sessionManager";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

/**
 * List all active/pending documents stored in the database.
 */
router.get(
  "/db/documents",
  asyncHandler(async (_req, res) => {
    const docs = await listPendingDocuments();
    res.json(docs);
  })
);

/**
 * Look up a document stored in the database by its 6-digit access code.
 */
router.get(
  "/db/document/code/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const doc = await getDocumentByAccessCode(code);
    if (!doc) {
      res.status(404).json({
        error: { message: "No document found matching this access code. Please check the code and try again.", code: "DOCUMENT_NOT_FOUND" },
      });
      return;
    }
    res.json(doc);
  })
);

/**
 * Load a document from database by 6-digit access code into a kiosk session so it can be printed!
 */
router.post(
  "/db/load-session",
  asyncHandler(async (req, res) => {
    const { accessCode, kioskSessionId } = req.body as { accessCode: string; kioskSessionId?: string };

    if (!accessCode) {
      res.status(400).json({ error: { message: "Access code is required" } });
      return;
    }

    const doc = await getDocumentByAccessCode(accessCode);
    if (!doc) {
      res.status(404).json({
        error: { message: "Document code not found in database.", code: "DOCUMENT_NOT_FOUND" },
      });
      return;
    }

    // Load DB record into session manager
    const loadedSession = sessionManager.loadFromDbRecord(doc);

    // If kiosk passed its active session ID, alias/sync it
    if (kioskSessionId && kioskSessionId !== loadedSession.id) {
      sessionManager.update(kioskSessionId, {
        file: loadedSession.file,
        accessCode: loadedSession.accessCode,
        options: loadedSession.options,
        price: loadedSession.price,
        payment: loadedSession.payment,
        stage: loadedSession.stage,
      });
      const kioskSession = sessionManager.requireSession(kioskSessionId);
      res.json(kioskSession);
      return;
    }

    res.json(loadedSession);
  })
);

export default router;
