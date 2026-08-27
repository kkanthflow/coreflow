import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Save, Play, AlertCircle, Crown } from 'lucide-react';
import { PageHeader } from '../components/ui/ObsidianPrimitives';

export default function NewMeeting() {
  const navigate = useNavigate();
  const { user, fullName } = useAuth();
  const { orgId } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('30');
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedInvited, setSelectedInvited] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hostDisplayName = fullName || (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'You';

  useEffect(() => {
    async function loadMembers() {
      if (!orgId) return;
      const { data } = await supabase
        .from('user_organizations')
        .select('users:user_id(id, full_name, email)')
        .eq('org_id', orgId);
      if (data) {
        setMembers(data.map((d: any) => d.users).filter(Boolean));
      }
    }
    loadMembers();
  }, [orgId]);

  const toggleInvite = (userId: string) => {
    setSelectedInvited(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (isInstant = false) => {
    if (!user) {
      setErrorMsg('You must be signed in to initialize a meeting.');
      return;
    }
    
    setSaving(true);
    setErrorMsg(null);

    try {
      const startTime = isInstant
        ? new Date().toISOString()
        : new Date(`${date}T${time}:00`).toISOString();

      const durationMins = parseInt(duration, 10) || 30;
      const endTime = new Date(new Date(startTime).getTime() + durationMins * 60000).toISOString();
      const roomName = `cf-meeting-${Math.random().toString(36).substring(2, 10)}`;

      // Resolve real workspace_id if available
      let realWorkspaceId: string | null = null;
      if (orgId && orgId !== 'independent') {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', orgId)
          .maybeSingle();
        if (wsData?.id) {
          realWorkspaceId = wsData.id;
        }
      }

      if (!realWorkspaceId) {
        const { data: userWorkspaces } = await supabase
          .from('workspaces')
          .select('id')
          .limit(1);
        if (userWorkspaces && userWorkspaces.length > 0) {
          realWorkspaceId = userWorkspaces[0].id;
        }
      }

      const meetingPayload: any = {
        title: isInstant ? (title.trim() || 'Instant Conference') : (title.trim() || 'Team Conference'),
        description: description.trim() || null,
        host_id: user.id,
        start_time: startTime,
        end_time: endTime,
        room_name: roomName,
        status: isInstant ? 'active' : 'scheduled',
      };

      if (realWorkspaceId) {
        meetingPayload.workspace_id = realWorkspaceId;
      }

      const { data: meeting, error: mErr } = await supabase
        .from('meetings')
        .insert(meetingPayload)
        .select()
        .single();

      if (mErr) {
        console.error('Supabase meetings insert error:', mErr);
        throw new Error(mErr.message || 'Failed to create meeting.');
      }

      // Add Host and invited attendees to meeting_participants
      try {
        const participants = [
          {
            meeting_id: meeting.id,
            user_id: user.id,
            role: 'host',
            status: 'accepted',
            admission_status: 'admitted',
          },
          ...selectedInvited.filter(uid => uid !== user.id).map(uid => ({
            meeting_id: meeting.id,
            user_id: uid,
            role: 'participant',
            status: 'invited',
            admission_status: 'waiting',
          }))
        ];
        await supabase.from('meeting_participants').insert(participants);
      } catch (pErr) {
        console.warn('Non-fatal: could not insert meeting_participants:', pErr);
      }

      // Also add to meeting_invitations for backwards compatibility
      if (selectedInvited.length > 0) {
        try {
          const invites = selectedInvited.map(uid => ({
            meeting_id: meeting.id,
            user_id: uid,
            status: uid === user.id ? 'accepted' : 'pending',
          }));
          await supabase.from('meeting_invitations').insert(invites);
        } catch (iErr) {
          console.warn('Non-fatal: could not insert meeting_invitations:', iErr);
        }
      }

      navigate(`/meetings/${meeting.id}`);
    } catch (e: any) {
      console.error('Failed to create meeting:', e);
      setErrorMsg(e.message || 'Failed to schedule conference.');
    } finally {
      setSaving(false);
    }
  };

  const otherMembers = members.filter(m => m.id !== user?.id);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      <PageHeader
        title="Schedule Video Session"
        breadcrumbs={[
          { label: 'Meetings', href: '/meetings' },
          { label: 'New Session' }
        ]}
        description="Configure WebRTC video parameters, attendees, and scheduling."
        actions={
          <button
            onClick={() => navigate('/meetings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Cancel</span>
          </button>
        }
      />

      {errorMsg && (
        <div className="max-w-2xl bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="max-w-2xl bg-[#0C0D12] border border-white/[0.06] rounded-lg p-5 sm:p-6 space-y-5">
        
        {/* Instant Launch Action Strip */}
        <div className="p-4 rounded bg-[#08090C] border border-[#FF6B4A]/25 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Instant Session</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Start an instant conference right now without advance scheduling.</p>
          </div>
          <button
            onClick={() => handleCreate(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold text-xs rounded transition-colors shadow-sm shrink-0 disabled:opacity-50"
          >
            <Play size={12} fill="currentColor" />
            <span>{saving ? 'Starting...' : 'Start Now'}</span>
          </button>
        </div>

        {/* Schedule Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(false); }} className="space-y-4 pt-2">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Meeting Title <span className="text-[#FF6B4A]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint Architecture & Delivery Review"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Agenda & Scope
            </label>
            <textarea
              rows={2}
              placeholder="Topics, agenda items, reference links..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.06] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.06] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="15">15 mins</option>
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">60 mins</option>
                <option value="90">90 mins</option>
              </select>
            </div>
          </div>

          {/* Attendees & Host Section */}
          <div className="pt-3 border-t border-white/[0.04] space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              Meeting Attendees & Roles
            </span>

            {/* Logged in User as Host */}
            <div>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                Organizer & Host
              </span>
              <div className="p-2.5 rounded bg-[#07080B] border border-[#FF6B4A]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold text-xs flex items-center justify-center shrink-0">
                    {hostDisplayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-white block truncate">
                      {hostDisplayName} <span className="text-zinc-500 text-[11px] font-normal">(You)</span>
                    </span>
                    {user?.email && (
                      <span className="text-[10px] font-mono text-zinc-500 block truncate">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FF6B4A]/15 border border-[#FF6B4A]/30 text-[#FF6B4A] text-[10px] font-mono font-bold uppercase shrink-0">
                  <Crown size={11} />
                  <span>Host</span>
                </div>
              </div>
            </div>

            {/* Invite Colleagues */}
            {otherMembers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                    Invite Team Members
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {selectedInvited.length} invited
                  </span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {otherMembers.map(m => {
                    const isSelected = selectedInvited.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleInvite(m.id)}
                        className={`p-2 rounded border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]/30 text-white font-semibold'
                            : 'bg-[#07080B] border-white/[0.04] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{m.full_name || m.email}</span>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                          {isSelected ? '✓ Invited' : '+ Add'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.04]">
            <button
              type="button"
              onClick={() => navigate('/meetings')}
              className="px-3.5 py-1.5 bg-[#10121A] hover:bg-[#151822] text-zinc-300 text-xs rounded border border-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors shadow-sm"
            >
              <Save size={13} />
              <span>{saving ? 'Scheduling...' : 'Schedule Conference'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
