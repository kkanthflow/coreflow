import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { getTabIcon } from './DepartmentTabs';

export interface ModuleCardProps {
  moduleKey: string;
  name: string;
  category?: string;
  description?: string | null;
  recordCount: number;
  icon?: LucideIcon;
  onClick: () => void;
  index?: number;
}

export function ModuleCard({
  moduleKey,
  name,
  category = 'Operational',
  description,
  recordCount,
  icon,
  onClick,
  index = 0,
}: ModuleCardProps) {
  const Icon = icon || getTabIcon(moduleKey, category);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${name} module workspace, ${recordCount} records`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="bg-card-bg border border-divider hover:border-accent/40 rounded-xl shadow-sm hover:shadow-md p-[18px] transition-all cursor-pointer flex flex-col justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background select-none min-h-[160px]"
    >
      <div className="space-y-3">
        {/* Header: 38px Icon Box + Title + Record Count */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[38px] h-[38px] rounded-xl bg-surface-2 border border-divider flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[14px] sm:text-[15px] font-medium text-main group-hover:text-accent transition-colors block truncate">
                {name}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted block truncate mt-0.5">
                {category}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-surface border border-divider text-muted tabular-nums shrink-0">
            {recordCount} {recordCount === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Description: 13px muted clamped to 2 lines */}
        {description && (
          <p className="text-[13px] text-muted line-clamp-2 leading-relaxed font-normal">
            {description}
          </p>
        )}
      </div>

      {/* Footer row: 1px divider + accent "Open Module Workspace" with arrow */}
      <div className="pt-3 border-t border-divider flex items-center justify-between text-xs text-accent font-semibold group-hover:underline mt-4">
        <span>Open Module Workspace</span>
        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.div>
  );
}

