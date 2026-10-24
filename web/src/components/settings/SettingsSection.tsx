import React from 'react';

interface SettingsSectionProps {
  label: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}

export default function SettingsSection({
  label,
  description,
  action,
  children,
  className = '',
  badge,
}: SettingsSectionProps) {
  return (
    <section className={`space-y-2.5 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-mono font-bold tracking-wider uppercase text-muted">
            {label}
          </h2>
          {badge && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-surface-2 border border-line text-muted">
              {badge}
            </span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {description && (
        <p className="text-xs text-muted px-1 -mt-1 leading-relaxed">
          {description}
        </p>
      )}

      {/* Card Container */}
      <div className="bg-surface rounded-2xl border border-line shadow-2xs divide-y divide-line overflow-hidden transition-colors">
        {children}
      </div>
    </section>
  );
}
