import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, Pressable, Text, Animated, StyleSheet } from "react-native";
import { useRef, useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";


function TabIcon({
  name,
  focused,
  label,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
  badge?: number;
}) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  }, [focused]);

  return (
    <View style={styles.tabItem}>
      {focused && (
        <View
          style={[
            styles.activeIndicator,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.iconWrap,
          focused && { backgroundColor: `${colors.primary}18` },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name={name}
          size={22}
          color={focused ? colors.primary : colors.muted}
        />
        {badge !== undefined && badge > 0 && (
          <View
            style={[styles.badgeContainer, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.primary : colors.muted },
          focused && { fontWeight: '700' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}


export default function TabLayout() {
  const { user, hasWorkspacePermission } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const canViewMeetings = hasPermission(user?.role, "schedule_meetings");

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 68 + bottomPadding;

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: memberships } = await supabase
        .from('channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', user.id);

      let totalUnread = 0;

      if (memberships) {
        for (const mem of memberships) {
          const lastRead = mem.last_read_at || new Date(0).toISOString();

          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', mem.channel_id)
            .gt('created_at', lastRead)
            .neq('sender_id', user.id);

          totalUnread += count || 0;
        }
      }
      setUnreadChatCount(totalUnread);
    } catch (err) {
      console.warn('Error fetching unread count:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUnreadCount();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`chat:tab-badges-updates:${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_members' },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_members' },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUnreadCount]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 20,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
        lazy: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "home" : "home-outline"}
              focused={focused}
              label="Home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          href: canViewMeetings ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "calendar" : "calendar-outline"}
              focused={focused}
              label="Meetings"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          href: hasWorkspacePermission("project.view") ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "briefcase" : "briefcase-outline"}
              focused={focused}
              label="Projects"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: hasWorkspacePermission("invoice.view") ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "bar-chart" : "bar-chart-outline"}
              focused={focused}
              label="Analytics"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: hasWorkspacePermission("chat.view") ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              focused={focused}
              label="Chat"
              badge={unreadChatCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? "person" : "person-outline"}
              focused={focused}
              label="Profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    minWidth: 56,
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B4A',
    shadowColor: '#FF6B4A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  iconWrap: {
    width: 44,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});

