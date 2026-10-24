import React from 'react';
import { AlertCircle, RefreshCw, FolderSearch } from 'lucide-react';

/* ── Settings Loading Skeleton ── */
export function SettingsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-surface rounded-2xl border border-line divide-y divide-line overflow-hidden shadow-2xs">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 sm:p-4.5 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5 flex-1">
            <div className="w-10 h-10 rounded-xl bg-surface-2 shrink-0" />
            <div className="space-y-2 flex-1 max-w-sm">
              <div className="h-3.5 bg-surface-2 rounded w-28" />
              <div className="h-2.5 bg-surface-2/70 rounded w-48" />
            </div>
          </div>
          <div className="w-12 h-6 bg-surface-2 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ── */
interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }> | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = FolderSearch,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const Icon = typeof icon === 'function' ? icon : null;

  return (
    <div
      className={`
        bg-surface rounded-2xl border border-line p-8 sm:p-12 text-center
        flex flex-col items-center justify-center space-y-3
        ${className}
      `}
    >
      <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-muted mb-1">
        {Icon ? <Icon size={22} className="text-muted" /> : icon}
      </div>

      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="text-xs text-muted leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── Error State ── */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load settings',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`
        bg-surface rounded-2xl border border-danger/30 p-6 sm:p-8 text-center
        flex flex-col items-center justify-center space-y-3
        ${className}
      `}
    >
      <div className="w-11 h-11 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-1">
        <AlertCircle size={22} />
      </div>

      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="text-xs text-muted leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-text border border-line text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw size={12} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
