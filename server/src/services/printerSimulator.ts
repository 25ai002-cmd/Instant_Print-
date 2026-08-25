import { PrintJobInfo, PrinterState } from "../types/session";

/**
 * Abstract printer contract. A future Raspberry Pi + real printer integration
 * implements this same interface (e.g. via CUPS/IPP or a serial driver) and
 * gets swapped in at the call site in routes/print.ts — nothing else changes.
 */
export interface PrinterDriver {
  startJob(sessionId: string, totalPages: number): void;
  getState(sessionId: string): PrintJobInfo | undefined;
  cancelJob(sessionId: string): void;
}

const SIMULATED_SECONDS_PER_PAGE = 1.6;
const TICK_MS = 250;

// Small deterministic-ish chance of a hardware hiccup, so the error/retry UI
// gets exercised without hand-triggering it. Tune to 0 to disable entirely.
const RANDOM_FAILURE_RATE = 0.04;

class SimulatedPrinterDriver implements PrinterDriver {
  private jobs = new Map<string, { info: PrintJobInfo; timer: NodeJS.Timeout }>();

  startJob(sessionId: string, totalPages: number): void {
    this.cancelJob(sessionId);

    const totalSeconds = Math.max(2, totalPages * SIMULATED_SECONDS_PER_PAGE);
    const startedAt = Date.now();

    const info: PrintJobInfo = {
      state: "RECEIVING",
      progressPercent: 0,
      estimatedSecondsRemaining: Math.ceil(totalSeconds),
    };

    const timer = setInterval(() => {
      const job = this.jobs.get(sessionId);
      if (!job) return;

      const elapsedSeconds = (Date.now() - startedAt) / 1000;

      if (job.info.state === "RECEIVING") {
        job.info.state = "PRINTING";
      }

      if (job.info.state === "PRINTING") {
        const progress = Math.min(99, Math.round((elapsedSeconds / totalSeconds) * 100));
        job.info.progressPercent = progress;
        job.info.estimatedSecondsRemaining = Math.max(0, Math.ceil(totalSeconds - elapsedSeconds));

        if (Math.random() < RANDOM_FAILURE_RATE / (totalSeconds / (TICK_MS / 1000))) {
          const faults: PrinterState[] = ["PAPER_EMPTY", "OUT_OF_INK", "OFFLINE", "ERROR"];
          const fault = faults[Math.floor(Math.random() * faults.length)];
          job.info.state = fault;
          job.info.error = describeFault(fault);
          clearInterval(job.timer);
          return;
        }

        if (elapsedSeconds >= totalSeconds) {
          job.info.state = "COMPLETED";
          job.info.progressPercent = 100;
          job.info.estimatedSecondsRemaining = 0;
          clearInterval(job.timer);
        }
      }
    }, TICK_MS);

    this.jobs.set(sessionId, { info, timer });
  }

  getState(sessionId: string): PrintJobInfo | undefined {
    return this.jobs.get(sessionId)?.info;
  }

  cancelJob(sessionId: string): void {
    const job = this.jobs.get(sessionId);
    if (job) {
      clearInterval(job.timer);
      this.jobs.delete(sessionId);
    }
  }
}

function describeFault(state: PrinterState): string {
  switch (state) {
    case "PAPER_EMPTY":
      return "The printer has run out of paper.";
    case "OUT_OF_INK":
      return "The printer is out of ink or toner.";
    case "OFFLINE":
      return "The printer went offline unexpectedly.";
    case "ERROR":
      return "The printer reported an unknown hardware error.";
    default:
      return "The printer encountered a problem.";
  }
}

export const printerDriver: PrinterDriver = new SimulatedPrinterDriver();
