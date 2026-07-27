import { io } from 'socket.io-client';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import pdfToPrinter from 'pdf-to-printer';

const SERVER_URL = process.env.CLOUD_URL || process.env.PUBLIC_URL || 'http://localhost:3002';
const MACHINE_CODE = process.env.MACHINE_CODE || 'ATM001';
const PRINTER_NAME = process.env.PRINTER_NAME || 'Brother DCP-L2530DW series';

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

log(`===================================================`);
log(` 🖨️  PrintATM Kiosk Hardware Agent Starting...`);
log(` Connecting to Cloud Server: ${SERVER_URL}`);
log(` Kiosk Machine Code: ${MACHINE_CODE}`);
log(` Target USB Printer: ${PRINTER_NAME}`);
log(`===================================================`);

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

socket.on('connect', () => {
  log(`✅ CONNECTED TO CLOUD SERVER! Socket ID: ${socket.id}`);
  socket.emit('JOIN_MACHINE_ROOM', { machineCode: MACHINE_CODE });
  socket.emit('MACHINE_HEARTBEAT', { machineCode: MACHINE_CODE, status: 'ONLINE' });
});

socket.on('connect_error', (err) => {
  log(`⚠️ Connection notice to ${SERVER_URL}: ${err.message}. Retrying...`);
});

socket.on('disconnect', () => {
  log(`⚠️ Disconnected from Cloud Server. Reconnecting...`);
});

// Send heartbeat every 10s to keep cloud session awake and reported online
setInterval(() => {
  if (socket.connected) {
    socket.emit('MACHINE_HEARTBEAT', { machineCode: MACHINE_CODE, status: 'ONLINE' });
  }
}, 10000);

socket.on('JOB_ASSIGNED', async (jobData: any) => {
  log(`🚀 NEW PRINT JOB RECEIVED: ${jobData.jobCode}`);
  log(` Document URL: ${jobData.fileUrl}`);
  log(` Copies: ${jobData.copies}, Sides: ${jobData.sides}`);

  const tempPath = path.join(process.cwd(), `temp_${jobData.jobId}.pdf`);

  try {
    // 1. Download document from Cloud Server
    log(`Downloading document from cloud server...`);
    const response = await fetch(jobData.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document from cloud server: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempPath, buffer);

    // 2. Spool document to physical Brother printer (clean SumatraPDF options)
    log(`Spooling PDF directly to printer "${PRINTER_NAME}"...`);
    const printOptions: any = {
      printer: PRINTER_NAME,
      copies: Math.max(1, jobData.copies || 1),
    };

    if (jobData.pageRanges && jobData.pageRanges.length > 0) {
      printOptions.pages = jobData.pageRanges.map((r: any) => `${r.from}-${r.to}`).join(',');
    }

    await pdfToPrinter.print(tempPath, printOptions);
    log(`✅ Physical print successfully spooled to Brother printer!`);

    socket.emit('UPDATE_JOB_STATUS', { jobId: jobData.jobId, status: 'COMPLETED' });
  } catch (err: any) {
    log(`❌ Hardware print execution error: ${err.message}`);
    socket.emit('UPDATE_JOB_STATUS', { jobId: jobData.jobId, status: 'FAILED', failureReason: err.message });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
});
