// ============================================================
// PrintATM Cloud SaaS Platform — Prisma Database Client
// ============================================================

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});
