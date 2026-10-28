import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  Bell, Calendar,
  CheckSquare, FileText, MessageSquare, Info
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  body?: string;
  type?: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  data?: any;
}

export default function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      const list = data || [];
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.is_read).length);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    markAsRead(n.id);
    setIsOpen(false);

    if (n.action_url && n.action_url.startsWith('/')) {
      navigate(n.action_url);
      return;
    }

    if (n.type?.includes('meeting') || n.data?.meeting_id) {
      navigate(`/meetings/${n.data?.meeting_id || ''}`);
    } else if (n.type?.includes('task') || n.data?.task_id) {
      navigate('/tasks');
    } else if (n.type?.includes('invoice') || n.data?.invoice_id) {
      navigate(`/invoices/${n.data?.invoice_id || ''}`);
    } else if (n.type?.includes('chat') || n.data?.channel_id) {
      navigate(`/chat/${n.data?.channel_id || ''}`);
    } else {
      navigate('/dashboard');
    }
  };

  const getIcon = (type: string) => {
    if (type?.includes('meeting')) return <Calendar size={14} className="text-[#FF6B4A]" />;
    if (type?.includes('task')) return <CheckSquare size={14} className="text-blue-400" />;
    if (type?.includes('invoice')) return <FileText size={14} className="text-emerald-400" />;
    if (type?.includes('chat')) return <MessageSquare size={14} className="text-purple-400" />;
    return <Info size={14} className="text-muted" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative w-9 h-9 flex items-center justify-center text-muted hover:text-main rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-divider transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#FF6B4A] text-main text-[10px] font-mono font-bold leading-none rounded-full flex items-center justify-center border-2 border-[#090A0E] shadow-sm pointer-events-none select-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card-bg border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-main uppercase tracking-wider">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6B4A]/20 text-muted border border-[#FF6B4A]/30">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-muted hover:text-main transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted font-medium">
                  <Bell size={24} className="mx-auto mb-2 opacity-40 text-muted" />
                  No notifications yet. You're all caught up!
                </div>
              ) : (
                notifications.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      !item.is_read ? 'bg-[#FF6B4A]/[0.04] hover:bg-[#FF6B4A]/[0.08]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-divider shrink-0 mt-0.5">
                      {getIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${!item.is_read ? 'text-main' : 'text-muted'}`}>
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-muted shrink-0 font-medium">
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {(item.message || item.body) && (
                        <p className="text-[11px] text-muted line-clamp-2 leading-relaxed font-normal">
                          {item.message || item.body}
                        </p>
                      )}
                    </div>

                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#FF6B4A] shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-divider bg-white/[0.02] flex items-center justify-between px-4">
              <span className="text-[10px] font-semibold text-muted">Real-time sync</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="text-[11px] font-bold text-[#FF6B4A] hover:underline flex items-center gap-1 transition-colors"
              >
                <span>View all notifications</span> &rarr;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
