import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export interface DepartmentHeaderProps {
  departmentName?: string;
  name?: string;
  department?: any;
  deptId?: string;
  canAdminWorkspace?: boolean;
  isOwner?: boolean;
  hasOrgOversight?: boolean;
  primaryDomain?: string;
  color?: string;
  headUser?: any;
  parentDepartmentName?: string;
  description?: string | null;
  badge?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
  };
  extraActions?: React.ReactNode;
}

export function DepartmentHeader({
  departmentName,
  name,
  department,
  deptId,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  primaryDomain,
  color,
  headUser,
  parentDepartmentName,
  description,
  badge = 'ACTIVE',
  onRefresh,
  isRefreshing = false,
  primaryAction,
  secondaryAction,
  extraActions,
}: DepartmentHeaderProps) {
  const displayName = departmentName || name || department?.name || 'Department Workspace';
  const displayDescription = description || department?.description;
  const displayBadge = badge || primaryDomain || 'ACTIVE';
  const displayParent = parentDepartmentName || department?.parent_department?.name;
  const displayHead = headUser || department?.head_user;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-divider pb-4 select-none"
    >
      <div className="min-w-0">
        {/* Breadcrumbs matching Projects standard */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted uppercase tracking-wider mb-1 animate-fade-in">
          <Link
            to="/departments"
            className="hover:text-main transition-colors text-muted/70"
          >
            DEPARTMENTS
          </Link>
          <span className="text-muted/40">/</span>
          <span className="text-muted font-semibold truncate max-w-[200px] sm:max-w-xs">
            {displayName.toUpperCase()}
          </span>
        </div>

        {/* Title + Single Status Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight animate-fade-up">
            {displayName}
          </h1>
          {displayBadge && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted animate-scale-in">
              {displayBadge}
            </span>
          )}
        </div>

        {/* One-line clamped description */}
        {displayDescription && (
          <p className="text-xs text-muted mt-0.5 font-normal truncate max-w-2xl animate-fade-in stagger-1">
            {displayDescription}
          </p>
        )}
      </div>

      {/* Action buttons on the right */}
      <div className="flex items-center gap-2 shrink-0 animate-fade-in stagger-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh workspace"
            aria-label="Refresh workspace"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            {secondaryAction.icon && <secondaryAction.icon size={13} />}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20 cursor-pointer"
          >
            {primaryAction.icon && <primaryAction.icon size={14} />}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {extraActions}
      </div>
    </motion.div>
  );
}

