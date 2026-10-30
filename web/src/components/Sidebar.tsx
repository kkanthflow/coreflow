import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { BRAND } from '../brand';
import {
  LayoutDashboard, Briefcase, CheckSquare, Calendar, Video,
  MessageSquare, Users, Building2, Building, FileText,
  CreditCard, BarChart3, Settings, ChevronLeft, ShieldCheck, Sparkles, Zap,
  Inbox, History, Shield, Award
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRole } from '../hooks/useRole';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
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
    color?: string;
  }[];
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, accountType } = useAuth();
  const { role, can } = useRole();
  const { orgName, orgId, isOwner, leadershipVisibility } = useWorkspace();
  const location = useLocation();
  const isSettingsActive = location.pathname.startsWith('/settings');

  const [departments, setDepartments] = useState<{ id: string; name: string; color: string | null }[]>([]);

  const isFreelancer = accountType === 'freelancer';
  const isClient = role === 'client';
  const isOrgAccount = accountType === 'organization' || (!!orgId && !isFreelancer && !isClient);

  useEffect(() => {
    if (!orgId || isFreelancer || isClient) {
      setDepartments([]);
      return;
    }

    async function loadAuthorizedDepts() {
      try {
        if (isOwner || leadershipVisibility === 'full_organization' || leadershipVisibility === 'all_departments') {
          const { data } = await supabase
            .from('departments')
            .select('id, name, color')
            .eq('org_id', orgId)
            .eq('is_deleted', false)
            .eq('status', 'active')
            .order('name');
          setDepartments(data || []);
        } else {
          // Check member's departments
          const { data: dm } = await supabase
            .from('department_members')
            .select('departments:department_id(id, name, color, is_deleted, status)')
            .eq('org_id', orgId)
            .eq('user_id', user?.id);

          const list = (dm || [])
            .map((item: any) => item.departments)
            .filter((d: any) => d && !d.is_deleted && d.status !== 'archived');
          setDepartments(list);
        }
      } catch (e) {
        console.error('Failed to load sidebar departments:', e);
      }
    }
    loadAuthorizedDepts();
  }, [orgId, isOwner, leadershipVisibility, user?.id, isFreelancer, isClient]);

  const CLIENT_NAV_GROUPS: NavGroup[] = [
    {
      label: 'Client Portal',
      items: [
        { name: 'My Projects', to: '/projects', icon: Briefcase, permission: 'view_projects', shortcut: '1' },
        { name: 'My Invoices', to: '/invoices', icon: FileText, permission: 'view_invoices', shortcut: '2' },
      ]
    }
  ];

  // Specific Organization Account Navigation per Prompt Section 15
  const ORG_NAV_GROUPS: NavGroup[] = [
    {
      label: 'ORGANIZATION',
      items: [
        { name: 'Overview', to: '/dashboard', icon: LayoutDashboard, permission: null, shortcut: '1' },
        { name: 'Leadership Team', to: '/leadership', icon: Award, permission: null, shortcut: 'L' },
        { name: 'Members', to: '/employees', icon: Users, permission: 'view_team_directory', shortcut: '2' },
        { name: 'Departments', to: '/departments', icon: Building2, permission: null, shortcut: 'D' },
        { name: 'Projects', to: '/projects', icon: Briefcase, permission: 'view_projects', shortcut: '3' },
        { name: 'Tasks', to: '/tasks', icon: CheckSquare, permission: 'manage_tasks', shortcut: '4' },
        { name: 'Chat', to: '/chat', icon: MessageSquare, permission: 'send_messages', shortcut: '5' },
        { name: 'Meetings', to: '/meetings', icon: Video, permission: 'schedule_meetings', shortcut: '6' },
        { name: 'Reports', to: '/analytics', icon: BarChart3, permission: 'view_reports', shortcut: '7' },
        { name: 'Settings', to: '/settings', icon: Settings, permission: null },
      ]
    },
    ...(departments.length > 0 ? [
      {
        label: 'DEPARTMENTS',
        items: departments.map(d => ({
          name: d.name,
          to: `/departments/${d.id}`,
          icon: Building2,
          permission: null,
          color: d.color || '#60A5FA',
        }))
      }
    ] : []),
    {
      label: 'Governance & Audit',
      items: [
        { name: 'Roles & RBAC', to: '/roles-permissions', icon: Shield, permission: null },
        { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck, permission: 'view_audit_logs' },
      ]
    },
    {
      label: 'Automations',
      items: [
        { name: 'Workflows', to: '/workflows', icon: Zap, permission: null, shortcut: 'W' },
        { name: 'Approvals', to: '/workflows/approvals', icon: Inbox, permission: null },
        { name: 'Execution Logs', to: '/workflows/history', icon: History, permission: null },
      ]
    },
    {
      label: 'Business & CRM',
      items: [
        { name: 'Clients', to: '/clients', icon: Building, permission: 'manage_clients' },
        { name: 'Invoices', to: '/invoices', icon: FileText, permission: 'view_invoices' },
        { name: 'Settlements', to: '/payments', icon: CreditCard, permission: 'record_payments' },
        { name: 'Subscription & Billing', to: '/settings/billing', icon: CreditCard, permission: null },
      ]
    }
  ];

  // Freelancer / Solo Navigation (Untouched and Isolated)
  const FREELANCER_NAV_GROUPS: NavGroup[] = [
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
      label: 'Automations',
      items: [
        { name: 'Workflows', to: '/workflows', icon: Zap, permission: null, shortcut: 'W' },
        { name: 'Approvals', to: '/workflows/approvals', icon: Inbox, permission: null },
        { name: 'Execution Logs', to: '/workflows/history', icon: History, permission: null },
      ]
    },
    {
      label: 'Collaboration',
      items: [
        { name: 'Meetings', to: '/meetings', icon: Video, permission: 'schedule_meetings', shortcut: '5' },
        { name: 'Chat', to: '/chat', icon: MessageSquare, permission: 'send_messages', shortcut: '6' },
      ]
    },
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
        { name: 'Subscription & Billing', to: '/settings/billing', icon: CreditCard, permission: null },
      ]
    }
  ];

  const activeNavGroups = isClient 
    ? CLIENT_NAV_GROUPS 
    : isOrgAccount 
    ? ORG_NAV_GROUPS 
    : FREELANCER_NAV_GROUPS;

  const currentWorkspaceName = orgName || BRAND.company;

  return (
    <motion.aside 
      animate={{ width: collapsed ? 58 : 224 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-full bg-surface border-r border-line z-20 shrink-0 font-sans select-none overflow-hidden"
    >
      {/* Workspace Header */}
      <div className="flex h-12 items-center px-3 border-b border-line overflow-hidden shrink-0">
        {collapsed ? (
          <button 
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-text mx-auto hover:border-accent/50 hover:bg-surface transition-all shadow-xs cursor-pointer"
            title="Expand Navigation"
          >
            <AuvrynLogo size={14} />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-w-0" title={currentWorkspaceName}>
              <div className="w-6 h-6 rounded-lg bg-surface-2 border border-line flex items-center justify-center shrink-0 shadow-xs">
                <AuvrynLogo size={13} />
              </div>
              <div className="min-w-0">
                <span className="text-text font-bold text-xs tracking-tight truncate block">
                  {currentWorkspaceName}
                </span>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 text-muted hover:text-text rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
              title="Collapse Rail"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Groups - scrollable independently with min-h-0 */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
        {activeNavGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter(item => !item.permission || can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-0.5 animate-fade-in" style={{ animationDelay: `${gIdx * 0.04}s` }}>
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted/70">
                  {group.label}
                </div>
              )}
              {visibleItems.map(item => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) => cn(
                    'relative flex items-center rounded-lg transition-all duration-150 text-xs font-medium group',
                    collapsed ? 'h-9 w-9 mx-auto justify-center' : 'px-2.5 py-1.5 justify-between',
                    isActive
                      ? 'bg-surface-2 text-text font-semibold shadow-xs'
                      : 'text-muted hover:text-text hover:bg-surface-2/60'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-indicator"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          className={cn(
                            "absolute bg-accent rounded-full shadow-[0_0_10px_var(--accent)]",
                            collapsed ? "-left-1 top-2 bottom-2 w-[3px]" : "left-0 top-1.5 bottom-1.5 w-[3px]"
                          )}
                        />
                      )}

                      <div className={cn('flex items-center gap-2.5 min-w-0', collapsed ? 'justify-center' : '')}>
                        {item.color ? (
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20" 
                            style={{ backgroundColor: item.color }} 
                          />
                        ) : (
                          <item.icon
                            size={15}
                            className={cn(
                              "shrink-0 transition-all duration-150 group-hover:translate-x-0.5",
                              isActive ? "text-accent" : "text-muted group-hover:text-text"
                            )}
                          />
                        )}
                        {!collapsed && (
                          <span className="truncate tracking-tight text-[12px]">{item.name}</span>
                        )}
                      </div>

                      {!collapsed && item.shortcut && (
                        <kbd
                          className="px-1.5 py-0.5 text-[9px] font-mono text-muted bg-surface-2/80 border border-line rounded shadow-xs group-hover:text-text"
                          title={`Keyboard shortcut: ${item.shortcut}`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Pinned Footer Settings */}
      <div className="p-2 border-t border-line bg-surface shrink-0 space-y-0.5">
        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            'relative flex items-center rounded-lg transition-all duration-150 text-xs font-medium group',
            collapsed ? 'h-9 w-9 mx-auto justify-center' : 'px-2.5 py-1.5 justify-between',
            isSettingsActive ? 'bg-surface-2 text-text font-semibold shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2/60'
          )}
        >
          <>
            {isSettingsActive && (
              <motion.div 
                layoutId="active-nav-indicator"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                className={cn(
                  "absolute bg-accent rounded-full shadow-[0_0_10px_var(--accent)]",
                  collapsed ? "-left-1 top-2 bottom-2 w-[3px]" : "left-0 top-1.5 bottom-1.5 w-[3px]"
                )} 
              />
            )}
            <div className={cn('flex items-center gap-2.5 min-w-0', collapsed ? 'justify-center' : '')}>
              <Settings 
                size={15} 
                className={cn(
                  "shrink-0 transition-all duration-150 group-hover:translate-x-0.5", 
                  isSettingsActive ? "text-accent" : "text-muted group-hover:text-text"
                )} 
              />
              {!collapsed && <span className="truncate tracking-tight text-[12px]">Settings</span>}
            </div>
          </>
        </NavLink>
      </div>
    </motion.aside>
  );
}
