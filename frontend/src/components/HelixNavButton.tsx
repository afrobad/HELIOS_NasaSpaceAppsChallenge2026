import React from 'react';
import './HelixNavButton.css';

export interface HelixNavButtonProps {
  isActive?: boolean;
  onClick?: () => void;
  title?: string;
}

/**
 * HelixNavButton — Cybernetic AI Button for Top Navigation Bar
 * 
 * Clean, robust aerospace implementation:
 * - Perfectly auto-sized pill container (zero clipping, zero overflow)
 * - Multi-layered glassmorphic bevel shadows with cyan highlight
 * - Animated SVG sparkle icon with continuous subtle pulse
 * - Staggered glowing letter reveal across "HELIX AI"
 */
export const HelixNavButton: React.FC<HelixNavButtonProps> = ({
  isActive = false,
  onClick,
  title = 'Helix-Ai Autonomous Clinical Sentry',
}) => {
  return (
    <div className="helix-btn-wrapper">
      <button
        type="button"
        className={`helix-btn ${isActive ? 'helix-btn--active' : ''}`}
        onClick={onClick}
        title={title}
        aria-label="Navigate to Helix AI Clinical Intelligence"
      >
        <svg className="helix-btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
          />
        </svg>

        <div className="helix-txt-wrapper">
          <span className="helix-btn-letter">H</span>
          <span className="helix-btn-letter">E</span>
          <span className="helix-btn-letter">L</span>
          <span className="helix-btn-letter">I</span>
          <span className="helix-btn-letter">X</span>
          <span className="helix-btn-spacer">&nbsp;</span>
          <span className="helix-btn-letter helix-btn-letter--accent">A</span>
          <span className="helix-btn-letter helix-btn-letter--accent">I</span>
        </div>
      </button>
    </div>
  );
};
