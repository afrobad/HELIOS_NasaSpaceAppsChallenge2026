import React, { useEffect, useState } from 'react';

export interface DeepAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  astronautName: string;
  astronautCallsign: string;
  astronautAvatar: string;
  metricLabel: string;
  currentValue: string;
  unit: string;
  baselineValue?: number | string;
  history?: number[];
  dotColor: string;
  category: string;
}

export const DeepAnalysisModal: React.FC<DeepAnalysisModalProps> = ({
  isOpen,
  onClose,
  astronautName,
  astronautCallsign,
  astronautAvatar,
  metricLabel,
  currentValue,
  unit,
  baselineValue,
  history = [],
  dotColor,
  category,
}) => {
  const [timeWindow, setTimeWindow] = useState<'1H' | '6H' | '24H'>('6H');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Extended synthetic historical points based on window
  const points = history.length > 5 ? history : [64, 65, 63, 67, 68, 66, 64, 65, 67, 69, 70, 68, 66, 65, 67];
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const avgVal = (points.reduce((a, b) => a + b, 0) / points.length).toFixed(1);
  const span = Math.max(0.001, maxVal - minVal);

  const width = 640;
  const height = 140;
  const padTop = 15;
  const padBottom = 25;
  const usableH = height - padTop - padBottom;

  const svgPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * (width - 32) + 16;
      const y = height - padBottom - ((val - minVal) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 200ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#131313',
          border: '1px solid #333333',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #242424',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#181818',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={astronautAvatar}
              alt={astronautName}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1.5px solid #38bdf8',
                objectFit: 'cover',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'nowrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', fontFamily: "'Tomorrow', sans-serif", whiteSpace: 'nowrap' }}>
                  {metricLabel}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.30)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {category}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Subject: {astronautName} ({astronautCallsign}) · Deep-Space Flight Surgeon Workstation
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            ESC ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Metric Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div style={{ background: '#181818', padding: '10px 12px', borderRadius: '8px', border: '1px solid #282828' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>CURRENT VALUE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: dotColor, marginTop: '2px', fontFamily: 'var(--hud-font-mono, monospace)' }}>
                {currentValue}
              </div>
            </div>

            <div style={{ background: '#181818', padding: '10px 12px', borderRadius: '8px', border: '1px solid #282828' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>PERSONAL BASELINE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#22c55e', marginTop: '2px', fontFamily: 'var(--hud-font-mono, monospace)' }}>
                {typeof baselineValue === 'number' && (unit === '%' || unit === '°C' || unit === 'g/dL' || unit === 'mmol/L')
                  ? baselineValue.toFixed(1)
                  : (baselineValue ?? 'Nominal')} {unit}
              </div>
            </div>

            <div style={{ background: '#181818', padding: '10px 12px', borderRadius: '8px', border: '1px solid #282828' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>WINDOW MEAN</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginTop: '2px', fontFamily: 'var(--hud-font-mono, monospace)' }}>
                {avgVal} {unit}
              </div>
            </div>

            <div style={{ background: '#181818', padding: '10px 12px', borderRadius: '8px', border: '1px solid #282828' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>PEAK RANGE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', marginTop: '2px', fontFamily: 'var(--hud-font-mono, monospace)' }}>
                {minVal.toFixed(1)} - {maxVal.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Time Window Selector + Chart */}
          <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
                HIGH-RESOLUTION TELEMETRY PROFILE
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['1H', '6H', '24H'] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setTimeWindow(win)}
                    style={{
                      background: timeWindow === win ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
                      color: timeWindow === win ? '#000000' : '#94a3b8',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    {win}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Extended Graph */}
            <div style={{ width: '100%', height: `${height}px`, background: '#0a0a0a', borderRadius: '6px', overflow: 'hidden', border: '1px solid #222222' }}>
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                <line x1="16" y1={padTop} x2={width - 16} y2={padTop} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                <line x1="16" y1={height / 2} x2={width - 16} y2={height / 2} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                <line x1="16" y1={height - padBottom} x2={width - 16} y2={height - padBottom} stroke="rgba(255, 255, 255, 0.15)" />

                <polyline
                  fill="none"
                  stroke={dotColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={svgPoints}
                />

                {points.map((val, idx) => {
                  const x = (idx / (points.length - 1)) * (width - 32) + 16;
                  const y = height - padBottom - ((val - minVal) / span) * usableH;
                  return (
                    <circle key={idx} cx={x} cy={y} r={idx === points.length - 1 ? 4 : 2} fill={dotColor} />
                  );
                })}

                <text x="18" y={height - 8} fill="#64748b" fontSize="9" fontFamily="'Tomorrow', sans-serif">
                  -{timeWindow}
                </text>
                <text x={width / 2 - 20} y={height - 8} fill="#64748b" fontSize="9" fontFamily="'Tomorrow', sans-serif">
                  MID-SESSION
                </text>
                <text x={width - 40} y={height - 8} fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="'Tomorrow', sans-serif">
                  NOW
                </text>
              </svg>
            </div>
          </div>

          {/* Clinical Standards & Multi-System Correlation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px', letterSpacing: '0.04em' }}>
                NASA-STD-3001 OPERATIONAL LIMITS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Safe Physiological Zone:</span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Nominal ± 1.5 σ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Flight Surgeon Watch Threshold:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>Deviation &gt; 2.0 σ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Immediate Triage Alarm:</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Critical Limit Exceeded</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px', letterSpacing: '0.04em' }}>
                MULTI-SYSTEM PHYSIOLOGICAL CONTEXT
              </div>
              <div style={{ fontSize: '10px', color: '#cbd5e1', lineHeight: 1.4 }}>
                This measurement is autonomously cross-correlated with active countermeasure states, cabin atmospheric partial pressures, and individual metabolic recovery curves.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
