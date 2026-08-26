import { IndianRupee, ShieldCheck, Zap } from "lucide-react";

interface UpiQrCardProps {
  qrImageDataUrl: string;
  amount?: number;
  secondsLeft?: number;
  title?: string;
  subtitle?: string;
  showUpiApps?: boolean;
}

export function UpiQrCard({
  qrImageDataUrl,
  amount,
  secondsLeft,
  title = "Scan to Pay via UPI",
  subtitle = "Accepts Google Pay, PhonePe, Paytm, BHIM & all UPI Apps",
  showUpiApps = true,
}: UpiQrCardProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto rounded-3xl bg-slate-900 text-white p-6 shadow-2xl border border-slate-800 overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Amount Header if provided */}
      {amount !== undefined && (
        <div className="text-center mb-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Amount Due
          </span>
          <div className="inline-flex items-center gap-1.5 font-display text-4xl font-extrabold text-emerald-400 drop-shadow-sm">
            <IndianRupee size={32} strokeWidth={2.8} />
            {amount.toFixed(2)}
          </div>
        </div>
      )}

      {/* High-Contrast QR Code Container with Center UPI Badge */}
      <div className="relative mx-auto w-64 h-64 rounded-2xl bg-white p-3 shadow-xl flex items-center justify-center border-4 border-slate-800">
        <img src={qrImageDataUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain rounded-lg" />

        {/* Center UPI Badge Logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900 p-1 border-2 border-emerald-400 shadow-md flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-slate-900 font-extrabold text-[10px] tracking-tighter">
            UPI
          </div>
        </div>
      </div>

      {/* Countdown Timer Badge */}
      {secondsLeft !== undefined && (
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {secondsLeft > 0
              ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
              : "Expiring…"}
          </div>
        </div>
      )}

      {/* Instruction Title & Subtitle */}
      <div className="mt-4 text-center">
        <h3 className="font-display text-base font-bold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Supported UPI Apps Bar */}
      {showUpiApps && (
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-400 flex-wrap">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1">Accepting:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-extrabold text-blue-400 border border-slate-700">GPay</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-extrabold text-purple-400 border border-slate-700">PhonePe</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-extrabold text-sky-400 border border-slate-700">Paytm</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-extrabold text-emerald-400 border border-slate-700">BHIM</span>
        </div>
      )}
    </div>
  );
}
