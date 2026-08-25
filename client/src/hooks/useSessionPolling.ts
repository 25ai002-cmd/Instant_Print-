import { useEffect, useRef, useState } from "react";
import { KioskSession } from "../types";
import { getSession } from "../services/api";

export function useSessionPolling(sessionId: string | undefined, intervalMs = 2000) {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getSession(sessionId);
        if (!cancelled) {
          setSession(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError("SESSION_EXPIRED");
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, intervalMs]);

  return { session, error, setSession };
}
