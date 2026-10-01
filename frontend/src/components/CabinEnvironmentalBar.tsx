import React, { useMemo } from 'react';
import type { TelemetryPacket } from '../types/telemetry';

interface CabinEnvironmentalBarProps {
  telemetryMap: Record<string, TelemetryPacket>;
  currentScenario?: string;
}

export const CabinEnvironmentalBar: React.FC<CabinEnvironmentalBarProps> = ({
  telemetryMap,
  currentScenario,
}) => {
  // Extract primary packet (Commander or first active crew)
  const activePacket = useMemo(() => {
    return (
      telemetryMap['AST-01_COMMANDER'] ||
      Object.values(telemetryMap)[0] ||
      undefined
    );
  }, [telemetryMap]);

  const sc = activePacket?.scenario_phase || currentScenario || 'NOMINAL_CRUISE';

  // 1. Cabin Pressure (kPa)
  const pressureVal = useMemo(() => {
    if (sc.includes('DECOMPRESSION') || sc === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA') {
      return 92.4;
    }
    return 101.3;
  }, [sc]);

  // 2. Cabin O2 Fraction (%)
  const o2Val = useMemo(() => {
    if (sc.includes('DECOMPRESSION') || sc === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA') {
      return 18.2;
    }
    return 20.9;
  }, [sc]);

  // 3. Cabin CO2 (mmHg)
  const co2Val = activePacket?.cabin_co2 ?? 1.8;

  // 4. Ambient Radiation Flux (mSv/h)
  const radFluxVal = activePacket?.radiation_flux ?? 0.08;

  // 5. Cabin Ambient Temperature (°C)
  const tempVal = 21.4;

  // 6. Ventilation Airflow Velocity (m/s)
  const airflowVal = 0.45;

  // Overall ECLSS Environmental Hazard Status
  const hazardStatus = useMemo(() => {
    if (pressureVal < 95.0) {
      return {
        label: 'DECOMPRESSION ALERT',
        severity: 'CRITICAL',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.40)',
      };
    }
    if (o2Val < 19.5) {
      return {
        label: 'HYPOXIC ATMOSPHERE',
        severity: 'CRITICAL',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.40)',
      };
    }
    if (co2Val >= 4.0) {
      return {
        label: 'CO₂ SCRUBBER SATURATION',
        severity: 'CRITICAL',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.40)',
      };
    }
    if (radFluxVal >= 1.0) {
      return {
        label: 'SOLAR RADIATION STORM',
        severity: 'CRITICAL',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.40)',
      };
    }
    if (co2Val >= 3.0) {
      return {
        label: 'ELEVATED CO₂ LEVEL',
        severity: 'WARNING',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.40)',
      };
    }
    if (radFluxVal >= 0.15) {
      return {
        label: 'ELEVATED RAD FLUX',
        severity: 'WARNING',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.40)',
      };
    }
    return {
      label: 'ECLSS NOMINAL',
      severity: 'NOMINAL',
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.10)',
      border: 'rgba(34, 197, 94, 0.25)',
    };
  }, [pressureVal, o2Val, co2Val, radFluxVal]);

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#090a0d',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          maxWidth: '1250px',
          margin: '0 auto',
          padding: '5px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexWrap: 'nowrap',
          gap: '14px',
          minHeight: '34px',
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        {/* Module Title */}
        <div
          className="hud-tooltip-trigger"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'default', flexShrink: 0 }}
        >
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              color: '#e2e8f0',
              letterSpacing: '0.08em',
              fontFamily: "'Tomorrow', sans-serif",
              textTransform: 'uppercase',
            }}
          >
            CABIN ECLSS
          </span>
          <span
            style={{
              fontSize: '8px',
              fontWeight: 600,
              color: 'rgba(148, 163, 184, 0.65)',
              letterSpacing: '0.04em',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            ORION CM-02
          </span>
          <div className="hud-tooltip hud-tooltip-down">
            Environmental Control & Life Support System · Autonomous Orion atmospheric circulation & scrubbing
          </div>
        </div>

        {/* Hazard Pill (Only rendered when there is an active alert / non-nominal) */}
        {hazardStatus.severity !== 'NOMINAL' && (
          <div
            className="hud-tooltip-trigger"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: hazardStatus.bg,
              border: `1px solid ${hazardStatus.border}`,
              cursor: 'default',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: hazardStatus.color,
                boxShadow: `0 0 6px ${hazardStatus.color}`,
              }}
            />
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: hazardStatus.color,
                letterSpacing: '0.05em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {hazardStatus.label}
            </span>
            <div className="hud-tooltip hud-tooltip-down">
              Cabin Environmental Hazard Alert · {hazardStatus.severity} status ({hazardStatus.label})
            </div>
          </div>
        )}

        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.12)', flexShrink: 0 }} />

        {/* 6 Core Environmental Signals — aligned to the left with zero scrollbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'nowrap',
            flexShrink: 0,
          }}
        >
          {/* 1. PRESSURE */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              PRESSURE
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: pressureVal < 95.0 ? '#ef4444' : '#f1f5f9',
              }}
            >
              {pressureVal.toFixed(1)}
            </span>
            <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>kPa</span>
            <div className="hud-tooltip hud-tooltip-down">
              Total Cabin Barometric Pressure · Orion CM-02 cabin ambient atmosphere (Nominal: 101.3 kPa)
            </div>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.12)', fontSize: '10px' }}>│</span>

          {/* 2. O2 */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              O₂
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: o2Val < 19.5 ? '#ef4444' : '#f1f5f9',
              }}
            >
              {o2Val.toFixed(1)}
            </span>
            <span style={{ fontSize: '8px', color: o2Val < 19.5 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>%</span>
            <div className="hud-tooltip hud-tooltip-down">
              Oxygen Partial Fraction · Cabin breathable O₂ concentration (Nominal: 20.9%)
            </div>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.12)', fontSize: '10px' }}>│</span>

          {/* 3. CO2 */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              CO₂
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: co2Val >= 4.0 ? '#ef4444' : co2Val >= 3.0 ? '#f59e0b' : '#f1f5f9',
              }}
            >
              {co2Val.toFixed(1)}
            </span>
            <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>mmHg</span>
            <div className="hud-tooltip hud-tooltip-down">
              Carbon Dioxide Partial Pressure · LiOH scrubber scrub efficacy (Normal: &lt;3.0 mmHg)
            </div>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.12)', fontSize: '10px' }}>│</span>

          {/* 4. RADIATION */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              RADIATION
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: radFluxVal >= 1.0 ? '#ef4444' : radFluxVal >= 0.15 ? '#f59e0b' : '#f1f5f9',
              }}
            >
              {radFluxVal >= 10.0 ? radFluxVal.toFixed(0) : radFluxVal.toFixed(2)}
            </span>
            <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>mSv/h</span>
            <div className="hud-tooltip hud-tooltip-down">
              Ambient Space Radiation Flux · Real-time cosmic & solar ionizing radiation (Normal: &lt;0.15 mSv/h)
            </div>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.12)', fontSize: '10px' }}>│</span>

          {/* 5. CABIN TEMP */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              TEMP
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#f1f5f9',
              }}
            >
              {tempVal.toFixed(1)}
            </span>
            <span style={{ fontSize: '8px', color: '#22c55e', fontWeight: 600 }}>°C</span>
            <div className="hud-tooltip hud-tooltip-down">
              Cabin Internal Ambient Temperature · Active thermal control loop (Nominal: 21.4°C)
            </div>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.12)', fontSize: '10px' }}>│</span>

          {/* 6. AIRFLOW */}
          <div
            className="hud-tooltip-trigger"
            style={{ display: 'flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              AIRFLOW
            </span>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#f1f5f9',
              }}
            >
              {airflowVal.toFixed(2)}
            </span>
            <span style={{ fontSize: '8px', color: '#22c55e', fontWeight: 600 }}>m/s</span>
            <div className="hud-tooltip hud-tooltip-down">
              Atmospheric Ventilation Velocity · Duct circulation rate preventing CO₂ pockets (Nominal: 0.45 m/s)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
