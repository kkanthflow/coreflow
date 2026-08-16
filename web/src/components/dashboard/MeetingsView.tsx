import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Calendar, Clock, Users, Check, Search, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserParticipant {
  id: string;
  email: string;
  full_name?: string;
  role: string | null;
}

export function MeetingsView() {
  const { session } = useAuth();
  const navigate = useNavigate();
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [duration, setDuration] = useState('30');
  
  // Attendees State
  const [users, setUsers] = useState<UserParticipant[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch users for the attendee selector
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // 1. Get current user's org_id
        const { data: userOrgs } = await supabase
          .from('user_organizations')
          .select('org_id')
          .eq('user_id', session?.user?.id)
          .limit(1);

        const orgId = userOrgs?.[0]?.org_id;

        if (!orgId) {
          // If the user has no organization, do not fetch the entire database!
          setUsers([]);
          setFetchingUsers(false);
          return;
        }

        // 2. Get all user_ids in this org
        const { data: orgUsersData } = await supabase
          .from('user_organizations')
          .select('user_id, role')
          .eq('org_id', orgId)
          .limit(100);

        const userIds = orgUsersData?.map(u => u.user_id) || [];

        if (userIds.length === 0) {
          setUsers([]);
          setFetchingUsers(false);
          return;
        }

        // 3. Fetch the actual user details for those IDs
        const { data, error } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', userIds);

        if (error) throw error;
        
        // Filter out the current user and attach their specific org role
        const otherUsers = (data || [])
          .filter(u => u.id !== session?.user?.id)
          .map(u => ({
             ...u,
             role: orgUsersData?.find(ou => ou.user_id === u.id)?.role || null
          }));
          
        setUsers(otherUsers as UserParticipant[]);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setFetchingUsers(false);
      }
    };

    if (session?.user?.id) {
      fetchUsers();
    }
  }, [session?.user?.id]);

  const toggleUser = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) {
      setError('Please fill out all required fields (Title, Date, Time).');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Create Meeting via API
      const startDateObj = new Date(`${date}T${time}`);
      const endDateObj = new Date(startDateObj.getTime() + parseInt(duration, 10) * 60000);
      
      const startDateTime = startDateObj.toISOString();
      const endDateTime = endDateObj.toISOString();
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
      
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          'x-workspace-id': 'independent'
        },
        body: JSON.stringify({
          title,
          description,
          startTime: startDateTime,
          endTime: endDateTime
        })
      });

      if (!res.ok) throw new Error('Failed to create meeting via API');
      const data = await res.json();
      const meetingId = data.meeting.id;

      // 2. Insert RSVPs for selected attendees
      if (selectedUsers.size > 0) {
        const invitations = Array.from(selectedUsers).map(userId => ({
          meeting_id: meetingId,
          user_id: userId,
          invited_by: session?.user?.id,
          status: 'pending'
        }));

        const { error: inviteError } = await supabase
          .from('meeting_invitations')
          .insert(invitations);

        if (inviteError) {
          console.error('Failed to send RSVPs:', inviteError);
          // We don't block success on RSVP failure, just warn
        }
      }

      setSuccess('Meeting scheduled successfully! RSVPs have been sent.');
      
      // Reset form
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setSelectedUsers(new Set());
      
      // Redirect after brief delay
      setTimeout(() => navigate('/dashboard'), 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while scheduling the meeting.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left Column: Meeting Details Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 lg:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Calendar className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Schedule Meeting</h2>
              <p className="text-sm text-gray-400 mt-1">Configure your secure enterprise meeting</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
              <Check size={16} />
              {success}
            </div>
          )}

          <form id="schedule-form" onSubmit={handleSchedule} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Meeting Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Q3 Roadmap Planning"
                className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief agenda or context for attendees..."
                rows={3}
                className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Time *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Duration</label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="90">1.5 Hours</option>
                <option value="120">2 Hours</option>
              </select>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: Attendee Selector */}
      <div className="space-y-6">
        <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 lg:p-8 shadow-xl flex flex-col h-full min-h-[500px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Users className="text-purple-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Invite Attendees</h3>
              <p className="text-xs text-gray-400 mt-1">{selectedUsers.size} selected for RSVP</p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0B0B0D] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {fetchingUsers ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                Loading workspace users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-sm text-gray-400">No users found.</p>
              </div>
            ) : (
              filteredUsers.map(u => {
                const nameToDisplay = u.full_name || u.email;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      selectedUsers.has(u.id)
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-white/5 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {nameToDisplay.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${selectedUsers.has(u.id) ? 'text-purple-400' : 'text-white'}`}>
                          {nameToDisplay}
                        </p>
                        {u.role && <p className="text-[10px] text-gray-500 capitalize">{u.role}</p>}
                      </div>
                    </div>
                    {selectedUsers.has(u.id) ? (
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-6 border-t border-white/5 mt-auto">
            <button
              form="schedule-form"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#2c2c2e] disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl px-4 py-4 transition-all shadow-lg"
            >
              {loading ? (
                <span>Scheduling...</span>
              ) : (
                <>
                  <Video size={18} />
                  <span>Schedule & Send RSVPs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
