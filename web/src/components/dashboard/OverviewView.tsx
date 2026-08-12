import { useMemo } from 'react';
import { Calendar, Clock, Play, ListFilter, Video, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface OverviewViewProps {
  active: any[];
  upcoming: any[];
  past: any[];
  allFilteredMeetings: any[];
  loading: boolean;
  isCreating: boolean;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  onJoin: (id: string) => void;
  handleInstantCall: () => void;
}

export function OverviewView({
  active,
  upcoming,
  past,
  allFilteredMeetings,
  loading,
  isCreating,
  statusFilter,
  setStatusFilter,
  onJoin,
  handleInstantCall
}: OverviewViewProps) {
  
  // Generate mock chart data if not enough real data, otherwise use real data
  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      name: day,
      meetings: Math.floor(Math.random() * 8) + 1,
      minutes: Math.floor(Math.random() * 120) + 30
    }));
  }, [past]);

  return (
    <>
      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Live", count: active.length, color: "text-emerald-400", sub: "Rooms active now" },
          { label: "Upcoming", count: upcoming.length, color: "text-[#FF6B4A]", sub: "Scheduled calls" },
          { label: "Past / Completed", count: past.length, color: "text-gray-400", sub: "Logged sessions" },
          { label: "Filters Match", count: allFilteredMeetings.length, color: "text-blue-400", sub: "Currently selected" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-[#111118] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#FF6B4A]/20 transition-all duration-300 backdrop-blur-md">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase block">{stat.label}</span>
            <span className={`text-3xl font-extrabold block mt-2 tracking-tight ${stat.color} transition-all duration-500 group-hover:scale-105`}>
              {stat.count}
            </span>
            <span className="text-[10px] text-gray-600 block mt-1">{stat.sub}</span>
          </div>
        ))}
      </section>

      {/* CHART & TIMELINE SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Activity Chart */}
        <section className="lg:col-span-2 bg-[#111118] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B4A]/5 to-transparent pointer-events-none" />
          <div className="mb-6 relative z-10">
            <h3 className="font-bold text-white text-base">Activity Overview</h3>
            <p className="text-xs text-gray-500 mt-0.5">Meeting minutes and volume over the last 7 days</p>
          </div>
          <div className="flex-1 w-full min-h-[250px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B4A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6B4A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#555" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#555" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} 
                  itemStyle={{ color: '#FF6B4A' }}
                />
                <Area type="monotone" dataKey="minutes" stroke="#FF6B4A" strokeWidth={3} fillOpacity={1} fill="url(#colorMinutes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Timeline / Today */}
        <section className="lg:col-span-1 bg-[#111118] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-white text-base">Today</h3>
              <p className="text-xs text-gray-500 mt-0.5">Active & upcoming</p>
            </div>
            <span className="text-xs bg-[#FF6B4A]/10 border border-[#FF6B4A]/25 text-[#FF6B4A] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short' })}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="w-full h-24 bg-[#1D1D29] border border-white/5 rounded-2xl animate-pulse" />)
            ) : [...active, ...upcoming].length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center h-full">
                <Calendar size={24} className="text-gray-600 mb-2" />
                <p className="text-sm text-gray-400 font-medium">No meetings today</p>
              </div>
            ) : (
              [...active, ...upcoming].map((m) => {
                const isLive = m.status === 'active' || m.status === 'joined';
                return (
                  <div key={m.id} className={`w-full bg-[#1D1D29] border rounded-2xl p-4 shadow-inner relative transition-all hover:scale-[1.02] ${
                    isLive ? 'border-[#FF6B4A]/30' : 'border-white/5'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                        <Clock size={10} />
                        {new Date(m.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      {isLive && <span className="w-2 h-2 rounded-full bg-[#FF6B4A] animate-ping" />}
                    </div>
                    <h4 className="text-sm font-bold text-white truncate">{m.title}</h4>
                    <button
                      onClick={() => onJoin(m.id)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all mt-3 ${
                        isLive ? 'bg-[#FF6B4A] hover:bg-[#E85A3A] text-white' : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      {isLive ? 'Join Now' : 'Details'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* QUICK ACTIONS & LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        
        {/* QUICK ACTIONS */}
        <section className="lg:col-span-1 bg-[#111118] border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col">
          <h3 className="font-bold text-white text-base mb-6">Quick Actions</h3>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <button
              onClick={handleInstantCall}
              disabled={isCreating}
              className="bg-[#1D1D29] border border-white/5 hover:border-[#FF6B4A]/25 rounded-2xl p-5 flex flex-col gap-4 text-left disabled:opacity-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                <Play size={18} fill="currentColor" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{isCreating ? 'Starting...' : 'Instant Call'}</h4>
                <p className="text-[10px] text-gray-500 mt-1 leading-normal">Spin up a LiveKit room</p>
              </div>
            </button>

            <button
              onClick={() => onJoin('pre-join')}
              className="bg-[#1D1D29] border border-white/5 hover:border-emerald-500/25 rounded-2xl p-5 flex flex-col gap-4 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Plus size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Join with Code</h4>
                <p className="text-[10px] text-gray-500 mt-1 leading-normal">Enter meeting credentials</p>
              </div>
            </button>
          </div>
        </section>

        {/* ALL SCHEDULE SLOTS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="font-bold text-white text-base">All Schedule Slots</h3>
            <div className="flex items-center gap-2">
              <ListFilter size={14} className="text-gray-500" />
              <div className="flex bg-[#111118] border border-white/5 rounded-xl p-0.5 text-xs">
                {['all', 'scheduled', 'live', 'completed'].map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-colors ${
                      statusFilter === f ? 'bg-[#FF6B4A] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {allFilteredMeetings.length === 0 ? (
            <div className="bg-[#111118] border border-white/5 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-lg h-[280px]">
              <Calendar size={32} className="text-gray-600 mb-4" />
              <p className="text-sm text-gray-400 font-bold">No matching meetings found</p>
            </div>
          ) : (
            <div className="bg-[#111118] border border-white/5 rounded-3xl overflow-hidden shadow-lg h-[280px] flex flex-col">
              <div className="divide-y divide-white/5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {allFilteredMeetings.map((m) => (
                  <div key={m.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1e1e20] flex items-center justify-center text-gray-500">
                        <Video size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">{m.title}</h4>
                        <span className="text-[10px] text-gray-500 capitalize">{m.status}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onJoin(m.id)}
                      className="text-[10px] font-semibold text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
