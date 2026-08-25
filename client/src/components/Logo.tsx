import { Printer } from "lucide-react";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const isLarge = size === "lg";
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`flex items-center justify-center rounded-2xl bg-primary text-white ${
          isLarge ? "w-14 h-14" : "w-10 h-10"
        }`}
      >
        <Printer size={isLarge ? 28 : 20} strokeWidth={2.4} />
      </div>
      <span className={`font-display font-extrabold tracking-tight text-ink ${isLarge ? "text-3xl" : "text-xl"}`}>
        Print<span className="text-primary">ATM</span>
      </span>
    </div>
  );
}
