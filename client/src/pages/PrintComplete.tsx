import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { InvoiceReceipt } from "../components/InvoiceReceipt";
import { getSession } from "../services/api";
import { KioskSession } from "../types";

export function PrintComplete() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<KioskSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    getSession(sessionId)
      .then((data) => setSession(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="mobile-shell items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="mobile-shell text-center pb-12">
      <div className="pt-2 pb-4">
        <Logo />
      </div>

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center"
      >
        <CheckCircle2 size={44} />
      </motion.div>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-ink tracking-tight">Printing Complete!</h1>
      <p className="mt-1 text-sm text-muted">Please collect your documents from the kiosk tray.</p>

      {/* Itemized Invoice & Tax Receipt */}
      {session && session.file ? (
        <InvoiceReceipt session={session} onDone={() => navigate("/")} />
      ) : (
        <div className="mt-8 p-6 rounded-card bg-white border border-slate-200 shadow-sm text-center">
          <p className="text-sm font-bold text-ink">Invoice generated &amp; saved.</p>
          <p className="text-xs text-muted mt-1">Your print job was completed successfully.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2.5 rounded-control bg-primary text-white font-bold text-sm"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
