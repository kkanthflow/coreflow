import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, Pressable, Text, StyleSheet } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";

// Route details mapping helper
const TAB_DETAILS: Record<string, { label: string; activeIcon: keyof typeof Ionicons.glyphMap; inactiveIcon: keyof typeof Ionicons.glyphMap }> = {
  home: { label: "Home", activeIcon: "home", inactiveIcon: "home-outline" },
  projects: { label: "Projects", activeIcon: "briefcase", inactiveIcon: "briefcase-outline" },
  chat: { label: "Chat", activeIcon: "chatbubbles", inactiveIcon: "chatbubbles-outline" },
  menu: { label: "Profile", activeIcon: "person", inactiveIcon: "person-outline" },
};

// Animated Tab Item Component
function AnimatedTabButton({
  route,
  isFocused,
  index,
  activeIndex,
  unreadChatCount,
  onPress,
  colors,
}: {
  route: any;
  isFocused: boolean;
  index: number;
  activeIndex: any;
  unreadChatCount: number;
  onPress: () => void;
  colors: any;
}) {
  const details = TAB_DETAILS[route.name] || { label: route.name, activeIcon: "alert-circle", inactiveIcon: "alert-circle-outline" };
  const distance = useDerivedValue(() => Math.abs(activeIndex.value - index));

  // Bubble rising animation
  const translateY = useDerivedValue(() => {
    return interpolate(distance.value, [0, 1], [-20, 0], Extrapolation.CLAMP);
  });

  // Neighbor shifting animation (fluid morphing effect)
  const translateX = useDerivedValue(() => {
    const activeIdx = activeIndex.value;
    if (index < activeIdx) {
      return interpolate(activeIdx - index, [0, 1, 2], [0, -6, 0], Extrapolation.CLAMP);
    } else if (index > activeIdx) {
      return interpolate(index - activeIdx, [0, 1, 2], [0, 6, 0], Extrapolation.CLAMP);
    }
    return 0;
  });

  // Icon scaling
  const iconScale = useDerivedValue(() => {
    return interpolate(distance.value, [0, 1], [1.15, 1], Extrapolation.CLAMP);
  });

  // Bubble dimensions
  const bubbleScale = useDerivedValue(() => {
    return interpolate(distance.value, [0, 0.4], [1, 0.4], Extrapolation.CLAMP);
  });

  const bubbleOpacity = useDerivedValue(() => {
    return interpolate(distance.value, [0, 0.4], [1, 0], Extrapolation.CLAMP);
  });

  // Label slide-and-fade
  const labelOpacity = useDerivedValue(() => {
    return interpolate(distance.value, [0, 0.25], [1, 0], Extrapolation.CLAMP);
  });

  const labelTranslateY = useDerivedValue(() => {
    return interpolate(distance.value, [0, 0.25], [-4, 6], Extrapolation.CLAMP);
  });

  // Apply Animated Styles
  const animatedButtonContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(translateY.value, { damping: 14, stiffness: 220 }) },
      { translateX: withSpring(translateX.value, { damping: 14, stiffness: 220 }) },
    ],
  }));

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(bubbleScale.value, { damping: 12, stiffness: 180 }) }],
    opacity: withSpring(bubbleOpacity.value, { damping: 12, stiffness: 180 }),
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(iconScale.value, { damping: 14, stiffness: 220 }) }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: withSpring(labelOpacity.value, { damping: 14, stiffness: 220 }),
    transform: [{ translateY: withSpring(labelTranslateY.value, { damping: 14, stiffness: 220 }) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      style={styles.tabContainer}
    >
      <Reanimated.View style={[styles.innerContainer, animatedButtonContainerStyle]}>
        {/* Floating Bubble Background */}
        <Reanimated.View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
            animatedBubbleStyle,
          ]}
        />

        {/* Tab Icon */}
        <Reanimated.View style={animatedIconStyle}>
          <Ionicons
            name={isFocused ? details.activeIcon : details.inactiveIcon}
            size={22}
            color={isFocused ? "#FFFFFF" : colors.muted}
          />
          {route.name === "chat" && unreadChatCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </Text>
            </View>
          )}
        </Reanimated.View>
      </Reanimated.View>

      {/* Floating Active Label */}
      <Reanimated.View style={[styles.labelWrapper, animatedLabelStyle]}>
        <Text style={[styles.label, { color: colors.primary }]}>{details.label}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

// Custom Premium Dock Tab Bar
function CustomTabBar({
  state,
  navigation,
  colors,
  insets,
  unreadChatCount,
  hasWorkspacePermission,
}: any) {
  const activeIndex = useSharedValue(state.index);

  useEffect(() => {
    activeIndex.value = state.index;
  }, [state.index]);

  // Filter routes based on permissions
  const visibleRoutes = state.routes.filter((route: any) => {
    if (route.name === "meetings" || route.name === "analytics") return false;
    if (route.name === "projects" && !hasWorkspacePermission("project.view")) return false;
    if (route.name === "chat" && !hasWorkspacePermission("chat.view")) return false;
    return true;
  });

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          bottom: Platform.OS === "web" ? 16 : Math.max(insets.bottom, 12),
        },
      ]}
    >
      {visibleRoutes.map((route: any, index: number) => {
        const actualIndex = state.routes.indexOf(route);
        const isFocused = state.index === actualIndex;

        const handlePress = () => {
          activeIndex.value = withSpring(index, { damping: 15, stiffness: 180 });
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <AnimatedTabButton
            key={route.key}
            route={route}
            isFocused={isFocused}
            index={index}
            activeIndex={activeIndex}
            unreadChatCount={unreadChatCount}
            onPress={handlePress}
            colors={colors}
          />
        );
      })}
    </View>
  );
}

// Main Tab Layout Wrapper
export default function TabLayout() {
  const { user, hasWorkspacePermission } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: memberships } = await supabase
        .from("channel_members")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id);

      let totalUnread = 0;

      if (memberships) {
        for (const mem of memberships) {
          const lastRead = mem.last_read_at || new Date(0).toISOString();

          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", mem.channel_id)
            .gt("created_at", lastRead)
            .neq("sender_id", user.id);

          totalUnread += count || 0;
        }
      }
      setUnreadChatCount(totalUnread);
    } catch (err) {
      console.warn("Error fetching unread count:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUnreadCount();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`chat:tab-badges-updates:${uniqueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        fetchUnreadCount();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_members" }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUnreadCount]);

  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          colors={colors}
          insets={insets}
          unreadChatCount={unreadChatCount}
          hasWorkspacePermission={hasWorkspacePermission}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        lazy: false,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="menu" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    width: "90%",
    maxWidth: 500,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    overflow: "visible",
  },
  tabContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  innerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },
  bubble: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  labelWrapper: {
    position: "absolute",
    bottom: -16,
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
});
