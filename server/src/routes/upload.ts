import fs from "fs";
import { Router } from "express";
import { upload } from "../middleware/upload";
import { sessionManager } from "../services/sessionManager";
import { analyzeFile, FileValidationError } from "../services/fileAnalyzer";
import { generateAccessCode, saveDocumentRecord } from "../services/database";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err.message === "UNSUPPORTED_FILE_TYPE") {
          res.status(400).json({
            error: { message: "Unsupported file type. Please upload a PDF, DOCX, PPTX, PNG, or JPEG.", code: "UNSUPPORTED_FILE_TYPE" },
          });
          return;
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            error: { message: "File is too large. Maximum size is 50MB.", code: "FILE_TOO_LARGE" },
          });
          return;
        }
        next(err);
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const sessionId = req.body.sessionId as string;
    if (!sessionId) {
      const err = new Error("sessionId is required");
      (err as any).statusCode = 400;
      throw err;
    }
    const session = sessionManager.requireSession(sessionId);

    if (!req.file) {
      const err = new Error("No file was uploaded");
      (err as any).statusCode = 400;
      throw err;
    }

    try {
      const meta = await analyzeFile({
        path: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });

      const accessCode = generateAccessCode();
      const metaWithCode = { ...meta, accessCode };

      const updated = sessionManager.update(session.id, {
        file: metaWithCode,
        accessCode,
        stage: "FILE_UPLOADED",
      });

      // Explicitly persist to database
      await saveDocumentRecord(updated, accessCode);

      res.json(updated);
    } catch (err) {
      // Validation failed — clean up the temp file immediately, nothing to keep.
      if (fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => undefined);
      }
      if (err instanceof FileValidationError) {
        res.status(400).json({ error: { message: err.message, code: "FILE_VALIDATION_FAILED" } });
        return;
      }
      throw err;
    }
  })
);

export default router;
