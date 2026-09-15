import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PageHeader, MetricStrip, type MetricItem
} from '../components/ui/ObsidianPrimitives';

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId } = useWorkspace();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const fetchCalendarEvents = useCallback(async () => {
    if (!user) return;
    try {
      const { data: mData } = await supabase
        .from('meetings')
        .select('*')
        .neq('status', 'cancelled');
      setMeetings(mData || []);

      let tQuery = supabase.from('tasks').select('id, title, due_date, priority, status').not('due_date', 'is', null);
      if (orgId) tQuery = tQuery.eq('org_id', orgId);
      const { data: tData } = await tQuery;
      setTasks(tData || []);
    } catch (e) {
      console.error('Error fetching calendar events:', e);
    }
  }, [user, orgId]);

  useEffect(() => { fetchCalendarEvents(); }, [fetchCalendarEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'SCHEDULED CONFERENCES', value: meetings.length < 10 ? `0${meetings.length}` : meetings.length, isOrange: meetings.length > 0 },
    { label: 'DELIVERABLE DEADLINES', value: tasks.length < 10 ? `0${tasks.length}` : tasks.length },
    { label: 'VIEW CYCLE', value: `${monthNames[month]} ${year}` },
    { label: 'CALENDAR SYNC', value: 'Live' },
  ], [meetings, tasks, month, year]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Schedule & Operations Calendar"
        description="Unified delivery timeline of conferences, milestone deadlines, and team commitments."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-card-bg border border-divider rounded p-0.5">
              <button
                onClick={prevMonth}
                className="p-1 rounded hover:bg-white/[0.05] text-muted hover:text-main transition-colors"
                title="Previous month"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={today}
                className="px-2.5 py-0.5 text-xs font-mono font-medium text-muted hover:text-main"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1 rounded hover:bg-white/[0.05] text-muted hover:text-main transition-colors"
                title="Next month"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            <button
              onClick={fetchCalendarEvents}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync events"
            >
              <RefreshCw size={13} />
            </button>

            <button
              onClick={() => navigate('/meetings/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Schedule Call</span>
            </button>
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Calendar Grid Surface ── */}
      <div className="bg-card-bg border border-divider rounded-lg p-4 sm:p-5 flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-muted pb-2.5 border-b border-divider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days cells */}
        <div className="grid grid-cols-7 gap-1.5 pt-2.5 auto-rows-fr">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 rounded bg-[#07080B]/50 border border-transparent min-h-[90px]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            const dayMeetings = meetings.filter(m => m.start_time?.startsWith(dateStr));
            const dayTasks = tasks.filter(t => t.due_date === dateStr);

            return (
              <div
                key={`day-${dayNum}`}
                className={`p-2 rounded border transition-all flex flex-col justify-between min-h-[90px] ${
                  isToday
                    ? 'bg-[#FF6B4A]/5 border-[#FF6B4A]/40'
                    : 'bg-[#07080B] border-divider hover:border-divider'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-mono font-bold ${isToday ? 'text-[#FF6B4A]' : 'text-muted'}`}>
                    {dayNum < 10 ? `0${dayNum}` : dayNum}
                  </span>
                  {(dayMeetings.length > 0 || dayTasks.length > 0) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-16 pr-0.5">
                  {dayMeetings.map(m => (
                    <Link
                      key={m.id}
                      to={`/meetings/${m.id}`}
                      className="block text-[10px] font-mono font-medium bg-[#FF6B4A]/10 text-[#FF6B4A] hover:bg-[#FF6B4A]/20 border border-[#FF6B4A]/20 rounded px-1.5 py-0.5 truncate transition-colors"
                    >
                      🎥 {m.title}
                    </Link>
                  ))}
                  {dayTasks.map(t => (
                    <div
                      key={t.id}
                      className="text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5 truncate"
                    >
                      ✓ {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
