import React, { useEffect, useState } from 'react';
import { audioService } from '../services/audioService';

interface EvidenceItem {
  metric: string;
  value: number;
  baseline_mean?: number;
  z_score?: number;
  clinical_finding: string;
}

interface TriageData {
  astronaut_id: string;
  astronaut_name: string;
  severity: string;
  confidence_percent: number;
  evidence_weight: number;
  correlated_signals_count: number;
  primary_diagnosis: string;
  actionable_instruction: string;
  trigger_reason: string;
  evidence_breakdown: EvidenceItem[];
  voice_warning?: {
    speech_text: string;
    tone: 'klaxon' | 'chime' | 'beep' | 'none';
  };
}

interface TriageModalProps {
  astronautId: string | null;
  onClose: () => void;
}

const formatChemicalSubscripts = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\bCO2\b/g, 'CO₂')
    .replace(/\bSpO2\b/g, 'SpO₂')
    .replace(/\bO2\b/g, 'O₂');
};

export const TriageModal: React.FC<TriageModalProps> = ({ astronautId, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [triage, setTriage] = useState<TriageData | null>(null);

  useEffect(() => {
    if (!astronautId) return;

    setLoading(true);
    fetch(`/api/ai/triage/${astronautId}`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        setTriage(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [astronautId]);

  if (!astronautId) return null;

  const handleSpeakTriage = () => {
    if (triage?.voice_warning?.speech_text) {
      audioService.speak(triage.voice_warning.speech_text);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--hud-bg-panel)',
          borderRadius: 'var(--hud-radius-panel)',
          padding: '20px 24px',
          border: '1px solid var(--hud-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--hud-border)',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
              CLINICAL TRIAGE & DIFFERENTIAL DIAGNOSIS
            </div>
            <div style={{ fontSize: '11px', color: 'var(--hud-text-dim)' }}>
              NASA FLIGHT SURGEON AUTONOMOUS DECISION SUPPORT
            </div>
          </div>
          <button
            onClick={onClose}
            className="hud-btn"
            style={{ padding: '4px 10px', minHeight: '26px' }}
          >
            CLOSE [ESC]
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--hud-text-dim)' }}>
            EVALUATING CLINICAL MULTI-SIGNAL SENTRY MATRIX...
          </div>
        ) : triage ? (
          <div>
            {/* Astronaut Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                background: 'var(--hud-bg-card)',
                padding: '12px 14px',
                borderRadius: 'var(--hud-radius-btn)',
                marginBottom: '14px',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  {triage.astronaut_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--hud-text-dim)' }}>
                  IDENTIFIER: {triage.astronaut_id}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontSize: '12px' }}>
                <span
                  style={{
                    color:
                      triage.severity === 'CRITICAL'
                        ? 'var(--hud-critical)'
                        : triage.severity === 'WARNING'
                        ? 'var(--hud-orange)'
                        : 'var(--hud-nominal)',
                    fontWeight: 700,
                  }}
                >
                  <span
                    className={`hud-status-dot ${
                      triage.severity === 'CRITICAL'
                        ? 'status-dot-critical'
                        : triage.severity === 'WARNING'
                        ? 'status-dot-warning'
                        : 'status-dot-nominal'
                    }`}
                  />
                  {triage.severity}
                </span>

                <span className="font-mono-tabular" style={{ color: 'var(--hud-text-muted)', fontWeight: 600 }}>
                  {triage.confidence_percent}% CONFIDENCE
                </span>
              </div>
            </div>

            {/* Primary Differential Diagnosis */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px' }}>
                PRIMARY DIFFERENTIAL DIAGNOSIS
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: triage.severity === 'CRITICAL' ? 'var(--hud-critical)' : '#ffffff',
                  background: 'var(--hud-bg-card)',
                  padding: '10px 12px',
                  borderRadius: 'var(--hud-radius-btn)',
                  borderLeft: `3px solid ${
                    triage.severity === 'CRITICAL'
                      ? 'var(--hud-critical)'
                      : triage.severity === 'WARNING'
                      ? 'var(--hud-orange)'
                      : 'var(--hud-nominal)'
                  }`,
                }}
              >
                {formatChemicalSubscripts(triage.primary_diagnosis)}
              </div>
            </div>

            {/* Actionable Clinical Instruction */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px' }}>
                OPERATIONAL COUNTERMEASURE DIRECTIVE
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--hud-text-secondary)',
                  background: 'var(--hud-bg-card)',
                  padding: '10px 12px',
                  borderRadius: 'var(--hud-radius-btn)',
                  lineHeight: '1.45',
                }}
              >
                {formatChemicalSubscripts(triage.actionable_instruction)}
              </div>
            </div>

            {/* Evidence Breakdown */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '6px' }}>
                TELEMETRY EVIDENCE BREAKDOWN ({triage.correlated_signals_count} CORRELATED MARKERS)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {triage.evidence_breakdown.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--hud-text-dim)' }}>
                    All physiological markers within nominal Gaussian bounds.
                  </div>
                ) : (
                  triage.evidence_breakdown.map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--hud-bg-card)',
                        borderRadius: 'var(--hud-radius-btn)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{formatChemicalSubscripts(ev.metric)}:</span>
                        <span style={{ color: 'var(--hud-text-secondary)' }}>{formatChemicalSubscripts(ev.clinical_finding)}</span>
                      </div>
                      {ev.z_score !== undefined && (
                        <span
                          className="font-mono-tabular"
                          style={{
                            fontWeight: 700,
                            color: Math.abs(ev.z_score) >= 2.0 ? 'var(--hud-orange)' : 'var(--hud-text-dim)',
                          }}
                        >
                          {ev.z_score >= 0 ? `+${ev.z_score}σ` : `${ev.z_score}σ`}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Voice Audio Directive */}
            {triage.voice_warning && (
              <div
                style={{
                  background: 'var(--hud-bg-card)',
                  padding: '10px 12px',
                  borderRadius: 'var(--hud-radius-btn)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '12.5px', color: '#ffffff', fontStyle: 'italic', flex: 1 }}>
                  "{formatChemicalSubscripts(triage.voice_warning.speech_text)}"
                </div>
                <button onClick={handleSpeakTriage} className="hud-btn" style={{ padding: '3px 8px', fontSize: '10px' }}>
                  SPEAK
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--hud-critical)', textAlign: 'center' }}>
            Failed to retrieve triage evaluation.
          </div>
        )}
      </div>
    </div>
  );
};
