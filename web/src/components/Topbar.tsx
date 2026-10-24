import { useNavigate, useLocation } from 'react-router-dom';
import { Search, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { BRAND } from '../brand';
import NotificationDropdown from './NotificationDropdown';

interface TopbarProps {
  onOpenCommandPalette?: () => void;
}

export default function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, fullName, user } = useAuth();
  const { orgName, loading } = useWorkspace();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const currentWorkspace = orgName || BRAND.company;
  const path = location.pathname;

  // Breadcrumb segment resolution (no hard-coded "main")
  let pageLabel = 'Dashboard';
  if (path.startsWith('/settings')) {
    const sub = path.replace('/settings', '').replace(/^\//, '');
    const subLabels: Record<string, string> = {
      '': 'Settings',
      'appearance': 'Settings / Appearance',
      'profile': 'Settings / Profile',
      'notifications': 'Settings / Notifications',
      'audio-video': 'Settings / Audio & Video',
      'security': 'Settings / Security',
      'organization': 'Settings / Organization',
      'billing': 'Settings / Billing & Plans',
      'members': 'Settings / Members',
      'integrations': 'Settings / Integrations',
    };
    pageLabel = subLabels[sub] || (sub ? `Settings / ${sub}` : 'Settings');
  } else if (path.startsWith('/projects')) pageLabel = 'Projects';
  else if (path.startsWith('/tasks')) pageLabel = 'Tasks';
  else if (path.startsWith('/calendar')) pageLabel = 'Calendar';
  else if (path.startsWith('/workflows')) pageLabel = 'Workflows';
  else if (path.startsWith('/meetings')) pageLabel = 'Meetings';
  else if (path.startsWith('/chat')) pageLabel = 'Chat';
  else if (path.startsWith('/employees')) pageLabel = 'Employees';
  else if (path.startsWith('/departments')) pageLabel = 'Departments';
  else if (path.startsWith('/clients')) pageLabel = 'Clients';
  else if (path.startsWith('/invoices')) pageLabel = 'Invoices';
  else if (path.startsWith('/payments')) pageLabel = 'Payments';
  else if (path.startsWith('/analytics')) pageLabel = 'Telemetry';
  else if (path.startsWith('/audit-logs')) pageLabel = 'Audit Logs';
  else if (path.startsWith('/pricing')) pageLabel = 'Plans & Pricing';

  return (
    <header className="h-11 shrink-0 bg-surface border-b border-line px-4 sm:px-6 flex items-center justify-between z-30 font-sans select-none">
      {/* Workspace Identity & Operational Breadcrumb */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-5 w-28 bg-surface-2 rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-2 border border-line text-[11px] font-semibold text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-text font-bold max-w-[160px] truncate" title={currentWorkspace}>{currentWorkspace}</span>
              <span className="text-muted font-mono">/</span>
              <span className="text-muted font-mono text-[10px] truncate max-w-[200px]">{pageLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Center Raycast Command Search Trigger */}
      <div className="flex-1 max-w-sm mx-4 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1 bg-surface-2 hover:bg-surface-2/80 border border-line hover:border-line/80 rounded-md text-[11px] text-muted hover:text-text transition-all group"
        >
          <div className="flex items-center gap-2">
            <Search size={12} className="text-muted group-hover:text-text" />
            <span className="tracking-tight">Execute command or jump to...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-muted bg-surface border border-line rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side Profile & Actions */}
      <div className="flex items-center gap-2.5">
        <button 
          onClick={onOpenCommandPalette}
          className="md:hidden p-1.5 text-muted hover:text-text rounded hover:bg-surface-2"
          title="Command search"
        >
          <Search size={14} />
        </button>

        {/* Live Notification Dropdown */}
        <NotificationDropdown />

        <div className="h-3 w-px bg-line" />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-0.5">
          <div className="w-6 h-6 rounded-md bg-surface-2 border border-line flex items-center justify-center text-[10px] font-bold text-text">
            {(fullName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="text-left hidden lg:block">
            <span className="text-[11px] font-semibold text-muted block leading-tight">{fullName || user?.email?.split('@')[0] || 'User'}</span>
          </div>

          <button 
            onClick={handleSignOut}
            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}
