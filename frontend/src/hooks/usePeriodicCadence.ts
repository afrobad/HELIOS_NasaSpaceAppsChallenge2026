import { useState, useEffect } from 'react';

export interface PeriodicCadenceResult {
  countdownText: string;
  isUpdating: boolean;
  secondsRemaining: number;
}

/**
 * Deterministic periodic cadence countdown hook for spaceflight telemetry.
 * Formats time remaining until next scheduled lab assay or sensor cycle (e.g. NEXT 02:14:32).
 * When timer reaches zero (or <= 3s), triggers a brief subtle 'UPDATING...' state, then resets.
 */
export function usePeriodicCadence(
  intervalHours?: number,
  isFastForward = false
): PeriodicCadenceResult {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!intervalHours || intervalHours <= 0) {
    return {
      countdownText: '',
      isUpdating: false,
      secondsRemaining: 0,
    };
  }

  const cycleTotalSeconds = intervalHours * 3600;
  // If fast-forward demo mode, speed up by 60x (1 hour in 60 seconds)
  const effectiveSec = isFastForward ? nowSec * 60 : nowSec;
  const elapsedInCycle = effectiveSec % cycleTotalSeconds;
  const remaining = cycleTotalSeconds - elapsedInCycle;

  const isUpdating = remaining <= 3;

  if (isUpdating) {
    return {
      countdownText: 'UPDATING...',
      isUpdating: true,
      secondsRemaining: remaining,
    };
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    countdownText: formatted,
    isUpdating: false,
    secondsRemaining: remaining,
  };
}
