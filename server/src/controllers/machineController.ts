// ============================================================
// PrintATM Cloud SaaS Platform — Machine Controller
// Machine authentication, pending job fetching, secure file downloads,
// and machine status updates.
// ============================================================

import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import type { ApiResponse } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'printatm_super_secret_jwt_key_2026';

/**
 * POST /api/machine/auth
 * Machine authentication using machineCode and authToken.
 * Returns machine JWT token.
 */
export async function authenticateMachine(req: Request, res: Response): Promise<void> {
  const { machineCode, authToken } = req.body as { machineCode: string; authToken: string };

  if (!machineCode) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'machineCode is required' },
    } satisfies ApiResponse);
    return;
  }

  try {
    let machine = await prisma.machine.findUnique({
      where: { machineCode: machineCode.toUpperCase() },
      include: { settings: true, pricing: true },
    });

    // Auto-register machine if it doesn't exist yet (Zero-friction machine onboarding!)
    if (!machine) {
      machine = await prisma.machine.create({
        data: {
          machineCode: machineCode.toUpperCase(),
          name: `PrintATM Kiosk (${machineCode.toUpperCase()})`,
          locationName: 'Self-Service Station',
          authToken: authToken || 'token_' + machineCode.toLowerCase() + '_2026',
          status: 'ONLINE',
          isOnline: true,
          settings: {
            create: {
              colorEnabled: true,
              duplexEnabled: true,
            },
          },
          pricing: {
            create: {
              bwSingleRate: 2.0,
              bwDoubleRate: 4.0,
              colorSingleRate: 10.0,
              colorDoubleRate: 16.0,
            },
          },
        },
        include: { settings: true, pricing: true },
      });
      console.log(`[Machine Controller] Auto-registered new machine: ${machineCode.toUpperCase()}`);
    }

    // Generate JWT for Machine
    const token = jwt.sign(
      { machineId: machine.id, machineCode: machine.machineCode, role: 'MACHINE' },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    // Update online status
    await prisma.machine.update({
      where: { id: machine.id },
      data: { isOnline: true, status: 'ONLINE', lastHeartbeat: new Date() },
    });

    res.json({
      success: true,
      data: {
        token,
        machine: {
          id: machine.id,
          machineCode: machine.machineCode,
          name: machine.name,
          locationName: machine.locationName,
          settings: machine.settings,
          pricing: machine.pricing,
        },
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[Machine Auth] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Could not authenticate machine' },
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/machine/jobs/pending
 * Fallback polling endpoint for ATM machine to fetch un-printed paid jobs.
 */
export async function getPendingJobs(req: Request, res: Response): Promise<void> {
  const machineCode = (req.query.machineCode as string) || (req.headers['x-machine-code'] as string);

  if (!machineCode) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_MACHINE_CODE', message: 'machineCode query param required' },
    } satisfies ApiResponse);
    return;
  }

  try {
    const machine = await prisma.machine.findUnique({
      where: { machineCode: machineCode.toUpperCase() },
    });

    if (!machine) {
      res.status(404).json({
        success: false,
        error: { code: 'MACHINE_NOT_FOUND', message: 'Machine not found' },
      } satisfies ApiResponse);
      return;
    }

    // Fetch jobs assigned to this machine that are paid but not printed yet
    const pendingJobs = await prisma.printJob.findMany({
      where: {
        machineId: machine.id,
        status: { in: ['PAYMENT_SUCCESS', 'ASSIGNED_TO_MACHINE', 'DOWNLOADING'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: { jobs: pendingJobs },
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[Machine Jobs] Error fetching pending jobs:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch pending jobs' },
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/machine/jobs/:jobId/file
 * Secure file download endpoint for the assigned ATM machine.
 */
export async function downloadJobFile(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  try {
    const job = await prisma.printJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Print job not found' },
      } satisfies ApiResponse);
      return;
    }

    const filePath = job.fileUrl;
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File no longer exists on server' },
      } satisfies ApiResponse);
      return;
    }

    // Update job status to DOWNLOADING
    await prisma.printJob.update({
      where: { id: jobId },
      data: { status: 'DOWNLOADING' },
    });

    // Send file stream
    res.download(filePath, job.fileName);
  } catch (err) {
    console.error(`[Download Error] Job ${jobId}:`, err);
    res.status(500).json({
      success: false,
      error: { code: 'DOWNLOAD_FAILED', message: 'Could not stream job file' },
    } satisfies ApiResponse);
  }
}
