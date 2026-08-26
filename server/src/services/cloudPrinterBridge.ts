import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { realBrotherPrinterDriver } from "./realPrinterDriver";
import { UPLOAD_DIR } from "../middleware/upload";

const RENDER_CLOUD_URL = process.env.RENDER_REMOTE_URL || "https://instant-print-1.onrender.com";
const POLL_INTERVAL_MS = 2000;
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
 * When running on a machine connected to a physical USB/Wi-Fi printer,
 * this worker continuously polls Render for new print jobs, downloads the files,
 * and spools them directly to the local physical printer!
 */
export function startCloudPrinterBridge(remoteCloudUrl = RENDER_CLOUD_URL) {
  // Only start cloud bridge worker if running locally or explicitly enabled
  const isCloud = !!process.env.RENDER || process.env.NODE_ENV === "production";
  if (isCloud && !process.env.ENABLE_LOCAL_BRIDGE) {
    return;
  }

  console.log(`[CloudPrinterBridge] Local Printer Bridge active!`);
  console.log(`[CloudPrinterBridge] Connecting local physical printer to cloud server at: ${remoteCloudUrl}`);

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

            console.log(`[CloudPrinterBridge] Found remote print job for session "${job.sessionId}" ("${job.originalName}")!`);
            
            // Download file locally to spool to physical printer
            const tempFilePath = path.join(UPLOAD_DIR, `remote_${job.sessionId}_${job.originalName}`);
            await downloadFile(job.fileUrl, tempFilePath);

            console.log(`[CloudPrinterBridge] File downloaded. Spooling to physical printer "${realBrotherPrinterDriver.detectedPrinterName}"...`);
            await realBrotherPrinterDriver.startJob(job.sessionId, job.totalPages, tempFilePath);
          }
        } catch {
          // ignore transient errors
        }
      });
    })
    .on("error", () => {
      // ignore transient network drops
    });
}

function downloadFile(fileUrl: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = fileUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    client
      .get(fileUrl, (response) => {
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
