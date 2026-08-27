import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  Send,
  Hash,
  CornerUpLeft,
  X,
  Trash2,
  Lock,
  Video,
  Plus,
  Search,
  CheckCheck,
  Check,
  Paperclip,
  PanelRight,
  Briefcase,
  FileText,
  Copy,
  ChevronRight
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import {
  initializeUserKeys,
  generateRandomSymmetricKey,
  encryptKeyForRecipient,
  decryptKeyWithSender,
  encryptMessagePayload,
  decryptMessagePayload,
} from '../lib/crypto';

function timeStr(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateStr(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Message Bubble Component ──────────────────────────────────────────
function Bubble({
  msg, isMe, showSender, onReply, onDelete, canDelete
}: {
  msg: any; isMe: boolean; showSender: boolean;
  onReply: (m: any) => void; onDelete: (id: string) => void; canDelete: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const initials = (msg.sender?.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex gap-2.5 group ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end my-1`}>
      {/* Compact Avatar for other party */}
      {!isMe && (
        <div className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-1">
          {msg.sender?.avatar_url
            ? <img src={msg.sender.avatar_url} className="w-7 h-7 rounded-md object-cover" alt={initials} />
            : initials}
        </div>
      )}

      <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name for channel context */}
        {showSender && !isMe && (
          <span className="text-[10px] font-mono text-zinc-500 mb-1 ml-1">
            {msg.sender?.full_name || 'Team Member'}
          </span>
        )}

        {/* Reply preview */}
        {msg.reply_message && (
          <div className={`mb-1 px-2.5 py-1 rounded border-l-2 border-[#FF6B4A] bg-white/[0.03] text-[11px] text-zinc-400 max-w-full ${isMe ? 'mr-1' : 'ml-1'}`}>
            <span className="text-[#FF6B4A] font-semibold">{msg.reply_message.sender?.full_name}: </span>
            <span className="truncate">{msg.reply_message.content}</span>
          </div>
        )}

        {/* Bubble Surface */}
        <div
          className={`relative px-3.5 py-2 rounded-lg text-[13px] leading-relaxed transition-all ${
            isMe
              ? 'bg-[#151722] text-zinc-100 border border-[#FF6B4A]/30 rounded-br-none shadow-sm'
              : 'bg-[#0E1016] text-zinc-200 border border-white/[0.06] rounded-bl-none'
          } ${msg.isOptimistic ? 'opacity-60' : ''}`}
        >
          {msg.content && <p>{msg.content}</p>}

          {/* File / Image Attachment */}
          {msg.file_url && (
            <div className={`${msg.content ? 'mt-2' : ''}`}>
              {msg.file_type?.startsWith('image/') || msg.file_url?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-white/[0.08] hover:opacity-90 transition-opacity">
                  <img src={msg.file_url} alt={msg.file_name || 'Attachment'} className="max-w-xs max-h-60 object-cover rounded-md" />
                </a>
              ) : (
                <a
                  href={msg.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={msg.file_name}
                  className="flex items-center gap-2 p-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs transition-colors"
                >
                  <FileText size={16} className="text-[#FF6B4A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium truncate">{msg.file_name || 'Attachment'}</div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">{msg.file_type?.split('/')[1] || 'FILE'}</div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-500 shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Metadata & Quick Hover Actions */}
        <div className={`flex items-center gap-2 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[9px] font-mono text-zinc-600 flex items-center gap-1">
            {timeStr(msg.created_at)}
            {isMe && (
              msg.message_reads?.length > 0
                ? <CheckCheck size={11} className="text-[#FF6B4A]" />
                : <Check size={11} className="text-zinc-600" />
            )}
          </span>

          <button
            onClick={() => onReply(msg)}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Reply"
          >
            <CornerUpLeft size={11} />
          </button>

          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
            title={copied ? 'Copied' : 'Copy'}
          >
            <Copy size={11} className={copied ? 'text-[#FF6B4A]' : ''} />
          </button>

          {canDelete && !msg.isOptimistic && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date Divider ───────────────────────────────────────────────────────
function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/[0.05]" />
      <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-wider">{date}</span>
      <div className="flex-1 h-px bg-white/[0.05]" />
    </div>
  );
}

// ── Main ChatRoom Component ────────────────────────────────────────────
export default function ChatRoom() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [channel, setChannel] = useState<any>(null);
  const [allChannels, setAllChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [fileAttachment, setFileAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [otherMember, setOtherMember] = useState<any | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [searchNav, setSearchNav] = useState('');
  const [relatedProjects, setRelatedProjects] = useState<any[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceRef = useRef<any>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiverTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const symmetricKeyRef = useRef<string | null>(null);

  const setSymmetricKey = (key: string | null) => {
    symmetricKeyRef.current = key;
  };

  const isAdminRole = ['owner', 'administrator', 'ceo'].includes(role || '');

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, []);

  // ── Mark channel as read ──
  const markRead = useCallback(async () => {
    if (!channelId || !user?.id) return;
    await supabase
      .from('channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channelId).eq('user_id', user.id);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id).eq('entity_id', channelId)
      .in('type', ['chat', 'chat_channel']).eq('is_read', false);
  }, [channelId, user?.id]);

  // ── Fetch Sidebar Channels ──
  const fetchSidebarChannels = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('chat_channels')
        .select(`*, channel_members(user_id, last_read_at, user:user_id(id, full_name, avatar_url, role))`)
        .order('created_at', { ascending: false });

      if (data) {
        const enriched = await Promise.all(data.map(async (ch: any) => {
          const { data: lm } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('channel_id', ch.id)
            .order('created_at', { ascending: false })
            .limit(1);

          let displayName = ch.name;
          let otherUser = null;
          if (ch.type === 'direct') {
            otherUser = ch.channel_members?.find((m: any) => m.user_id !== user.id)?.user;
            if (otherUser) displayName = otherUser.full_name;
          }

          let lastText = lm?.[0]?.content || 'No messages yet';
          if (lastText.startsWith('__E2EE__:')) lastText = '🔒 Encrypted message';

          const myMembership = ch.channel_members?.find((m: any) => m.user_id === user.id);
          const lastReadAt = myMembership?.last_read_at || ch.created_at;

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .gt('created_at', lastReadAt)
            .neq('sender_id', user.id);

          return {
            ...ch,
            name: displayName,
            otherUser,
            unreadCount: count || 0,
            lastMessageText: lastText,
            lastMessageTime: lm?.[0]?.created_at || ch.created_at,
          };
        }));
        setAllChannels(enriched);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // ── Fetch Main Channel + Messages + Related Work ──
  const fetchChannelData = useCallback(async () => {
    if (!channelId || !user) return;
    try {
      const { data: chanData, error } = await supabase
        .from('chat_channels')
        .select(`*, channel_members(user_id, user:user_id(id, full_name, avatar_url, role, is_online, last_seen_at))`)
        .eq('id', channelId).single();
      if (error) throw error;
      setChannel(chanData);

      if (chanData.type === 'direct') {
        const other = chanData.channel_members?.find((m: any) => m.user_id !== user?.id)?.user;
        if (other) {
          const { data: priv } = await supabase
            .from('privacy_settings').select('show_last_seen, show_online')
            .eq('user_id', other.id).maybeSingle();
          setOtherMember({ ...other, show_last_seen: priv?.show_last_seen ?? 'everyone', show_online: priv?.show_online ?? 'everyone' });
        }
      }

      // E2EE Keys
      let symmetricKey = symmetricKeyRef.current;
      try {
        if (!symmetricKey) {
          const myPubKey = await initializeUserKeys(user.id);
          const { data: myKeyData } = await supabase
            .from('channel_keys')
            .select('encrypted_key')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (myKeyData) {
            const candidateUserIds = [
              chanData.created_by,
              chanData.channel_members?.find((m: any) => m.user_id !== user?.id)?.user_id,
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
                  symmetricKey = await decryptKeyWithSender(myKeyData.encrypted_key, senderKeyData.public_key);
                  if (symmetricKey) {
                    setSymmetricKey(symmetricKey);
                    break;
                  }
                }
              } catch {
                // Try next candidate
              }
            }
          } else {
            const newKey = generateRandomSymmetricKey();
            const myEncryptedKey = await encryptKeyForRecipient(newKey, myPubKey);
            const inserts = [
              { channel_id: channelId, user_id: user.id, encrypted_key: myEncryptedKey }
            ];

            if (chanData.type === 'direct') {
              const other = chanData.channel_members?.find((m: any) => m.user_id !== user?.id)?.user;
              if (other) {
                const { data: otherKeyData } = await supabase
                  .from('user_public_keys')
                  .select('public_key')
                  .eq('user_id', other.id)
                  .maybeSingle();

                if (otherKeyData?.public_key) {
                  const otherEncryptedKey = await encryptKeyForRecipient(newKey, otherKeyData.public_key);
                  inserts.push({ channel_id: channelId, user_id: other.id, encrypted_key: otherEncryptedKey });
                }
              }
            }
            await supabase.from('channel_keys').insert(inserts);
            symmetricKey = newKey;
            setSymmetricKey(symmetricKey);
          }
        }
      } catch (cryptoErr) {
        console.warn('E2EE sync warning:', cryptoErr);
      }

      // Fetch messages
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select(`*, sender:sender_id(full_name, avatar_url), message_reads(user_id), reply_message:reply_to_id(id, content, sender:sender_id(full_name))`)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      const msgs = await Promise.all((msgData || []).map(async (m: any) => {
        let content = m.content;
        if (m.content?.startsWith('__E2EE__:')) {
          if (symmetricKey) {
            const cipher = m.content.replace('__E2EE__:', '');
            const payload = await decryptMessagePayload(cipher, symmetricKey);
            content = payload?.text || '🔒 Encrypted message';
          } else {
            content = '🔒 Encrypted message';
          }
        }
        return { ...m, content };
      }));
      setMessages(msgs);

      // Fetch related projects for Context Inspector
      const { data: projs } = await supabase
        .from('projects')
        .select('id, title, status, cover_color')
        .limit(3);
      setRelatedProjects(projs || []);

      // Mark read
      if (msgs.length > 0) {
        const unread = msgs.filter((m: any) => m.sender_id !== user.id && !m.message_reads?.some((r: any) => r.user_id === user.id));
        if (unread.length > 0) {
          await supabase.from('message_reads').insert(unread.map((m: any) => ({ message_id: m.id, user_id: user.id })));
        }
      }
      await markRead();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [channelId, user, markRead, scrollToBottom]);

  useEffect(() => {
    fetchSidebarChannels();
    fetchChannelData();
  }, [fetchSidebarChannels, fetchChannelData]);

  // Realtime
  useEffect(() => {
    if (!channelId || !user) return;

    const msgSub = supabase
      .channel(`chat:messages:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const rawNew = payload.new as any;
          const { data: sender } = await supabase.from('users').select('full_name, avatar_url').eq('id', rawNew.sender_id).single();
          let replyMsg = null;
          if (rawNew.reply_to_id) {
            const { data: rm } = await supabase.from('chat_messages').select('id, content, sender:sender_id(full_name)').eq('id', rawNew.reply_to_id).single();
            replyMsg = rm;
          }
          
          let content = rawNew.content;
          if (rawNew.content?.startsWith('__E2EE__:')) {
            const key = symmetricKeyRef.current;
            if (key) {
              const cipher = rawNew.content.replace('__E2EE__:', '');
              const dec = await decryptMessagePayload(cipher, key);
              content = dec?.text || '🔒 Encrypted message';
            } else {
              content = '🔒 Encrypted message';
            }
          }

          const msg: any = { ...rawNew, content, sender, reply_message: replyMsg, message_reads: [] };
          setMessages(prev => {
            const filtered = prev.filter(m => !(m.isOptimistic && m.content === content && m.sender_id === msg.sender_id));
            if (filtered.some(m => m.id === msg.id)) return filtered;
            return [...filtered, msg];
          });
          if (rawNew.sender_id !== user.id) {
            supabase.from('message_reads').insert({ message_id: rawNew.id, user_id: user.id }).then();
            markRead();
          }
          scrollToBottom();
          fetchSidebarChannels();
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const rawOld = payload.old as any;
          setMessages(prev => prev.filter(m => m.id !== rawOld.id));
        })
      .subscribe();

    // Presence
    const presenceCh = supabase.channel(`chat:presence:${channelId}`, { config: { presence: { key: user.id } } });
    presenceRef.current = presenceCh;

    presenceCh
      .on('presence', { event: 'sync' }, () => {
        const state = presenceCh.presenceState();
        if (otherMember?.id) {
          const isOnline = Object.values(state).some((presences: any) =>
            presences.some((p: any) => p.user_id === otherMember.id)
          );
          setOtherOnline(isOnline);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        const { userId, isTyping } = payload;
        if (userId !== user.id) {
          if (isTyping) {
            setTypingUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
            if (receiverTimeouts.current[userId]) clearTimeout(receiverTimeouts.current[userId]);
            receiverTimeouts.current[userId] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(id => id !== userId));
            }, 4000);
          } else {
            if (receiverTimeouts.current[userId]) { clearTimeout(receiverTimeouts.current[userId]); delete receiverTimeouts.current[userId]; }
            setTypingUsers(prev => prev.filter(id => id !== userId));
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceCh.track({ user_id: user.id, online_at: new Date().toISOString() });
      });

    return () => {
      supabase.removeChannel(msgSub);
      if (presenceRef.current) supabase.removeChannel(presenceRef.current);
      Object.values(receiverTimeouts.current).forEach(clearTimeout);
    };
  }, [channelId, user, otherMember?.id, markRead, scrollToBottom, fetchSidebarChannels]);

  // Input & Typing
  const handleInput = (text: string) => {
    setInputText(text);
    if (!presenceRef.current || !user) return;
    presenceRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping: text.length > 0 } });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (text.length > 0) {
      typingTimeout.current = setTimeout(() => {
        presenceRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping: false } });
      }, 3000);
    }
  };

  // Send Message
  // File Attachment Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploadingAttachment(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `chat/${channelId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      // Upload to supabase storage (avatars / chat bucket or fallback)
      let uploadBucket = 'chat-attachments';
      let uploadResult = await supabase.storage.from(uploadBucket).upload(filePath, file);

      if (uploadResult.error) {
        // Fallback to avatars bucket if chat-attachments does not exist
        uploadBucket = 'avatars';
        uploadResult = await supabase.storage.from(uploadBucket).upload(filePath, file);
      }

      if (uploadResult.error) throw uploadResult.error;

      const { data: { publicUrl } } = supabase.storage.from(uploadBucket).getPublicUrl(filePath);

      setFileAttachment({
        url: publicUrl,
        name: file.name,
        type: file.type || 'application/octet-stream'
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      alert('Failed to upload file: ' + (err.message || 'Error occurred'));
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !fileAttachment) || sending) return;
    setInputText('');
    const currentAttachment = fileAttachment;
    setFileAttachment(null);
    setSending(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    presenceRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, isTyping: false } });

    const optimisticId = `opt-${Math.random()}`;
    const optimistic = {
      id: optimisticId,
      channel_id: channelId,
      sender_id: user?.id,
      content: text,
      file_url: currentAttachment?.url || null,
      file_name: currentAttachment?.name || null,
      file_type: currentAttachment?.type || null,
      created_at: new Date().toISOString(),
      sender: { full_name: user?.user_metadata?.full_name || 'Me', avatar_url: null },
      message_reads: [],
      reply_message: replyTo ? { content: replyTo.content, sender: { full_name: replyTo.sender?.full_name || 'User' } } : null,
      reply_to_id: replyTo?.id || null,
      isOptimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setReplyTo(null);
    scrollToBottom();

    try {
      let finalContent = text;
      const key = symmetricKeyRef.current;
      if (key && text) {
        const payload = { text };
        const encrypted = await encryptMessagePayload(payload, key);
        finalContent = `__E2EE__:${encrypted}`;
      }

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_id: user?.id,
        content: finalContent || '',
        file_url: currentAttachment?.url || null,
        file_name: currentAttachment?.name || null,
        file_type: currentAttachment?.type || null,
        reply_to_id: optimistic.reply_to_id,
      });
      if (error) throw error;
    } catch (e: any) {
      console.error(e);
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  // Delete
  const handleDelete = useCallback((messageId: string) => {
    setDeleteMsgId(messageId);
  }, []);

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', deleteMsgId);
    if (!error) setMessages(prev => prev.filter(m => m.id !== deleteMsgId));
    setDeleteMsgId(null);
  };

  // Group messages
  const grouped: { divider?: string; msg?: any; showSender?: boolean }[] = [];
  let lastDate = '';
  let lastSenderId = '';
  messages.forEach(msg => {
    const d = dateStr(msg.created_at);
    if (d !== lastDate) { grouped.push({ divider: d }); lastDate = d; lastSenderId = ''; }
    const showSender = msg.sender_id !== lastSenderId;
    grouped.push({ msg, showSender });
    lastSenderId = msg.sender_id;
  });

  const isDirect = channel?.type === 'direct';
  const displayName = isDirect ? (otherMember?.full_name || 'Direct Message') : (channel?.name || 'Channel');

  const filteredNavChannels = allChannels.filter(ch =>
    !searchNav || ch.name?.toLowerCase().includes(searchNav.toLowerCase())
  );

  return (
    <div className="h-full flex flex-1 -m-4 sm:-m-6 lg:-m-7 bg-[#08090C] text-zinc-300 select-none overflow-hidden font-sans">
      
      {/* ── Panel 1: Conversation Navigator (280px - 320px) ── */}
      <div className="w-80 border-r border-white/[0.05] bg-[#0A0B10] flex flex-col h-full shrink-0 hidden md:flex">
        
        {/* Navigator Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Chat</h2>
            <span className="text-[10px] font-mono text-zinc-500">· {allChannels.length}</span>
          </div>

          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#13151D] hover:bg-[#181B26] border border-white/[0.06] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors"
            title="Compose new conversation"
          >
            <Plus size={12} className="text-[#FF6B4A]" />
            <span>Compose</span>
          </button>
        </div>

        {/* Navigator Search */}
        <div className="p-3 border-b border-white/[0.05]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchNav}
              onChange={e => setSearchNav(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080A] border border-white/[0.05] focus:border-[#FF6B4A]/40 rounded-md text-[11px] text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          <div className="space-y-0.5 px-1.5">
            {filteredNavChannels.map(ch => {
              const isSelected = ch.id === channelId;
              const hasUnread = ch.unreadCount > 0;

              return (
                <Link
                  key={ch.id}
                  to={`/chat/${ch.id}`}
                  className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors group ${
                    isSelected
                      ? 'bg-white/[0.06] text-white font-semibold'
                      : 'hover:bg-white/[0.025] text-zinc-400'
                  }`}
                >
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#FF6B4A] rounded-full" />
                  )}

                  {/* Avatar / Hash */}
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white">
                      {ch.type === 'direct'
                        ? (ch.name || 'U').charAt(0).toUpperCase()
                        : <Hash size={13} className="text-[#FF6B4A]" />
                      }
                    </div>
                    {ch.type === 'direct' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0A0B10]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className={`text-[12px] truncate ${isSelected ? 'text-white font-bold' : 'text-zinc-300'}`}>
                        {ch.type === 'direct' ? ch.name : `#${ch.name}`}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-600 shrink-0 ml-1">
                        {timeAgo(ch.lastMessageTime)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {ch.lastMessageText}
                    </div>
                  </div>

                  {hasUnread && !isSelected && (
                    <span className="shrink-0 min-w-[16px] h-4 px-1 rounded bg-[#FF6B4A] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                      {ch.unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
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

      {/* ── Panel 2: Active Conversation Main Workspace ── */}
      <div className="flex-1 flex flex-col h-full bg-[#07080B] overflow-hidden min-w-0">
        
        {/* Active Conversation Topbar */}
        <div className="h-14 px-4 sm:px-6 border-b border-white/[0.05] bg-[#0A0B10] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white relative shrink-0">
              {isDirect ? (
                displayName.charAt(0).toUpperCase()
              ) : (
                <Hash size={15} className="text-[#FF6B4A]" />
              )}
              {isDirect && (
                <span className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0A0B10] ${
                  otherOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                }`} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">{displayName}</span>
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                  {isDirect ? (otherMember?.role || 'Team Member') : 'Team Channel'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Lock size={10} />
                  <span>End-to-end encrypted</span>
                </span>
                <span>·</span>
                <span className={otherOnline ? 'text-emerald-400' : 'text-zinc-500'}>
                  {otherOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/meetings/new')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#13151D] hover:bg-[#181B26] border border-white/[0.06] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors"
              title="Start or schedule LiveKit meeting"
            >
              <Video size={12} className="text-[#FF6B4A]" />
              <span className="hidden sm:inline">Start Meeting</span>
            </button>

            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`p-1.5 rounded border transition-colors ${
                showInspector
                  ? 'bg-white/[0.06] border-white/[0.1] text-white'
                  : 'bg-[#13151D] border-white/[0.06] text-zinc-400 hover:text-white'
              }`}
              title="Toggle Details Inspector"
            >
              <PanelRight size={14} />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
          {loading ? (
            <div className="space-y-4 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex gap-2.5 items-end ${i % 2 ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 bg-white/[0.02] rounded-md" />
                  <div className={`h-10 bg-white/[0.02] rounded-lg ${i % 2 ? 'w-48' : 'w-64'}`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-10 h-10 rounded-lg bg-[#11131B] border border-white/[0.08] flex items-center justify-center text-[#FF6B4A] mb-3">
                <Lock size={18} />
              </div>
              <p className="text-white text-xs font-bold">
                {isDirect ? `Encrypted session with ${displayName}` : `Welcome to #${displayName}`}
              </p>
              <p className="text-zinc-500 text-[11px] mt-0.5 max-w-xs">
                Messages in this thread are securely encrypted on your device.
              </p>
            </div>
          ) : (
            grouped.map((item, idx) => {
              if (item.divider) return <DateDivider key={`div-${idx}`} date={item.divider} />;
              const msg = item.msg!;
              const isMe = msg.sender_id === user?.id;
              const canDel = isMe || isAdminRole;
              return (
                <Bubble
                  key={msg.id || idx}
                  msg={msg}
                  isMe={isMe}
                  showSender={!!item.showSender}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  canDelete={canDel}
                />
              );
            })
          )}

          {/* Realtime Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 pl-9 py-1 text-[10px] font-mono text-zinc-500">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1 h-1 bg-[#FF6B4A] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span>Typing message…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Reply Preview Banner */}
        {replyTo && (
          <div className="px-4 py-2 border-t border-white/[0.05] bg-[#0A0B10] flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 text-zinc-400">
              <CornerUpLeft size={13} className="text-[#FF6B4A]" />
              <span>Replying to <strong className="text-white">{replyTo.sender?.full_name}</strong></span>
              <span className="text-zinc-500 truncate max-w-xs">{replyTo.content}</span>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white p-1">
              <X size={13} />
            </button>
          </div>
        )}

        {/* File Attachment Preview Banner */}
        {fileAttachment && (
          <div className="px-4 py-2 border-t border-white/[0.05] bg-[#0E1017] flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-[#FF6B4A]/10 border border-[#FF6B4A]/20 flex items-center justify-center text-[#FF6B4A]">
                <Paperclip size={12} />
              </div>
              <div className="min-w-0">
                <span className="text-white font-medium truncate block">{fileAttachment.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono uppercase">{fileAttachment.type.split('/')[1] || 'FILE'}</span>
              </div>
            </div>
            <button onClick={() => setFileAttachment(null)} className="text-zinc-500 hover:text-white p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Command Message Composer */}
        <div className="p-3 sm:p-4 border-t border-white/[0.05] bg-[#0A0B10] shrink-0">
          <div className="flex items-end gap-2 bg-[#07080A] border border-white/[0.06] focus-within:border-[#FF6B4A]/50 rounded-lg p-2 transition-colors">
            
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              disabled={uploadingAttachment}
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-white/[0.06] transition-colors disabled:opacity-40"
              title="Attach Document or Image"
            >
              {uploadingAttachment ? (
                <div className="w-3.5 h-3.5 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip size={15} />
              )}
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={e => {
                handleInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${displayName}...`}
              className="flex-1 resize-none bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:outline-none max-h-[120px] overflow-y-auto leading-relaxed"
              style={{ height: '28px' }}
            />

            <button
              onClick={handleSend}
              disabled={(!inputText.trim() && !fileAttachment) || sending || uploadingAttachment}
              className="px-3 py-1.5 bg-[#FF6B4A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FF552B] text-white text-[11px] font-semibold rounded transition-all shrink-0 flex items-center gap-1"
            >
              <span>Send</span>
              <Send size={11} />
            </button>
          </div>
        </div>

      </div>

      {/* ── Panel 3: Context Inspector (300px - 360px) ── */}
      {showInspector && (
        <div className="w-80 border-l border-white/[0.05] bg-[#0A0B10] flex flex-col h-full shrink-0 overflow-y-auto hidden lg:flex font-sans">
          
          {/* Inspector Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.05]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">Conversation Details</span>
            <button onClick={() => setShowInspector(false)} className="text-zinc-500 hover:text-white p-1">
              <X size={13} />
            </button>
          </div>

          <div className="p-4 space-y-6">
            
            {/* Identity Profile Card */}
            <div className="text-center pb-4 border-b border-white/[0.05]">
              <div className="w-12 h-12 rounded-lg bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-white mx-auto mb-2 relative">
                {isDirect ? displayName.charAt(0).toUpperCase() : <Hash size={20} className="text-[#FF6B4A]" />}
                {isDirect && (
                  <span className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0A0B10] ${
                    otherOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                  }`} />
                )}
              </div>
              <h3 className="text-xs font-bold text-white">{displayName}</h3>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                {isDirect ? (otherMember?.role || 'Employee') : 'Organization Channel'}
              </p>
            </div>

            {/* Security Telemetry */}
            <div className="p-3 rounded bg-[#07080A] border border-white/[0.04] space-y-2">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Lock size={11} className="text-emerald-400" />
                <span>Security Telemetry</span>
              </div>
              <div className="text-[11px] text-zinc-400 space-y-1">
                <div className="flex justify-between"><span>Protocol:</span><span className="font-mono text-zinc-300">P-256 ECDH</span></div>
                <div className="flex justify-between"><span>Cipher:</span><span className="font-mono text-zinc-300">AES-GCM-256</span></div>
                <div className="flex justify-between"><span>Ratchets:</span><span className="text-emerald-400 font-semibold">Active</span></div>
              </div>
            </div>

            {/* Related Work (Work OS Connection) */}
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Briefcase size={11} className="text-[#FF6B4A]" />
                <span>Related Work</span>
              </div>

              <div className="space-y-1.5">
                {relatedProjects.map(p => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="p-2.5 rounded bg-[#07080A] border border-white/[0.04] hover:border-white/[0.1] block transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                        {p.title}
                      </span>
                      <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300" />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">Project · {p.status || 'Active'}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Shared Content Summary */}
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <FileText size={11} className="text-zinc-400" />
                <span>Shared Telemetry</span>
              </div>

              <div className="divide-y divide-white/[0.04] text-[11px]">
                <div className="py-2 flex justify-between text-zinc-400">
                  <span>Encrypted Messages</span>
                  <span className="font-mono text-white">{messages.length}</span>
                </div>
                <div className="py-2 flex justify-between text-zinc-400">
                  <span>Channel Members</span>
                  <span className="font-mono text-white">{channel?.channel_members?.length || 2}</span>
                </div>
                <div className="py-2 flex justify-between text-zinc-400">
                  <span>Meeting History</span>
                  <span className="font-mono text-zinc-500">LiveKit Link</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteMsgId}
        title="Delete Message"
        message="Are you sure you want to delete this message? It will be removed for all members in this conversation."
        confirmText="Delete for Everyone"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteMessage}
        onCancel={() => setDeleteMsgId(null)}
      />
    </div>
  );
}
