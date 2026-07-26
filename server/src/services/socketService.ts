// ============================================================
// PrintATM Cloud SaaS Platform — Socket.IO Real-Time Service
// Manages WebSocket rooms per Machine ID (e.g. machine:ATM001),
// pushes print jobs instantly upon payment success, & tracks heartbeat.
// ============================================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../db/prisma.js';

let io: SocketIOServer | null = null;

export function initSocketService(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] Connected client: ${socket.id}`);

    // Machine Authentication & Room Join
    socket.on('JOIN_MACHINE_ROOM', async (data: { machineCode: string; authToken?: string }) => {
      const { machineCode } = data;
      if (!machineCode) return;

      const roomName = `machine:${machineCode.toUpperCase()}`;
      socket.join(roomName);
      console.log(`[WebSocket] Client ${socket.id} joined room: ${roomName}`);

      // Update machine status in database
      try {
        await prisma.machine.updateMany({
          where: { machineCode: machineCode.toUpperCase() },
          data: {
            isOnline: true,
            status: 'ONLINE',
            lastHeartbeat: new Date(),
          },
        });

        // Audit Log
        const machine = await prisma.machine.findUnique({ where: { machineCode: machineCode.toUpperCase() } });
        if (machine) {
          await prisma.auditLog.create({
            data: {
              machineId: machine.id,
              action: 'MACHINE_CONNECTED',
              actorType: 'MACHINE',
              details: JSON.stringify({ socketId: socket.id }),
            },
          });
        }
      } catch (err) {
        console.error(`[WebSocket] Failed to update machine status for ${machineCode}:`, err);
      }
    });

    // Machine Heartbeat
    socket.on('MACHINE_HEARTBEAT', async (data: { machineCode: string; paperLevel?: number; tonerLevel?: number; status?: string }) => {
      const { machineCode, paperLevel, tonerLevel, status } = data;
      if (!machineCode) return;

      try {
        await prisma.machine.updateMany({
          where: { machineCode: machineCode.toUpperCase() },
          data: {
            isOnline: true,
            status: (status as any) || 'ONLINE',
            lastHeartbeat: new Date(),
            ...(paperLevel !== undefined ? { paperLevel } : {}),
            ...(tonerLevel !== undefined ? { tonerLevel } : {}),
          },
        });
      } catch (err) {
        console.warn(`[WebSocket] Heartbeat error for ${machineCode}:`, err);
      }
    });

    // Machine Job Status Update
    socket.on('UPDATE_JOB_STATUS', async (data: { jobId: string; status: string; failureReason?: string }) => {
      const { jobId, status, failureReason } = data;
      if (!jobId || !status) return;

      try {
        const job = await prisma.printJob.update({
          where: { id: jobId },
          data: {
            status: status as any,
            ...(failureReason ? { failureReason } : {}),
            ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
          },
        });

        // Broadcast status update to room
        io?.emit(`JOB_STATUS_CHANGED:${jobId}`, { jobId, status, failureReason });
        console.log(`[WebSocket] Job ${jobId} status updated to: ${status}`);
      } catch (err) {
        console.error(`[WebSocket] Failed to update job status for ${jobId}:`, err);
      }
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Disconnected client: ${socket.id}`);
    });
  });

  console.log('[WebSocket] Socket.IO Server initialized and listening for machines.');
  return io;
}

/**
 * Get Socket.IO instance.
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Push new paid print job instantly to assigned Machine room.
 */
export function notifyMachineNewJob(machineCode: string, jobData: any): boolean {
  if (!io) {
    console.warn('[WebSocket] Cannot notify machine: Socket.IO not initialized.');
    return false;
  }

  const roomName = `machine:${machineCode.toUpperCase()}`;
  io.to(roomName).emit('JOB_ASSIGNED', jobData);
  console.log(`[WebSocket] 🚀 Pushed JOB_ASSIGNED event to room "${roomName}" for Job Code: ${jobData.jobCode}`);
  return true;
}
