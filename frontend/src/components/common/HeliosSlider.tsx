import React, { useState, useEffect, useRef, useMemo } from 'react';
import './HeliosSlider.css';

export interface HeliosSliderTick {
  label: string;
  value?: number;
}

export interface HeliosSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  ticks?: HeliosSliderTick[];
  color?: 'cyan' | 'emerald' | 'amber' | 'red';
  className?: string;
  style?: React.CSSProperties;
}

export const HeliosSlider: React.FC<HeliosSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  formatValue,
  onChange,
  ticks,
  color = 'cyan',
  className = '',
  style,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute percentage for track fill and tooltip position
  const pct = useMemo(() => {
    const raw = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [value, min, max]);

  // Color profiles
  const colorMap = {
    cyan: {
      accent: '#0284c7',
      glow: 'rgba(56, 189, 248, 0.65)',
      badgeBg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      caret: '#0369a1',
    },
    emerald: {
      accent: '#059669',
      glow: 'rgba(16, 185, 129, 0.65)',
      badgeBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      caret: '#047857',
    },
    amber: {
      accent: '#d97706',
      glow: 'rgba(245, 158, 11, 0.65)',
      badgeBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      caret: '#b45309',
    },
    red: {
      accent: '#dc2626',
      glow: 'rgba(239, 68, 68, 0.65)',
      badgeBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      caret: '#b91c1c',
    },
  }[color];

  // Window-level release listener ensures tooltip animates back down even when pointer leaves slider
  useEffect(() => {
    const handleRelease = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleRelease);
    window.addEventListener('touchend', handleRelease);
    window.addEventListener('touchcancel', handleRelease);

    return () => {
      window.removeEventListener('mouseup', handleRelease);
      window.removeEventListener('touchend', handleRelease);
      window.removeEventListener('touchcancel', handleRelease);
    };
  }, []);

  const displayVal = formatValue ? formatValue(value) : value.toString();

  // Mathematical center-offset correction so tooltip tracks thumb center across entire travel
  const thumbCenterOffset = `calc(${pct}% + ${(0.5 - pct / 100) * 16}px)`;

  const trackGradient = `linear-gradient(to right, ${colorMap.accent} 0%, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`;

  return (
    <div
      ref={containerRef}
      className={`helios-slider-container ${isDragging ? 'helios-slider-container--active' : ''} ${className}`}
      style={
        {
          '--slider-accent': colorMap.accent,
          '--slider-glow': colorMap.glow,
          '--slider-badge-bg': colorMap.badgeBg,
          '--slider-caret-color': colorMap.caret,
          ...style,
        } as React.CSSProperties
      }
    >
      {/* ── Slider Header: Label + Resting Value ── */}
      <div className="helios-slider-header">
        <label className="helios-slider-label">{label}</label>
        <div className="helios-slider-resting-value">
          <span className="helios-slider-resting-number">{displayVal}</span>
          {unit && <span className="helios-slider-resting-unit">{unit}</span>}
        </div>
      </div>

      {/* ── Slider Track Wrap with Input + Live Tooltip ── */}
      <div className="helios-slider-track-wrap">
        {/* Floating Tooltip directly above thumb knob */}
        <div
          className="helios-slider-tooltip"
          style={{ left: thumbCenterOffset }}
          aria-hidden="true"
        >
          <div className="helios-slider-tooltip-badge">
            <span className="helios-slider-tooltip-value">{displayVal}</span>
            {unit && <span className="helios-slider-tooltip-unit">{unit}</span>}
          </div>
          <div className="helios-slider-tooltip-arrow" />
        </div>

        {/* The Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          className="helios-slider-input"
          style={{ background: trackGradient }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>

      {/* ── Optional Tick Markers ── */}
      {ticks && ticks.length > 0 && (
        <div className="helios-slider-ticks">
          {ticks.map((tick, idx) => {
            const isNear =
              tick.value !== undefined
                ? Math.abs(value - tick.value) <= (max - min) * 0.1
                : false;
            return (
              <span
                key={idx}
                className={`helios-slider-tick ${isNear ? 'helios-slider-tick--active' : ''}`}
              >
                {tick.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

