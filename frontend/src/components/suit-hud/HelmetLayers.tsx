import { memo } from 'react';
import { VIEWBOX, VISOR_D, scaleAboutVisor } from './geometry';

interface LayerProps {
  fit: 'slice' | 'meet';
  planet?: string;
  scenario?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

/**
 * Glass effects that sit BETWEEN the landscape and the HUD graphics:
 * edge vignette, environment refraction band, and dynamic scenario visor FX.
 */
function _GlassUnderLayer({ fit, planet = 'Mars', scenario = 'NOMINAL_CRUISE' }: LayerProps) {
  const isMoon = planet === 'Moon';
  const isISS = planet === 'Space Station';

  const skyStopColor = isMoon ? '#05070a' : isISS ? '#0369a1' : '#ff8a3d';
  const skyStopOpacity = isMoon ? 0.02 : isISS ? 0.16 : 0.05;
  const rimStroke = isMoon ? '#cbd5e1' : isISS ? '#38bdf8' : '#ff9550';
  const rimOpacity = isMoon ? 0.22 : isISS ? 0.38 : 0.28;

  // Environmental Scenario Flags
  const isRadiation = scenario === 'SCENARIO_3_SOLAR_RADIATION_STORM';
  const isDecompression = scenario === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA';
  const isFire = scenario === 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER';
  const isAmmonia = scenario === 'SCENARIO_4_AMMONIA_COOLANT_LEAK';
  const isCo2 = scenario === 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH';

  return (
    <svg className="suit-hud__layer" viewBox={VIEWBOX} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true">
      <defs>
        <clipPath id="shud-visor-clip-u">
          <path d={VISOR_D} />
        </clipPath>
        <radialGradient id="shud-vignette" cx="512" cy="262" r="560" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 262) scale(1 0.62) translate(-512 -262)">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="0.82" stopColor={isMoon ? '#050508' : isISS ? '#041226' : '#0a0402'} stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
        <linearGradient id="shud-sky-tint" x1="0" y1="0" x2="0" y2="571" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={isMoon ? '#000000' : isISS ? '#020b17' : '#020304'} stopOpacity="0.45" />
          <stop offset="0.28" stopColor={isMoon ? '#020406' : isISS ? '#041933' : '#0b0806'} stopOpacity="0.08" />
          <stop offset="0.5" stopColor={skyStopColor} stopOpacity={skyStopOpacity} />
          <stop offset="1" stopColor={isMoon ? '#030508' : isISS ? '#0c4a6e' : '#1a0702'} stopOpacity={isMoon ? 0.08 : 0.18} />
        </linearGradient>

        {/* Solar Radiation Storm: High-Energy Ionization Aurora */}
        <radialGradient id="shud-radiation-storm" cx="512" cy="70" r="580" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#818cf8" stopOpacity="0.28" />
          <stop offset="0.7" stopColor="#c084fc" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* Cabin Fire: Smoldering Smoke & Emergency Alarm Glow */}
        <radialGradient id="shud-fire-smoke" cx="512" cy="300" r="540" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ef4444" stopOpacity="0.22" />
          <stop offset="0.65" stopColor="#b91c1c" stopOpacity="0.09" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* Cabin Decompression: Hypoxia Tunnel Vignette */}
        <radialGradient id="shud-hypoxia-vignette" cx="512" cy="285" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="0.75" stopColor="#0369a1" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0.75" />
        </radialGradient>

        <filter id="shud-blur-8u" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <g clipPath="url(#shud-visor-clip-u)">
        <rect width="1024" height="571" fill="url(#shud-sky-tint)" />
        <rect width="1024" height="571" fill="url(#shud-vignette)" />

        {/* Scenario 3: Deep-Space Solar Radiation Storm Aurora Curtain */}
        {isRadiation && (
          <rect
            width="1024"
            height="571"
            fill="url(#shud-radiation-storm)"
            className="hud-radiation-curtain"
          />
        )}

        {/* Scenario 2: Cabin Decompression Frost Halo & Hypoxia Vignette */}
        {isDecompression && (
          <>
            <rect width="1024" height="571" fill="url(#shud-hypoxia-vignette)" />
            <path
              d={VISOR_D}
              fill="none"
              stroke="#e0f2fe"
              strokeOpacity="0.55"
              strokeWidth="24"
              strokeDasharray="16 10 32 8"
              filter="url(#shud-blur-8u)"
              className="hud-frost-halo"
            />
          </>
        )}

        {/* Scenario 5: Smoke Haze & Red Cabin Alarm Pulse */}
        {isFire && (
          <>
            <rect width="1024" height="571" fill="rgba(28, 25, 23, 0.42)" />
            <rect width="1024" height="571" fill="url(#shud-fire-smoke)" className="hud-emergency-pulse" />
          </>
        )}

        {/* Scenario 4: Toxic Ammonia Coolant Mist */}
        {isAmmonia && (
          <rect width="1024" height="571" fill="rgba(254, 240, 138, 0.18)" filter="url(#shud-blur-8u)" />
        )}

        {/* Scenario 1: Heavy Breathing Condensation Fog Pulse */}
        {isCo2 && (
          <ellipse
            cx="512"
            cy="460"
            rx="160"
            ry="75"
            fill="rgba(255, 255, 255, 0.16)"
            filter="url(#shud-blur-8u)"
            className="hud-breath-fog"
          />
        )}

        {/* Environment refraction band hugging the inner rim */}
        <path d={VISOR_D} fill="none" stroke={rimStroke} strokeOpacity={rimOpacity} strokeWidth="34" filter="url(#shud-blur-8u)" />
      </g>
    </svg>
  );
}

export const GlassUnderLayer = memo(_GlassUnderLayer);

/**
 * Everything ABOVE the HUD: glossy glare on the glass, the dark padded helmet
 * interior, the chin console with its LEDs, and the visor bezel/gasket.
 */
function _HelmetShellLayer({ fit, planet = 'Mars' }: LayerProps) {
  const isMoon = planet === 'Moon';
  const isISS = planet === 'Space Station';

  const glare1 = isMoon ? '#f1f5f9' : isISS ? '#bae6fd' : '#ffbf86';
  const glare2 = isMoon ? '#e2e8f0' : isISS ? '#38bdf8' : '#ffb070';
  const glare3 = isMoon ? '#cbd5e1' : isISS ? '#0284c7' : '#ff9e5e';
  const rimHi1 = isMoon ? '#f8fafc' : isISS ? '#7dd3fc' : '#ffc792';
  const rimHi2 = isMoon ? '#e2e8f0' : isISS ? '#38bdf8' : '#ff9a52';

  return (
    <svg className="suit-hud__layer" viewBox={VIEWBOX} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true">
      <defs>
        <clipPath id="shud-visor-clip">
          <path d={VISOR_D} />
        </clipPath>
        <mask id="shud-outside" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="5024" height="4571">
          <rect x="-2000" y="-2000" width="5024" height="4571" fill="#fff" />
          <path d={VISOR_D} fill="#000" />
        </mask>

        <radialGradient id="shud-interior" cx="512" cy="270" r="720" gradientUnits="userSpaceOnUse">
          <stop offset="0.6" stopColor={isMoon ? '#141416' : isISS ? '#0f172a' : '#1a1310'} />
          <stop offset="0.78" stopColor={isMoon ? '#090a0c' : isISS ? '#090e17' : '#0d0a09'} />
          <stop offset="1" stopColor="#040303" />
        </radialGradient>

        {/* Rim specular – matched to planetary environment */}
        <linearGradient id="shud-rim-hi" x1="0" y1="0" x2="1024" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={rimHi1} stopOpacity="0.95" />
          <stop offset="0.1" stopColor={rimHi2} stopOpacity="0.75" />
          <stop offset="0.28" stopColor="#ffe6cf" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="0.72" stopColor="#ffe6cf" stopOpacity="0.16" />
          <stop offset="0.9" stopColor={rimHi2} stopOpacity="0.75" />
          <stop offset="1" stopColor={rimHi1} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="shud-bezel" x1="0" y1="0" x2="0" y2="571" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#141110" />
          <stop offset="0.5" stopColor="#1d1916" />
          <stop offset="1" stopColor="#0b0908" />
        </linearGradient>
        <linearGradient id="shud-console" x1="0" y1="495" x2="0" y2="571" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#25211e" />
          <stop offset="0.35" stopColor="#141210" />
          <stop offset="1" stopColor="#070606" />
        </linearGradient>
        <pattern id="shud-mesh" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3.2" height="3.2" fill="#111010" />
          <circle cx="1.6" cy="1.6" r="0.75" fill="#040404" />
        </pattern>

        <filter id="shud-blur-1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.8" /></filter>
        <filter id="shud-blur-5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id="shud-blur-18" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id="shud-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.8  1.4 0 0 0 -0.55" />
        </filter>
      </defs>

      {/* ── Glass-over glare (screen-blended, kept off the HUD panels) ── */}
      <g clipPath="url(#shud-visor-clip)" style={{ mixBlendMode: 'screen' }}>
        <g filter="url(#shud-blur-5)">
          <ellipse cx="32" cy="175" rx="7" ry="62" fill={glare1} opacity="0.6" />
          <ellipse cx="34" cy="385" rx="6" ry="52" fill={glare2} opacity="0.5" />
          <ellipse cx="78" cy="46" rx="34" ry="7" fill={glare1} opacity="0.55" transform="rotate(-38 78 46)" />
          <ellipse cx="992" cy="175" rx="7" ry="62" fill={glare1} opacity="0.6" />
          <ellipse cx="990" cy="385" rx="6" ry="52" fill={glare2} opacity="0.5" />
          <ellipse cx="946" cy="46" rx="34" ry="7" fill={glare1} opacity="0.55" transform="rotate(38 946 46)" />
          <ellipse cx="860" cy="12" rx="60" ry="4" fill={isMoon ? '#ffffff' : isISS ? '#bae6fd' : '#ffd8b0'} opacity="0.4" />
          <ellipse cx="128" cy="488" rx="48" ry="5" fill={glare3} opacity="0.4" transform="rotate(14 128 488)" />
          <ellipse cx="896" cy="488" rx="48" ry="5" fill={glare3} opacity="0.4" transform="rotate(-14 896 488)" />
        </g>
        {/* faint diagonal reflection streaks across the visor */}
        <path d="M168,0 L226,0 L58,571 L0,571 Z" fill="#ffffff" opacity="0.022" />
        <path d="M842,0 L872,0 L1000,571 L966,571 Z" fill="#ffffff" opacity="0.018" />
        {/* thin glossy inner edge of the glass */}
        <path d={VISOR_D} transform={scaleAboutVisor(0.99, 0.982)} fill="none" stroke="url(#shud-rim-hi)" strokeWidth="1.6" filter="url(#shud-blur-1)" />
      </g>

      {/* ── Helmet interior (outside the visor only) ── */}
      <g mask="url(#shud-outside)">
        <rect x="-2000" y="-2000" width="5024" height="4571" fill="url(#shud-interior)" />
        {/* warm bounce light from the visor onto the padding */}
        <path d={VISOR_D} fill="none" stroke="#5a3220" strokeOpacity="0.55" strokeWidth="90" filter="url(#shud-blur-18)" />

        {/* panel seams */}
        <g fill="none" stroke="#ffd9b8" strokeOpacity="0.05" strokeWidth="1.2">
          <path d="M-20,96 C10,56 46,22 104,-6" />
          <path d="M1044,96 C1014,56 978,22 920,-6" />
          <path d="M-20,452 C-6,500 30,530 80,560" />
          <path d="M1044,452 C1030,500 994,530 944,560" />
        </g>

        {/* lower side panels */}
        <path d="M-40,512 C60,512 160,526 236,546 L262,620 L-40,620 Z" fill="#0c0a09" stroke="#ffb98a" strokeOpacity="0.07" />
        <path d="M1064,512 C964,512 864,526 788,546 L762,620 L1064,620 Z" fill="#0c0a09" stroke="#ffb98a" strokeOpacity="0.07" />

        {/* chin console */}
        <path d="M300,620 C330,542 380,513 440,506 C470,502 490,501 512,501 C534,501 554,502 584,506 C644,513 694,542 724,620 Z" fill="url(#shud-console)" />
        <path d="M318,571 C346,536 388,515 440,509 C472,505 492,504 512,504 C532,504 552,505 584,509 C636,515 678,536 706,571" fill="none" stroke="#ffffff" strokeOpacity="0.07" />
        <path d="M410,620 C420,550 456,523 512,523 C568,523 604,550 614,620 Z" fill="url(#shud-mesh)" stroke="#ffffff" strokeOpacity="0.06" />

        {/* status LEDs */}
        {[
          [283, 522],
          [741, 522],
          [52, 540],
          [972, 540],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="7" fill="#ff7a1f" opacity="0.55" filter="url(#shud-blur-5)" />
            <rect x={x - 3.5} y={y - 1.6} width="7" height="3.2" rx="1.4" fill="#ffb066" />
          </g>
        ))}
        {[
          [238, 551],
          [786, 551],
        ].map(([x, y]) => (
          <rect key={`d-${x}`} x={x - 2.5} y={y - 1.2} width="5" height="2.4" rx="1" fill="#7a3d18" opacity="0.8" />
        ))}

        <rect x="-2000" y="-2000" width="5024" height="4571" filter="url(#shud-grain)" opacity="0.07" />
      </g>

      {/* ── Visor bezel & gasket ── */}
      <path d={VISOR_D} transform={scaleAboutVisor(1.018, 1.036)} fill="none" stroke="url(#shud-bezel)" strokeWidth="18" />
      <path d={VISOR_D} transform={scaleAboutVisor(1.036, 1.07)} fill="none" stroke="url(#shud-rim-hi)" strokeOpacity="0.45" strokeWidth="1.2" filter="url(#shud-blur-1)" />
      <path d={VISOR_D} fill="none" stroke="#030202" strokeWidth="7" />
      <path d={VISOR_D} transform={scaleAboutVisor(1.004, 1.008)} fill="none" stroke="url(#shud-rim-hi)" strokeOpacity="0.7" strokeWidth="1" />
    </svg>
  );
}

export const HelmetShellLayer = memo(_HelmetShellLayer);
