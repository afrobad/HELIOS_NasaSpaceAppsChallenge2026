/**
 * frontend/src/services/labAssayService.ts
 * Manages authentic NASA OSDR spaceflight laboratory datasets (OSD-569 CBC, OSD-575 CMP, CV, Immune).
 * Caches laboratory panels for all 4 crew members (119 biomarkers total).
 */

import type { CrewFullLabProfile } from '../types/telemetry';

const cache: Record<string, CrewFullLabProfile> = {};

export async function fetchCrewLabProfile(astronautId: string): Promise<CrewFullLabProfile | null> {
  const cleanId = (astronautId || '').trim();
  if (cache[cleanId]) {
    return cache[cleanId];
  }

  try {
    const res = await fetch(`/api/telemetry/lab-assays/${encodeURIComponent(cleanId)}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data: CrewFullLabProfile = await res.json();
    cache[cleanId] = data;
    return data;
  } catch (err) {
    console.warn(`[LabAssayService] Failed to fetch lab assays for ${cleanId}:`, err);
    return null;
  }
}

export async function fetchAllCrewLabProfiles(): Promise<Record<string, CrewFullLabProfile>> {
  try {
    const res = await fetch('/api/telemetry/lab-assays');
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const json = await res.json();
    const map = json.lab_assays || {};
    Object.assign(cache, map);
    return map;
  } catch (err) {
    console.warn('[LabAssayService] Failed to fetch all lab assays:', err);
    return cache;
  }
}
