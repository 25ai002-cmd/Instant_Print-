import { ButtonHTMLAttributes, ReactNode } from "react";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary text-white shadow-control hover:bg-primary-dark active:scale-[0.98]",
  secondary: "bg-surface-alt text-ink border border-slate-200 hover:bg-slate-100 active:scale-[0.98]",
  danger: "bg-white text-danger border-2 border-danger/30 hover:bg-danger/5 active:scale-[0.98]",
};

export function BigButton({ children, variant = "primary", icon, className = "", ...rest }: BigButtonProps) {
  return (
    <button
      {...rest}
      className={`w-full flex items-center justify-center gap-3 rounded-control px-8 py-5 text-lg font-display font-bold transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
