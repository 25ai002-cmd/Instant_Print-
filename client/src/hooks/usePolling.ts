import { useEffect, useRef } from 'react';

/**
 * Polls a function at a specified interval until stopped or component unmounts.
 */
export function usePolling(
  pollFn: () => Promise<boolean>, // Return true to stop polling
  intervalMs = 1500,
  active = true
) {
  const savedCallback = useRef(pollFn);

  useEffect(() => {
    savedCallback.current = pollFn;
  }, [pollFn]);

  useEffect(() => {
    if (!active) return;

    let isSubscribed = true;
    let timerId: NodeJS.Timeout;

    const tick = async () => {
      try {
        const stop = await savedCallback.current();
        if (stop || !isSubscribed) return;

        timerId = setTimeout(tick, intervalMs);
      } catch (err) {
        console.error('Polling error:', err);
        if (isSubscribed) {
          timerId = setTimeout(tick, intervalMs);
        }
      }
    };

    tick();

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
    };
  }, [active, intervalMs]);
}
