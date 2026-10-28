import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Calendar,
  CheckSquare,
  FileText,
  MessageSquare,
  Info,
  Check,
  Trash2,
  Search,
  ExternalLink,
  RefreshCw,
  Clock,
  Briefcase,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/ui/Toast';

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  body?: string;
  type?: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  delivery_status?: string;
}

type FilterCategory = 'all' | 'unread' | 'task' | 'meeting' | 'invoice' | 'chat';

const PAGE_SIZE = 12;

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch notifications from Supabase
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('[Notifications] Fetch error:', err);
      toast.error('Failed to load notifications: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    // Realtime subscription
    const channel = supabase
      .channel(`notifications-center-${user.id}`)
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
  }, [user, fetchNotifications]);

  // Derived counts
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Filter & Search
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const type = (item.type || '').toLowerCase();
      const entity = (item.entity_type || '').toLowerCase();

      // Category filter
      if (activeCategory === 'unread' && item.is_read) return false;
      if (activeCategory === 'task' && !type.includes('task') && !entity.includes('task') && !type.includes('project')) return false;
      if (activeCategory === 'meeting' && !type.includes('meeting') && !entity.includes('meeting')) return false;
      if (activeCategory === 'invoice' && !type.includes('invoice') && !type.includes('finance') && !type.includes('payment') && !entity.includes('invoice')) return false;
      if (activeCategory === 'chat' && !type.includes('chat') && !entity.includes('chat')) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const bodyMatch = (item.message || item.body || '').toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch) return false;
      }

      return true;
    });
  }, [notifications, activeCategory, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(start, start + PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeCategory, searchQuery]);

  // Action: Mark single as read/unread
  const toggleReadStatus = async (item: NotificationRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const nextStatus = !item.is_read;
      await supabase
        .from('notifications')
        .update({ is_read: nextStatus })
        .eq('id', item.id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: nextStatus } : n))
      );
    } catch (err: any) {
      toast.error('Could not update notification: ' + err.message);
    }
  };

  // Action: Mark all as read
  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch (err: any) {
      toast.error('Failed to mark all as read: ' + err.message);
    }
  };

  // Action: Delete single
  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Notification removed.');
    } catch (err: any) {
      toast.error('Failed to delete notification: ' + err.message);
    }
  };

  // Action: Batch Delete Selected
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await supabase.from('notifications').delete().in('id', ids);
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
      toast.success(`Removed ${ids.length} notification(s).`);
    } catch (err: any) {
      toast.error('Failed to delete notifications: ' + err.message);
    }
  };

  // Action: Select All on page
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length && paginatedItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((n) => n.id)));
    }
  };

  // Click & Navigate
  const handleItemClick = (item: NotificationRecord) => {
    if (!item.is_read) {
      toggleReadStatus(item);
    }

    if (item.action_url && item.action_url.startsWith('/')) {
      navigate(item.action_url);
      return;
    }

    const type = (item.type || '').toLowerCase();
    if (type.includes('meeting')) {
      navigate('/meetings');
    } else if (type.includes('task')) {
      navigate('/tasks');
    } else if (type.includes('invoice') || type.includes('payment')) {
      navigate('/invoices');
    } else if (type.includes('chat')) {
      navigate('/chat');
    } else if (type.includes('project')) {
      navigate('/projects');
    } else {
      navigate('/dashboard');
    }
  };

  // Formatting helper
  const formatRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Icon mapping
  const getCategoryIcon = (item: NotificationRecord) => {
    const type = (item.type || '').toLowerCase();
    const entity = (item.entity_type || '').toLowerCase();

    if (type.includes('meeting') || entity.includes('meeting')) {
      return { icon: <Calendar size={16} className="text-[#FF6B4A]" />, bg: 'bg-[#FF6B4A]/10 border-[#FF6B4A]/20' };
    }
    if (type.includes('task') || entity.includes('task')) {
      return { icon: <CheckSquare size={16} className="text-sky-400" />, bg: 'bg-sky-500/10 border-sky-500/20' };
    }
    if (type.includes('invoice') || type.includes('payment') || entity.includes('invoice')) {
      return { icon: <FileText size={16} className="text-emerald-400" />, bg: 'bg-emerald-500/10 border-emerald-500/20' };
    }
    if (type.includes('chat') || entity.includes('chat')) {
      return { icon: <MessageSquare size={16} className="text-purple-400" />, bg: 'bg-purple-500/10 border-purple-500/20' };
    }
    if (type.includes('project') || entity.includes('project')) {
      return { icon: <Briefcase size={16} className="text-indigo-400" />, bg: 'bg-indigo-500/10 border-indigo-500/20' };
    }
    return { icon: <Info size={16} className="text-zinc-400" />, bg: 'bg-zinc-800/40 border-zinc-700/30' };
  };

  return (
    <div className="min-h-full max-w-5xl mx-auto px-4 py-8 select-none">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-main tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/25 text-[#FF6B4A]">
                <Bell size={20} />
              </span>
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30 text-xs font-mono font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1">
            Real-time activity feed, task assignments, meeting invitations, and financial milestone alerts.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-divider text-xs font-medium text-muted hover:text-main transition-colors flex items-center gap-1.5"
            title="Refresh feed"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 rounded-lg bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 border border-[#FF6B4A]/30 text-xs font-bold text-[#FF6B4A] transition-colors flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CONTROLS & FILTER TABS ── */}
      <div className="bg-card-bg border border-divider rounded-2xl p-3 mb-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'task', label: 'Tasks & Projects' },
            { id: 'meeting', label: 'Meetings' },
            { id: 'invoice', label: 'Invoices & Billing' },
            { id: 'chat', label: 'Chat' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as FilterCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeCategory === tab.id
                  ? 'bg-[#FF6B4A] text-white shadow-md shadow-[#FF6B4A]/20 font-bold'
                  : 'text-muted hover:text-main hover:bg-white/[0.04]'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeCategory === tab.id ? 'bg-white/25 text-white' : 'bg-white/[0.06] text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
          />
        </div>
      </div>

      {/* ── BATCH SELECTION BAR (When items selected) ── */}
      {selectedIds.size > 0 && (
        <div className="bg-[#FF6B4A]/10 border border-[#FF6B4A]/25 rounded-xl px-4 py-2 mb-4 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <span className="font-semibold text-main">
            {selectedIds.size} notification{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-main border border-divider font-semibold transition-colors"
            >
              {selectedIds.size === paginatedItems.length && paginatedItems.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={deleteSelected}
              className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS LIST ── */}
      <div className="space-y-2">
        {loading && notifications.length === 0 ? (
          <div className="p-16 text-center text-muted">
            <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs font-mono tracking-wider">SYNCING NOTIFICATIONS...</span>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="bg-card-bg border border-divider rounded-2xl p-16 text-center">
            <Bell size={36} className="mx-auto mb-3 text-muted opacity-40" />
            <h3 className="text-sm font-bold text-main mb-1">No notifications found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchQuery
                ? 'No notifications matched your search query. Try clearing the filter.'
                : activeCategory === 'unread'
                ? "You're all caught up! No unread notifications pending."
                : 'Activity and alerts will show up here as your team works.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {paginatedItems.map((item) => {
              const { icon, bg } = getCategoryIcon(item);
              const isSelected = selectedIds.has(item.id);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => handleItemClick(item)}
                className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  !item.is_read
                    ? 'bg-[#FF6B4A]/[0.035] border-[#FF6B4A]/20 hover:border-[#FF6B4A]/40 shadow-sm'
                    : 'bg-card-bg border-divider hover:border-white/[0.12] hover:bg-white/[0.02]'
                } ${isSelected ? 'ring-1 ring-[#FF6B4A]' : ''}`}
              >
                {/* Category Icon */}
                <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${bg}`}>
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-16 sm:pr-24">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-xs font-bold truncate ${!item.is_read ? 'text-main' : 'text-zinc-300'}`}>
                      {item.title}
                    </h4>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#FF6B4A] shrink-0" />
                    )}
                  </div>

                  {(item.message || item.body) && (
                    <p className="text-xs text-muted leading-relaxed font-normal line-clamp-2">
                      {item.message || item.body}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatRelativeTime(item.created_at)}
                    </span>
                    {item.entity_type && (
                      <span className="uppercase text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/[0.04] text-muted border border-white/[0.06]">
                        {item.entity_type}
                      </span>
                    )}
                    {item.action_url && (
                      <span className="text-[#FF6B4A] flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                        <span>Open</span>
                        <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute right-3 top-3.5 flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-white/[0.06] transition-colors"
                    title={isSelected ? 'Deselect' : 'Select'}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#FF6B4A] border-[#FF6B4A] text-white' : 'border-divider'}`}>
                      {isSelected && <Check size={10} />}
                    </span>
                  </button>

                  <button
                    onClick={(e) => toggleReadStatus(item, e)}
                    className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-white/[0.06] transition-colors"
                    title={item.is_read ? 'Mark as unread' : 'Mark as read'}
                  >
                    <Check size={14} className={item.is_read ? 'text-zinc-500' : 'text-[#FF6B4A]'} />
                  </button>

                  <button
                    onClick={(e) => deleteNotification(item.id, e)}
                    className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        )}
      </div>

      {/* ── PAGINATION CONTROLS ── */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-divider pt-4 text-xs text-muted">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1} &ndash;{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredNotifications.length)} of {filteredNotifications.length}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-card-bg border border-divider hover:bg-white/[0.04] disabled:opacity-40 disabled:pointer-events-none text-main transition-colors"
            >
              Previous
            </button>
            <span className="px-2 font-mono text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-card-bg border border-divider hover:bg-white/[0.04] disabled:opacity-40 disabled:pointer-events-none text-main transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
