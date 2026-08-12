import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const SidebarProfile = () => {
  const { session, role, fullName } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-3 border-t border-white/5 bg-[#1D1D29]/30 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF6B4A] to-[#FFA86B] flex items-center justify-center font-bold text-white shadow-inner">
          {(fullName || session?.user?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{fullName || session?.user?.email || 'Active User'}</p>
          <p className="text-[10px] text-gray-500 truncate capitalize">{role || 'Participant Role'}</p>
        </div>
      </div>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }}
        className="w-full py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 hover:text-red-300 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
      >
        <LogOut size={12} />
        <span>Sign Out</span>
      </button>
    </div>
  );
};
