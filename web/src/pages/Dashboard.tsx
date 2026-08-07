import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface Meeting {
  id: string;
  title: string;
  description: string;
  status: string;
  start_time: string;
  end_time: string;
  duration: number;
}

export default function Dashboard() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [active, setActive] = useState<Meeting[]>([]);
  const [past, setPast] = useState<Meeting[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session?.user?.id) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchMeetings = async () => {
      // Fetch meetings the user is invited to or hosting
      // Using an OR condition for host_id or being in meeting_invitations
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id, title, description, status, start_time, end_time, duration, host_id,
          meeting_invitations!left(user_id, status)
        `)
        .or(`host_id.eq.${session.user.id},meeting_invitations.user_id.eq.${session.user.id}`);

      if (error) {
        console.error('Error fetching meetings:', error);
        return;
      }

      if (data) {
        // Filter unique meetings because the join might duplicate if host is also invited
        const unique = Array.from(new Map(data.map(m => [m.id, m])).values());
        setUpcoming(unique.filter((m: any) => m.status === 'scheduled'));
        setActive(unique.filter((m: any) => m.status === 'active'));
        setPast(unique.filter((m: any) => m.status === 'completed' || m.status === 'cancelled'));
      }
    };

    fetchMeetings();

    // Subscribe to real-time changes on meetings
    const channel = supabase
      .channel('dashboard_meetings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        () => {
          fetchMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loading, navigate]);

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-12">
        <h1 className="text-3xl font-bold text-white tracking-tight">Meeting Dashboard</h1>

        <section>
          <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            Active Meetings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.length === 0 ? (
              <p className="text-gray-500 text-sm">No active meetings.</p>
            ) : (
              active.map((m) => (
                <div key={m.id} className="bg-[#18181b] border border-white/10 rounded-xl p-5 shadow-lg flex flex-col gap-3">
                  <h3 className="text-white font-bold">{m.title}</h3>
                  <p className="text-gray-400 text-sm flex-1">{m.description || 'No description'}</p>
                  <button 
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Join Now
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Upcoming Meetings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming meetings.</p>
            ) : (
              upcoming.map((m) => (
                <div key={m.id} className="bg-[#18181b] border border-white/10 rounded-xl p-5 flex flex-col gap-3 opacity-90 hover:opacity-100 transition-opacity">
                  <h3 className="text-white font-bold">{m.title}</h3>
                  <p className="text-gray-400 text-sm flex-1">{new Date(m.start_time).toLocaleString()}</p>
                  <button 
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    className="mt-2 w-full py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-white font-semibold rounded-lg transition-colors border border-white/5"
                  >
                    View Details
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-500 mb-4">Past Meetings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.length === 0 ? (
              <p className="text-gray-500 text-sm">No past meetings.</p>
            ) : (
              past.map((m) => (
                <div key={m.id} className="bg-[#121214] border border-white/5 rounded-xl p-5 flex flex-col gap-2">
                  <h3 className="text-gray-300 font-bold">{m.title}</h3>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{new Date(m.start_time).toLocaleDateString()}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                      {m.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
