import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { realBrotherPrinterDriver } from "./realPrinterDriver";
import { UPLOAD_DIR } from "../middleware/upload";

const RENDER_CLOUD_URL = process.env.RENDER_REMOTE_URL || "https://instant-print-1.onrender.com";
const POLL_INTERVAL_MS = 1500;
const processedJobs = new Set<string>();

export interface PendingPrintJob {
  sessionId: string;
  originalName: string;
  fileUrl: string;
  totalPages: number;
  colorMode: string;
  copies: number;
}

/**
 * Starts the local printer bridge background worker.
 * When running on a local machine connected to a physical USB/Wi-Fi printer,
 * this worker continuously polls Render for new print jobs, downloads the files,
 * and spools them directly to the local physical printer!
 */
export function startCloudPrinterBridge(remoteCloudUrl = RENDER_CLOUD_URL) {
  // Only skip if running directly inside Render cloud environment
  const isRenderCloudHost = !!process.env.RENDER;
  if (isRenderCloudHost) {
    console.log(`[CloudPrinterBridge] Running on Render Cloud Host. Exposing /api/pending-print-jobs for local printers.`);
    return;
  }

  console.log(`==================================================`);
  console.log(`[CloudPrinterBridge] 🖨️ Local Physical Printer Spooler ACTIVE`);
  console.log(`[CloudPrinterBridge] Polling cloud server: ${remoteCloudUrl}`);
  console.log(`==================================================`);

  // Run immediate first check + interval loop
  pollAndPrintRemoteJobs(remoteCloudUrl);
  setInterval(() => {
    pollAndPrintRemoteJobs(remoteCloudUrl);
  }, POLL_INTERVAL_MS);
}

function pollAndPrintRemoteJobs(remoteCloudUrl: string) {
  const endpoint = `${remoteCloudUrl}/api/pending-print-jobs`;
  const client = endpoint.startsWith("https") ? https : http;

  client
    .get(endpoint, (res) => {
      let rawData = "";
      res.on("data", (chunk) => (rawData += chunk));
      res.on("end", async () => {
        try {
          if (res.statusCode !== 200) return;
          const jobs: PendingPrintJob[] = JSON.parse(rawData);

          for (const job of jobs) {
            if (processedJobs.has(job.sessionId)) continue;
            processedJobs.add(job.sessionId);

            console.log(`[CloudPrinterBridge] 📄 New remote print job detected: "${job.originalName}" (Session: ${job.sessionId})`);

            // Ensure local uploads directory exists
            if (!fs.existsSync(UPLOAD_DIR)) {
              fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }

            // Download file locally to spool to physical printer
            const safeName = job.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
            const tempFilePath = path.join(UPLOAD_DIR, `remote_${job.sessionId}_${safeName}`);
            
            await downloadFile(job.fileUrl, tempFilePath);

            console.log(`[CloudPrinterBridge] File downloaded to "${tempFilePath}". Spooling to physical printer "${realBrotherPrinterDriver.detectedPrinterName}"...`);
            await realBrotherPrinterDriver.startJob(job.sessionId, job.totalPages, tempFilePath);
          }
        } catch (err: any) {
          console.error(`[CloudPrinterBridge] Processing error:`, err?.message || err);
        }
      });
    })
    .on("error", (err) => {
      // transient network log
    });
}

function downloadFile(fileUrl: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = fileUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    client
      .get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => undefined);
        reject(err);
      });
  });
}
