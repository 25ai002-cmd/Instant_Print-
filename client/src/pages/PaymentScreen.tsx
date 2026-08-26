import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, IndianRupee, XCircle, RotateCcw, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { StatusRing } from "../components/StatusRing";
import { UpiQrCard } from "../components/UpiQrCard";
import {
  apiErrorMessage,
  createPayment,
  deleteSession,
  devSimulatePayment,
  retryPayment,
  startPrint,
  verifyPayment,
} from "../services/api";
import { PaymentInfo } from "../types";

export function PaymentScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [devMode, setDevMode] = useState(true);
  const [phase, setPhase] = useState<"LOADING" | "WAITING" | "SUCCESS" | "FAILED" | "ERROR">("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startingPrintRef = useRef(false);

  const beginPayment = useCallback(
    async (isRetry: boolean) => {
      if (!sessionId) return;
      setPhase("LOADING");
      setError(null);
      try {
        const result = isRetry ? await retryPayment(sessionId) : await createPayment(sessionId);
        const p = result.session.payment!;
        setPayment(p);
        setDevMode(result.devMode);
        setPhase("WAITING");
      } catch (err) {
        setError(apiErrorMessage(err));
        setPhase("ERROR");
      }
    },
    [sessionId]
  );

  useEffect(() => {
    beginPayment(false);
  }, [beginPayment]);

  // Countdown display
  useEffect(() => {
    if (!payment || phase !== "WAITING") return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((payment.expiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment, phase]);

  // Poll for payment result
  useEffect(() => {
    if (!sessionId || phase !== "WAITING") return;
    const t = setInterval(async () => {
      try {
        const session = await verifyPayment(sessionId);
        const status = session.payment?.status;
        if (status === "PAID" && !startingPrintRef.current) {
          startingPrintRef.current = true;
          setPhase("SUCCESS");
          await startPrint(sessionId);
          navigate(`/printing/${sessionId}`);
        } else if (status === "FAILED" || status === "TIMED_OUT") {
          setPhase("FAILED");
        }
      } catch {
        // transient — keep polling
      }
    }, 1500);
    return () => clearInterval(t);
  }, [sessionId, phase, navigate]);

  const handleCancel = async () => {
    if (sessionId) await deleteSession(sessionId).catch(() => undefined);
    navigate("/");
  };

  const handleSimulate = async (result: "PAID" | "FAILED") => {
    if (!sessionId) return;
    try {
      await devSimulatePayment(sessionId, result);
    } catch {
      // ignore
    }
  };

  if (phase === "LOADING") {
    return (
      <div className="mobile-shell items-center justify-center">
        <Loader2 className="text-primary animate-spin" size={40} />
      </div>
    );
  }

  if (phase === "ERROR") {
    return (
      <div className="mobile-shell items-center justify-center text-center gap-4">
        <XCircle className="text-danger" size={48} />
        <p className="text-danger font-medium">{error}</p>
        <BigButton onClick={() => beginPayment(false)}>Try Again</BigButton>
      </div>
    );
  }

  if (phase === "FAILED") {
    return (
      <div className="mobile-shell items-center justify-center text-center px-6">
        <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center mb-6">
          <XCircle className="text-danger" size={40} />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-ink">Payment Failed</h1>
        <p className="mt-2 text-muted">Your payment didn't go through. You can try again or cancel.</p>
        <div className="mt-8 w-full flex flex-col gap-3">
          <BigButton icon={<RotateCcw size={20} />} onClick={() => beginPayment(true)}>
            Retry Payment
          </BigButton>
          <BigButton variant="secondary" icon={<X size={20} />} onClick={handleCancel}>
            Cancel
          </BigButton>
        </div>
      </div>
    );
  }

  if (phase === "SUCCESS") {
    return (
      <div className="mobile-shell items-center justify-center text-center gap-4">
        <StatusRing size={200}>
          <Loader2 className="text-primary animate-spin" size={40} />
        </StatusRing>
        <h1 className="font-display text-2xl font-extrabold text-ink">Payment Approved!</h1>
        <p className="text-muted">Sending print job to Brother printer…</p>
      </div>
    );
  }

  // WAITING
  return (
    <div className="mobile-shell items-center text-center pt-4">
      <div className="pb-4">
        <Logo />
      </div>
      <h1 className="font-display text-2xl font-extrabold text-ink">Scan to Pay</h1>
      <p className="mt-1 text-muted text-sm">Scan with any UPI app OR tap test approval below.</p>

      {payment && (
        <div className="mt-4">
          <UpiQrCard
            qrImageDataUrl={payment.qrImageDataUrl}
            amount={payment.amount}
            secondsLeft={secondsLeft}
            title="Scan to Pay via UPI"
            subtitle="Accepts GPay, PhonePe, Paytm, BHIM & all UPI apps"
          />
        </div>
      )}

      {/* Prominent Test Mode Payment Approval */}
      <div className="mt-6 w-full max-w-sm rounded-card bg-emerald-50 border border-emerald-200 p-4 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-emerald-800 font-display font-bold text-sm mb-2">
          <ShieldCheck size={18} className="text-emerald-600" />
          <span>Test Payment (No Real Money Required)</span>
        </div>
        <p className="text-xs text-emerald-700 mb-3">Tap below to approve this payment immediately for testing without real transaction fees.</p>
        
        <BigButton
          icon={<CheckCircle2 size={20} />}
          onClick={() => handleSimulate("PAID")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-3.5 text-base shadow-sm"
        >
          Approve Test Payment (Free)
        </BigButton>
      </div>

      {devMode && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleSimulate("FAILED")}
            className="text-xs text-rose-500 hover:underline"
          >
            Simulate Payment Failure
          </button>
        </div>
      )}

      <button onClick={handleCancel} className="mt-6 text-sm text-muted underline">
        Cancel and return home
      </button>
    </div>
  );
}
