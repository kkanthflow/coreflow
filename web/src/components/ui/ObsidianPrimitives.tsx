import React, { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

/* ── 1. Page Header Standard ── */
interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageHeader({ title, description, badge, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-divider pb-4 select-none">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted uppercase tracking-wider mb-1">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-muted font-semibold' : 'text-zinc-600'}>
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">{title}</h1>
          {badge && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/[0.04] border border-divider text-muted">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted mt-0.5 font-normal">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ── 2. Continuous Metric Strip ── */
export interface MetricItem {
  label: string;
  value: string | number;
  indicator?: string;
  isOrange?: boolean;
  trend?: string;
}

export function MetricStrip({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="bg-card-bg border border-divider rounded-lg grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-white/[0.05] select-none">
      {metrics.map((m, idx) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="p-3.5 sm:p-4 flex flex-col justify-between"
        >
          <span className="text-[10px] font-mono font-semibold tracking-wider text-muted uppercase">{m.label}</span>
          <div className="mt-2">
            <motion.div
              key={String(m.value)}
              initial={{ opacity: 0.8, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${m.isOrange ? 'text-[#FF6B4A]' : 'text-main'}`}
            >
              {m.value}
            </motion.div>
            {m.indicator && (
              <span className="text-[9px] font-mono text-emerald-400 mt-0.5 block">{m.indicator}</span>
            )}
            {m.trend && (
              <span className="text-[9px] font-mono text-muted mt-0.5 block">{m.trend}</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── 3. Restrained Status Signals ── */
export type StatusType = 'active' | 'planning' | 'review' | 'completed' | 'on_hold' | 'critical' | 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft';

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active:         { label: 'Active',      dot: 'bg-[#FF6B4A]', text: 'text-[#FF6B4A]', bg: 'bg-[#FF6B4A]/10 border-[#FF6B4A]/20' },
  in_progress:    { label: 'In Progress', dot: 'bg-blue-400',  text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  planning:       { label: 'Planning',    dot: 'bg-zinc-400',  text: 'text-muted', bg: 'bg-white/[0.03] border-divider' },
  todo:           { label: 'To Do',       dot: 'bg-zinc-400',  text: 'text-muted', bg: 'bg-white/[0.03] border-divider' },
  review:         { label: 'In Review',   dot: 'bg-purple-400',text: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
  completed:      { label: 'Completed',   dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  done:           { label: 'Done',        dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  paid:           { label: 'Paid',        dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partially_paid: { label: 'Partially Paid', dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
  unpaid:         { label: 'Unpaid',         dot: 'bg-blue-400',  text: 'text-blue-300',  bg: 'bg-blue-500/10 border-blue-500/20' },
  settled:        { label: 'Settled',     dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  on_hold:        { label: 'On Hold',     dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
  pending:        { label: 'Pending',     dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
  critical:       { label: 'Critical',    dot: 'bg-red-400',   text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  overdue:        { label: 'Overdue',     dot: 'bg-red-400',   text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  cancelled:      { label: 'Cancelled',   dot: 'bg-zinc-600',  text: 'text-muted', bg: 'bg-zinc-900 border-divider' },
  draft:          { label: 'Draft',       dot: 'bg-zinc-500',  text: 'text-muted', bg: 'bg-white/[0.03] border-divider' },
};

export function StatusSignal({ status, label }: { status: string; label?: string }) {
  const s = STATUS_MAP[status.toLowerCase()] || STATUS_MAP.draft;
  const displayLabel = label || s.label;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={s.text}>{displayLabel}</span>
    </span>
  );
}

/* ── 4. Precision Progress Trajectory (Moving Node Motion) ── */
export function TrajectoryProgress({ value, color = '#FF6B4A', height = 3 }: { value: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full bg-hover rounded-full overflow-visible relative flex items-center" style={{ height: `${height}px` }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full relative"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}, 0 0 16px ${color}88` }}
      >
        {/* Flow Node at trajectory tip */}
        {clamped > 0 && (
          <div 
            className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm"
            style={{ transform: 'translate(50%, -50%)', boxShadow: `0 0 8px #ffffff, 0 0 14px ${color}, 0 0 20px ${color}` }}
          />
        )}
      </motion.div>
    </div>
  );
}

/* ── 5. Context Inspector Panel (380px - 440px) ── */
interface ContextInspectorProps {
  title: string;
  subtitle?: string;
  badge?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function ContextInspector({ title, subtitle, badge, onClose, children, footer }: ContextInspectorProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card-bg border-l border-divider shadow-2xl flex flex-col font-sans select-none animate-in slide-in-from-right duration-200">
      {/* Inspector Header */}
      <div className="h-14 px-5 border-b border-divider flex items-center justify-between shrink-0 bg-card-bg">
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main truncate">{title}</h2>
            {badge && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.04] text-muted border border-divider">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-muted hover:text-main hover:bg-white/[0.04] transition-colors"
          title="Close Inspector (Esc)"
        >
          <X size={15} />
        </button>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {children}
      </div>

      {/* Optional Inspector Footer */}
      {footer && (
        <div className="p-4 border-t border-divider bg-card-bg shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}

/* ── 6. Empty State ── */
interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 px-4 text-center select-none">
      <div className="w-10 h-10 rounded-lg bg-card-bg border border-divider flex items-center justify-center mx-auto text-muted mb-3">
        <Icon size={18} className="text-[#FF6B4A]" />
      </div>
      <h3 className="text-sm font-semibold text-main tracking-tight">{title}</h3>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3.5 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── 7. Skeleton Loaders ── */
export function SkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 bg-white/[0.02] rounded border border-divider animate-pulse" />
      ))}
    </div>
  );
}
