import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { realBrotherPrinterDriver } from "./realPrinterDriver";
import { UPLOAD_DIR } from "../middleware/upload";

const RENDER_CLOUD_URL =
  process.env.CLOUD_URL ||
  process.env.RENDER_REMOTE_URL ||
  "https://printatm.netlify.app";
const POLL_INTERVAL_MS = 1500;
const processedJobs = new Set<string>();
const inFlightJobs = new Set<string>();
let isPolling = false;

export interface PendingPrintJob {
  sessionId: string;
  originalName: string;
  fileUrl: string;
  totalPages: number;
  colorMode: string;
  copies: number;
  sides?: string;
  pageRangeMode?: string;
  customPageRange?: string;
  pagesPerSheet?: number;
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
  if (isPolling) return;
  isPolling = true;

  const endpoint = `${remoteCloudUrl.replace(/\/+$/, "")}/api/pending-print-jobs`;
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
            if (processedJobs.has(job.sessionId) || inFlightJobs.has(job.sessionId)) continue;
            inFlightJobs.add(job.sessionId);

            try {
              console.log(`[CloudPrinterBridge] 📄 New remote print job detected: "${job.originalName}" (Session: ${job.sessionId})`);

              // Ensure local uploads directory exists
              if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
              }

              // Download file locally to spool to physical printer
              const safeName = job.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
              const tempFilePath = path.join(UPLOAD_DIR, `remote_${job.sessionId}_${safeName}`);

              await downloadFile(job.fileUrl, tempFilePath);

              console.log(`[CloudPrinterBridge] File downloaded to "${tempFilePath}". Spooling to physical printer "${realBrotherPrinterDriver.detectedPrinterName}" (Range: ${job.customPageRange || "ALL"}, Sides: ${job.sides || "SINGLE"})...`);
              await realBrotherPrinterDriver.startJob(job.sessionId, job.totalPages, tempFilePath, {
                copies: job.copies,
                colorMode: job.colorMode as any,
                sides: job.sides as any,
                pageRangeMode: job.pageRangeMode as any,
                customPageRange: job.customPageRange,
                pagesPerSheet: job.pagesPerSheet,
              });
              processedJobs.add(job.sessionId);
              markSpooledRemote(remoteCloudUrl, job.sessionId);
            } catch (jobErr: any) {
              console.error(`[CloudPrinterBridge] Job ${job.sessionId} error (will retry):`, jobErr?.message || jobErr);
            } finally {
              inFlightJobs.delete(job.sessionId);
            }
          }
        } catch (err: any) {
          console.error(`[CloudPrinterBridge] Processing error:`, err?.message || err);
        } finally {
          isPolling = false;
        }
      });
    })
    .on("error", () => {
      isPolling = false;
    });
}

function downloadFile(fileUrl: string, destPath: string, redirectsLeft = 3): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = fileUrl.startsWith("https") ? https : http;
    client
      .get(fileUrl, (response) => {
        if (
          response.statusCode &&
          [301, 302, 307, 308].includes(response.statusCode) &&
          response.headers.location &&
          redirectsLeft > 0
        ) {
          const nextUrl = new URL(response.headers.location, fileUrl).toString();
          response.resume();
          downloadFile(nextUrl, destPath, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(destPath, () => undefined);
          reject(err);
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => undefined);
        reject(err);
      });
  });
}

function markSpooledRemote(remoteCloudUrl: string, sessionId: string) {
  try {
    const u = new URL(`${remoteCloudUrl}/api/mark-spooled`);
    const client = u.protocol === "https:" ? https : http;
    const data = JSON.stringify({ sessionId });
    const req = client.request(u, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    });
    req.write(data);
    req.end();
  } catch {
    // transient
  }
}
