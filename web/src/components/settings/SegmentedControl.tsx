import React, { useRef } from 'react';
import { motion } from 'motion/react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }> | React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  name?: string;
}

export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  className = '',
  ariaLabel = 'Segmented options',
  name = 'segmented-control',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutId = `segmented-pill-${name}`;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return;
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    }

    if (nextIndex >= 0) {
      const nextOption = options[nextIndex];
      if (!nextOption.disabled) {
        onChange(nextOption.value);
        // Focus the next button
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  const isSm = size === 'sm';

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`
        inline-flex items-center p-1 rounded-xl bg-surface-2 border border-line select-none transition-colors
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
    >
      {options.map((option, idx) => {
        const isSelected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || option.disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`
              relative flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring z-10
              ${isSm ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}
              ${isSelected ? 'text-text font-semibold' : 'text-muted hover:text-text'}
              ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            {/* Sliding Active Pill Background */}
            {isSelected && (
              <motion.div
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                className="absolute inset-0 bg-surface rounded-lg shadow-2xs border border-line/70 -z-10"
              />
            )}

            {Icon && (
              <span className={`shrink-0 ${isSelected ? 'text-accent' : 'text-muted'}`}>
                {typeof Icon === 'function' ? <Icon size={isSm ? 13 : 14} /> : Icon}
              </span>
            )}

            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
