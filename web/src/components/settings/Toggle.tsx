import React from 'react';
import { Loader2 } from 'lucide-react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  ariaLabel,
  size = 'md',
  className = '',
}: ToggleProps) {
  const isSm = size === 'sm';
  const trackWidth = isSm ? 'w-8 h-4.5' : 'w-10 h-5.5 sm:w-11 sm:h-6';
  const knobSize = isSm ? 'w-3.5 h-3.5' : 'w-4 h-4 sm:w-4.5 sm:h-4.5';
  const translateDistance = isSm
    ? (checked ? 'translate-x-3.5' : 'translate-x-0.5')
    : (checked ? 'translate-x-5 sm:translate-x-5.5' : 'translate-x-0.5 sm:translate-x-1');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || loading) return;
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label || 'Toggle switch'}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1
          ${trackWidth}
          ${checked ? 'bg-accent' : 'bg-surface-2 border border-line'}
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
          ${loading ? 'cursor-wait' : ''}
        `}
      >
        <span
          className={`
            inline-flex items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-200 ease-out
            ${knobSize}
            ${translateDistance}
          `}
        >
          {loading && (
            <Loader2
              size={isSm ? 9 : 11}
              className="animate-spin text-accent"
            />
          )}
        </span>
      </button>

      {label && (
        <span
          onClick={handleClick}
          className={`text-xs font-medium text-text cursor-pointer ${
            disabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
