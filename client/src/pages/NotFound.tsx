import { QrCode } from "lucide-react";
import { Logo } from "../components/Logo";

export function NotFound() {
  return (
    <div className="mobile-shell items-center justify-center text-center px-6">
      <div className="pb-6">
        <Logo />
      </div>
      <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mb-6">
        <QrCode className="text-primary" size={36} />
      </div>
      <h1 className="font-display text-2xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">
        This link may have expired. Please scan the QR code on the PrintATM kiosk to start again.
      </p>
    </div>
  );
}
