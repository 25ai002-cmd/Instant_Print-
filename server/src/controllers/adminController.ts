// ============================================================
// PrintATM Cloud SaaS Platform — Admin Controller
// Dashboard analytics, machine fleet management, pricing updates,
// and audit log inspection.
// ============================================================

import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/admin/dashboard
 * Aggregates platform metrics: machines, active print queue, total revenue, alerts.
 */
export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  try {
    const totalMachines = await prisma.machine.count();
    const onlineMachines = await prisma.machine.count({ where: { isOnline: true } });
    const totalJobs = await prisma.printJob.count();
    const completedJobs = await prisma.printJob.count({ where: { status: 'COMPLETED' } });
    const failedJobs = await prisma.printJob.count({ where: { status: 'FAILED' } });
    const pendingQueue = await prisma.printJob.count({
      where: { status: { in: ['PAYMENT_SUCCESS', 'ASSIGNED_TO_MACHINE', 'DOWNLOADING', 'PRINTING'] } },
    });

    // Total Revenue calculation
    const successfulPayments = await prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });

    const totalRevenueINR = (successfulPayments._sum.amount || 0) / 100;

    // Recent Machines with paper/toner info
    const machines = await prisma.machine.findMany({
      include: { pricing: true, settings: true },
      orderBy: { machineCode: 'asc' },
    });

    // Recent Print Jobs
    const recentJobs = await prisma.printJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { machine: { select: { machineCode: true, name: true } } },
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalMachines,
          onlineMachines,
          offlineMachines: totalMachines - onlineMachines,
          totalJobs,
          completedJobs,
          failedJobs,
          pendingQueue,
          totalRevenueINR,
        },
        machines,
        recentJobs,
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[Admin Dashboard] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch admin dashboard metrics' },
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/admin/machines
 * List all registered ATM machines.
 */
export async function getMachines(req: Request, res: Response): Promise<void> {
  try {
    const machines = await prisma.machine.findMany({
      include: { settings: true, pricing: true },
      orderBy: { machineCode: 'asc' },
    });

    res.json({
      success: true,
      data: { machines },
    } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch machines list' },
    } satisfies ApiResponse);
  }
}

/**
 * PUT /api/admin/machines/:machineId/pricing
 * Update machine pricing rate card.
 */
export async function updateMachinePricing(req: Request, res: Response): Promise<void> {
  const { machineId } = req.params;
  const { bwSingleRate, bwDoubleRate, colorSingleRate, colorDoubleRate } = req.body;

  try {
    const updatedPricing = await prisma.pricing.upsert({
      where: { machineId },
      update: {
        ...(bwSingleRate !== undefined ? { bwSingleRate: Number(bwSingleRate) } : {}),
        ...(bwDoubleRate !== undefined ? { bwDoubleRate: Number(bwDoubleRate) } : {}),
        ...(colorSingleRate !== undefined ? { colorSingleRate: Number(colorSingleRate) } : {}),
        ...(colorDoubleRate !== undefined ? { colorDoubleRate: Number(colorDoubleRate) } : {}),
      },
      create: {
        machineId,
        bwSingleRate: Number(bwSingleRate || 2.0),
        bwDoubleRate: Number(bwDoubleRate || 4.0),
        colorSingleRate: Number(colorSingleRate || 10.0),
        colorDoubleRate: Number(colorDoubleRate || 16.0),
      },
    });

    res.json({
      success: true,
      data: { pricing: updatedPricing },
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[Update Pricing] Error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update machine pricing' },
    } satisfies ApiResponse);
  }
}
