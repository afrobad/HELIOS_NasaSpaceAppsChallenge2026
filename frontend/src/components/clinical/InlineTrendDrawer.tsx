import React from 'react';

export interface InlineTrendDrawerProps {
  metricId?: string;
  metricLabel?: string;
  currentValue: string;
  baselineValue?: number | string;
  unit?: string;
  dotColor: string;
  history?: number[];
  cadenceLabel?: string;
  onOpenDeepAnalysis?: () => void;
  onClose?: () => void;
}

export const InlineTrendDrawer: React.FC<InlineTrendDrawerProps> = ({
  currentValue: _currentValue,
  baselineValue,
  unit = '',
  dotColor,
  history = [],
  onOpenDeepAnalysis,
}) => {
  const points = history.length > 0 ? history : [50, 50, 51, 50, 52, 50, 51];
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const span = Math.max(0.001, maxVal - minVal);

  const width = 420;
  const height = 66;
  const padTop = 10;
  const padBottom = 16;
  const usableH = height - padTop - padBottom;

  const baselineNum = typeof baselineValue === 'number' ? baselineValue : null;

  // Calculate baseline Y position if within min-max range
  let baselineY: number | null = null;
  if (baselineNum !== null && baselineNum >= minVal - span * 0.2 && baselineNum <= maxVal + span * 0.2) {
    const norm = (baselineNum - minVal) / span;
    baselineY = height - padBottom - Math.max(0, Math.min(usableH, norm * usableH));
  }

  // Calculate polyline points
  const svgPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * (width - 24) + 12;
      const y = height - padBottom - ((val - minVal) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      style={{
        background: 'transparent',
        padding: '6px 8px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxSizing: 'border-box',
        width: '100%',
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      {/* ── METRICS & ACTION STRIP: Range + Baseline + Deep Analysis Button (No duplicate header) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 0 2px 0',
          fontSize: '9px',
          fontFamily: 'var(--hud-font-mono, monospace)',
          whiteSpace: 'nowrap',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>RANGE:</span>
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
            {minVal.toFixed(1)} - {maxVal.toFixed(1)} {unit}
          </span>
        </div>

        {baselineValue !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>BASE:</span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>
              {baselineValue} {unit}
            </span>
          </div>
        )}

        {onOpenDeepAnalysis && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDeepAnalysis();
            }}
            style={{
              background: '#0284c7',
              border: '1px solid #38bdf8',
              color: '#ffffff',
              fontSize: '8px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              height: '18px',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
            }}
            title="Open full clinical deep analysis modal"
          >
            <span>DEEP ANALYSIS</span>
            <span style={{ fontSize: '9px', lineHeight: 1 }}>↗</span>
          </button>
        )}
      </div>

      {/* ── CLEAN SVG GRAPH CANVAS: Zero HTML text overlays inside the waveform territory ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          background: 'rgba(0, 0, 0, 0.50)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Subtle Grid Lines */}
          <line x1="12" y1={padTop} x2={width - 12} y2={padTop} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="2 3" />
          <line x1="12" y1={padTop + usableH / 2} x2={width - 12} y2={padTop + usableH / 2} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="2 3" />
          <line x1="12" y1={height - padBottom} x2={width - 12} y2={height - padBottom} stroke="rgba(255, 255, 255, 0.12)" />

          {/* Baseline Reference Band / Line if available */}
          {baselineY !== null && (
            <>
              <rect
                x="12"
                y={Math.max(padTop, baselineY - 5)}
                width={width - 24}
                height="10"
                fill="rgba(34, 197, 94, 0.08)"
              />
              <line
                x1="12"
                y1={baselineY}
                x2={width - 12}
                y2={baselineY}
                stroke="rgba(34, 197, 94, 0.50)"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* Trend Polyline */}
          <polyline
            fill="none"
            stroke={dotColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={svgPoints}
          />

          {/* Data Points on discrete positions */}
          {points.map((val, idx) => {
            const x = (idx / (points.length - 1)) * (width - 24) + 12;
            const y = height - padBottom - ((val - minVal) / span) * usableH;
            const isLatest = idx === points.length - 1;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isLatest ? 3 : 1.5}
                fill={dotColor}
                stroke={isLatest ? '#ffffff' : 'none'}
                strokeWidth={isLatest ? 1 : 0}
              />
            );
          })}

          {/* Time Axis Labels */}
          <text x="14" y={height - 4} fill="#64748b" fontSize="8" fontFamily="'Tomorrow', sans-serif">
            -60m
          </text>
          <text x={width * 0.35} y={height - 4} fill="#64748b" fontSize="8" fontFamily="'Tomorrow', sans-serif">
            -30m
          </text>
          <text x={width * 0.70} y={height - 4} fill="#64748b" fontSize="8" fontFamily="'Tomorrow', sans-serif">
            -10m
          </text>
          <text x={width - 32} y={height - 4} fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="'Tomorrow', sans-serif">
            NOW
          </text>
        </svg>
      </div>

      {/* ── FOOTER: Single-line diagnostic note ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '8.5px',
          color: '#64748b',
          whiteSpace: 'nowrap',
          gap: '8px',
          paddingTop: '2px',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          NASA-STD-3001 Bio-Telemetry Standard
        </span>
        <span style={{ color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Click row to collapse
        </span>
      </div>
    </div>
  );
};
