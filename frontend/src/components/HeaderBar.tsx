import React, { useEffect, useState } from 'react';
import { audioService } from '../services/audioService';

interface HeaderBarProps {
  connected: boolean;
  marsDelay: boolean;
  onToggleMarsDelay: (enabled: boolean) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  connected,
  marsDelay,
  onToggleMarsDelay,
}) => {
  const [audioEngaged, setAudioEngaged] = useState<boolean>(true);
  const [metSeconds, setMetSeconds] = useState<number>(14 * 3600 + 43 * 60 + 18);

  useEffect(() => {
    // Enable audio service by default and unlock Web Audio context on first user click/interaction
    audioService.setEngaged(true);
    const unlockAudio = () => {
      audioService.initAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const timer = setInterval(() => {
      setMetSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatMet = (totalSec: number) => {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `T+${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleToggleAudio = () => {
    const next = !audioEngaged;
    audioService.setEngaged(next);
    setAudioEngaged(next);
    if (next) {
      audioService.playTone('chime');
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0 16px',
        borderBottom: '1px solid var(--hud-border)',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '14px',
      }}
    >
      {/* Brand Hierarchy: Clean Typographic Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
          H.E.L.I.O.S
        </span>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px', fontSize: '11px' }}>
          <span
            className={`hud-status-dot ${connected ? 'status-dot-nominal' : 'status-dot-critical'}`}
          />
          <span style={{ color: connected ? 'var(--hud-nominal)' : 'var(--hud-critical)', fontWeight: 600 }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Controls: Minimal Buttons with High-Contrast Orange Accents */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* MET Clock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            padding: '4px 10px',
            background: 'var(--hud-bg-panel)',
            borderRadius: 'var(--hud-radius-btn)',
            border: '1px solid var(--hud-border)',
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--hud-text-dim)', fontWeight: 700 }}>MET</span>
          <span className="font-mono-tabular" style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
            {formatMet(metSeconds)}
          </span>
        </div>

        {/* Mars 22m Latency Toggle (High-Contrast Orange when Active) */}
        <button
          onClick={() => onToggleMarsDelay(!marsDelay)}
          className={`hud-btn ${marsDelay ? 'hud-btn-active' : ''}`}
        >
          <span>{marsDelay ? 'MARS DELAY: ON' : 'MARS DELAY: OFF'}</span>
        </button>

        {/* Voice Audio Toggle */}
        <button
          onClick={handleToggleAudio}
          className={`hud-btn ${audioEngaged ? 'hud-btn-orange' : ''}`}
        >
          <span>{audioEngaged ? 'VOICE: ON' : 'VOICE: MUTED'}</span>
        </button>
      </div>
    </header>
  );
};
