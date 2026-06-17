import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { safeFormatDistanceToNow } from '@/lib/utils';

export interface ActivityFeedItem {
  id: string;
  action_type: string;
  action_description: string;
  created_at: string;
  user: {
    full_name: string;
  };
}

export function ActivityFeed() {
  const colors = useColors();
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_feed')
        .select(`
          id,
          action_type,
          action_description,
          created_at,
          users:user_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        setActivities(
          data.map((item: any) => ({
            id: item.id,
            action_type: item.action_type,
            action_description: item.action_description,
            created_at: item.created_at,
            user: { full_name: item.users?.full_name || 'System' },
          }))
        );
      }
    } catch (e) {
      console.error('Error fetching activity feed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      fetchActivities();
    });
    return () => cancelAnimationFrame(frameId);
  }, [fetchActivities]);

  const getIconForAction = (type: string) => {
    switch (type) {
      case 'meeting_created':
        return { name: 'calendar', color: colors.primary };
      case 'meeting_updated':
        return { name: 'calendar-outline', color: colors.secondary };
      case 'role_changed':
        return { name: 'shield-checkmark', color: colors.tertiary };
      case 'user_joined':
        return { name: 'person-add', color: colors.success };
      default:
        return { name: 'flash', color: colors.muted };
    }
  };

  if (isLoading) {
    return (
      <View className="py-8 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View 
        className="p-6 rounded-2xl border border-dashed border-border items-center justify-center"
        style={{ backgroundColor: colors.surface }}
      >
        <Ionicons name="notifications-off-outline" size={32} color={colors.muted} className="mb-2" />
        <Text className="text-sm text-muted">No recent activity</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {activities.map((activity) => {
        const iconInfo = getIconForAction(activity.action_type);
        return (
          <View 
            key={activity.id}
            className="flex-row items-center p-4 rounded-xl border border-border"
            style={{ backgroundColor: colors.surface }}
          >
            <View 
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${iconInfo.color}20` }}
            >
              <Ionicons name={iconInfo.name as any} size={20} color={iconInfo.color} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-foreground font-medium mb-1">
                {activity.action_description}
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted font-medium">
                  {activity.user.full_name}
                </Text>
                <Text className="text-xs text-muted">
                  {safeFormatDistanceToNow(activity.created_at, { addSuffix: true })}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
