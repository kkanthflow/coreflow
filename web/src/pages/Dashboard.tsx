import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  Video, 
  CalendarDays, 
  FolderIcon, 
  Settings, 
  Search, 
  Bell, 
  LayoutDashboard
} from 'lucide-react';
import { SidebarProfile } from '../components/SidebarProfile';
import { CalendarView } from '../components/dashboard/CalendarView';
import { MeetingsView } from '../components/dashboard/MeetingsView';
import { RecordingsView } from '../components/dashboard/RecordingsView';
import { OverviewView } from '../components/dashboard/OverviewView';

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  const fetchMeetings = async () => {
    try {
      if (!session?.user?.id) return;
      setLoading(true);

      const { data: hosted, error: hostError } = await supabase
        .from('meetings')
        .select('id, title, description, status, start_time, end_time, duration, host_id')
        .eq('host_id', session.user.id);

      const { data: invitations, error: invError } = await supabase
        .from('meeting_invitations')
        .select('status, meetings:meeting_id (id, title, description, status, start_time, end_time, duration, host_id)')
        .eq('user_id', session.user.id);

      if (hostError || invError) throw hostError || invError;

      const allMeetings: any[] = [];
      if (hosted) allMeetings.push(...hosted);
      if (invitations) {
        invitations.forEach(inv => {
          if (inv.meetings && !Array.isArray(inv.meetings)) {
            allMeetings.push({ ...(inv.meetings as any), invitation_status: inv.status });
          } else if (Array.isArray(inv.meetings)) {
            inv.meetings.forEach((m: any) => allMeetings.push({ ...m, invitation_status: inv.status }));
          }
        });
      }

      const unique = Array.from(new Map(allMeetings.map(m => [m.id, m])).values());
      const now = new Date();
      
      const upcomingMeetings = unique.filter((m: any) => m.status === 'scheduled' && new Date(m.start_time) > now);
      const activeMeetings = unique.filter((m: any) => (m.status === 'active' || m.status === 'joined') || (m.status === 'scheduled' && new Date(m.start_time) <= now && new Date(m.end_time) > now));
      const pastMeetings = unique.filter((m: any) => m.status === 'completed' || m.status === 'cancelled' || (m.status === 'scheduled' && new Date(m.end_time) <= now));
      
      setUpcoming(upcomingMeetings);
      setActive(activeMeetings);
      setPast(pastMeetings);
    } catch (e: any) {
      console.error('Error fetching meetings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user?.id) {
      navigate('/login', { replace: true });
      return;
    }
    fetchMeetings();
    const channel = supabase.channel('dashboard_meetings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, fetchMeetings).subscribe();
    const invitationChannel = supabase.channel('dashboard_invitations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_invitations' }, fetchMeetings).subscribe();
    const interval = setInterval(fetchMeetings, 60000);
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(invitationChannel);
      clearInterval(interval);
    };
  }, [session, authLoading, navigate]);

  const allFilteredMeetings = useMemo(() => {
    const list = [...active, ...upcoming, ...past];
    return list.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = statusFilter === 'all' || 
                            (statusFilter === 'scheduled' && m.status === 'scheduled') ||
                            (statusFilter === 'completed' && m.status === 'completed');
      return matchesSearch && matchesFilter;
    });
  }, [active, upcoming, past, searchQuery, statusFilter]);

  const sidebarItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Meetings', icon: Video },
    { name: 'Calendar', icon: CalendarDays },
    { name: 'Recordings', icon: FolderIcon },
    { name: 'Settings', icon: Settings },
  ];

  const handleInstantCall = async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.from('meetings').insert([{
        title: 'Instant Meeting',
        description: 'Spontaneous secure session',
        status: 'active',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        host_id: session?.user?.id,
        duration: 60
      }]).select().single();
      if (error) throw error;
      navigate('/meetings/' + data.id);
    } catch (err) {
      console.error(err);
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#07070B] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Authenticating session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070B] text-white flex flex-col md:flex-row overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#111118] border-b md:border-b-0 md:border-r border-white/5 flex flex-col flex-shrink-0 z-30">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center">
            <Video size={20} className="text-[#FF6B4A]" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-tight">CoreFlow</h1>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1 block">Enterprise Workspace</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === 'Settings') navigate('/settings');
                  else setActiveTab(item.name);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative overflow-hidden group ${
                  isActive ? 'text-white bg-[#FF6B4A]/10 border border-[#FF6B4A]/25' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#FF6B4A] rounded-r-md" />}
                <Icon size={18} className={isActive ? 'text-[#FF6B4A]' : 'text-gray-400 group-hover:text-white transition-colors'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
        <SidebarProfile />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        <header className="sticky top-0 bg-[#07070B]/80 backdrop-blur-md border-b border-white/5 px-6 md:px-8 py-5 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight uppercase text-sm font-mono tracking-widest text-[#FF6B4A]">MEETINGS</h2>
            <p className="text-xs text-gray-400 mt-0.5">Secure, low-latency, end-to-end encrypted rooms</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Search meeting titles..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#111118] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors w-full sm:w-60"
              />
            </div>
            <button className="w-10 h-10 rounded-xl bg-[#111118] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="w-2 h-2 rounded-full bg-[#FF6B4A] absolute top-2 right-2 border border-[#07070B]" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6 space-y-4 max-w-7xl w-full mx-auto">
          {activeTab === 'Calendar' ? (
            <CalendarView meetings={allFilteredMeetings} onJoin={(id: string) => navigate('/meetings/' + id)} />
          ) : activeTab === 'Meetings' ? (
            <MeetingsView />
          ) : activeTab === 'Recordings' ? (
            <div className="flex-1 flex flex-col min-h-0 bg-[#0B0B0D] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl">
              <RecordingsView />
            </div>
          ) : (
            <OverviewView 
              active={active}
              upcoming={upcoming}
              past={past}
              allFilteredMeetings={allFilteredMeetings}
              loading={loading}
              isCreating={isCreating}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onJoin={(id) => navigate('/meetings/' + id)}
              handleInstantCall={handleInstantCall}
            />
          )}
        </div>
      </main>
    </div>
  );
}
