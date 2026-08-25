import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "../components/Logo";

export function PrintComplete() {
  return (
    <div className="mobile-shell items-center justify-center text-center">
      <div className="pb-6">
        <Logo />
      </div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center"
      >
        <CheckCircle2 className="text-success" size={52} />
      </motion.div>
      <h1 className="mt-8 font-display text-2xl font-extrabold text-ink">Printing Complete</h1>
      <p className="mt-2 text-muted">Please collect your documents from the kiosk tray.</p>
      <p className="mt-6 text-sm text-muted">
        Your file and payment details have been deleted from PrintATM. Thanks for using PrintATM!
      </p>
    </div>
  );
}
