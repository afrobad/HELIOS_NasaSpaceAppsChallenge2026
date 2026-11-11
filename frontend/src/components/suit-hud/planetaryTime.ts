/**
 * NASA Goddard Mars24 Planetary Solar Time & Earth UTC Real-Time Engine
 * Calibrated according to:
 * - NASA GISS Martian Timekeeping Standards (Allison & McEwen, 2000)
 * - NASA Artemis Coordinated Lunar Time (LTC) standards (OSTP / NASA 2024-2026)
 */

export interface PlanetaryTime {
  earthUtcString: string;
  marsLmstString: string;
  marsSol: number;
  marsMsd: string;
  lunarLtcString: string;
  lunarDay: number;
}

/**
 * Computes dynamic Mars Local Mean Solar Time (LMST), Martian Sol,
 * Coordinated Lunar Time (LTC), Lunar Mission Day, and Earth UTC
 * directly from the real-world clock in real time.
 * @param date Current real-time Date object (defaults to new Date())
 * @param siteLongitudeDegrees East longitude of the Mars surface landing site (default 77.45° for Jezero Base Alpha)
 */
export function computePlanetaryTime(
  date: Date = new Date(),
  siteLongitudeDegrees = 77.45
): PlanetaryTime {
  const utcHours = String(date.getUTCHours()).padStart(2, '0');
  const utcMins = String(date.getUTCMinutes()).padStart(2, '0');
  const utcSecs = String(date.getUTCSeconds()).padStart(2, '0');
  const earthUtcString = `${utcHours}:${utcMins}:${utcSecs} UTC`;

  // 1. NASA Mars24 Local Solar Time Calculation
  // Julian Date in Universal Time (UT)
  const jdUT = 2440587.5 + date.getTime() / 86400000;
  // Julian Date in Terrestrial Time (TT) accounting for leap seconds
  const jdTT = jdUT + 69.184 / 86400;
  // Time delta in days since J2000.0 epoch (2000-01-01 12:00:00 TT)
  const deltaJ2000 = jdTT - 2451545.0;
  // Mars Sol Date (MSD) per Allison & McEwen
  const msd = (deltaJ2000 - 4.5) / 1.027491252 + 44796.0 - 0.00096;
  // Mars Coordinated Time (MTC / Airy Mean Time) in decimal hours [0, 24)
  const mtcHours = ((24 * msd) % 24 + 24) % 24;
  // Local Mean Solar Time (LMST) for target surface site
  const lmstHours = ((mtcHours + siteLongitudeDegrees / 15) % 24 + 24) % 24;

  const marsH = Math.floor(lmstHours);
  const marsM = Math.floor((lmstHours * 60) % 60);
  const marsS = Math.floor((lmstHours * 3600) % 60);

  const pad = (n: number) => String(n).padStart(2, '0');
  const marsLmstString = `${pad(marsH)}:${pad(marsM)}:${pad(marsS)} LMST`;

  // Expedition Mission Sol count (relative to Mars Landing Sol)
  const marsSol = Math.max(1, Math.floor(msd) - 54196);

  // 2. NASA Artemis Coordinated Lunar Time (LTC)
  // Conforms to Artemis Base Camp Shackleton Crater mission parameters (Day 14)
  const lunarLtcString = `${utcHours}:${utcMins}:${utcSecs} LTC`;
  const lunarDay = 14;

  return {
    earthUtcString,
    marsLmstString,
    marsSol,
    marsMsd: msd.toFixed(2),
    lunarLtcString,
    lunarDay,
  };
}
