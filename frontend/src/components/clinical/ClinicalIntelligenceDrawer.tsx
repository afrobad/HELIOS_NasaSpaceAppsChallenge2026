import React, { useEffect } from 'react';
import type { CrewClinicalSummary } from '../../utils/clinicalPrioritization';

interface ClinicalIntelligenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clinicalSummary: CrewClinicalSummary;
  astronautName: string;
  astronautRole: string;
  subjectId: string;
  avatar: string;
}

export const ClinicalIntelligenceDrawer: React.FC<ClinicalIntelligenceDrawerProps> = ({
  isOpen,
  onClose,
  clinicalSummary,
  astronautName,
  astronautRole,
  subjectId,
  avatar,
}) => {
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

  const isAbnormal = clinicalSummary.isAbnormal;
  const reasoning = clinicalSummary.structuredReasoning;
  const concern = clinicalSummary.primaryConcern;
  const confidence = reasoning?.diagnosticConfidence ?? (isAbnormal ? 94.8 : 98.2);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 180ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: 'linear-gradient(180deg, #14181c 0%, #0d1014 100%)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          animation: 'slideInRight 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: "'Tomorrow', system-ui, sans-serif",
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(18, 22, 28, 0.95) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: `1.5px solid ${concern.borderColor}`,
                flexShrink: 0,
                backgroundColor: '#1a1a1a',
              }}
            >
              <img
                src={avatar}
                alt={astronautName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', fontFamily: "'Tomorrow', sans-serif" }}>
                  {astronautName}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  {subjectId}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px', fontFamily: "'Tomorrow', sans-serif" }}>
                {astronautRole} · Telemetry Analysis
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: concern.color,
                background: concern.bgColor,
                border: `1px solid ${concern.borderColor}`,
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.04em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {confidence.toFixed(1)}% CONFIDENCE
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#cbd5e1',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                fontFamily: "'Tomorrow', sans-serif",
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Sub-Banner */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: isAbnormal ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: concern.color,
                boxShadow: `0 0 8px ${concern.color}`,
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 800, color: concern.color, letterSpacing: '0.03em', fontFamily: "'Tomorrow', sans-serif" }}>
              {concern.title}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: clinicalSummary.trajectory.color, fontFamily: "'Tomorrow', sans-serif" }}>
            {clinicalSummary.trajectory.label}
          </span>
        </div>

        {/* 5-Tier Operational Intelligence Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, fontFamily: "'Tomorrow', sans-serif" }}>
            Structured Health Analysis
          </div>

          {/* 1. MEASURED */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(18, 22, 28, 0.70) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.06em', fontFamily: "'Tomorrow', sans-serif" }}>
                1 · MEASURED
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif" }}>What is being measured</span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#ffffff',
                fontFamily: "'Tomorrow', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {reasoning?.measuredData || clinicalSummary.decisionSupport.observedPattern}
            </div>
          </div>

          {/* 2. CHANGE */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(18, 22, 28, 0.70) 100%)',
              border: isAbnormal ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em', fontFamily: "'Tomorrow', sans-serif" }}>
                2 · WHAT'S CHANGED
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif" }}>Change from normal</span>
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: isAbnormal ? '#e0f2fe' : '#f1f5f9',
                lineHeight: 1.45,
                fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {reasoning?.detectedChange || 'Within personal range'}
            </div>
          </div>

          {/* 3. RELATED */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(18, 22, 28, 0.70) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#c084fc', letterSpacing: '0.06em', fontFamily: "'Tomorrow', sans-serif" }}>
                3 · RELATED CHANGES
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif" }}>Connected biomarker patterns</span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#f1f5f9', lineHeight: 1.45, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif" }}>
              {reasoning?.patternCorrelation || 'No related changes detected'}
            </div>
          </div>

          {/* 4. MEANING */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(18, 22, 28, 0.70) 100%)',
              border: isAbnormal ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.06em', fontFamily: "'Tomorrow', sans-serif" }}>
                4 · WHAT IT MEANS
              </span>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif" }}>Operational indication</span>
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: isAbnormal ? '#fef3c7' : '#f1f5f9',
                lineHeight: 1.45,
                fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {reasoning?.possibleInterpretation || 'Within baseline tolerance'}
            </div>
          </div>

          {/* 5. ACTION */}
          <div
            style={{
              background: isAbnormal
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(32, 17, 19, 0.75) 100%)'
                : 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(17, 24, 20, 0.75) 100%)',
              border: `1px solid ${isAbnormal ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.28)'}`,
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: isAbnormal ? '#ef4444' : '#22c55e',
                  letterSpacing: '0.06em',
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                5 · RECOMMENDED ACTION
              </span>
              <span style={{ fontSize: '9px', color: isAbnormal ? '#fca5a5' : '#86efac', fontFamily: "'Tomorrow', sans-serif" }}>Protocol directive</span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: isAbnormal ? '#ffffff' : '#f1f5f9',
                lineHeight: 1.45,
                fontWeight: 700,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {reasoning?.recommendedAssessment || clinicalSummary.decisionSupport.recommendedAction}
            </div>
          </div>
        </div>

        {/* Footer Dismiss */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 18, 22, 0.95)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
            }}
          >
            CLOSE ANALYSIS
          </button>
        </div>
      </div>
    </div>
  );
};
