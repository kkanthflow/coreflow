import { useNavigate } from 'react-router-dom';
import { Search, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import NotificationDropdown from './NotificationDropdown';

interface TopbarProps {
  onOpenCommandPalette?: () => void;
}

export default function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const navigate = useNavigate();
  const { signOut, fullName, user } = useAuth();
  const { orgName, loading } = useWorkspace();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <header className="h-11 shrink-0 bg-card-bg border-b border-divider px-4 sm:px-6 flex items-center justify-between z-30 font-sans select-none">
      {/* Workspace Identity & Operational Page State */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-5 w-24 bg-white/[0.04] rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] border border-divider text-[11px] font-semibold text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
              <span className="text-main font-bold">{orgName || 'Workspace'}</span>
              <span className="text-zinc-600 font-mono">/</span>
              <span className="text-muted font-mono text-[10px]">main</span>
            </div>
          </div>
        )}
      </div>

      {/* Center Raycast Command Search Trigger */}
      <div className="flex-1 max-w-sm mx-4 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1 bg-white/[0.025] hover:bg-white/[0.05] border border-divider hover:border-white/[0.1] rounded-md text-[11px] text-muted hover:text-zinc-200 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Search size={12} className="text-muted group-hover:text-muted" />
            <span className="tracking-tight">Execute command or jump to...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-muted bg-white/[0.03] border border-divider rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side Profile & Actions */}
      <div className="flex items-center gap-2.5">
        <button 
          onClick={onOpenCommandPalette}
          className="md:hidden p-1.5 text-muted hover:text-main rounded hover:bg-white/[0.04]"
          title="Command search"
        >
          <Search size={14} />
        </button>

        {/* Live Notification Dropdown */}
        <NotificationDropdown />

        <div className="h-3 w-px bg-white/[0.06]" />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-0.5">
          <div className="w-6 h-6 rounded-md bg-[#13151D] border border-divider flex items-center justify-center text-[10px] font-bold text-main">
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
