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

export class UniversalPrinterDriver implements PrinterDriver {
  private jobs = new Map<string, { info: PrintJobInfo; timer?: NodeJS.Timeout }>();
  public detectedPrinterName: string | null = null;
  public availablePrinters: string[] = [];

  constructor() {
    this.refreshPrinters();
  }

  /** Scans local system OS for all installed physical printers (Windows PowerShell / Linux lpstat). */
  public refreshPrinters(): Promise<string[]> {
    return new Promise((resolve) => {
      const isWin = process.platform === "win32";
      const cmd = isWin
        ? 'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"'
        : "lpstat -p | awk '{print $2}'";

      exec(cmd, (err, stdout) => {
        if (err || !stdout) {
          resolve(this.availablePrinters);
          return;
        }

        const list = stdout
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0 && !p.includes("PDF") && !p.includes("OneNote") && !p.includes("Fax") && !p.includes("XPS"));

        this.availablePrinters = list.length > 0 ? list : stdout.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);

        if (!this.detectedPrinterName && this.availablePrinters.length > 0) {
          // Auto-select first physical printer (or Brother/HP/Canon if present)
          const preferred =
            this.availablePrinters.find((p) => /brother|hp|canon|epson|xerox|samsung/i.test(p)) ||
            this.availablePrinters[0];
          this.detectedPrinterName = preferred;
          console.log(`[UniversalPrinterDriver] Selected physical printer: "${preferred}"`);
        }

        resolve(this.availablePrinters);
      });
    });
  }

  public setPrinter(printerName: string): boolean {
    this.detectedPrinterName = printerName;
    console.log(`[UniversalPrinterDriver] Active printer updated to: "${printerName}"`);
    return true;
  }

  async startJob(sessionId: string, totalPages: number, filePath?: string): Promise<void> {
    this.cancelJob(sessionId);

    const printerName = this.detectedPrinterName || "System Default Printer";
    const startedAt = Date.now();
    const estSeconds = Math.max(3, totalPages * 2.5);

    const info: PrintJobInfo = {
      state: "RECEIVING",
      progressPercent: 10,
      estimatedSecondsRemaining: Math.ceil(estSeconds),
    };

    const timer = setInterval(() => {
      const job = this.jobs.get(sessionId);
      if (!job) return;

      const elapsed = (Date.now() - startedAt) / 1000;
      if (job.info.state === "RECEIVING") {
        job.info.state = "PRINTING";
        job.info.progressPercent = 25;
      } else if (job.info.state === "PRINTING") {
        const progress = Math.min(95, Math.round(25 + (elapsed / estSeconds) * 70));
        job.info.progressPercent = progress;
        job.info.estimatedSecondsRemaining = Math.max(0, Math.ceil(estSeconds - elapsed));
      }
    }, 500);

    this.jobs.set(sessionId, { info, timer });

    // Execute physical spooler command to send file directly to local USB / Wi-Fi printer
    if (filePath && fs.existsSync(filePath)) {
      try {
        console.log(`[UniversalPrinterDriver] Spooling file "${filePath}" to physical printer "${printerName}"...`);

        if (process.platform === "win32") {
          if (pdfToPrinter && filePath.toLowerCase().endsWith(".pdf")) {
            await pdfToPrinter.print(filePath, { printer: printerName });
          } else {
            // PowerShell physical print spooling
            const escapedPath = filePath.replace(/'/g, "''");
            const escapedPrinter = printerName.replace(/'/g, "''");
            exec(
              `powershell -Command "Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '${escapedPrinter}'"`
            );
          }
        } else {
          // Linux / macOS CUPS lp spooling
          exec(`lp -d "${printerName}" "${filePath}"`);
        }

        console.log(`[UniversalPrinterDriver] Physical print job submitted successfully!`);
      } catch (err: any) {
        console.error(`[UniversalPrinterDriver] Physical print spooling warning:`, err?.message || err);
      }
    }

    // Complete job status after estimated spool duration
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

export const realBrotherPrinterDriver = new UniversalPrinterDriver();
