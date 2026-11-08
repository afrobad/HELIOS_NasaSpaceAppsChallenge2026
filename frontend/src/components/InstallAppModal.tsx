import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState<'IDLE' | 'INSTALLED' | 'LAUNCHED'>('IDLE');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setInstallStatus('INSTALLED');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallStatus('INSTALLED');
          setTimeout(() => onClose(), 1400);
        } else {
          onClose();
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: Open in standalone focused window with desktop-app dimensions
      try {
        window.open(
          window.location.href,
          'AstroDocX_Console',
          'menubar=no,toolbar=no,location=no,status=no,width=1440,height=900,left=100,top=80'
        );
        setInstallStatus('LAUNCHED');
        setTimeout(() => onClose(), 1800);
      } catch (err) {
        console.warn('Could not launch window:', err);
        onClose();
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Card (Matching Reference Image Exactly) */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#181a1b',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          padding: '24px 26px',
          boxSizing: 'border-box',
          position: 'relative',
          color: '#ffffff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {/* Close 'X' Button at Top Right */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            transition: 'color 0.14s ease, background 0.14s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#9ca3af';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={20} strokeWidth={2.2} />
        </button>

        {/* Top Header Row: Icon + Title & Publisher */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          {/* AstroDocX Glowing Spherical Logo with Orbit Ring & Cross */}
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #38bdf8 0%, #2563eb 50%, #1e1b4b 100%)',
              boxShadow: '0 0 18px rgba(56, 189, 248, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Orbit Ellipse Ring */}
            <div
              style={{
                position: 'absolute',
                width: '52px',
                height: '24px',
                borderRadius: '50%',
                border: '1.8px solid rgba(168, 85, 247, 0.85)',
                transform: 'rotate(-28deg)',
                boxShadow: '0 0 8px rgba(168, 85, 247, 0.6)',
                pointerEvents: 'none',
              }}
            />
            {/* Orbiting Satellite Dot */}
            <div
              style={{
                position: 'absolute',
                top: '5px',
                right: '4px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#f59e0b',
                boxShadow: '0 0 6px #f59e0b',
              }}
            />
            {/* Central White Medical Star / Cross */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ zIndex: 2 }}>
              <path
                d="M12 4v16M4 12h16"
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Title & Publisher Text */}
          <div style={{ flex: 1, paddingRight: '20px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                lineHeight: 1.25,
                color: '#ffffff',
                letterSpacing: '-0.01em',
              }}
            >
              Install AstroDocX Crew Console app
            </h2>
            <div
              style={{
                fontSize: '13.5px',
                color: '#9ca3af',
                marginTop: '4px',
                fontWeight: 400,
              }}
            >
              Publisher: <span style={{ color: '#9ca3af' }}>astrodocx.vercel.app</span>
            </div>
          </div>
        </div>

        {/* Feature Explanatory Text & Bullet List */}
        <div style={{ marginBottom: '24px', fontSize: '14px', lineHeight: 1.5, color: '#e5e7eb' }}>
          <p style={{ margin: '0 0 10px 0', color: '#f3f4f6' }}>
            Use this site often? Install the app which:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              listStyleType: 'disc',
              color: '#d1d5db',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <li>Opens in a focused window</li>
            <li>Has quick access options like pin to taskbar</li>
            <li>Syncs across multiple devices</li>
          </ul>
        </div>

        {/* Action Buttons: Install (Dark) & Not now (Light White) */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: '9999px',
              background: '#374151',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease, transform 0.1s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#4b5563';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#374151';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {installStatus === 'INSTALLED'
              ? '✓ Installed'
              : installStatus === 'LAUNCHED'
                ? '✓ Opened'
                : 'Install'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: '9999px',
              background: '#ffffff',
              border: 'none',
              color: '#111827',
              fontSize: '14.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease, transform 0.1s ease',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'none';
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
