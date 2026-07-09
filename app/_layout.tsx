import "../lib/preboot";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, View, ActivityIndicator, StyleSheet, Text, Pressable, AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

import "@/lib/_core/nativewind-pressable";
import { ThemeProvider, useThemeContext } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from '@/lib/trpc';
import { initManusRuntime, subscribeSafeAreaInsets } from '@/lib/_core/manus-runtime';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from "@/components/error-boundary";
import { useOTAUpdates } from '@/hooks/use-ota-updates';
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      const senderId = notification.request.content.data?.senderId as string | undefined;
      const sessionRes = await supabase.auth.getSession();
      const currentUserId = sessionRes.data.session?.user?.id;

      if (senderId && currentUserId && senderId.toLowerCase() === currentUserId.toLowerCase()) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
    } catch (e) {
      console.warn('[NotificationHandler] Error checking self-message:', e);
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  initialRouteName: "index",
};

import { useColors } from "@/hooks/use-colors";

// ─────────────────────────────────────────────────────────────────────────
// AuthGate: Lives inside the navigation tree so useRouter() works correctly.
// Watches auth state and handles ALL navigation decisions centrally.
// This eliminates the black-screen race condition from login screen redirects.
// ─────────────────────────────────────────────────────────────────────────
function AuthGate() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useThemeContext();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync user theme preference to theme provider
  useEffect(() => {
    if (user?.preferences?.theme) {
      if (user.preferences.theme !== colorScheme) {
        setColorScheme(user.preferences.theme as any);
      }
    }
  }, [user?.preferences?.theme, colorScheme, setColorScheme]);

  // Check for OTA updates silently — notifies user if one is available
  useOTAUpdates();

  // Fallback timeout for stuck profile loading
  useEffect(() => {
    if (isAuthenticated && !user) {
      stuckTimerRef.current = setTimeout(async () => {
        console.warn('[AuthGate] Profile failed to load after 15s, signing out');
        await logout();
      }, 15000);
    } else {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
    }
    return () => {
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavigationState?.key) return;

    const currentSegment = segments[0] as string | undefined;
    const isIndex = currentSegment === 'index' || currentSegment === undefined || currentSegment === '';
    const onAuthScreens = ['login', 'register', 'forgot-password', 'oauth', 'privacy-policy', 'terms-and-conditions'].includes(currentSegment ?? '');
    const onFreelancerPortal = currentSegment === 'freelancer';

    // Handle fine-grained redirects WITHIN the authenticated stack
    if (isAuthenticated) {
      if (user?.role === 'freelancer') {
        if (!onFreelancerPortal) {
          router.replace('/freelancer/portal' as any);
        }
      } else {
        // If they are on the splash screen, auth screens, or freelancer portal, send them home
        if (isIndex || onAuthScreens || onFreelancerPortal) {
          router.replace('/(tabs)/home' as any);
        }
        // Otherwise, let them navigate freely to tabs, projects, departments, etc.
      }
    } else {
      if (!onAuthScreens) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, user, segments, rootNavigationState?.key]);

  return null;
}

function BiometricAppLock({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const colors = useColors();
  const appState = useRef(AppState.currentState);

  const triggerLock = useCallback(async () => {
    if (Platform.OS === 'web' || !user) return;
    
    // Check if biometrics is enabled in SecureStore
    const isBiometricEnabled = await SecureStore.getItemAsync('biometric_enabled');
    if (isBiometricEnabled !== 'true') return;

    setIsLocked(true);
    authenticate();
  }, [user]);

  const authenticate = async () => {
    if (authenticating) return;
    setAuthenticating(true);
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CoreFlow',
        fallbackLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('[AppLock] Authentication error:', e);
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If returning to active from background, trigger the lock
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        triggerLock();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [triggerLock]);

  // Lock the app initially if biometric is configured, but don't block web
  useEffect(() => {
    if (user && Platform.OS !== 'web') {
      triggerLock();
    }
  }, [user]);

  if (isLocked) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 99999 }]}>
        <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#FF6B4A18', borderWidth: 1, borderColor: '#FF6B4A30', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="lock-closed" size={38} color="#FF6B4A" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.foreground, marginBottom: 8 }}>Workspace Locked</Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 40, textAlign: 'center', paddingHorizontal: 40 }}>
          Use biometric authentication to unlock and access your workspace
        </Text>
        
        <Pressable
          onPress={authenticate}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 14,
            paddingHorizontal: 28,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Unlock Workspace</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

function AppNavigator() {
  const colors = useColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  
  const router = useRouter();

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    try {
      initManusRuntime();
    } catch (e) {
      console.error("[RootLayout] Failed to initialize Manus runtime:", e);
    }
    
    // Request notification permissions
    if (Platform.OS !== 'web') {
      try {
        Notifications.requestPermissionsAsync().then(({ status }) => {
          if (status !== 'granted') {
            console.log('Notification permissions not granted');
          }
        }).catch((e) => {
          console.error("[RootLayout] Failed to request notifications permission:", e);
        });
      } catch (e) {
        console.error("[RootLayout] Notifications permission request threw synchronously:", e);
      }
    }
  }, []);

  // Set up global real-time chat push notification scheduler
  useEffect(() => {
    // Listen for notification taps
    const tapSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (!data) return;

      if (data.action_url) {
        router.push(data.action_url as any);
        return;
      }

      if (data.entity_type && data.entity_id) {
        switch (data.entity_type) {
          case 'meeting':
            router.push(`/meetings/${data.entity_id}` as any);
            break;
          case 'project':
            router.push(`/projects/${data.entity_id}` as any);
            break;
          case 'task':
            router.push(`/tasks/${data.entity_id}` as any);
            break;
          case 'invoice':
            router.push(`/invoices/${data.entity_id}` as any);
            break;
          case 'chat_channel':
            router.push(`/chat/${data.entity_id}` as any);
            break;
          default:
            break;
        }
        return;
      }

      if (data.channelId) {
        router.push(`/chat/${data.channelId}` as any);
      }
    });

    let chatChannel: any = null;

    const setupRealtimeSubscription = async (userId: string) => {
      // Clean up previous subscription if any
      if (chatChannel) {
        supabase.removeChannel(chatChannel);
        chatChannel = null;
      }

      // Startup Catch-up: Mark all undelivered messages sent to this user as delivered
      try {
        const { data: myChannels } = await supabase
          .from('channel_members')
          .select('channel_id')
          .eq('user_id', userId);

        const channelIds = (myChannels || []).map((c: any) => c.channel_id);
        
        if (channelIds.length > 0) {
          await supabase
            .from('chat_messages')
            .update({ delivered_at: new Date().toISOString() })
            .in('channel_id', channelIds)
            .neq('sender_id', userId)
            .is('delivered_at', null);
        }
      } catch (err) {
        console.warn('E2E Delivery catch-up failed:', err);
      }

      chatChannel = supabase
        .channel('chat:global-push-notifs')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
          },
          async (payload: any) => {
            console.log('[GlobalPushNotifs] Received new message payload:', payload.new);
            const sessionRes = await supabase.auth.getSession();
            const currentUserId = sessionRes.data.session?.user?.id || userId;
            const isSelfMessage =
              payload.new.sender_id &&
              currentUserId &&
              payload.new.sender_id.toLowerCase() === currentUserId.toLowerCase();
            if (!isSelfMessage) {
              // Mark as delivered immediately on receipt
              if (!payload.new.delivered_at) {
                supabase
                  .from('chat_messages')
                  .update({ delivered_at: new Date().toISOString() })
                  .eq('id', payload.new.id)
                  .then();
              }

              // Suppress notification if the user is actively viewing this channel
              if ((global as any).activeChannelId === payload.new.channel_id) {
                return;
              }

              // Fetch sender details
              const { data: senderData } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', payload.new.sender_id)
                .single();

              const senderName = senderData?.full_name || 'New Message';
              let body = payload.new.content || '';

              if (body.startsWith('__E2EE__:')) {
                body = '🔒 Encrypted Message';
              }

              Notifications.scheduleNotificationAsync({
                identifier: payload.new.channel_id,
                content: {
                  title: senderName,
                  body: body,
                  data: {
                    channelId: payload.new.channel_id,
                  },
                },
                trigger: null,
              });
            }
          }
        )
        .subscribe();
    };



    const registerAndSavePushToken = async (userId: string) => {
      if (Platform.OS === 'web') return;
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            showBadge: true,
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', userId);
          return;
        }

        // Try to get Expo Push Token using project ID from Constants
        const Constants = require('expo-constants').default;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const token = tokenData.data;

        if (token) {
          await supabase
            .from('user_push_tokens')
            .upsert({ user_id: userId, token });
        }
      } catch (err) {
        console.warn('Failed to register push token:', err);
      }
    };

    // Automatically register push token on startup if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setupRealtimeSubscription(session.user.id);
        registerAndSavePushToken(session.user.id);
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        setupRealtimeSubscription(session.user.id);
        registerAndSavePushToken(session.user.id);
      } else {
        if (chatChannel) {
          supabase.removeChannel(chatChannel);
          chatChannel = null;
        }
      }
    });

    return () => {
      tapSubscription.remove();
      authSubscription.unsubscribe();
      if (chatChannel) {
        supabase.removeChannel(chatChannel);
      }
    };
  }, [router]);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <BiometricAppLock>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <QueryClientProvider client={queryClient}>
              {/* AuthGate: centrally handles auth → navigation decisions.
                  Must be inside Stack (navigation tree) to use useRouter/useSegments */}
              <AuthGate />
              <AppNavigator />
              <StatusBar style="auto" />
              </QueryClientProvider>
            </trpc.Provider>
          </BiometricAppLock>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
