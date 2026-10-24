import React from 'react';
import { Check, Lock } from 'lucide-react';

export interface ChipItem<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  symbol?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }> | React.ReactNode;
  disabled?: boolean;
}

interface ChipGridProps<T = string> {
  items: ChipItem<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: '2' | '3' | '4' | 'auto';
  disabled?: boolean;
  disabledTooltip?: string;
  className?: string;
  ariaLabel?: string;
}

export default function ChipGrid<T = string>({
  items,
  value,
  onChange,
  columns = 'auto',
  disabled = false,
  disabledTooltip,
  className = '',
  ariaLabel = 'Select option',
}: ChipGridProps<T>) {
  const getGridColsClass = () => {
    switch (columns) {
      case '2':
        return 'grid-cols-1 sm:grid-cols-2';
      case '3':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
      case '4':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
      case 'auto':
      default:
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3';
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid ${getGridColsClass()} gap-2.5 w-full ${className}`}
    >
      {items.map((item) => {
        const isSelected = item.value === value;
        const isItemDisabled = disabled || item.disabled;

        return (
          <button
            key={String(item.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isItemDisabled}
            onClick={() => !isItemDisabled && onChange(item.value)}
            title={isItemDisabled && disabledTooltip ? disabledTooltip : undefined}
            className={`
              relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring
              ${
                isSelected
                  ? 'border-accent bg-accent-soft text-text shadow-2xs'
                  : 'border-line bg-surface hover:bg-surface-2/60 text-muted hover:text-text'
              }
              ${isItemDisabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            {/* Header: Code/Symbol & Check/Lock indicator */}
            <div className="flex items-center justify-between w-full mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.symbol && (
                  <span className={`text-xs font-mono font-bold ${isSelected ? 'text-accent' : 'text-text'}`}>
                    {item.symbol}
                  </span>
                )}
                <span className="font-mono font-bold text-xs tracking-wide text-text truncate">
                  {item.label}
                </span>
              </div>

              <div className="shrink-0 ml-1.5">
                {isSelected ? (
                  <div className="w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center">
                    <Check size={10} strokeWidth={3} />
                  </div>
                ) : isItemDisabled ? (
                  <Lock size={12} className="text-muted/60" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-line bg-surface-2" />
                )}
              </div>
            </div>

            {/* Sublabel / Full Name */}
            {item.sublabel && (
              <span className="text-[11px] text-muted truncate w-full leading-tight">
                {item.sublabel}
              </span>
            )}

            {/* Optional badge */}
            {item.badge && (
              <span className="mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-surface-2 border border-line text-muted">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
