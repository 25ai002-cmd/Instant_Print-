// ============================================================
// PrintATM Cloud SaaS Platform — Database Seed Script
// Populates default machines, rate cards, and admin users.
// ============================================================

import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('[Seed] Seeding database with initial SaaS platform data...');

  try {
    // 1. Seed Super Admin
    const adminEmail = 'admin@printatm.com';
    const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.adminUser.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
        },
      });
      console.log('[Seed] Created Super Admin: admin@printatm.com / admin123');
    }

    // 2. Seed Machine ATM001
    const m1Code = 'ATM001';
    let m1 = await prisma.machine.findUnique({ where: { machineCode: m1Code } });
    if (!m1) {
      m1 = await prisma.machine.create({
        data: {
          machineCode: m1Code,
          name: 'Instant Print Kiosk #1',
          locationName: 'Central Campus Library',
          printerModel: 'Brother DCP-L2531DW',
          status: 'ONLINE',
          isOnline: true,
          authToken: 'token_atm001_secret_key_2026',
        },
      });
      console.log('[Seed] Created Machine: ATM001');
    }

    // 3. Seed Machine Settings for ATM001
    const s1 = await prisma.machineSettings.findUnique({ where: { machineId: m1.id } });
    if (!s1) {
      await prisma.machineSettings.create({
        data: {
          machineId: m1.id,
          colorEnabled: true,
          duplexEnabled: true,
          autoResetSec: 25,
        },
      });
    }

    // 4. Seed Pricing for ATM001
    const p1 = await prisma.pricing.findUnique({ where: { machineId: m1.id } });
    if (!p1) {
      await prisma.pricing.create({
        data: {
          machineId: m1.id,
          bwSingleRate: 2.0,      // ₹2 per B&W page
          bwDoubleRate: 4.0,      // ₹4 per 2-sided B&W sheet
          colorSingleRate: 10.0,  // ₹10 per Color page
          colorDoubleRate: 16.0,  // ₹16 per 2-sided Color sheet
          a3Multiplier: 2.0,
          legalMultiplier: 1.2,
          letterMultiplier: 1.1,
          minimumCharge: 2.0,
        },
      });
    }

    // 5. Seed Machine ATM002 (Secondary Machine for testing multi-ATM scalability!)
    const m2Code = 'ATM002';
    let m2 = await prisma.machine.findUnique({ where: { machineCode: m2Code } });
    if (!m2) {
      m2 = await prisma.machine.create({
        data: {
          machineCode: m2Code,
          name: 'Instant Print Kiosk #2',
          locationName: 'Metro Station Station Hall',
          printerModel: 'Brother DCP-L2531DW',
          status: 'OFFLINE',
          isOnline: false,
          authToken: 'token_atm002_secret_key_2026',
        },
      });
      console.log('[Seed] Created Machine: ATM002');
    }

    console.log('[Seed] Database seed completed successfully!');
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
  }
}
