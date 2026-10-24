import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  User, 
  SunMoon, 
  Bell, 
  Video, 
  ShieldCheck, 
  Building2, 
  CreditCard, 
  Users, 
  Key,
  Lock
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

const MY_SETTINGS_ITEMS: NavItem[] = [
  { name: 'Profile', to: '/settings/profile', icon: User },
  { name: 'Appearance', to: '/settings/appearance', icon: SunMoon },
  { name: 'Notifications', to: '/settings/notifications', icon: Bell },
  { name: 'Audio & Video', to: '/settings/audio-video', icon: Video },
  { name: 'Security', to: '/settings/security', icon: ShieldCheck },
];

const WORKSPACE_SETTINGS_ITEMS: NavItem[] = [
  { name: 'Organization', to: '/settings/organization', icon: Building2, adminOnly: true },
  { name: 'Billing & Plans', to: '/settings/billing', icon: CreditCard, adminOnly: true },
  { name: 'Members & Roles', to: '/settings/members', icon: Users, adminOnly: true },
  { name: 'Integrations', to: '/settings/integrations', icon: Key, adminOnly: true },
];

export default function SettingsNav() {
  const { canEditWorkspace } = useSettings();

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      <div className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider uppercase text-muted">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group
                ${isActive 
                  ? 'bg-surface-2 text-text font-semibold shadow-2xs border border-line' 
                  : 'text-muted hover:text-text hover:bg-surface-2/60 border border-transparent'}
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon 
                      size={15} 
                      className={`shrink-0 transition-colors ${
                        isActive ? 'text-accent' : 'text-muted group-hover:text-text'
                      }`} 
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {item.adminOnly && !canEditWorkspace && (
                    <span 
                      title="Admin-only setting (Read-only for members)" 
                      className="flex items-center text-[10px] font-mono text-muted/70 group-hover:text-muted"
                    >
                      <Lock size={11} />
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Vertical Secondary Rail */}
      <nav className="hidden md:flex flex-col gap-5 w-52 shrink-0 py-1 font-sans">
        {renderNavGroup('My Settings', MY_SETTINGS_ITEMS)}
        <div className="h-px bg-line my-1" />
        {renderNavGroup('Workspace Settings', WORKSPACE_SETTINGS_ITEMS)}
      </nav>

      {/* Mobile Horizontal Scrollable Tabs */}
      <nav className="flex md:hidden overflow-x-auto pb-2 -mx-4 px-4 border-b border-line gap-1.5 no-scrollbar shrink-0">
        {[...MY_SETTINGS_ITEMS, ...WORKSPACE_SETTINGS_ITEMS].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors
                ${isActive 
                  ? 'bg-accent text-white font-semibold shadow-xs' 
                  : 'bg-surface-2 text-muted hover:text-text border border-line'}
              `}
            >
              <Icon size={13} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
