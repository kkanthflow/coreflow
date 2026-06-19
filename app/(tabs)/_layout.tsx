import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, Pressable, Text, Animated, StyleSheet } from "react-native";
import { useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";

// Colors hardcoded to avoid flash during navigation
const COLORS = {
  bg:       '#111118',
  border:   '#2A2A3A',
  primary:  '#FF6B4A',
  inactive: '#5A5A70',
  text:     '#F5F5FA',
  navBg:    '#07070B',
};

import { useColors } from "@/hooks/use-colors";

function TabIcon({ name, focused, label }: { name: keyof typeof Ionicons.glyphMap; focused: boolean; label: string }) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: focused ? 1.15 : 1, useNativeDriver: true, tension: 300, friction: 10 }),
      Animated.timing(glowAnim,  { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [focused]);

  return (
    <View style={styles.tabItem}>
      {focused && (
        <View style={[styles.activeIndicator, { backgroundColor: colors.primary, shadowColor: colors.primary }]} />
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const canViewMeetings = hasPermission(user?.role, "schedule_meetings");

  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight  = 68 + bottomPadding;

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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "home" : "home-outline"} focused={focused} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          href: canViewMeetings ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} label="Meetings" />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "briefcase" : "briefcase-outline"} focused={focused} label="Projects" />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: user?.role === "freelancer" ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "bar-chart" : "bar-chart-outline"} focused={focused} label="Analytics" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: user?.role === "freelancer" ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} focused={focused} label="Chat" />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "person" : "person-outline"} focused={focused} label="Profile" />,
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
});
