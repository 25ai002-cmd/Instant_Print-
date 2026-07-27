import { io } from 'socket.io-client';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import pdfToPrinter from 'pdf-to-printer';

const SERVER_URL = process.env.CLOUD_URL || process.env.PUBLIC_URL || 'http://localhost:3002';
const MACHINE_CODE = process.env.MACHINE_CODE || 'ATM001';
const PRINTER_NAME = process.env.PRINTER_NAME || 'Brother DCP-L2530DW series';

console.log(`===================================================`);
console.log(` 🖨️  PrintATM Kiosk Hardware Agent Starting...`);
console.log(` Connecting to Cloud Server: ${SERVER_URL}`);
console.log(` Kiosk Machine Code: ${MACHINE_CODE}`);
console.log(` Target USB Printer: ${PRINTER_NAME}`);
console.log(`===================================================`);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 2000,
});

socket.on('connect', () => {
  console.log(`[Kiosk Agent] Connected to Cloud Server WebSocket! Socket ID: ${socket.id}`);
  socket.emit('JOIN_MACHINE_ROOM', { machineCode: MACHINE_CODE });
});

socket.on('disconnect', () => {
  console.warn(`[Kiosk Agent] Disconnected from Cloud Server. Reconnecting...`);
});

socket.on('JOB_ASSIGNED', async (jobData: any) => {
  console.log(`[Kiosk Agent] 🚀 NEW PRINT JOB RECEIVED: ${jobData.jobCode}`);
  console.log(` Document URL: ${jobData.fileUrl}`);
  console.log(` Copies: ${jobData.copies}, Sides: ${jobData.sides}`);

  const tempPath = path.join(process.cwd(), `temp_${jobData.jobId}.pdf`);

  try {
    // 1. Download document from Cloud Server
    console.log(`[Kiosk Agent] Downloading document from cloud...`);
    const response = await fetch(jobData.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document from cloud server: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempPath, buffer);

    // 2. Spool document to physical Brother printer
    console.log(`[Kiosk Agent] Spooling PDF directly to printer "${PRINTER_NAME}"...`);
    const printOptions: any = {
      printer: PRINTER_NAME,
      copies: Math.max(1, jobData.copies || 1),
    };

    if (jobData.sides === 'double') {
      printOptions.side = 'duplexlong';
    } else {
      printOptions.side = 'simplex';
    }

    if (jobData.pageRanges && jobData.pageRanges.length > 0) {
      printOptions.pages = jobData.pageRanges.map((r: any) => `${r.from}-${r.to}`).join(',');
    }

    await pdfToPrinter.print(tempPath, printOptions);
    console.log(`[Kiosk Agent] ✅ Physical print successfully spooled to Brother printer!`);

    socket.emit('UPDATE_JOB_STATUS', { jobId: jobData.jobId, status: 'COMPLETED' });
  } catch (err: any) {
    console.error(`[Kiosk Agent] ❌ Hardware print execution error:`, err.message);
    socket.emit('UPDATE_JOB_STATUS', { jobId: jobData.jobId, status: 'FAILED', failureReason: err.message });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
});
