import fs from "fs";
import path from "path";
import multer from "multer";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const sessionId = (req.body?.sessionId as string) || "unknown";
    const ext = path.extname(file.originalname);
    cb(null, `${sessionId}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    // Support all documents, photos, text, and spreadsheet files automatically
    cb(null, true);
  },
});

export { UPLOAD_DIR };
