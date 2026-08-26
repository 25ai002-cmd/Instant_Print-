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

  let bwPagesPerCopy = 0;
  let colorPagesPerCopy = 0;

  if (options.colorMode === "COLOR") {
    colorPagesPerCopy = selectedPages.length;
  } else {
    bwPagesPerCopy = selectedPages.length;
  }

  const sizeMultiplier = RATES.PAPER_SIZE_MULTIPLIER[options.paperSize] || 1;
  const bwRate = +(RATES.BW_PER_PAGE * sizeMultiplier).toFixed(2);
  const colorRate = +(RATES.COLOR_PER_PAGE * sizeMultiplier).toFixed(2);

  const copies = Math.max(1, options.copies);
  const bwPages = bwPagesPerCopy * copies;
  const colorPages = colorPagesPerCopy * copies;

  // Exact pricing: ₹2/pg for B&W, ₹10/pg for Color. Double-sided (2 pages front & back) = 2 x rate.
  const subtotal = +(bwPages * bwRate + colorPages * colorRate).toFixed(2);
  const total = subtotal;

  return {
    bwPages,
    colorPages,
    bwRate,
    colorRate,
    copies,
    subtotal,
    doubleSidedDiscount: 0,
    bulkDiscount: 0,
    total,
    currency: "INR",
  };
}
