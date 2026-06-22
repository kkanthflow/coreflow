import "../lib/preboot";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, View, ActivityIndicator, StyleSheet } from "react-native";

import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const onAuthScreens = ['login', 'register', 'forgot-password', 'oauth'].includes(currentSegment ?? '');
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
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
            {/* AuthGate: centrally handles auth → navigation decisions.
                Must be inside Stack (navigation tree) to use useRouter/useSegments */}
            <AuthGate />
            <AppNavigator />
            <StatusBar style="auto" />
            </QueryClientProvider>
          </trpc.Provider>
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
