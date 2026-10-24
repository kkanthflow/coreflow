import React from 'react';

interface SettingsRowProps {
  icon?: React.ComponentType<{ size?: number; className?: string }> | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  badge?: string;
  iconClassName?: string;
}

export default function SettingsRow({
  icon,
  title,
  description,
  children,
  action,
  disabled = false,
  className = '',
  badge,
  iconClassName = '',
}: SettingsRowProps) {
  const renderIcon = () => {
    if (!icon) return null;
    
    // If it's a React component function/class
    if (typeof icon === 'function' || (typeof icon === 'object' && '$$typeof' in (icon as any) && typeof (icon as any).type === 'function')) {
      const IconComponent = icon as React.ComponentType<{ size?: number; className?: string }>;
      return <IconComponent size={18} className={`text-accent ${iconClassName}`} />;
    }
    
    return icon;
  };

  return (
    <div
      className={`
        py-4 px-[18px] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors
        ${disabled ? 'opacity-55 pointer-events-none' : 'hover:bg-surface-2/30'}
        ${className}
      `}
    >
      {/* Left side: Icon + Title & Description (Gap 14px) */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {icon && (
          <div className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft flex items-center justify-center shrink-0 text-accent transition-colors">
            {renderIcon()}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text text-[14.5px] leading-tight">
              {title}
            </span>
            {badge && (
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-surface-2 border border-line text-muted">
                {badge}
              </span>
            )}
          </div>

          {description && (
            <div className="text-[12.5px] text-muted leading-relaxed break-words">
              {description}
            </div>
          )}
        </div>
      </div>

      {/* Right side control area */}
      {(children || action) && (
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-1 sm:pt-0 pl-12 sm:pl-0">
          {children}
          {action}
        </div>
      )}
    </div>
  );
}
