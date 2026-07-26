// ============================================================
// PrintATM — Pricing Service
// Rate card:
//   B&W   Single-Sided: ₹2 per page
//   B&W   Double-Sided: ₹4 per sheet (2 pages) => ₹2/side
//   Color Single-Sided: ₹10 per page
//   Color Double-Sided: ₹16 per sheet (2 pages) => ₹8/side
// ============================================================

import type { DocumentAnalysis, PrintSettings, PriceBreakdown, PricingConfig, PageRange } from '../types/index.js';

/**
 * Count how many pages are covered by the given ranges,
 * clamped to [1, totalPageCount].
 */
export function countPagesInRanges(ranges: PageRange[], totalPageCount: number): number {
  if (!ranges || ranges.length === 0) return totalPageCount;
  const pages = new Set<number>();
  for (const { from, to } of ranges) {
    const start = Math.max(1, from);
    const end = Math.min(to, totalPageCount);
    for (let p = start; p <= end; p++) pages.add(p);
  }
  return pages.size;
}

const DEFAULT_RATES: PricingConfig = {
  bwRatePerPage: 2.0,       // ₹2 per page B&W
  colorRatePerPage: 10.0,   // ₹10 per page Color single-sided
  doubleSideFactor: 1.0,
  a3Multiplier: 2.0,
  legalMultiplier: 1.2,
  letterMultiplier: 1.1,
  minimumCharge: 2.0,       // Minimum charge ₹2
};

/**
 * Calculate the total price for a print job.
 */
export function calculatePrice(
  analysis: DocumentAnalysis,
  settings: PrintSettings,
  rates: PricingConfig = DEFAULT_RATES
): PriceBreakdown {
  const isColor = settings.colorMode === 'color';
  const isDouble = settings.sides === 'double';

  // Paper size multiplier (A4 = 1.0 baseline)
  let paperSizeMultiplier = 1.0;
  if (settings.paperSize === 'A3') paperSizeMultiplier = rates.a3Multiplier;
  else if (settings.paperSize === 'Legal') paperSizeMultiplier = rates.legalMultiplier;
  else if (settings.paperSize === 'Letter') paperSizeMultiplier = rates.letterMultiplier;

  // Selected pages per single copy
  const selectedPageCount = (settings.pageRanges && settings.pageRanges.length > 0)
    ? countPagesInRanges(settings.pageRanges, analysis.pageCount)
    : analysis.pageCount;

  // Total content pages across all copies
  const totalPages = selectedPageCount * settings.copies;

  let baseRatePerPage: number;
  let singleCopyCost = 0;

  if (isColor) {
    baseRatePerPage = 10.0;
    if (isDouble) {
      // Color Double-Sided: ₹16 per 2-sided sheet + ₹10 for leftover single page
      const fullSheets = Math.floor(selectedPageCount / 2);
      const leftoverPage = selectedPageCount % 2;
      singleCopyCost = (fullSheets * 16.0) + (leftoverPage * 10.0);
    } else {
      // Color Single-Sided: ₹10 per page
      singleCopyCost = selectedPageCount * 10.0;
    }
  } else {
    baseRatePerPage = 2.0;
    if (isDouble) {
      // B&W Double-Sided: ₹4 per 2-sided sheet + ₹2 for leftover single page
      const fullSheets = Math.floor(selectedPageCount / 2);
      const leftoverPage = selectedPageCount % 2;
      singleCopyCost = (fullSheets * 4.0) + (leftoverPage * 2.0);
    } else {
      // B&W Single-Sided: ₹2 per page
      singleCopyCost = selectedPageCount * 2.0;
    }
  }

  const rawSubtotal = singleCopyCost * settings.copies * paperSizeMultiplier;
  const total = Math.max(Math.round(rawSubtotal * 100) / 100, rates.minimumCharge);

  return {
    baseRatePerPage,
    colorSurchargePerPage: isColor ? 8.0 : 0,
    doubleSideDiscountFactor: isDouble ? (isColor ? 0.8 : 1.0) : 1.0,
    paperSizeMultiplier,
    copies: settings.copies,
    totalPages,
    effectivePages: totalPages,
    subtotal: rawSubtotal,
    total,
    currency: 'INR',
  };
}

/**
 * Convert INR to paise (Razorpay uses smallest currency unit).
 */
export function inrToPaise(amount: number): number {
  return Math.round(amount * 100);
}
