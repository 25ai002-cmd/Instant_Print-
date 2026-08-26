import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Smartphone, QrCode, AlertTriangle, Printer } from "lucide-react";
import { Logo } from "../components/Logo";
import { KioskCard } from "../components/KioskCard";
import { StatusRing } from "../components/StatusRing";
import { createSession, deleteSession, getFilePreviewUrl, getPrintStatus, getSession } from "../services/api";
import { KioskSession } from "../types";

const POLL_MS = 2000;
const PRINT_POLL_MS = 1000;
const COLLECT_COUNTDOWN_SECONDS = 10;

export function KioskDisplay() {
  const navigate = useNavigate();
  const [session, setSession] = useState<KioskSession | null>(null);
  const [mobileUrl, setMobileUrl] = useState("");
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [countdown, setCountdown] = useState(COLLECT_COUNTDOWN_SECONDS);
  const sessionIdRef = useRef<string | null>(null);
  const resettingRef = useRef(false);

  // Guard: Never show Kiosk QR Display screen on mobile handheld devices
  useEffect(() => {
    const isMobileDevice =
      window.innerWidth < 768 || /android|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent);
    if (isMobileDevice) {
      navigate("/expired", { replace: true });
    }
  }, [navigate]);

  const startNewSession = useCallback(async () => {
    resettingRef.current = false;
    const created = await createSession();
    sessionIdRef.current = created.sessionId;
    setMobileUrl(created.mobileUrl);
    setQrImageDataUrl(created.qrImageDataUrl);
    setSession({ id: created.sessionId, stage: "CREATED", createdAt: Date.now(), updatedAt: Date.now(), expiresAt: 0 });
    setCountdown(COLLECT_COUNTDOWN_SECONDS);
  }, []);

  // Boot: mint initial session
  useEffect(() => {
    startNewSession();
  }, [startNewSession]);

  // Poll session state continuously
  useEffect(() => {
    const timer = setInterval(async () => {
      const id = sessionIdRef.current;
      if (!id || resettingRef.current) return;
      try {
        const data = await getSession(id);
        setSession(data);
      } catch {
        if (!resettingRef.current) {
          resettingRef.current = true;
          startNewSession();
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [startNewSession]);

  // While printing, poll status
  useEffect(() => {
    if (session?.stage !== "PRINTING") return;
    const id = sessionIdRef.current;
    if (!id) return;

    const timer = setInterval(async () => {
      try {
        const status = await getPrintStatus(id);
        setSession((prev) => (prev ? { ...prev, stage: status.stage as any, printJob: status.printJob } : prev));
      } catch {
        // ignore transient errors
      }
    }, PRINT_POLL_MS);
    return () => clearInterval(timer);
  }, [session?.stage]);

  // On completion, countdown then reset
  useEffect(() => {
    if (session?.stage !== "COMPLETED") return;
    if (countdown <= 0) {
      const id = sessionIdRef.current;
      resettingRef.current = true;
      (async () => {
        if (id) await deleteSession(id).catch(() => undefined);
        startNewSession();
      })();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [session?.stage, countdown, startNewSession]);

  const stage = session?.stage ?? "CREATED";

  return (
    <div className="kiosk-shell bg-gradient-to-b from-surface-alt to-white">
      <div className="absolute top-10 left-10">
        <Logo size="lg" />
      </div>

      <AnimatePresence mode="wait">
        {stage === "CREATED" && (
          <HomeView key="home" qrImageDataUrl={qrImageDataUrl} mobileUrl={mobileUrl} />
        )}

        {stage === "AWAITING_UPLOAD" && (
          <PhoneConnectedView key="phone_connected" />
        )}

        {(stage === "FILE_UPLOADED" || stage === "AWAITING_PAYMENT" || stage === "PAYMENT_FAILED") && (
          <ContinueOnPhoneView key="continue" stage={stage} session={session} />
        )}

        {stage === "PRINTING" && (
          <PrintingView key="printing" progress={session?.printJob?.progressPercent ?? 0} session={session} />
        )}

        {stage === "COMPLETED" && (
          <CompleteView key="complete" countdown={countdown} session={session} onContinue={startNewSession} />
        )}

        {stage === "ERROR" && <ErrorView key="error" />}
      </AnimatePresence>
    </div>
  );
}

function HomeView({ qrImageDataUrl, mobileUrl }: { qrImageDataUrl: string; mobileUrl: string }) {
  return (
    <KioskCard className="text-center">
      <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold text-ink leading-tight">
        Welcome to PrintATM
      </h1>
      <p className="mt-3 text-lg text-muted">Scan the QR code on your phone to upload your document.</p>

      <div className="mt-8 flex justify-center">
        <div className="relative p-5 rounded-3xl bg-white shadow-2xl border-4 border-slate-100 max-w-xs mx-auto group">
          {/* Subtle Ambient Pulsing Glow */}
          <div className="absolute inset-0 rounded-3xl bg-primary/10 animate-pulse pointer-events-none" />

          {qrImageDataUrl ? (
            <div className="relative rounded-2xl bg-white p-2 border border-slate-100">
              <img src={qrImageDataUrl} alt="Scan to start printing" className="w-60 h-60 object-contain rounded-lg" />
              
              {/* Center Kiosk Icon Badge */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary text-white shadow-md border-2 border-white flex items-center justify-center">
                <QrCode size={20} />
              </div>
            </div>
          ) : (
            <div className="w-60 h-60 flex items-center justify-center">
              <QrCode className="text-primary animate-pulse" size={64} />
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Point phone camera to scan
          </div>
        </div>
      </div>
    </KioskCard>
  );
}

function PhoneConnectedView() {
  return (
    <KioskCard className="text-center">
      <div className="flex justify-center my-6">
        <StatusRing size={240} color="#10B981" trackColor="#D1FAE5">
          <div className="flex flex-col items-center gap-2 text-emerald-600">
            <Smartphone size={56} className="animate-bounce" />
            <span className="font-display font-extrabold text-xs tracking-wider uppercase bg-emerald-100 text-emerald-800 py-1 px-3 rounded-full">
              Connected
            </span>
          </div>
        </StatusRing>
      </div>

      <h2 className="mt-8 font-display text-3xl font-extrabold text-ink tracking-tight">
        📱 Phone Connected!
      </h2>
      <p className="mt-3 text-muted text-lg max-w-md mx-auto">
        A customer has scanned the QR code and is selecting a document to print.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        Single-User Session Active · Scanner Locked
      </div>
    </KioskCard>
  );
}

function ContinueOnPhoneView({ stage, session }: { stage: string; session: KioskSession | null }) {
  const isFailed = stage === "PAYMENT_FAILED";
  return (
    <KioskCard className="text-center">
      <div className="flex justify-center my-6">
        <StatusRing size={220} color={isFailed ? "#DC2626" : "#2563EB"} trackColor={isFailed ? "#FEE2E2" : "#DBEAFE"}>
          <Smartphone className={isFailed ? "text-danger" : "text-primary"} size={64} />
        </StatusRing>
      </div>
      <h2 className="mt-8 font-display text-3xl font-bold text-ink">
        {isFailed ? "Payment didn't go through" : "Document Uploaded Successfully"}
      </h2>
      {session?.file?.originalName && (
        <div className="mt-3 py-2 px-4 rounded-control bg-slate-100 font-display font-bold text-sm text-slate-700 inline-block">
          📄 {session.file.originalName} ({session.file.pageCount} pages)
        </div>
      )}
      <p className="mt-3 text-muted text-lg">
        {isFailed
          ? "Follow the retry option on your phone to try again."
          : "Select your print options and complete payment right from your phone."}
      </p>
    </KioskCard>
  );
}

function PrintingView({ progress, session }: { progress: number; session: KioskSession | null }) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (session?.id && !printedRef.current) {
      printedRef.current = true;
      triggerBrowserPrint(session.id);
    }
  }, [session?.id]);

  return (
    <KioskCard className="text-center">
      <div className="flex justify-center my-6">
        <StatusRing percent={progress} size={280}>
          <span className="font-display text-5xl font-extrabold text-primary">{progress}%</span>
        </StatusRing>
      </div>
      <h2 className="mt-8 font-display text-3xl font-extrabold text-ink">Printing Document…</h2>
      <p className="mt-2 text-muted text-base">Spooling document to your physical printer.</p>
      
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => session?.id && triggerBrowserPrint(session.id)}
          className="px-6 py-3 rounded-control bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <Printer size={18} /> Send to Physical Printer Now
        </button>
      </div>
    </KioskCard>
  );
}

function triggerBrowserPrint(sessionId: string) {
  try {
    const previewUrl = getFilePreviewUrl(sessionId);
    // Open print preview tab that auto-triggers window.print()
    const printWin = window.open(previewUrl, "_blank");
    if (printWin) {
      printWin.onload = () => {
        try {
          printWin.focus();
          printWin.print();
        } catch {
          // fallback handled by user clicking print in new tab
        }
      };
    }
  } catch (err) {
    console.error("Print trigger error:", err);
  }
}

function CompleteView({
  countdown,
  session,
  onContinue,
}: {
  countdown: number;
  session: KioskSession | null;
  onContinue: () => void;
}) {
  const singleRate = session?.options?.colorMode === "COLOR" ? 10.0 : 2.0;
  const pgs = session?.options?.pagesToPrint || session?.file?.pageCount || 1;
  const cps = session?.options?.copies || 1;
  const total = session?.price?.total ?? singleRate * pgs * cps;

  return (
    <KioskCard className="text-center">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 size={48} />
        </div>
      </motion.div>
      <h2 className="mt-6 font-display text-3xl font-extrabold text-ink">
        Print Complete! Collect Your Document 🖨️
      </h2>
      <p className="mt-2 text-muted text-base">
        Your physical document has printed out into the paper tray below. Please collect your pages.
      </p>

      {/* Itemized Invoice Receipt Box */}
      <div className="mt-6 p-4 rounded-control bg-slate-50 border border-slate-200 text-left text-xs shadow-sm">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-bold text-ink">
          <span>TAX INVOICE RECEIPT</span>
          <span className="text-emerald-600 font-extrabold">PAID ✅</span>
        </div>
        <div className="mt-2 flex justify-between text-slate-600 font-semibold">
          <span>Single Page Rate ({session?.options?.colorMode === "COLOR" ? "Color" : "B&W"}):</span>
          <span>₹{singleRate.toFixed(2)} / pg</span>
        </div>
        <div className="mt-1 flex justify-between text-ink font-bold text-sm bg-white p-2 rounded border border-slate-200">
          <span>Total Pages &amp; Copies:</span>
          <span className="text-primary">
            ₹{singleRate.toFixed(2)} × {pgs} pgs × {cps} {cps === 1 ? "copy" : "copies"}
          </span>
        </div>
        <div className="mt-2 flex justify-between font-extrabold text-ink text-base pt-1">
          <span>Total Paid Amount:</span>
          <span className="text-emerald-700">₹{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={onContinue}
          className="w-full py-4 px-6 rounded-2xl bg-primary hover:bg-primary-dark text-white font-extrabold text-base shadow-lg transition-all flex items-center justify-center gap-2 group"
        >
          <span>Continue / Scan Next Document</span>
          <QrCode size={20} className="group-hover:scale-110 transition-transform" />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span>Auto-resetting kiosk QR code in</span>
          <span className="font-display text-xl font-extrabold text-primary">{countdown}s</span>
        </div>
      </div>
    </KioskCard>
  );
}

function ErrorView() {
  return (
    <KioskCard className="text-center">
      <div className="mx-auto flex items-center justify-center w-28 h-28 rounded-full bg-danger/10">
        <AlertTriangle className="text-danger" size={64} />
      </div>
      <h2 className="mt-8 font-display text-3xl font-bold text-ink">Something went wrong</h2>
      <p className="mt-3 text-muted text-lg">Please check your phone for details, or ask an attendant for help.</p>
    </KioskCard>
  );
}
