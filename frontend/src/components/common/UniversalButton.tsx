import React from 'react';
import './UniversalButton.css';

export interface UniversalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'neutral';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  pill?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
}

export const UniversalButton: React.FC<UniversalButtonProps> = ({
  variant = 'cyan',
  size = 'md',
  pill = true,
  fullWidth = false,
  icon,
  iconPosition = 'right',
  className = '',
  children,
  ...props
}) => {
  const variantClass = `helios-btn--${variant}`;
  const sizeClass = `helios-btn--${size}`;
  const shapeClass = pill ? 'helios-btn--pill' : 'helios-btn--rounded';
  const widthClass = fullWidth ? 'helios-btn--full' : '';

  return (
    <button
      className={`helios-btn ${variantClass} ${sizeClass} ${shapeClass} ${widthClass} ${className}`.trim()}
      {...props}
    >
      <span className="helios-btn-content">
        {icon && iconPosition === 'left' && <span className="helios-btn-icon">{icon}</span>}
        <span>{children}</span>
        {icon && iconPosition === 'right' && <span className="helios-btn-icon">{icon}</span>}
      </span>
    </button>
  );
};

export default UniversalButton;

