import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: SelectOption[];
  size?: 'sm' | 'md';
  error?: boolean;
  className?: string;
  selectClassName?: string;
}

export default function Select({
  options,
  value,
  onChange,
  disabled = false,
  size = 'md',
  error = false,
  className = '',
  selectClassName = '',
  children,
  ...props
}: SelectProps) {
  const isSm = size === 'sm';

  return (
    <div className={`relative inline-block w-full sm:w-auto min-w-[140px] ${className}`}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full appearance-none rounded-xl bg-surface-2 border text-text font-medium cursor-pointer transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-accent
          ${isSm ? 'pl-2.5 pr-8 py-1.5 text-xs' : 'pl-3.5 pr-9 py-2 text-xs sm:text-sm'}
          ${error ? 'border-danger focus-visible:ring-danger/30' : 'border-line'}
          ${disabled ? 'opacity-40 cursor-not-allowed bg-surface-2/40' : 'hover:border-line/80'}
          ${selectClassName}
        `}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option
                key={String(opt.value)}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-surface text-text"
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {/* Trailing Chevron Icon */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted">
        <ChevronDown size={isSm ? 13 : 15} />
      </div>
    </div>
  );
}
