import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { decryptKeyWithSender, decryptMessagePayload } from '../lib/crypto';
import {
  Search,
  Plus,
  Hash,
  X,
  Shield,
  MessageSquare,
  Lock,
  Users,
  CheckCheck,
  ChevronRight
} from 'lucide-react';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [composeSearch, setComposeSearch] = useState('');
  const [creatingDm, setCreatingDm] = useState(false);

  const fetchChannels = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Fetch blocked users
      const { data: blockedList } = await supabase
        .from('user_blocks').select('blocked_id').eq('blocker_id', user.id);
      const blockedIds = (blockedList || []).map((b: any) => b.blocked_id);

      // Fetch muted channels
      const { data: mutedList } = await supabase
        .from('channel_mutes').select('channel_id').eq('user_id', user.id);
      const mutedChannelIds = (mutedList || []).map((m: any) => m.channel_id);

      // Fetch channels with members
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          channel_members(
            user_id,
            last_read_at,
            user:user_id(id, full_name, avatar_url, role)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance with last message + unread count
      const channelsWithStats = await Promise.all(
        (data || []).map(async (ch: any) => {
          const { data: lastMsgData } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('channel_id', ch.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = lastMsgData?.[0];
          let lastMsgText = lastMsg?.content || ch.description || 'No messages yet';

          if (lastMsgText.startsWith('__E2EE__:')) {
            const { data: myKeyData } = await supabase
              .from('channel_keys')
              .select('encrypted_key')
              .eq('channel_id', ch.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (myKeyData) {
              const candidateUserIds = [
                ch.created_by,
                ch.channel_members?.find((m: any) => m.user_id !== user.id)?.user_id,
                user.id,
              ].filter(Boolean);

              for (const senderId of candidateUserIds) {
                try {
                  const { data: senderKeyData } = await supabase
                    .from('user_public_keys')
                    .select('public_key')
                    .eq('user_id', senderId)
                    .maybeSingle();

                  if (senderKeyData?.public_key) {
                    const symmetricKey = await decryptKeyWithSender(myKeyData.encrypted_key, senderKeyData.public_key);
                    const ciphertext = lastMsgText.substring('__E2EE__:'.length);
                    const decrypted = await decryptMessagePayload(ciphertext, symmetricKey);
                    if (decrypted?.text) {
                      lastMsgText = decrypted.text;
                      break;
                    }
                  }
                } catch {
                  // Try next candidate
                }
              }
            }
            if (lastMsgText.startsWith('__E2EE__:')) {
              lastMsgText = '🔒 Encrypted message';
            }
          }

          const myMembership = ch.channel_members?.find((m: any) => m.user_id === user.id);
          const lastReadAt = myMembership?.last_read_at || ch.created_at;

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .gt('created_at', lastReadAt)
            .neq('sender_id', user.id);

          let displayName = ch.name;
          let otherUser = null;
          let isBlocked = false;

          if (ch.type === 'direct') {
            otherUser = ch.channel_members?.find((m: any) => m.user_id !== user.id)?.user;
            if (otherUser) {
              displayName = otherUser.full_name;
              isBlocked = blockedIds.includes(otherUser.id);
            }
          }

          return {
            ...ch,
            name: displayName,
            otherUser,
            unreadCount: count || 0,
            lastMessageText: lastMsgText,
            lastMessageTime: lastMsg?.created_at || ch.created_at,
            lastSenderId: lastMsg?.sender_id,
            isBlocked,
            isMuted: mutedChannelIds.includes(ch.id),
          };
        })
      );

      const activeChannels = channelsWithStats
        .filter((ch: any) => !ch.isBlocked)
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      setChannels(activeChannels);
    } catch (e) {
      console.error('Chat channels error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Fetch employees for Compose Modal
  useEffect(() => {
    if (!isComposeOpen || !user) return;
    const fetchEmps = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, role')
        .neq('id', user.id)
        .limit(30);
      if (data) setEmployees(data);
    };
    fetchEmps();
  }, [isComposeOpen, user]);

  const handleStartDirectChat = async (targetUser: any) => {
    if (!user || creatingDm) return;
    setCreatingDm(true);
    try {
      // Check existing DM
      const existing = channels.find(ch => 
        ch.type === 'direct' && ch.channel_members?.some((m: any) => m.user_id === targetUser.id)
      );
      if (existing) {
        setIsComposeOpen(false);
        navigate(`/chat/${existing.id}`);
        return;
      }

      // Create new DM channel
      const { data: newCh, error: chErr } = await supabase
        .from('chat_channels')
        .insert({
          type: 'direct',
          name: `${user.email}_${targetUser.email}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (chErr) throw chErr;

      // Add members
      await supabase.from('channel_members').insert([
        { channel_id: newCh.id, user_id: user.id },
        { channel_id: newCh.id, user_id: targetUser.id },
      ]);

      setIsComposeOpen(false);
      navigate(`/chat/${newCh.id}`);
    } catch (err) {
      console.error('Error starting DM:', err);
    } finally {
      setCreatingDm(false);
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const id = Math.random().toString(36).slice(7);
    const sub = supabase
      .channel(`chat:list:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, fetchChannels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels' }, fetchChannels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_members' }, fetchChannels)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, fetchChannels]);

  const filtered = channels.filter(ch =>
    !search || ch.name?.toLowerCase().includes(search.toLowerCase())
  );

  const directMessages = filtered.filter(ch => ch.type === 'direct');
  const groupChannels = filtered.filter(ch => ch.type !== 'direct');

  const filteredEmployees = employees.filter(emp =>
    !composeSearch ||
    emp.full_name?.toLowerCase().includes(composeSearch.toLowerCase()) ||
    emp.email?.toLowerCase().includes(composeSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-1 -m-4 sm:-m-6 lg:-m-7 bg-[#08090C] text-zinc-300 select-none overflow-hidden">
      
      {/* ── Panel 1: Conversation Navigator (280px - 320px) ── */}
      <div className="w-80 border-r border-white/[0.05] bg-[#0A0B10] flex flex-col h-full shrink-0">
        
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Chat</h1>
            <span className="text-[10px] font-mono text-zinc-500">· {channels.length}</span>
          </div>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#13151D] hover:bg-[#181B26] border border-white/[0.06] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors"
            title="Compose new conversation"
          >
            <Plus size={12} className="text-[#FF6B4A]" />
            <span>Compose</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/[0.05]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080A] border border-white/[0.05] focus:border-[#FF6B4A]/40 rounded-md text-[11px] text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.02] rounded-md animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Direct Messages Section */}
              {directMessages.length > 0 && (
                <div>
                  <div className="px-4 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-600">
                    Direct Messages
                  </div>
                  <div className="space-y-0.5 mt-1 px-1.5">
                    {directMessages.map(ch => {
                      const hasUnread = ch.unreadCount > 0;
                      const isMeSender = ch.lastSenderId === user?.id;

                      return (
                        <Link
                          key={ch.id}
                          to={`/chat/${ch.id}`}
                          className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.03] transition-colors group"
                        >
                          {/* Avatar with subtle presence dot */}
                          <div className="relative shrink-0">
                            <div className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white">
                              {(ch.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0A0B10]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between mb-0.5">
                              <span className={`text-[12px] font-medium truncate ${hasUnread ? 'text-white font-semibold' : 'text-zinc-300'}`}>
                                {ch.name}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-600 shrink-0 ml-1">
                                {timeAgo(ch.lastMessageTime)}
                              </span>
                            </div>
                            <div className={`text-[11px] truncate flex items-center gap-1 ${hasUnread ? 'text-zinc-200 font-medium' : 'text-zinc-500'}`}>
                              {isMeSender && <CheckCheck size={11} className="text-zinc-600 shrink-0" />}
                              <span className="truncate">{ch.lastMessageText}</span>
                            </div>
                          </div>

                          {/* Unread Accent Badge */}
                          {hasUnread && (
                            <span className="shrink-0 min-w-[16px] h-4 px-1 rounded bg-[#FF6B4A] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                              {ch.unreadCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Channels Section */}
              {groupChannels.length > 0 && (
                <div>
                  <div className="px-4 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-600">
                    Channels
                  </div>
                  <div className="space-y-0.5 mt-1 px-1.5">
                    {groupChannels.map(ch => {
                      const hasUnread = ch.unreadCount > 0;

                      return (
                        <Link
                          key={ch.id}
                          to={`/chat/${ch.id}`}
                          className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.03] transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-zinc-400 shrink-0">
                            <Hash size={13} className="text-[#FF6B4A]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between mb-0.5">
                              <span className={`text-[12px] font-medium truncate ${hasUnread ? 'text-white font-semibold' : 'text-zinc-300'}`}>
                                #{ch.name}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-600 shrink-0 ml-1">
                                {timeAgo(ch.lastMessageTime)}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">
                              {ch.lastMessageText}
                            </div>
                          </div>

                          {hasUnread && (
                            <span className="shrink-0 min-w-[16px] h-4 px-1 rounded bg-[#FF6B4A] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                              {ch.unreadCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Security / Encryption Status Footer */}
        <div className="p-3 border-t border-white/[0.05] bg-[#07080A] flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Lock size={11} className="text-emerald-400" />
            <span>P-256 ECDH Encrypted</span>
          </span>
          <span className="text-zinc-600">AES-GCM</span>
        </div>

      </div>

      {/* ── Panel 2: Active Conversation Placeholder / Operational Command Zero-State ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#07080B] relative">
        <div className="max-w-md space-y-4">
          <div className="w-12 h-12 rounded-lg bg-[#11131B] border border-white/[0.08] flex items-center justify-center mx-auto text-[#FF6B4A] shadow-sm">
            <Shield size={22} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">AUVRYN Secure Messaging</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Select an active conversation or initialize a new direct encrypted thread with team members.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus size={13} />
              <span>New Conversation</span>
            </button>
          </div>

          <div className="pt-8 border-t border-white/[0.05] grid grid-cols-2 gap-4 text-left text-[11px]">
            <div className="p-3 rounded bg-[#0A0B10] border border-white/[0.04]">
              <div className="font-mono text-zinc-400 font-bold mb-1 flex items-center gap-1">
                <Lock size={11} className="text-[#FF6B4A]" /> Zero Knowledge
              </div>
              <div className="text-zinc-600 text-[10px]">Client-side end-to-end encryption. The host server never holds message plaintext.</div>
            </div>
            <div className="p-3 rounded bg-[#0A0B10] border border-white/[0.04]">
              <div className="font-mono text-zinc-400 font-bold mb-1 flex items-center gap-1">
                <Users size={11} className="text-emerald-400" /> Work OS Linked
              </div>
              <div className="text-zinc-600 text-[10px]">Directly connect message context to deliverables, invoices, and meetings.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Compose / New Conversation Modal Overlay ── */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C0D12] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-[#FF6B4A]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">New Direct Message</span>
              </div>
              <button onClick={() => setIsComposeOpen(false)} className="text-zinc-500 hover:text-white p-1">
                <X size={14} />
              </button>
            </div>

            <div className="p-3 border-b border-white/[0.05]">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search team members by name or email..."
                  value={composeSearch}
                  onChange={e => setComposeSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 bg-[#07080A] border border-white/[0.06] rounded text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]/50"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredEmployees.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No colleagues match this query.
                </div>
              ) : (
                filteredEmployees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleStartDirectChat(emp)}
                    disabled={creatingDm}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white">
                        {emp.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors">
                          {emp.full_name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {emp.role || 'Member'} · {emp.email}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300" />
                  </button>
                ))
              )}
            </div>

            <div className="p-3 border-t border-white/[0.06] bg-[#08090C] text-[10px] font-mono text-zinc-500 flex justify-between">
              <span>RBAC Scoped</span>
              <button onClick={() => setIsComposeOpen(false)} className="text-zinc-400 hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
