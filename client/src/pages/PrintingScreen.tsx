import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { StatusRing } from "../components/StatusRing";
import { deleteSession, getPrintStatus, startPrint } from "../services/api";
import { PrintJobInfo } from "../types";

const FAULT_STATES = new Set(["PAPER_EMPTY", "OUT_OF_INK", "OFFLINE", "ERROR"]);

const FAULT_MESSAGES: Record<string, string> = {
  PAPER_EMPTY: "The printer has run out of paper. An attendant has been notified.",
  OUT_OF_INK: "The printer is low on ink or toner. An attendant has been notified.",
  OFFLINE: "The printer went offline unexpectedly.",
  ERROR: "The printer reported an unknown error.",
};

export function PrintingScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<PrintJobInfo | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(async () => {
      try {
        const status = await getPrintStatus(sessionId);
        if (status.printJob) setJob(status.printJob);
        if (status.stage === "COMPLETED") {
          navigate(`/complete/${sessionId}`);
        }
      } catch {
        // transient — keep polling
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sessionId, navigate]);

  const isFault = job && FAULT_STATES.has(job.state);

  const handleRetry = async () => {
    if (!sessionId) return;
    setRetrying(true);
    try {
      await startPrint(sessionId);
      setJob(null);
    } finally {
      setRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (sessionId) await deleteSession(sessionId).catch(() => undefined);
    navigate("/");
  };

  if (isFault) {
    return (
      <div className="mobile-shell items-center justify-center text-center px-6">
        <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center mb-6">
          <AlertTriangle className="text-danger" size={40} />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-ink">Printer Issue</h1>
        <p className="mt-2 text-muted">{FAULT_MESSAGES[job!.state] ?? "The printer hit a problem."}</p>
        <div className="mt-8 w-full flex flex-col gap-3">
          <BigButton icon={<RotateCcw size={20} />} onClick={handleRetry} disabled={retrying}>
            Retry Print
          </BigButton>
          <BigButton variant="secondary" icon={<X size={20} />} onClick={handleCancel}>
            Cancel
          </BigButton>
        </div>
      </div>
    );
  }

  const progress = job?.progressPercent ?? 0;

  return (
    <div className="mobile-shell items-center justify-center text-center">
      <div className="pb-6">
        <Logo />
      </div>
      <StatusRing percent={progress} size={240}>
        <span className="font-display text-4xl font-extrabold text-primary">{progress}%</span>
      </StatusRing>
      <h1 className="mt-8 font-display text-2xl font-extrabold text-ink">Printing…</h1>
      <p className="mt-2 text-muted">
        {job?.estimatedSecondsRemaining ? `About ${job.estimatedSecondsRemaining}s remaining` : "Please wait"}
      </p>
      <p className="mt-6 text-sm text-muted">Please don't close this page or walk away from the machine.</p>
    </div>
  );
}
