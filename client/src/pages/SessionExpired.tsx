import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { Logo } from "../components/Logo";

export function SessionExpired() {
  return (
    <div className="mobile-shell text-center py-10 px-4">
      <div className="pt-2 pb-6 flex justify-center">
        <Logo />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 mx-auto rounded-full bg-slate-100 text-primary border border-slate-200 flex items-center justify-center mb-4"
      >
        <ShieldCheck size={44} />
      </motion.div>

      <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">
        Session Completed &amp; Expired
      </h1>

      <p className="mt-2 text-sm text-muted max-w-xs mx-auto leading-relaxed">
        Your document print job is complete. For your privacy, your session and uploaded files have been securely erased.
      </p>

      <div className="mt-8 p-4 rounded-control bg-slate-50 border border-slate-200 text-left space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" /> Document Printed &amp; Collected
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" /> Temporary Upload Wiped
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" /> Payment Receipt Generated
        </div>
      </div>

      <div className="mt-8">
        <p className="text-xs text-muted font-medium mb-3">Want to print another file?</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="w-full py-3 px-6 rounded-control bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} /> Scan Kiosk QR Code Again
        </button>
      </div>
    </div>
  );
}
