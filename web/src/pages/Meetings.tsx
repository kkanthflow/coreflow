import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import {
  Video, Key, Play,
  Plus, RefreshCw, Sparkles, ChevronRight
} from 'lucide-react';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDurationMinutes(m: any) {
  if (m.duration_minutes) return m.duration_minutes;
  if (m.start_time && m.end_time) {
    const diff = Math.round((new Date(m.end_time).getTime() - new Date(m.start_time).getTime()) / 60000);
    return diff > 0 ? diff : 30;
  }
  return 30;
}

export default function Meetings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const canSchedule = hasPermission(role, 'schedule_meetings');

  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [meetingCode, setMeetingCode] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const fetchMeetings = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id, title, description, start_time, end_time, status,
          host:host_id (full_name, email),
          participants:meeting_participants(user_id)
        `)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (e) {
      console.error('Meetings fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const now = new Date();
  const upcomingMeetings = meetings.filter(m =>
    m.status === 'active' ||
    (m.status === 'scheduled' && new Date(m.start_time).getTime() + getDurationMinutes(m) * 60000 > now.getTime())
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastMeetings = meetings.filter(m =>
    m.status === 'completed' || m.status === 'cancelled' ||
    (m.status === 'scheduled' && new Date(m.start_time).getTime() + getDurationMinutes(m) * 60000 <= now.getTime())
  );

  const displayed = filter === 'upcoming' ? upcomingMeetings : pastMeetings;
  const nextMeeting = upcomingMeetings[0];

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingCode.trim()) return;
    const cleanId = meetingCode.trim().replace(/^https?:\/\/.*?\/meetings\//, '');
    navigate(`/meetings/${cleanId}`);
  };

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'ACTIVE / SCHEDULED', value: upcomingMeetings.length < 10 ? `0${upcomingMeetings.length}` : upcomingMeetings.length, isOrange: upcomingMeetings.length > 0 },
    { label: 'PAST ARCHIVE', value: pastMeetings.length < 10 ? `0${pastMeetings.length}` : pastMeetings.length },
    { label: 'SFU TOPOLOGY', value: 'LiveKit SFU' },
    { label: 'CODEC / FPS', value: 'VP8 / 30 FPS' },
    { label: 'SECURITY MESH', value: 'AES-256' },
    { label: 'AUDIO ROUTING', value: 'HD Voice' },
  ], [upcomingMeetings, pastMeetings]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Conferences & Video Rooms"
        description="Sub-second WebRTC video, 1080p screen share, and secure client waiting rooms."
        actions={
          <div className="flex items-center gap-2">
            <form onSubmit={handleJoinWithCode} className="flex items-center gap-1.5">
              <div className="relative">
                <Key size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Enter meeting room code..."
                  value={meetingCode}
                  onChange={e => setMeetingCode(e.target.value)}
                  className="w-48 pl-7 pr-3 py-1.5 bg-[#0C0D12] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded text-xs text-white placeholder-zinc-500 focus:outline-none font-mono transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!meetingCode.trim()}
                className="px-2.5 py-1.5 bg-[#12141F] hover:bg-[#181B28] disabled:opacity-40 text-white text-xs font-semibold rounded border border-white/[0.06] transition-colors"
              >
                Join
              </button>
            </form>

            <button
              onClick={fetchMeetings}
              className="p-2 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors"
              title="Sync schedule"
            >
              <RefreshCw size={13} />
            </button>

            {canSchedule && (
              <button
                onClick={() => navigate('/meetings/new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>Schedule Call</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Continuous Telemetry Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── 2-Column Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Chronological Meeting Stream (8 cols) */}
        <div className="xl:col-span-8 space-y-5">
          
          {/* Active / Next Prominent Meeting Banner */}
          {filter === 'upcoming' && nextMeeting && (
            <div className="bg-[#0C0D12] border border-[#FF6B4A]/30 rounded-lg p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-pulse" />
                  Next Scheduled Session
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {formatDate(nextMeeting.start_time)} · {formatTime(nextMeeting.start_time)}
                </span>
              </div>

              <h2 className="text-base font-bold text-white mb-1">{nextMeeting.title || 'Team Conference'}</h2>
              {nextMeeting.description && (
                <p className="text-xs text-zinc-400 mb-3 line-clamp-1">{nextMeeting.description}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] mt-2">
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                  <span>Duration: {getDurationMinutes(nextMeeting)} mins</span>
                  <span>Host: {nextMeeting.host?.full_name?.split(' ')[0] || 'Team'}</span>
                </div>

                <Link
                  to={`/meetings/${nextMeeting.id}`}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded transition-colors shadow-sm"
                >
                  <Play size={12} fill="currentColor" />
                  <span>Enter Room</span>
                </Link>
              </div>
            </div>
          )}

          {/* Schedule Navigation Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex bg-[#0C0D12] border border-white/[0.06] rounded p-0.5">
              <button
                onClick={() => setFilter('upcoming')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === 'upcoming' ? 'bg-[#151822] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Upcoming Sessions ({upcomingMeetings.length})
              </button>
              <button
                onClick={() => setFilter('past')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === 'past' ? 'bg-[#151822] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Past Conferences ({pastMeetings.length})
              </button>
            </div>
          </div>

          {/* Meeting List */}
          {loading ? (
            <SkeletonRow count={4} />
          ) : displayed.length === 0 ? (
            <EmptyState
              icon={Video}
              title={`No ${filter} conferences`}
              description="Schedule a team sync or client meeting to initialize WebRTC rooms."
              action={canSchedule && filter === 'upcoming' ? { label: "Schedule First Meeting", onClick: () => navigate('/meetings/new') } : undefined}
            />
          ) : (
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg divide-y divide-white/[0.03] overflow-hidden">
              {displayed.map(meeting => {
                const isLive = meeting.status === 'active';
                return (
                  <div
                    key={meeting.id}
                    className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${
                        isLive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#FF6B4A]/10 border-[#FF6B4A]/20 text-[#FF6B4A]'
                      }`}>
                        <Video size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                            {meeting.title}
                          </span>
                          {isLive && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                          <span>{formatDate(meeting.start_time)}</span>
                          <span>{formatTime(meeting.start_time)} ({getDurationMinutes(meeting)}m)</span>
                          {meeting.host && <span>Host: {meeting.host.full_name?.split(' ')[0]}</span>}
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/meetings/${meeting.id}`}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                        isLive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-[#151822] hover:bg-[#1C2030] text-zinc-200 border border-white/[0.06]'
                      }`}
                    >
                      <span>{isLive ? 'Join Live' : 'Open'}</span>
                      <ChevronRight size={12} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Infrastructure & Ad-hoc Room (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Sparkles size={13} className="text-[#FF6B4A]" />
              <span>LiveKit Protocol</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
              High performance selective forwarding unit (SFU) with dynamic bitrates, adaptive resolution switching, and end-to-end security.
            </p>

            <div className="pt-2 border-t border-white/[0.04] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-mono text-[10px]">SFU TOPOLOGY</span>
                <span className="text-white font-mono text-[11px]">LiveKit Cloud</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-mono text-[10px]">BITRATE MAX</span>
                <span className="text-white font-mono text-[11px]">1080p @ 30fps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-mono text-[10px]">GLOBAL LATENCY</span>
                <span className="text-emerald-400 font-mono text-[11px]">&lt; 140ms</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">Instant Session</span>
            <p className="text-xs text-zinc-500 mb-3">Launch an ad-hoc room immediately without calendar registration.</p>
            {canSchedule && (
              <button
                onClick={() => navigate('/meetings/new')}
                className="w-full py-2 bg-[#12141F] hover:bg-[#181B28] text-white text-xs font-semibold rounded border border-white/[0.06] transition-colors flex items-center justify-center gap-2"
              >
                <Video size={13} className="text-[#FF6B4A]" />
                <span>Launch Instant Room</span>
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
