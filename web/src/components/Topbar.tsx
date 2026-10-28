import { useNavigate, useLocation } from 'react-router-dom';
import { Search, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { BRAND } from '../brand';
import NotificationDropdown from './NotificationDropdown';
import ThemeToggle from './ThemeToggle';
import AuvrynFoxMascot from './motion/AuvrynFoxMascot';
import { openFoxTour } from './onboarding/FoxProductTour';

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

  // Breadcrumb segment resolution
  let pageLabel = 'Dashboard';
  if (path.startsWith('/settings')) {
    pageLabel = 'Settings';
  } else if (path.startsWith('/projects')) pageLabel = 'Projects';
  else if (path.startsWith('/tasks')) pageLabel = 'Tasks';
  else if (path.startsWith('/calendar')) pageLabel = 'Calendar';
  else if (path.startsWith('/workflows')) pageLabel = 'Workflows';
  else if (path.startsWith('/meetings')) pageLabel = 'Meetings';
  else if (path.startsWith('/chat')) pageLabel = 'Chat';
  else if (path.startsWith('/employees')) pageLabel = 'Employees';
  else if (path.startsWith('/departments')) pageLabel = 'Departments';
  else if (path.startsWith('/roles-permissions') || path.startsWith('/roles') || path.startsWith('/rbac')) pageLabel = 'Roles & RBAC';
  else if (path.startsWith('/clients')) pageLabel = 'Clients';
  else if (path.startsWith('/invoices')) pageLabel = 'Invoices';
  else if (path.startsWith('/payments')) pageLabel = 'Settlements';
  else if (path.startsWith('/analytics')) pageLabel = 'Telemetry';
  else if (path.startsWith('/audit-logs')) pageLabel = 'Audit Logs';
  else if (path.startsWith('/pricing')) pageLabel = 'Plans & Pricing';

  return (
    <header className="h-12 shrink-0 bg-surface/95 backdrop-blur-md border-b border-line px-4 sm:px-6 flex items-center justify-between z-30 font-sans select-none transition-colors duration-200">
      {/* Workspace Identity & Operational Breadcrumb */}
      <div className="flex items-center gap-3 animate-fade-in">
        {loading ? (
          <div className="h-6 w-32 bg-surface-2 rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-2/80 hover:bg-surface-2 border border-line text-xs font-medium text-muted transition-colors">
              <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent-soft)]" />
              <span className="text-text font-bold max-w-[170px] truncate" title={currentWorkspace}>
                {currentWorkspace}
              </span>
              <span className="text-muted/60 font-mono">/</span>
              <span className="text-muted font-mono text-[11px] truncate max-w-[180px] font-medium">
                {pageLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Center Raycast Command Search Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden md:block animate-fade-up stagger-1">
        <button
          data-tour="search-trigger"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-1.5 bg-surface-2/70 hover:bg-surface-2 border border-line hover:border-line/80 rounded-lg text-xs text-muted hover:text-text transition-all duration-150 group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <Search size={13} className="text-muted group-hover:text-accent transition-colors" />
            <span className="tracking-tight font-medium">Execute command or jump to...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted bg-surface border border-line rounded font-semibold shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side Profile & Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 animate-fade-in stagger-2">
        <button 
          onClick={onOpenCommandPalette}
          className="md:hidden p-1.5 text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors"
          title="Command search"
        >
          <Search size={15} />
        </button>

        {/* Global Working Theme Toggle (Light / Dark) */}
        <ThemeToggle size="sm" />

        {/* Live Notification Dropdown */}
        <NotificationDropdown />

        {/* Fox Guide Onboarding Tour Trigger */}
        <button
          type="button"
          onClick={openFoxTour}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#FF5A36]/10 hover:bg-[#FF5A36]/20 border border-[#FF5A36]/25 text-xs font-semibold text-[#FF5A36] hover:text-[#E84E2C] transition-all cursor-pointer group"
          title="Reopen Fox Product Tour"
          aria-label="Reopen Fox Product Tour"
        >
          <AuvrynFoxMascot variant="compact" className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="hidden xl:inline text-[11px] tracking-tight">Fox Guide</span>
        </button>

        <div className="h-4 w-px bg-line mx-0.5" />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-0.5">
          <div className="w-7 h-7 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-xs font-bold text-text shadow-2xs">
            {(fullName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="text-left hidden lg:block max-w-[140px]">
            <span className="text-xs font-semibold text-text block leading-tight truncate">
              {fullName || user?.email?.split('@')[0] || 'User'}
            </span>
          </div>

          <button 
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
