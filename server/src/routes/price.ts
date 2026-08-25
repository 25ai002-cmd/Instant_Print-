import { Router } from "express";
import { sessionManager } from "../services/sessionManager";
import { calculatePrice } from "../services/priceEngine";
import { asyncHandler } from "../middleware/errorHandler";
import { PrintOptions } from "../types/session";

const router = Router();

router.post(
  "/calculate-price",
  asyncHandler(async (req, res) => {
    const { sessionId, options } = req.body as { sessionId: string; options: PrintOptions };
    const session = sessionManager.requireSession(sessionId);

    if (!session.file) {
      const err = new Error("Upload a document before selecting print options");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!options || !options.paperSize || !options.colorMode || !options.sides) {
      const err = new Error("Print options are incomplete");
      (err as any).statusCode = 400;
      throw err;
    }

    const price = calculatePrice(session.file, options);

    const updated = sessionManager.update(session.id, { options, price });
    res.json({ session: updated, price });
  })
);

export default router;
