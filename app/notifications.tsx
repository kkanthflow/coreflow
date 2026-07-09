import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeFormatDistanceToNow } from '@/lib/utils';

interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  entity_type?: 'meeting' | 'project' | 'task' | 'invoice' | 'chat_channel' | string;
  entity_id?: string;
  action_url?: string;
  related_meeting_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (data && !error) {
        const list = data as DbNotification[];
        setNotifications(list);
        
        // Automatically mark all as read when opening the page
        const hasUnread = list.some(n => !n.is_read);
        if (hasUnread && filter === 'all') {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        }
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    let frameId: number;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (user) {
      frameId = requestAnimationFrame(() => {
        fetchNotifications();
      });

      // Remove any existing channel with this name before creating a new one
      const channelName = `notifications:user:${user.id}`;
      const existing = supabase.getChannels().find(
        (ch: any) => ch.topic === `realtime:${channelName}`
      );
      if (existing) {
        supabase.removeChannel(existing);
      }

      // Subscribe to real-time notifications
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[NotificationsScreen] Realtime channel error');
          }
        });
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, filter, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (!error) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (!error) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationPress = (notification: DbNotification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    // 1. Route directly to action_url if provided
    if (notification.action_url) {
      router.push(notification.action_url as any);
      return;
    }

    // 2. Otherwise route based on entity type and ID
    if (notification.entity_type && notification.entity_id) {
      switch (notification.entity_type) {
        case 'meeting':
          router.push(`/meetings/${notification.entity_id}` as any);
          break;
        case 'project':
          router.push(`/projects/${notification.entity_id}` as any);
          break;
        case 'task':
          router.push(`/tasks/${notification.entity_id}` as any);
          break;
        case 'invoice':
          router.push(`/invoices/${notification.entity_id}` as any);
          break;
        case 'chat_channel':
        case 'chat':
          router.push(`/chat/${notification.entity_id}` as any);
          break;
        default:
          break;
      }
      return;
    }

    // 3. Fallback to legacy related meeting ID
    if (notification.related_meeting_id) {
      router.push(`/meetings/${notification.related_meeting_id}` as any);
    }
  };

  const getNotificationIcon = (type: string, entityType?: string): keyof typeof Ionicons.glyphMap => {
    if (entityType) {
      switch (entityType) {
        case 'project': return 'briefcase-outline';
        case 'task': return 'checkbox-outline';
        case 'invoice': return 'receipt-outline';
        case 'chat_channel':
        case 'chat':
          return 'chatbubbles-outline';
        case 'meeting': return 'calendar-outline';
      }
    }

    switch (type) {
      case 'meeting_invite': return 'mail-unread-outline';
      case 'meeting_reminder': return 'alarm-outline';
      case 'role_change': return 'shield-checkmark-outline';
      case 'chat': return 'chatbubbles-outline';
      default: return 'notifications-outline';
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable 
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        </View>

        {notifications.some(n => !n.is_read) && (
          <Pressable onPress={handleMarkAllAsRead}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => {
            setIsLoading(true);
            setFilter('all');
          }}
          style={[
            styles.tab,
            filter === 'all' ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }
          ]}
        >
          <Text style={[styles.tabText, filter === 'all' ? { color: '#FFFFFF' } : { color: colors.foreground }]}>
            All ({notifications.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setIsLoading(true);
            setFilter('unread');
          }}
          style={[
            styles.tab,
            filter === 'unread' ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }
          ]}
        >
          <Text style={[styles.tabText, filter === 'unread' ? { color: '#FFFFFF' } : { color: colors.foreground }]}>
            Unread ({notifications.filter(n => !n.is_read).length})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.muted} style={{ marginBottom: 16, opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Clear Inbox</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            You don't have any {filter === 'unread' ? 'unread' : ''} notifications at the moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleNotificationPress(item)}
              style={[
                styles.card,
                item.is_read ? { borderColor: colors.border, opacity: 0.7 } : { borderColor: `${colors.primary}40` },
                { backgroundColor: colors.surface }
              ]}
            >
              <View 
                style={[
                  styles.iconBox,
                  { backgroundColor: item.is_read ? `${colors.muted}15` : `${colors.primary}15` }
                ]}
              >
                <Ionicons 
                  name={getNotificationIcon(item.type, item.entity_type)} 
                  size={20} 
                  color={item.is_read ? colors.muted : colors.primary} 
                />
              </View>

              <View style={styles.cardDetails}>
                <Text 
                  style={[
                    styles.cardTitle,
                    item.is_read ? { fontWeight: '600' } : { fontWeight: '800' },
                    { color: colors.foreground }
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.cardMsg, { color: colors.muted }]}>
                  {item.message}
                </Text>
                <Text style={[styles.cardTime, { color: colors.muted }]}>
                  {safeFormatDistanceToNow(item.created_at, { addSuffix: true })}
                </Text>
              </View>

              <View style={styles.cardActions}>
                {!item.is_read && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]} />
                )}
                <Pressable 
                  onPress={() => handleDelete(item.id)}
                  style={[styles.deleteBtn, { backgroundColor: `${colors.error}10` }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  markAll: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  cardMsg: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 11,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
  },
});

