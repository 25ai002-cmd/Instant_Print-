import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, QrCode, Lock } from "lucide-react";
import { Logo } from "../components/Logo";

export function SessionExpired() {
  const handleScanAgain = () => {
    sessionStorage.clear();
    localStorage.removeItem("printatm_client_token");
    window.location.href = "/";
  };

  return (
    <div className="mobile-shell text-center py-10 px-4">
      <div className="pt-2 pb-6 flex justify-center">
        <Logo />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm"
      >
        <ShieldCheck size={44} />
      </motion.div>

      <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">
        Session Completed &amp; Expired
      </h1>

      <p className="mt-2 text-sm text-muted max-w-xs mx-auto leading-relaxed">
        Your document print job is complete. For your security and privacy, this mobile session has been closed and all temporary upload files have been wiped.
      </p>

      <div className="mt-6 p-4 rounded-control bg-slate-50 border border-slate-200 text-left space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" /> Document Printed &amp; Spooled
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 size={16} className="text-emerald-500" /> Uploaded File Securely Erased
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Lock size={16} className="text-slate-400" /> Single-User Session Expired
        </div>
      </div>

      <div className="mt-8 p-5 rounded-2xl bg-primary/5 border border-primary/20 text-center">
        <QrCode className="mx-auto text-primary mb-2" size={32} />
        <h3 className="font-display text-sm font-bold text-slate-800">Want to Print Another File?</h3>
        <p className="text-xs text-slate-600 mt-1 leading-normal">
          Please scan the new QR code displayed on the PrintATM kiosk screen to start a fresh session.
        </p>

        <button
          onClick={handleScanAgain}
          className="mt-4 w-full py-3.5 px-6 rounded-control bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <QrCode size={18} /> Scan Kiosk QR Code Again
        </button>
      </div>
    </div>
  );
}
