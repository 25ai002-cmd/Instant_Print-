import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { PrintJobInfo, PrinterState } from "../types/session";
import { PrinterDriver } from "./printerSimulator";

let pdfToPrinter: any = null;
try {
  pdfToPrinter = require("pdf-to-printer");
} catch {
  pdfToPrinter = null;
}

export class RealBrotherPrinterDriver implements PrinterDriver {
  private jobs = new Map<string, { info: PrintJobInfo; timer?: NodeJS.Timeout }>();
  public detectedPrinterName: string | null = "Brother DCP-L2530DW series";

  constructor() {
    this.checkConnectedBrotherPrinter();
  }

  public checkConnectedBrotherPrinter(): Promise<string | null> {
    return new Promise((resolve) => {
      exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
        if (err || !stdout) {
          resolve(this.detectedPrinterName);
          return;
        }
        const printers = stdout.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
        const brother = printers.find((p) => p.toLowerCase().includes("brother"));
        if (brother) {
          this.detectedPrinterName = brother;
          console.log(`[RealPrinterDriver] Detected Brother Physical Printer: "${brother}"`);
        } else if (printers.length > 0) {
          // Use default printer if Brother name is slightly different
          const defaultPrinter = printers.find((p) => !p.includes("PDF") && !p.includes("OneNote")) || printers[0];
          this.detectedPrinterName = defaultPrinter;
          console.log(`[RealPrinterDriver] Using physical printer: "${defaultPrinter}"`);
        }
        resolve(this.detectedPrinterName);
      });
    });
  }

  async startJob(sessionId: string, totalPages: number, filePath?: string): Promise<void> {
    this.cancelJob(sessionId);

    const printerName = this.detectedPrinterName || "Brother DCP-L2530DW series";
    const startedAt = Date.now();
    const estSeconds = Math.max(3, totalPages * 2);

    const info: PrintJobInfo = {
      state: "RECEIVING",
      progressPercent: 10,
      estimatedSecondsRemaining: estSeconds,
    };

    const timer = setInterval(() => {
      const job = this.jobs.get(sessionId);
      if (!job) return;

      const elapsed = (Date.now() - startedAt) / 1000;
      if (job.info.state === "RECEIVING") {
        job.info.state = "PRINTING";
        job.info.progressPercent = 30;
      } else if (job.info.state === "PRINTING") {
        const progress = Math.min(95, Math.round(30 + (elapsed / estSeconds) * 65));
        job.info.progressPercent = progress;
        job.info.estimatedSecondsRemaining = Math.max(0, Math.ceil(estSeconds - elapsed));
      }
    }, 500);

    this.jobs.set(sessionId, { info, timer });

    // Execute physical print job to Brother Printer if file exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        console.log(`[RealPrinterDriver] Sending file "${filePath}" to physical printer "${printerName}"...`);
        if (pdfToPrinter) {
          await pdfToPrinter.print(filePath, { printer: printerName });
        } else {
          // PowerShell print fallback
          exec(`powershell -Command "Start-Process -FilePath '${filePath}' -Verb PrintTo -ArgumentList '${printerName}'"`);
        }
        console.log(`[RealPrinterDriver] Physical print job submitted successfully!`);
      } catch (err: any) {
        console.error(`[RealPrinterDriver] Print error:`, err?.message || err);
      }
    }

    // Complete job status after estimation
    setTimeout(() => {
      const job = this.jobs.get(sessionId);
      if (job) {
        job.info.state = "COMPLETED";
        job.info.progressPercent = 100;
        job.info.estimatedSecondsRemaining = 0;
        if (job.timer) clearInterval(job.timer);
      }
    }, estSeconds * 1000);
  }

  getState(sessionId: string): PrintJobInfo | undefined {
    return this.jobs.get(sessionId)?.info;
  }

  cancelJob(sessionId: string): void {
    const job = this.jobs.get(sessionId);
    if (job) {
      if (job.timer) clearInterval(job.timer);
      this.jobs.delete(sessionId);
    }
  }
}

export const realBrotherPrinterDriver = new RealBrotherPrinterDriver();
