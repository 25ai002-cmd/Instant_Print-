import { motion } from "framer-motion";
import { ReactNode } from "react";

export function KioskCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`w-full max-w-xl rounded-card bg-surface shadow-soft px-10 py-12 md:px-14 md:py-16 ${className}`}
    >
      {children}
    </motion.div>
  );
}
