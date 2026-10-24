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
  const isBadgeActive = badge && (badge.toLowerCase().includes('active') || badge.toLowerCase().includes('inr') || badge.toLowerCase().includes('rupee'));

  return (
    <section className={`mt-7 first:mt-0 ${className}`}>
      {/* Section Header: 28px above (mt-7), 8-10px below (mb-2.5) */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.08em] text-muted">
            {label}
          </h2>
          {badge && (
            <span
              className={`text-[11px] font-mono tracking-[0.08em] font-medium ${
                isBadgeActive ? 'text-accent' : 'text-muted'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {description && (
        <p className="text-xs text-muted px-1 -mt-1 mb-2.5 leading-relaxed">
          {description}
        </p>
      )}

      {/* Card Container: surface background, 1px border from line token, 12-14px radius, no heavy shadow, overflow-visible */}
      <div className="bg-surface rounded-[13px] border border-line divide-y divide-line overflow-visible transition-colors">
        {children}
      </div>
    </section>
  );
}
