import React, { useMemo } from 'react';
import type { TelemetryPacket, AlertPayload } from '../../types/telemetry';
import type { CrewClinicalSummary } from '../../utils/clinicalPrioritization';

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'EVENT' | 'NOMINAL';
  icon?: string;
}

export interface ClinicalTimelineProps {
  astronautId: string;
  astronautName: string;
  telemetry?: TelemetryPacket;
  clinicalSummary?: CrewClinicalSummary;
  latestAlert?: AlertPayload | null;
}

export const ClinicalTimeline: React.FC<ClinicalTimelineProps> = ({
  astronautName,
  telemetry,
  clinicalSummary,
  latestAlert,
}) => {
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // 1. Current active clinical event if abnormal
    if (clinicalSummary?.isAbnormal) {
      const topBio = clinicalSummary.prioritizedBiomarkers[0];
      const bioName = topBio ? topBio.symbol : 'Vitals';
      const arrow = topBio?.deltaStr.includes('↑') ? '↑' : topBio?.deltaStr.includes('↓') ? '↓' : 'Δ';
      const valStr = topBio ? topBio.formattedValue : '';

      list.push({
        id: 'active_anomaly',
        time: '14:32',
        title: `${bioName} ${arrow} ${valStr}`,
        description: clinicalSummary.primaryConcern.description,
        severity: clinicalSummary.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      });

      if (clinicalSummary.prioritizedBiomarkers.length > 1) {
        const secBio = clinicalSummary.prioritizedBiomarkers[1];
        const secArrow = secBio.deltaStr.includes('↑') ? '↑' : secBio.deltaStr.includes('↓') ? '↓' : 'Δ';
        list.push({
          id: 'sec_anomaly',
          time: '14:28',
          title: `${secBio.symbol} ${secArrow} ${secBio.formattedValue}`,
          description: secBio.clinicalMeaning,
          severity: secBio.tier === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        });
      }
    }

    // 2. Alert payload if matches
    if (latestAlert && latestAlert.severity !== 'NOMINAL') {
      const alreadyIncluded = list.some((e) => e.title.includes(latestAlert.reason.slice(0, 10)));
      if (!alreadyIncluded) {
        list.push({
          id: latestAlert.id,
          time: '14:30',
          title: latestAlert.reason || 'Telemetry Alert Dispatched',
          description: latestAlert.actionable_instruction || 'Sentry monitoring engaged.',
          severity: latestAlert.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        });
      }
    }

    // 3. Preceding mission & physiological contextual events (answering "What happened before?")
    if (telemetry?.mission_state === 'WORKOUT') {
      list.push({
        id: 'workout_active',
        time: '14:25',
        title: 'Countermeasure Exercise In Progress',
        description: 'Cycle ergometry active; target exertion zone 130-155 bpm.',
        severity: 'EVENT',
      });
    } else {
      list.push({
        id: 'workout_completed',
        time: '14:20',
        title: 'Countermeasure Exercise Completed',
        description: 'Prescribed cycle ergometry session concluded; post-workout vitals settling.',
        severity: 'EVENT',
      });
    }

    list.push({
      id: 'rad_updated',
      time: '14:08',
      title: 'Radiation Dosimeter Synced',
      description: `Personal CAD sensor verified: ${((telemetry?.radiation_flux ?? 0.04)).toFixed(2)} mSv/h background.`,
      severity: 'NOMINAL',
    });

    list.push({
      id: 'lab_sync',
      time: '13:42',
      title: 'NASA OSDR Assays Synchronized',
      description: `Inspiration4 lab panel verified for ${astronautName}.`,
      severity: 'NOMINAL',
    });

    list.push({
      id: 'eclss_verify',
      time: '12:15',
      title: 'Cabin ECLSS Atmosphere Verified',
      description: 'pO₂ 20.9%, cabin pressure 101.3 kPa nominal.',
      severity: 'NOMINAL',
    });

    list.push({
      id: 'wake_protocol',
      time: '08:00',
      title: 'Crew Wake & Circadian Alignment',
      description: 'Actigraphy sleep efficiency recorded; wake phase initialized.',
      severity: 'NOMINAL',
    });

    return list;
  }, [clinicalSummary, latestAlert, telemetry, astronautName]);

  const getSeverityColor = (sev: TimelineEvent['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return '#ef4444';
      case 'WARNING':
        return '#f59e0b';
      case 'EVENT':
        return '#38bdf8';
      case 'NOMINAL':
      default:
        return '#22c55e';
    }
  };

  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid #282828',
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Clinical Timeline
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '1px' }}>
            Physiological &amp; mission sequence context
          </div>
        </div>
        <span
          style={{
            fontSize: '8.5px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '3px',
            color: '#94a3b8',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            fontFamily: "'Tomorrow', sans-serif",
          }}
        >
          NASA FLIGHT LOG
        </span>
      </div>

      {/* Timeline Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '8px' }}>
        {/* Continuous vertical timeline connector line */}
        <div
          style={{
            position: 'absolute',
            left: '14px',
            top: '6px',
            bottom: '6px',
            width: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.10)',
          }}
        />

        {events.map((evt, idx) => {
          const color = getSeverityColor(evt.severity);
          const isLatest = idx === 0;

          return (
            <div
              key={evt.id + idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                position: 'relative',
                paddingBottom: idx === events.length - 1 ? '0' : '10px',
              }}
            >
              {/* Timeline Dot */}
              <div
                style={{
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  backgroundColor: '#141414',
                  border: `2px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                  zIndex: 1,
                  boxShadow: isLatest && evt.severity !== 'NOMINAL' ? `0 0 8px ${color}` : 'none',
                }}
              >
                <div
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
              </div>

              {/* Event Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="font-mono-tabular"
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: isLatest ? '#ffffff' : '#94a3b8',
                    }}
                  >
                    {evt.time}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: evt.severity === 'CRITICAL' ? '#ef4444' : evt.severity === 'WARNING' ? '#f59e0b' : '#e2e8f0',
                      letterSpacing: '0.02em',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    {evt.title}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '9px',
                    color: '#94a3b8',
                    marginTop: '2px',
                    lineHeight: 1.35,
                  }}
                >
                  {evt.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
