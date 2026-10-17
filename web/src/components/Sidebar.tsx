import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Briefcase, CheckSquare, Calendar, Video,
  MessageSquare, Users, Building2, Building, FileText,
  CreditCard, BarChart3, Settings, ChevronLeft, ShieldCheck, Sparkles
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useWorkspace } from '../hooks/useWorkspace';
import AuvrynLogo from './AuvrynLogo';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface NavGroup {
  label: string;
  items: {
    name: string;
    to: string;
    icon: any;
    permission: any;
    shortcut?: string;
    badgeCount?: number;
  }[];
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { can } = useRole();
  const { orgName, orgId } = useWorkspace();

  const NAV_GROUPS: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: null, shortcut: '1' },
        { name: 'Projects', to: '/projects', icon: Briefcase, permission: 'view_projects', shortcut: '2' },
        { name: 'Tasks', to: '/tasks', icon: CheckSquare, permission: 'manage_tasks', shortcut: '3' },
        { name: 'Calendar', to: '/calendar', icon: Calendar, permission: null, shortcut: '4' },
      ]
    },
    {
      label: 'Collaboration',
      items: [
        { name: 'Meetings', to: '/meetings', icon: Video, permission: 'schedule_meetings', shortcut: '5' },
        { name: 'Chat', to: '/chat', icon: MessageSquare, permission: 'send_messages', shortcut: '6' },
      ]
    },
    ...(orgId ? [
      {
        label: 'Organization',
        items: [
          { name: 'Employees', to: '/employees', icon: Users, permission: 'view_team_directory' },
          { name: 'Departments', to: '/departments', icon: Building2, permission: 'manage_departments' },
          { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck, permission: 'view_audit_logs' },
        ]
      }
    ] : []),
    {
      label: 'Business & CRM',
      items: [
        { name: 'Clients', to: '/clients', icon: Building, permission: 'manage_clients' },
      ]
    },
    {
      label: 'Finance & Insights',
      items: [
        { name: 'Invoices', to: '/invoices', icon: FileText, permission: 'view_invoices' },
        { name: 'Settlements', to: '/payments', icon: CreditCard, permission: 'record_payments' },
        { name: 'Telemetry', to: '/analytics', icon: BarChart3, permission: 'view_reports' },
        { name: 'Plans & Pricing', to: '/pricing', icon: Sparkles, permission: null },
        { name: 'Subscription & Billing', to: '/settings?tab=billing', icon: CreditCard, permission: null },
      ]
    }
  ];

  return (
    <motion.aside 
      animate={{ width: collapsed ? 58 : 224 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-full bg-card-bg border-r border-divider z-20 shrink-0 font-sans select-none overflow-hidden"
    >
      {/* Workspace Header */}
      <div className="flex h-12 items-center px-3 border-b border-divider overflow-hidden">
        {collapsed ? (
          <button 
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 rounded-md bg-card-bg border border-divider flex items-center justify-center text-main mx-auto hover:border-[#FF6B4A]/40 transition-colors"
            title="Expand Navigation"
          >
            <AuvrynLogo size={14} />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-hover border border-divider flex items-center justify-center shrink-0">
                <AuvrynLogo size={12} />
              </div>
              <div className="min-w-0">
                <span className="text-main font-bold text-xs tracking-tight truncate block">
                  {orgName || 'AUVRYN'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 text-muted hover:text-muted rounded hover:bg-white/[0.04] transition-colors"
              title="Collapse Rail"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-1.5 space-y-4">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(item => !item.permission || can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-600">
                  {group.label}
                </div>
              )}
              {visibleItems.map(item => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) => cn(
                    'relative flex items-center rounded-md transition-all duration-150 text-xs font-medium group',
                    collapsed ? 'h-9 w-9 mx-auto justify-center' : 'px-2.5 py-1.5 justify-between',
                    isActive
                      ? 'bg-white/[0.06] text-main font-semibold'
                      : 'text-muted hover:text-zinc-200 hover:bg-white/[0.025]'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active Signature Flow Shift Continuous Indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-indicator"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          className={cn(
                            "absolute bg-[#FF6B4A] rounded-full shadow-[0_0_14px_rgba(255,107,74,0.9),0_0_24px_rgba(255,107,74,0.5)]",
                            collapsed ? "-left-1 top-2 bottom-2 w-[3px]" : "left-0 top-1.5 bottom-1.5 w-[2.5px]"
                          )}
                        />
                      )}

                      <div className={cn('flex items-center gap-2.5 min-w-0', collapsed ? 'justify-center' : '')}>
                        <item.icon
                          size={15}
                          className={cn(
                            "shrink-0 transition-all duration-150 group-hover:translate-x-0.5",
                            isActive ? "text-[#FF6B4A]" : "text-muted group-hover:text-zinc-200"
                          )}
                        />
                        {!collapsed && (
                          <span className="truncate tracking-tight text-[12px]">{item.name}</span>
                        )}
                      </div>

                      {!collapsed && item.shortcut && (
                        <span className="text-[9px] font-mono text-zinc-600 group-hover:text-muted">
                          {item.shortcut}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer Settings */}
      <div className="p-1.5 border-t border-divider space-y-0.5">
        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={({ isActive }) => cn(
            'relative flex items-center rounded-md transition-all text-xs group',
            collapsed ? 'h-9 w-9 mx-auto justify-center' : 'px-2.5 py-1.5 justify-between',
            isActive ? 'bg-white/[0.06] text-main' : 'text-muted hover:text-muted hover:bg-white/[0.025]'
          )}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div 
                  layoutId="active-nav-indicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className={cn(
                    "absolute bg-[#FF6B4A] rounded-full shadow-[0_0_10px_rgba(255,107,74,0.5)]",
                    collapsed ? "-left-1 top-2 bottom-2 w-[3px]" : "left-0 top-1.5 bottom-1.5 w-[2.5px]"
                  )} 
                />
              )}
              <div className="flex items-center gap-2">
                <Settings size={15} className={cn("transition-transform group-hover:translate-x-0.5", isActive ? "text-[#FF6B4A]" : "text-muted group-hover:text-muted")} />
                {!collapsed && <span className="text-[12px] font-medium">Settings</span>}
              </div>
            </>
          )}
        </NavLink>
      </div>
    </motion.aside>
  );
}
