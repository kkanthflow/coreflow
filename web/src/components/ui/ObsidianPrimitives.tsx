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
    <motion.div 
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-divider pb-4 select-none"
    >
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted uppercase tracking-wider mb-1 animate-fade-in">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-muted font-semibold' : 'text-muted/60'}>
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight animate-fade-up">{title}</h1>
          {badge && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted animate-scale-in">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted mt-0.5 font-normal animate-fade-in stagger-1">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 animate-fade-in stagger-2">
          {actions}
        </div>
      )}
    </motion.div>
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
    <div className="bg-card-bg border border-divider rounded-xl shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-divider select-none overflow-hidden">
      {metrics.map((m, idx) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-hover/40 transition-colors"
        >
          <span className="text-[10px] font-mono font-semibold tracking-wider text-muted uppercase">{m.label}</span>
          <div className="mt-2">
            <motion.div
              key={String(m.value)}
              initial={{ opacity: 0.8, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${m.isOrange ? 'text-accent' : 'text-main'}`}
            >
              {m.value}
            </motion.div>
            {m.indicator && (
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold">{m.indicator}</span>
            )}
            {m.trend && (
              <span className="text-[9px] font-mono text-muted mt-0.5 block font-medium">{m.trend}</span>
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
  active:         { label: 'Active',      dot: 'bg-[#FF6B4A]', text: 'text-[#FF6B4A]', bg: 'bg-[#FF6B4A]/10 border-[#FF6B4A]/25' },
  in_progress:    { label: 'In Progress', dot: 'bg-blue-500',  text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25' },
  planning:       { label: 'Planning',    dot: 'bg-zinc-400',  text: 'text-muted', bg: 'bg-hover border-divider' },
  todo:           { label: 'To Do',       dot: 'bg-zinc-400',  text: 'text-muted', bg: 'bg-hover border-divider' },
  review:         { label: 'In Review',   dot: 'bg-purple-500',text: 'text-purple-600 dark:text-purple-300', bg: 'bg-purple-500/10 border-purple-500/25' },
  completed:      { label: 'Completed',   dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  done:           { label: 'Done',        dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  paid:           { label: 'Paid',        dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  partially_paid: { label: 'Partially Paid', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10 border-amber-500/25' },
  unpaid:         { label: 'Unpaid',         dot: 'bg-blue-500',  text: 'text-blue-600 dark:text-blue-300',  bg: 'bg-blue-500/10 border-blue-500/25' },
  settled:        { label: 'Settled',     dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  on_hold:        { label: 'On Hold',     dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10 border-amber-500/25' },
  pending:        { label: 'Pending',     dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10 border-amber-500/25' },
  critical:       { label: 'Critical',    dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/25' },
  overdue:        { label: 'Overdue',     dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/25' },
  cancelled:      { label: 'Cancelled',   dot: 'bg-zinc-500',  text: 'text-muted', bg: 'bg-hover border-divider' },
  draft:          { label: 'Draft',       dot: 'bg-zinc-400',  text: 'text-muted', bg: 'bg-hover border-divider' },
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
  showFox?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, showFox = true }: EmptyStateProps) {
  return (
    <div className="py-14 px-4 text-center select-none relative animate-fade-in">
      {showFox ? (
        <div className="relative inline-flex items-center justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-2/80 border border-[#FF5A36]/25 shadow-sm flex items-center justify-center overflow-hidden p-1">
            <img
              src="/auvryn-hero-mascot.png"
              alt="Auvryn Companion"
              className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-surface border border-line shadow-xs flex items-center justify-center text-accent">
            <Icon size={12} />
          </div>
        </div>
      ) : (
        <div className="w-12 h-12 rounded-xl bg-card-bg border border-divider shadow-2xs flex items-center justify-center mx-auto text-muted mb-3.5">
          <Icon size={20} className="text-accent" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-main tracking-tight">{title}</h3>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 hover:shadow-md cursor-pointer"
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
        <div key={i} className="h-10 bg-surface-2/70 rounded-lg border border-line animate-pulse" />
      ))}
    </div>
  );
}
