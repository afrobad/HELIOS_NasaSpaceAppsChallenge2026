import React from 'react';
import './UniversalTab.css';

export interface UniversalTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  accent?: 'neutral' | 'cyan' | 'emerald' | 'amber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  pill?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export const UniversalTab: React.FC<UniversalTabProps> = ({
  active,
  accent = 'neutral',
  size = 'md',
  pill = false,
  icon,
  badge,
  className = '',
  children,
  ...props
}) => {
  const activeClass = active ? 'helios-tab--active' : '';
  const accentClass = `helios-tab--${accent}`;
  const sizeClass = `helios-tab--${size}`;
  const shapeClass = pill ? 'helios-tab--pill' : 'helios-tab--rounded';

  return (
    <button
      type="button"
      className={`helios-tab ${activeClass} ${accentClass} ${sizeClass} ${shapeClass} ${className}`.trim()}
      {...props}
    >
      {icon && <span className="helios-tab-icon">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && badge !== null && (
        <span className="helios-tab-badge">{badge}</span>
      )}
    </button>
  );
};

export default UniversalTab;

