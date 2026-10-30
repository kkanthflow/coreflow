import React from 'react';
import { motion } from 'motion/react';

export interface DepartmentMetricItem {
  label: string;
  value: string | number;
  indicator?: string;
  isOrange?: boolean;
  trend?: string;
}

export interface DepartmentMetricStripProps {
  metrics: DepartmentMetricItem[];
}

/**
 * Continuous Telemetry Metric Strip for Department Workspace.
 * Perfectly balances 3 metrics across grid-cols-1 sm:grid-cols-3
 * with 1px divider, tabular nums, and hover telemetry.
 */
export function DepartmentMetricStrip({ metrics }: DepartmentMetricStripProps) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="bg-card-bg border border-divider rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-divider select-none overflow-hidden">
      {metrics.map((m, idx) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-hover/40 transition-colors"
        >
          <span className="text-[10px] font-mono font-semibold tracking-wider text-muted uppercase">
            {m.label}
          </span>
          <div className="mt-2">
            <motion.div
              key={String(m.value)}
              initial={{ opacity: 0.8, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${
                m.isOrange ? 'text-accent' : 'text-main'
              }`}
            >
              {m.value}
            </motion.div>
            {m.indicator && (
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold">
                {m.indicator}
              </span>
            )}
            {m.trend && (
              <span className="text-[9px] font-mono text-muted mt-0.5 block font-medium">
                {m.trend}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

