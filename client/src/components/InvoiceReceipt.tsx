import { CheckCircle2, Printer, Download, FileText, IndianRupee, Tag } from "lucide-react";
import { KioskSession } from "../types";

interface InvoiceReceiptProps {
  session: KioskSession;
  onDone?: () => void;
}

export function InvoiceReceipt({ session, onDone }: InvoiceReceiptProps) {
  const file = session.file;
  const options = session.options;
  const price = session.price;

  const invNo = session.accessCode ? `INV-${session.accessCode}` : `INV-${session.id.slice(0, 6).toUpperCase()}`;
  const formattedDate = new Date(session.updatedAt || Date.now()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Calculate rate per single page
  const singlePageRate = options?.colorMode === "COLOR" ? 10.0 : 2.0;
  const pagesCount = options?.pagesToPrint || file?.pageCount || 1;
  const copiesCount = options?.copies || 1;
  const baseSubtotal = singlePageRate * pagesCount * copiesCount;

  return (
    <div className="w-full max-w-md mx-auto my-4 text-left font-body">
      {/* Receipt Card */}
      <div className="bg-white rounded-card border border-slate-200 shadow-lg p-6 sm:p-8 relative overflow-hidden">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-dashed border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Printer className="text-primary" size={24} />
              <span className="font-display text-xl font-extrabold text-ink">
                Print<span className="text-primary">ATM</span>
              </span>
            </div>
            <p className="text-[11px] font-semibold text-muted mt-0.5">TAX INVOICE &amp; RECEIPT</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={12} /> PAID
            </span>
            <p className="text-[11px] font-mono font-bold text-ink mt-1">#{invNo}</p>
          </div>
        </div>

        {/* Info Rows */}
        <div className="grid grid-cols-2 gap-3 my-4 py-3 bg-slate-50 rounded-control px-4 text-xs">
          <div>
            <span className="block text-muted text-[10px] uppercase font-bold">Date &amp; Time</span>
            <span className="font-bold text-ink">{formattedDate}</span>
          </div>
          <div>
            <span className="block text-muted text-[10px] uppercase font-bold">Payment Status</span>
            <span className="font-bold text-emerald-600">Successful</span>
          </div>
        </div>

        {/* Document Info */}
        <div className="mb-4 pb-4 border-b border-slate-100">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Item Details</span>
          <div className="flex items-start gap-2.5">
            <FileText size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink truncate">{file?.originalName ?? "Printed Document"}</p>
              <p className="text-xs text-muted mt-0.5">
                {options?.paperSize ?? "A4"} · {options?.colorMode === "COLOR" ? "Full Color" : "Black & White"} ·{" "}
                {options?.sides === "DOUBLE" ? "Double Sided" : "Single Sided"}
              </p>
            </div>
          </div>
        </div>

        {/* Itemized Calculation Table (Exact Formula: Single Page Cost * Pages * Copies) */}
        <div className="mb-5">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-2">Cost Breakdown</span>
          <div className="space-y-2 text-xs">
            {/* Single Page Rate Row */}
            <div className="flex justify-between items-center text-slate-600">
              <span>Single Page Base Rate:</span>
              <span className="font-semibold text-ink">₹{singlePageRate.toFixed(2)} / page</span>
            </div>

            {/* Exact Math Formula Row */}
            <div className="bg-primary-light/60 p-3 rounded-control border border-primary/20">
              <div className="flex justify-between items-center font-bold text-ink text-sm">
                <span>Calculation Formula:</span>
                <span className="text-primary">
                  ₹{singlePageRate.toFixed(2)} × {pagesCount} pgs × {copiesCount} {copiesCount === 1 ? "copy" : "copies"}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">
                ({pagesCount} page{pagesCount !== 1 ? "s" : ""} selected at ₹{singlePageRate.toFixed(2)} per page)
              </p>
            </div>

            {/* Base Subtotal */}
            <div className="flex justify-between items-center text-ink font-semibold pt-1">
              <span>Base Subtotal:</span>
              <span>₹{baseSubtotal.toFixed(2)}</span>
            </div>

            {/* Discounts (if any) */}
            {price && price.doubleSidedDiscount > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold">
                <span className="flex items-center gap-1">
                  <Tag size={12} /> Double-Sided Discount (-10%):
                </span>
                <span>-₹{price.doubleSidedDiscount.toFixed(2)}</span>
              </div>
            )}
            {price && price.bulkDiscount > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold">
                <span className="flex items-center gap-1">
                  <Tag size={12} /> Bulk Discount:
                </span>
                <span>-₹{price.bulkDiscount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Final Total Box */}
        <div className="p-4 rounded-control bg-slate-900 text-white flex items-center justify-between mb-5 shadow-md">
          <div>
            <span className="text-xs text-slate-400 block font-semibold">TOTAL AMOUNT PAID</span>
            <span className="text-[10px] text-emerald-400 font-bold">Inclusive of all taxes</span>
          </div>
          <span className="font-display text-2xl font-extrabold text-white flex items-center">
            <IndianRupee size={22} className="mr-0.5 text-emerald-400" />
            {price?.total.toFixed(2) ?? baseSubtotal.toFixed(2)}
          </span>
        </div>

        {/* Receipt Footer Note */}
        <div className="text-center pt-2 border-t border-dashed border-slate-200">
          <p className="text-[11px] text-muted">Thank you for using PrintATM Self-Service Kiosk!</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Please collect your printed pages from the kiosk tray.</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-control bg-white border border-slate-300 hover:bg-slate-50 text-ink text-sm font-bold py-3 px-4 flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Download size={16} /> Save / Print Receipt
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-control bg-primary hover:bg-primary-dark text-white text-sm font-bold py-3 px-4 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
