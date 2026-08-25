import { FileMeta, PriceBreakdown, PrintOptions } from "../types/session";

const RATES = {
  BW_PER_PAGE: 2,
  COLOR_PER_PAGE: 10,
  PAPER_SIZE_MULTIPLIER: {
    A4: 1,
    Letter: 1,
    Legal: 1.2,
    A3: 2,
  } as const,
};

const DOUBLE_SIDED_DISCOUNT_RATE = 0.1; // 10% off the affected pages when duplexing
const BULK_DISCOUNT_TIERS = [
  { minTotalPages: 100, rate: 0.15 },
  { minTotalPages: 50, rate: 0.1 },
  { minTotalPages: 20, rate: 0.05 },
];

/** Expands "1-3,5,8-9" against a known page count into a sorted, deduped page list. */
export function parsePageRange(range: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = range.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(totalPages, parseInt(rangeMatch[2], 10));
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= totalPages) pages.add(p);
    } else {
      const err = new Error(`Invalid page range segment: "${part}"`);
      (err as any).statusCode = 400;
      throw err;
    }
  }
  if (pages.size === 0) {
    const err = new Error("Page range resolved to zero pages");
    (err as any).statusCode = 400;
    throw err;
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function calculatePrice(file: FileMeta, options: PrintOptions): PriceBreakdown {
  const selectedPages =
    options.pageRangeMode === "ALL"
      ? Array.from({ length: file.pageCount }, (_, i) => i + 1)
      : parsePageRange(options.customPageRange ?? "", file.pageCount);

  const colorPageSet = new Set<number>(); // in this simulation we treat the whole doc uniformly by colorMode choice
  let bwPagesPerCopy = 0;
  let colorPagesPerCopy = 0;

  if (options.colorMode === "COLOR") {
    colorPagesPerCopy = selectedPages.length;
  } else {
    bwPagesPerCopy = selectedPages.length;
  }
  void colorPageSet;

  const sizeMultiplier = RATES.PAPER_SIZE_MULTIPLIER[options.paperSize];
  const bwRate = +(RATES.BW_PER_PAGE * sizeMultiplier).toFixed(2);
  const colorRate = +(RATES.COLOR_PER_PAGE * sizeMultiplier).toFixed(2);

  const copies = Math.max(1, options.copies);
  const bwPages = bwPagesPerCopy * copies;
  const colorPages = colorPagesPerCopy * copies;

  const subtotal = +(bwPages * bwRate + colorPages * colorRate).toFixed(2);

  const totalPages = bwPages + colorPages;
  const doubleSidedDiscount =
    options.sides === "DOUBLE" ? +(subtotal * DOUBLE_SIDED_DISCOUNT_RATE).toFixed(2) : 0;

  const bulkTier = BULK_DISCOUNT_TIERS.find((t) => totalPages >= t.minTotalPages);
  const bulkDiscount = bulkTier ? +(subtotal * bulkTier.rate).toFixed(2) : 0;

  const total = Math.max(0, +(subtotal - doubleSidedDiscount - bulkDiscount).toFixed(2));

  return {
    bwPages,
    colorPages,
    bwRate,
    colorRate,
    copies,
    subtotal,
    doubleSidedDiscount,
    bulkDiscount,
    total,
    currency: "INR",
  };
}
