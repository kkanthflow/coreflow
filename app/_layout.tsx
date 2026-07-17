import "../lib/preboot";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { ZoomIn } from "react-native-reanimated";
import { Platform, View, ActivityIndicator, StyleSheet, Text, Pressable, AppState, AppStateStatus, Alert, Modal } from "react-native";
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';

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
import { scheduleMeetingLocalNotifications } from '@/lib/notifications-helper';
import * as Crypto from 'expo-crypto';

async function getOrInitDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync('cf_device_id');
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync('cf_device_id', deviceId);
  }
  return deviceId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      const data = notification.request.content.data;
      const senderId = data?.senderId as string | undefined;
      const notifType = data?.type as string | undefined;
      const entityId = data?.entity_id as string | undefined;

      const sessionRes = await supabase.auth.getSession();
      const currentUserId = sessionRes.data.session?.user?.id;

      // Always suppress self-sent notifications
      if (senderId && currentUserId && senderId.toLowerCase() === currentUserId.toLowerCase()) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      // Suppress foreground FCM chat notifications if the user is actively viewing that channel
      // The Realtime listener handles foreground chat notifications instead
      if (notifType === 'chat' && entityId && (global as any).activeChannelId === entityId) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
    } catch (e) {
      console.warn('[NotificationHandler] Error in notification handler:', e);
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

// Global Alert Interceptor Singleton
export class GlobalAlertManager {
  private static showAlertListener: ((title: string, message?: string, buttons?: any[]) => void) | null = null;

  static register(listener: (title: string, message?: string, buttons?: any[]) => void) {
    this.showAlertListener = listener;
  }

  static unregister() {
    this.showAlertListener = null;
  }

  static show(title: string, message?: string, buttons?: any[]) {
    if (this.showAlertListener) {
      this.showAlertListener(title, message, buttons);
    } else {
      originalAlert(title, message, buttons);
    }
  }
}

const originalAlert = Alert.alert;
Alert.alert = (title: string, message?: string, buttons?: any[]) => {
  GlobalAlertManager.show(title, message, buttons);
};

function GlobalAlert() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<any[]>([]);
  const colors = useColors();

  useEffect(() => {
    GlobalAlertManager.register((t, m, b) => {
      setTitle(t);
      setMessage(m || '');
      setButtons(b || []);
      setVisible(true);
    });
    return () => {
      GlobalAlertManager.unregister();
    };
  }, []);

  // Monitor network status globally
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) {
        Alert.alert(
          'Internet Connection Error',
          'Your device is offline. Please check your internet connection and try again.'
        );
      }
    });
    return () => unsubscribe();
  }, []);

  if (!visible) return null;

  const isSuccess = title.toLowerCase().includes('success') || title.toLowerCase().includes('complete') || title.toLowerCase().includes('done') || title.toLowerCase().includes('generated') || title.toLowerCase().includes('updated');
  const isError = title.toLowerCase().includes('error') || title.toLowerCase().includes('failed') || title.toLowerCase().includes('invalid');

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => setVisible(false)}
    >
      <Pressable 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        onPress={() => setVisible(false)}
      >
        <Reanimated.View
          entering={ZoomIn.springify().mass(0.8).damping(12).stiffness(160)}
          style={{
            width: '90%',
            maxWidth: 340,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 24,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isSuccess ? `${colors.success}15` : isError ? `${colors.error}15` : `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons 
              name={isSuccess ? "checkmark-circle-outline" : isError ? "alert-circle-outline" : "information-circle-outline"} 
              size={32} 
              color={isSuccess ? colors.success : isError ? colors.error : colors.primary} 
            />
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: colors.foreground,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>

          {message ? (
            <Text
              style={{
                fontSize: 14,
                color: colors.muted,
                textAlign: 'center',
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              {message}
            </Text>
          ) : null}

          <View style={{ width: '100%', gap: 10 }}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setVisible(false);
                    if (btn.onPress) btn.onPress();
                  }}
                  style={({ pressed }) => [
                    {
                      width: '100%',
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: btn.style === 'destructive' ? colors.error : colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    }
                  ]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    {btn.text}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Pressable
                onPress={() => setVisible(false)}
                style={({ pressed }) => [
                  {
                    width: '100%',
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  }
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  Okay
                </Text>
              </Pressable>
            )}
          </View>
        </Reanimated.View>
      </Pressable>
    </Modal>
  );
}

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
  const lastSyncedUserTheme = useRef<string | null>(null);

  // Sync user theme preference to theme provider only when user preference changes
  useEffect(() => {
    if (user?.preferences?.theme && user.preferences.theme !== lastSyncedUserTheme.current) {
      lastSyncedUserTheme.current = user.preferences.theme;
      setColorScheme(user.preferences.theme as any);
    }
  }, [user?.preferences?.theme, setColorScheme]);

  // Check for OTA updates silently — notifies user if one is available
  useOTAUpdates();

  // Trigger background bootstrap queue when authenticated and user context is loaded
  useEffect(() => {
    if (isAuthenticated && user) {
      const { bootstrapQueue } = require("@/lib/bootstrapQueue");
      bootstrapQueue.run().catch((e: any) => {
        console.error('[AuthGate] Failed to run bootstrap queue:', e);
      });
    }
  }, [isAuthenticated, user]);

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
      const isSetupComplete = user && (user.organizationId || user.freelancerType === 'independent' || user.role === 'freelancer');
      
      if (!isSetupComplete && user) {
        // Redirect to register screen to finish workspace/org configuration
        if (currentSegment !== 'register') {
          router.replace('/register');
        }
      } else if (isIndex || onAuthScreens || onFreelancerPortal) {
        router.replace('/(tabs)/home' as any);
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="meetings/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="chat/new-dm" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="projects/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="departments/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
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
    
    // Request notification permissions (delayed to prevent blocking first-render main thread)
    if (Platform.OS !== 'web') {
      setTimeout(() => {
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
      }, 1500);
    }
  }, []);

  // Capture deep links to login/set OAuth session
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;
      
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      const paramPart = hashIndex !== -1 ? url.substring(hashIndex + 1) : (queryIndex !== -1 ? url.substring(queryIndex + 1) : '');
      
      if (!paramPart) return;

      const params = new URLSearchParams(paramPart.replace(/#/g, '&').replace(/\?/g, '&'));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            router.replace('/home' as any);
          }
        } catch (e) {
          console.error('[RootLayout] Failed to set deep-linked session:', e);
        }
      }
    };

    // Get initial URL if the app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Listen for new deep links while the app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
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

      const uniqueId = Math.random().toString(36).substring(7);
      chatChannel = supabase
        .channel(`chat:global-push-notifs:${uniqueId}`)
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
          // Chat Channel (High Importance, lights, vibration)
          await Notifications.setNotificationChannelAsync('chat', {
            name: 'Chat Messages',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            showBadge: true,
          });
          // Meetings Channel
          await Notifications.setNotificationChannelAsync('meetings', {
            name: 'Meetings',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            showBadge: true,
          });
          // Tasks Channel
          await Notifications.setNotificationChannelAsync('tasks', {
            name: 'Tasks',
            importance: Notifications.AndroidImportance.DEFAULT,
            showBadge: true,
          });
          // Fallback Default Channel
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default Alerts',
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
          const devId = await getOrInitDeviceId();
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', userId)
            .eq('device_id', devId);
          return;
        }

        // Get direct native device FCM / APNs token instead of Expo token
        const deviceTokenData = await Notifications.getDevicePushTokenAsync();
        const nativeToken = deviceTokenData.data;

        if (nativeToken) {
          const deviceId = await getOrInitDeviceId();
          const Constants = require('expo-constants').default;
          const appVersion = Constants.expoConfig?.version || '1.0.0';

          await supabase
            .from('user_push_tokens')
            .upsert({
              user_id: userId,
              device_id: deviceId,
              token: nativeToken,
              platform: Platform.OS,
              app_version: appVersion,
              is_enabled: true,
              last_seen_at: new Date().toISOString(),
            });
          console.log('[FCM] Successfully registered native push token for device:', deviceId);
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
        scheduleMeetingLocalNotifications(session.user.id);
      }
    });

    // Listen for push token refreshes dynamically
    const tokenRefreshSubscription = Notifications.addPushTokenListener(async (tokenData) => {
      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (userId && tokenData.data) {
        const deviceId = await getOrInitDeviceId();
        const Constants = require('expo-constants').default;
        const appVersion = Constants.expoConfig?.version || '1.0.0';
        await supabase
          .from('user_push_tokens')
          .upsert({
            user_id: userId,
            device_id: deviceId,
            token: tokenData.data,
            platform: Platform.OS,
            app_version: appVersion,
            is_enabled: true,
            last_seen_at: new Date().toISOString(),
          });
        console.log('[FCM] Auto-refreshed push token in database.');
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        setupRealtimeSubscription(session.user.id);
        registerAndSavePushToken(session.user.id);
        scheduleMeetingLocalNotifications(session.user.id);
      } else {
        if (chatChannel) {
          supabase.removeChannel(chatChannel);
          chatChannel = null;
        }
      }
    });

    return () => {
      tapSubscription.remove();
      tokenRefreshSubscription.remove();
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
              <GlobalAlert />
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
