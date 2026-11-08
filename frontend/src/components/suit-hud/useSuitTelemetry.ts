import { useEffect, useState } from 'react';

export type ScrubberState = 'NOMINAL' | 'DEGRADED' | 'FAULT';

export interface SuitTelemetry {
  aiStatus: string;
  heartRate: number;
  spo2: number;
  o2Reserve: number;
  o2TteMinutes: number;
  feedwaterPct: number;
  lcvgTempC: number;
  ppCo2: number;
  co2Scrubber: ScrubberState;
  suitPressurePsi: number;
  temperatureC: number;
  batteryPct: number;
  evaMet?: string;
  radiationFlux?: number;
  commSignalPct?: number;
  pitchDeg?: number;
  rollDeg?: number;
  waypoint: {
    line1: string;
    line2: string;
    distanceKm: number;
    bearingDeg: number;
  };
}

/** Values calibrated to NASA xEMU / Artemis EVA specifications. */
export const DEFAULT_SUIT_TELEMETRY: SuitTelemetry = {
  aiStatus: 'ONLINE',
  heartRate: 72,
  spo2: 99,
  o2Reserve: 86,
  o2TteMinutes: 412, // 06h 52m remaining
  feedwaterPct: 88,
  lcvgTempC: 18.2,
  ppCo2: 1.8,
  co2Scrubber: 'NOMINAL',
  suitPressurePsi: 4.3,
  temperatureC: 21.4,
  batteryPct: 78,
  evaMet: '03:41:20',
  radiationFlux: 0.04,
  commSignalPct: 98,
  pitchDeg: 1.8,
  rollDeg: -0.6,
  waypoint: { line1: 'MARS ONE BASE', line2: 'HABITAT POD 01', distanceKm: 0.032, bearingDeg: 4 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Supplies suit telemetry. When `simulate` is on, values gently drift around
 * the reference numbers so the HUD feels alive. Any field passed via
 * `override` (e.g. from a live WebSocket feed) always wins.
 */
export function useSuitTelemetry(override?: Partial<SuitTelemetry>, simulate = true): SuitTelemetry {
  const [sim, setSim] = useState<SuitTelemetry>(DEFAULT_SUIT_TELEMETRY);

  useEffect(() => {
    if (!simulate) return;
    const id = window.setInterval(() => {
      setSim((prev) => {
        const hrDrift = prev.heartRate + Math.round((Math.random() - 0.5) * 2.2) + (72 - prev.heartRate) * 0.35;
        return {
          ...prev,
          heartRate: Math.round(clamp(hrDrift, 70, 75)),
          spo2: Math.random() < 0.88 ? 99 : 98,
          temperatureC: Math.round(clamp(prev.temperatureC + (Math.random() - 0.5) * 0.2 + (21.4 - prev.temperatureC) * 0.4, 21.2, 21.6) * 10) / 10,
        };
      });
    }, 1600);
    return () => window.clearInterval(id);
  }, [simulate]);

  return {
    ...sim,
    ...override,
    waypoint: { ...sim.waypoint, ...override?.waypoint },
  };
}
