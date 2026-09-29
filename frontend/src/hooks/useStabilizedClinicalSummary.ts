import { useState, useEffect, useRef } from 'react';
import type { CrewClinicalSummary } from '../utils/clinicalPrioritization';

/**
 * Computes a deterministic identity key for the current clinical view mode.
 * Changes only when the visual layout, severity level, primary concern, or deviating biomarker set switches.
 */
export function computeClinicalViewKey(summary: CrewClinicalSummary | null | undefined): string {
  if (!summary) return 'NULL';
  if (!summary.isAbnormal) return 'NOMINAL';
  const bioKey = (summary.prioritizedBiomarkers || [])
    .map((b) => b.symbol || b.name)
    .sort()
    .join('|');
  return `${summary.severity}::${summary.primaryConcern?.title || 'DEV'}::${bioKey}`;
}

/**
 * useStabilizedClinicalSummary
 * 
 * Enforces a clinical state dwell-time mechanism (default 1000ms = 1 second).
 * Prevents rapid UI flipping / visual jitter caused by high-frequency sensor noise.
 * 
 * Rules:
 * 1. Initial mount / astronaut navigation: Commits immediately (0ms dwell) to prevent UI lag.
 * 2. Same clinical view state: Real-time values, PRI, and metrics update smoothly.
 * 3. View state changes (severity, primary concern, alert mode):
 *    Must persist continuously for >= dwellMs (1000ms) before the UI transitions.
 *    Transient spikes (< 1000ms) are filtered out, keeping the view stable and visually perfect.
 */
export function useStabilizedClinicalSummary(
  astronautId: string,
  rawSummary: CrewClinicalSummary,
  dwellMs: number = 1000
): CrewClinicalSummary {
  // Current committed summary displayed to the UI
  const [displayedSummary, setDisplayedSummary] = useState<CrewClinicalSummary>(rawSummary);

  // Astronaut navigation tracking (instant bypass)
  const prevAstronautIdRef = useRef<string>(astronautId);

  // Track pending transition state and timer
  const pendingRef = useRef<{
    targetKey: string;
    targetSummary: CrewClinicalSummary;
    timerId: ReturnType<typeof setTimeout> | null;
  }>({
    targetKey: computeClinicalViewKey(rawSummary),
    targetSummary: rawSummary,
    timerId: null,
  });

  const displayedKey = computeClinicalViewKey(displayedSummary);
  const rawKey = computeClinicalViewKey(rawSummary);

  // Immediate reset if user switched astronaut
  if (prevAstronautIdRef.current !== astronautId) {
    prevAstronautIdRef.current = astronautId;
    if (pendingRef.current.timerId) {
      clearTimeout(pendingRef.current.timerId);
      pendingRef.current.timerId = null;
    }
    pendingRef.current.targetKey = rawKey;
    pendingRef.current.targetSummary = rawSummary;
    setDisplayedSummary(rawSummary);
  }

  useEffect(() => {
    // If astronaut changed, it was handled synchronously above
    if (prevAstronautIdRef.current !== astronautId) return;

    // Case 1: Raw view state matches the currently displayed view state
    if (rawKey === displayedKey) {
      // Discard any obsolete pending transition timer
      if (pendingRef.current.timerId) {
        clearTimeout(pendingRef.current.timerId);
        pendingRef.current.timerId = null;
      }
      pendingRef.current.targetKey = rawKey;
      pendingRef.current.targetSummary = rawSummary;

      // Update live numbers/metrics smoothly within the same view layout
      setDisplayedSummary(rawSummary);
      return;
    }

    // Case 2: Raw view state differs from displayed view state.
    // Keep targetSummary updated with latest incoming telemetry
    pendingRef.current.targetSummary = rawSummary;

    // If this is a new candidate target, start or restart the 1000ms dwell timer
    if (pendingRef.current.targetKey !== rawKey) {
      if (pendingRef.current.timerId) {
        clearTimeout(pendingRef.current.timerId);
        pendingRef.current.timerId = null;
      }
      pendingRef.current.targetKey = rawKey;

      pendingRef.current.timerId = setTimeout(() => {
        // Dwell duration satisfied (condition persisted for >= 1000ms continuously)
        setDisplayedSummary(pendingRef.current.targetSummary);
        pendingRef.current.timerId = null;
      }, dwellMs);
    }
  }, [astronautId, rawKey, displayedKey, rawSummary, dwellMs]);

  // Clean up any remaining timer on unmount
  useEffect(() => {
    return () => {
      if (pendingRef.current.timerId) {
        clearTimeout(pendingRef.current.timerId);
      }
    };
  }, []);

  return displayedSummary;
}
