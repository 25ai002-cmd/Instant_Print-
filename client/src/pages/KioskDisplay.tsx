import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Smartphone, QrCode, AlertTriangle } from "lucide-react";
import { Logo } from "../components/Logo";
import { KioskCard } from "../components/KioskCard";
import { StatusRing } from "../components/StatusRing";
import { createSession, deleteSession, getPrintStatus, getSession } from "../services/api";
import { KioskSession } from "../types";

const POLL_MS = 2000;
const PRINT_POLL_MS = 1000;
const COLLECT_COUNTDOWN_SECONDS = 5;

export function KioskDisplay() {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [mobileUrl, setMobileUrl] = useState("");
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [countdown, setCountdown] = useState(COLLECT_COUNTDOWN_SECONDS);
  const sessionIdRef = useRef<string | null>(null);
  const resettingRef = useRef(false);

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
        {(stage === "CREATED" || stage === "AWAITING_UPLOAD") && (
          <HomeView key="home" qrImageDataUrl={qrImageDataUrl} mobileUrl={mobileUrl} />
        )}

        {(stage === "FILE_UPLOADED" || stage === "AWAITING_PAYMENT" || stage === "PAYMENT_FAILED") && (
          <ContinueOnPhoneView key="continue" stage={stage} session={session} />
        )}

        {stage === "PRINTING" && (
          <PrintingView key="printing" progress={session?.printJob?.progressPercent ?? 0} />
        )}

        {stage === "COMPLETED" && <CompleteView key="complete" countdown={countdown} />}

        {stage === "ERROR" && <ErrorView key="error" />}
      </AnimatePresence>
    </div>
  );
}

function HomeView({ qrImageDataUrl, mobileUrl }: { qrImageDataUrl: string; mobileUrl: string }) {
  return (
    <KioskCard className="text-center">
      <Logo size="lg" />
      <h1 className="mt-10 font-display text-4xl md:text-5xl font-extrabold text-ink leading-tight">
        Welcome to PrintATM
      </h1>
      <p className="mt-3 text-lg text-muted">Scan the QR code on your phone to upload your document.</p>

      <div className="mt-10 flex justify-center">
        <StatusRing size={300}>
          {qrImageDataUrl ? (
            <div className="rounded-3xl bg-white p-4 shadow-soft">
              <img src={qrImageDataUrl} alt="Scan to start printing" className="w-52 h-52" />
            </div>
          ) : (
            <QrCode className="text-primary" size={64} />
          )}
        </StatusRing>
      </div>

      <p className="mt-8 text-sm text-muted break-all">{mobileUrl}</p>
    </KioskCard>
  );
}

function ContinueOnPhoneView({ stage, session }: { stage: string; session: KioskSession | null }) {
  const isFailed = stage === "PAYMENT_FAILED";
  return (
    <KioskCard className="text-center">
      <StatusRing size={220} color={isFailed ? "#DC2626" : "#2563EB"} trackColor={isFailed ? "#FEE2E2" : "#DBEAFE"}>
        <Smartphone className={isFailed ? "text-danger" : "text-primary"} size={64} />
      </StatusRing>
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

function PrintingView({ progress }: { progress: number }) {
  return (
    <KioskCard className="text-center">
      <StatusRing percent={progress} size={280}>
        <span className="font-display text-5xl font-extrabold text-primary">{progress}%</span>
      </StatusRing>
      <h2 className="mt-8 font-display text-3xl font-bold text-ink">Printing…</h2>
      <p className="mt-3 text-muted text-lg">Please wait. Do not walk away from the machine.</p>
    </KioskCard>
  );
}

function CompleteView({ countdown }: { countdown: number }) {
  return (
    <KioskCard className="text-center">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <div className="mx-auto flex items-center justify-center w-28 h-28 rounded-full bg-success/10">
          <CheckCircle2 className="text-success" size={64} />
        </div>
      </motion.div>
      <h2 className="mt-8 font-display text-3xl font-bold text-ink">Printing Complete</h2>
      <p className="mt-3 text-muted text-lg">Please collect your documents from the tray.</p>
      <p className="mt-8 font-display text-6xl font-extrabold text-primary">{countdown}</p>
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
