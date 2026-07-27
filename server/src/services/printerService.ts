// ============================================================
// PrintATM — Printer Service
// Brother DCP-L2531DW Laser Printer Hardware Integration
// Supports Silent USB/Wi-Fi Printing on Windows & Simulation Fallback
// ============================================================

import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { countPagesInRanges } from './priceService.js';
import type { PrintJob, PrintJobStatus } from '../types/index.js';

import pdfToPrinter from 'pdf-to-printer';
import { convertToPdf } from './fileService.js';

const { print: pdfPrint, getPrinters } = pdfToPrinter;

const execAsync = (cmd: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(cmd, { timeout: 1800000, maxBuffer: 500 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });

/** Active print jobs tracked in memory */
const jobs = new Map<string, PrintJob>();

/** Target printer model name pattern */
const TARGET_PRINTER_NAME = process.env.PRINTER_NAME || 'Brother DCP-L2531DW series';

/**
 * Detect connected Brother printer or installed Windows printers.
 */
export async function detectBrotherPrinter(): Promise<{
  installed: boolean;
  name: string | null;
  status: string;
  allPrinters: string[];
}> {
  let allNames: string[] = [];

  // Method 1: Query pdf-to-printer getPrinters()
  try {
    const printerList = await getPrinters();
    allNames = printerList.map((p) => String(p.name));

    const brotherMatch = printerList.find(
      (p) =>
        p.name.toLowerCase().includes('brother') ||
        p.name.toLowerCase().includes('dcp-l2531dw') ||
        p.name.toLowerCase().includes('dcp-l2530dw') ||
        p.name.toLowerCase().includes('dcp')
    );

    if (brotherMatch) {
      return {
        installed: true,
        name: brotherMatch.name,
        status: 'Normal',
        allPrinters: allNames,
      };
    }
  } catch (err) {
    console.warn('[Printer] getPrinters warning:', err);
  }

  // Method 2: Query Windows PowerShell Get-Printer
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(
        `powershell -Command "Get-Printer | Select-Object Name | ConvertTo-Json"`
      );
      const parsed = JSON.parse(stdout.trim() || '[]');
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const psNames = list.map((p) => String(p.Name)).filter(Boolean);
      allNames = Array.from(new Set([...allNames, ...psNames]));

      const psBrother = list.find((p) =>
        String(p.Name).toLowerCase().includes('brother') ||
        String(p.Name).toLowerCase().includes('dcp')
      );

      if (psBrother) {
        return {
          installed: true,
          name: String(psBrother.Name),
          status: 'Normal',
          allPrinters: allNames,
        };
      }
    } catch (_) {
      // ignore
    }
  }

  // Method 3: Fallback target on Windows for Brother DCP-L2530DW series hardware spooler
  if (process.platform === 'win32') {
    return {
      installed: true,
      name: TARGET_PRINTER_NAME,
      status: 'Default Spooler Target',
      allPrinters: allNames,
    };
  }

  return {
    installed: false,
    name: null,
    status: 'Not Found',
    allPrinters: allNames,
  };
}

/**
 * Submit a print job to Brother DCP-L2531DW or simulation.
 */
export async function submitPrintJob(params: {
  filePath: string;
  fileName: string;
  pageCount: number;
  copies: number;
  colorMode: 'bw' | 'color';
  sides: 'single' | 'double';
  paperSize: string;
  pageRanges?: Array<{ from: number; to: number }>;
}): Promise<PrintJob> {
  const jobId = uuidv4();
  const selectedPageCount =
    params.pageRanges && params.pageRanges.length > 0
      ? countPagesInRanges(params.pageRanges, params.pageCount)
      : params.pageCount;
  const numCopies = Math.max(1, params.copies || 1);
  const totalPages = selectedPageCount * numCopies;

  const job: PrintJob = {
    jobId,
    status: 'queued',
    progress: 0,
    totalPages,
    printedPages: 0,
    startedAt: new Date(),
    estimatedSeconds: Math.max(8, totalPages * 2), // ~2s per page on Brother laser printer
  };

  jobs.set(jobId, job);
  console.log(
    `[Printer] Job queued: ${jobId} (${totalPages} total pages across ${numCopies} copy/copies, sides: ${params.sides}) for file: ${params.fileName}`
  );

  // Check if real Brother printer is connected on Windows
  const detected = await detectBrotherPrinter();

  if (detected.installed && detected.name) {
    console.log(`[Printer] Found physical printer: "${detected.name}". Executing hardware print...`);
    executePhysicalPrint(jobId, params, detected.name);
  } else {
    console.warn(
      `[Printer] Hardware printer not detected. Installed printers: [${detected.allPrinters.join(', ')}].`
    );
    // Mark job as failed with clear message so user knows printer is offline
    setTimeout(() => {
      jobs.set(jobId, {
        ...job,
        status: 'failed',
        error: `Physical printer not connected or turned OFF. Installed printers found: [${detected.allPrinters.join(
          ', '
        )}]. Please power ON your Brother printer and connect USB.`,
      });
    }, 1000);
  }

  return job;
}

/**
 * Send print job directly to physical printer hardware spooler via pdf-to-printer.
 */
async function executePhysicalPrint(
  jobId: string,
  params: {
    filePath: string;
    copies: number;
    sides: 'single' | 'double';
    colorMode: 'bw' | 'color';
    pageRanges?: Array<{ from: number; to: number }>;
  },
  printerName: string
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  jobs.set(jobId, { ...job, status: 'printing', progress: 20 });

  const absolutePath = path.resolve(params.filePath);
  const ext = path.extname(absolutePath).toLowerCase();

  try {
    // 1. Ensure file is in PDF format for direct hardware spooling
    console.log(`[Printer] Preparing PDF for hardware printing: "${absolutePath}"...`);
    const pdfPath = await convertToPdf(absolutePath, ext.startsWith('.') ? ext : '');
    jobs.set(jobId, { ...jobs.get(jobId)!, progress: 40 });

    // 2. Configure duplexing on Windows Printer Spooler
    const duplexSetting = params.sides === 'double' ? 'TwoSidedLongEdge' : 'OneSided';
    const setDuplexCmd = `powershell -Command "Set-PrintConfiguration -PrinterName '${printerName}' -Duplexing ${duplexSetting} -ErrorAction SilentlyContinue"`;
    await execAsync(setDuplexCmd).catch((e) => console.warn('[Printer] Duplexing notice:', e.message));

    // 3. Build pdf-to-printer options
    const printOptions: any = {
      printer: printerName,
      copies: Math.max(1, params.copies || 1),
    };

    if (params.sides === 'double') {
      printOptions.side = 'duplexlong';
    } else {
      printOptions.side = 'simplex';
    }

    if (params.pageRanges && params.pageRanges.length > 0) {
      printOptions.pages = params.pageRanges.map((r) => `${r.from}-${r.to}`).join(',');
    }

    console.log(`[Printer] Spooling PDF directly to printer hardware "${printerName}":`, printOptions);
    jobs.set(jobId, { ...jobs.get(jobId)!, progress: 60 });

    await pdfPrint(pdfPath, printOptions);
    console.log(`[Printer] Hardware print command successfully sent to printer "${printerName}".`);

    // Mark job as completed ONLY AFTER physical hardware print command succeeds
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: 'completed',
      progress: 100,
      printedPages: job.totalPages,
      completedAt: new Date(),
    });
  } catch (err) {
    console.error(`[Printer] Hardware print command error for job ${jobId}:`, err);
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: 'failed',
      error: (err as Error).message || 'Hardware printing failed',
    });
  }
}

/**
 * Simulate realistic print progress with stages.
 */
function simulatePrintProgress(jobId: string, totalPages: number): void {
  const stages = [
    { progress: 10, delay: 400, status: 'printing' as PrintJobStatus },
    { progress: 30, delay: 1200, status: 'printing' as PrintJobStatus },
    { progress: 60, delay: 1500, status: 'printing' as PrintJobStatus },
    { progress: 85, delay: 1200, status: 'printing' as PrintJobStatus },
    { progress: 100, delay: 600, status: 'completed' as PrintJobStatus },
  ];

  let cumulativeDelay = 0;

  for (const stage of stages) {
    cumulativeDelay += stage.delay;
    setTimeout(() => {
      const job = jobs.get(jobId);
      if (!job || job.status === 'cancelled') return;

      const printedPages = Math.round((stage.progress / 100) * totalPages);
      const updatedJob: PrintJob = {
        ...job,
        status: stage.status,
        progress: stage.progress,
        printedPages,
        ...(stage.status === 'completed' ? { completedAt: new Date() } : {}),
      };
      jobs.set(jobId, updatedJob);
      console.log(`[Printer] Job ${jobId}: ${stage.progress}% (${stage.status})`);
    }, cumulativeDelay);
  }
}

/**
 * Get the current status of a print job.
 */
export function getJobStatus(jobId: string): PrintJob | undefined {
  return jobs.get(jobId);
}

/**
 * Cancel a queued or printing job.
 */
export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;

  jobs.set(jobId, { ...job, status: 'cancelled' });
  console.log(`[Printer] Job cancelled: ${jobId}`);
  return true;
}

/**
 * Get the overall printer status including Brother connection status.
 */
export function getPrinterStatus(): {
  online: boolean;
  ready: boolean;
  activeJobs: number;
  printerModel: string;
  message: string;
} {
  const activeJobs = Array.from(jobs.values()).filter(
    (j) => j.status === 'queued' || j.status === 'printing'
  ).length;

  return {
    online: true,
    ready: activeJobs === 0,
    activeJobs,
    printerModel: 'Brother DCP-L2531DW',
    message: activeJobs > 0 ? `${activeJobs} job(s) in queue` : 'Ready',
  };
}

/**
 * Clean up completed/failed jobs from memory.
 */
export function cleanupJob(jobId: string): void {
  jobs.delete(jobId);
}
