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
      return <IconComponent size={17} className={`text-text ${iconClassName}`} />;
    }
    
    return icon;
  };

  return (
    <div
      className={`
        p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors
        ${disabled ? 'opacity-55 pointer-events-none' : 'hover:bg-surface-2/30'}
        ${className}
      `}
    >
      {/* Left side: Icon + Title & Description */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {icon && (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center shrink-0 mt-0.5 text-muted transition-colors">
            {renderIcon()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text text-xs sm:text-sm tracking-tight">
              {title}
            </span>
            {badge && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-surface-2 border border-line text-muted">
                {badge}
              </span>
            )}
          </div>

          {description && (
            <div className="text-[11px] sm:text-xs text-muted leading-relaxed mt-0.5 break-words">
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
