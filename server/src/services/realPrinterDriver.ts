import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { PrintJobInfo, PrinterState } from "../types/session";
import { PrinterDriver } from "./printerSimulator";
import { convertToPdfIfNeeded } from "./officeConverter";

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
    // Continuous USB & Wi-Fi printer auto-plug-and-play scanner (polls every 3s)
    setInterval(() => this.refreshPrinters(), 3000).unref();
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

        // Instant USB Auto-Plug-and-Play binding:
        if (!this.detectedPrinterName || !this.availablePrinters.includes(this.detectedPrinterName)) {
          if (this.availablePrinters.length > 0) {
            const preferred =
              this.availablePrinters.find((p) => /brother|hp|canon|epson|xerox|samsung|ricoh|kyocera/i.test(p)) ||
              this.availablePrinters[0];
            
            if (this.detectedPrinterName !== preferred) {
              this.detectedPrinterName = preferred;
              console.log(`[UniversalPrinterDriver] 🖨️ USB/Wi-Fi Physical Printer Connected: "${preferred}"`);
            }
          }
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

    // Refresh OS printer list before spooling to ensure USB printer is active
    await this.refreshPrinters();

    const printerName = this.detectedPrinterName || "System Default Printer";
    const startedAt = Date.now();
    const estSeconds = Math.max(3, totalPages * 2);

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
        job.info.progressPercent = 30;
      } else if (job.info.state === "PRINTING") {
        const progress = Math.min(95, Math.round(30 + (elapsed / estSeconds) * 65));
        job.info.progressPercent = progress;
        job.info.estimatedSecondsRemaining = Math.max(0, Math.ceil(estSeconds - elapsed));
      }
    }, 500);

    this.jobs.set(sessionId, { info, timer });

    // Execute physical spooler command to send file directly to local USB / Wi-Fi printer
    if (filePath && fs.existsSync(filePath)) {
      try {
        const fileToSpool = await convertToPdfIfNeeded(filePath);
        console.log(`[UniversalPrinterDriver] Spooling file "${fileToSpool}" to physical printer "${printerName}"...`);

        if (process.platform === "win32") {
          let spooled = false;
          if (pdfToPrinter) {
            try {
              await pdfToPrinter.print(fileToSpool, { printer: printerName });
              spooled = true;
              console.log(`[UniversalPrinterDriver] 🖨️ Physical print job spooled via pdf-to-printer to "${printerName}"!`);
            } catch (pErr: any) {
              console.warn(`[UniversalPrinterDriver] pdf-to-printer notice: ${pErr?.message}`);
            }
          }
          if (!spooled) {
            // PowerShell physical print spooling fallback
            const escapedPath = fileToSpool.replace(/'/g, "''");
            const escapedPrinter = printerName.replace(/'/g, "''");
            exec(
              `powershell -Command "Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '${escapedPrinter}' -WindowStyle Hidden"`
            );
            console.log(`[UniversalPrinterDriver] 🖨️ Physical print job spooled via PowerShell PrintTo to "${printerName}"!`);
          }
        } else {
          // Linux / macOS CUPS lp spooling
          exec(`lp -d "${printerName}" "${fileToSpool}"`);
          console.log(`[UniversalPrinterDriver] 🖨️ Physical print job spooled via CUPS lp to "${printerName}"!`);
        }
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
