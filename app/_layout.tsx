import "../lib/preboot";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, View, ActivityIndicator } from "react-native";

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

// ─────────────────────────────────────────────────────────────────────────
// AuthGate: Lives inside the navigation tree so useRouter() works correctly.
// Watches auth state and handles ALL navigation decisions centrally.
// This eliminates the black-screen race condition from login screen redirects.
// ─────────────────────────────────────────────────────────────────────────
function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const currentSegment = segments[0] as string | undefined;
    const inTabsGroup = currentSegment === '(tabs)';
    const onAuthScreens =
      currentSegment === 'login' ||
      currentSegment === 'register' ||
      currentSegment === 'forgot-password';
    const onIndex = currentSegment === 'index' || currentSegment === undefined;

    if (isAuthenticated && user) {
      // Freelancers get their own portal
      if (user.role === 'freelancer') {
        const onFreelancerPortal = currentSegment === 'freelancer';
        if (!onFreelancerPortal) {
          router.replace('/freelancer/portal' as any);
        }
        return;
      }

      // Regular users: go to tabs if not already there
      if (!inTabsGroup) {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !user) {
      // Session exists but profile not yet fetched — stay on index spinner
    } else {
      // Not authenticated — send to login
      if (!onAuthScreens) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, user, segments]);

  return null;
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
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="oauth/callback" />
              <Stack.Screen name="login" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="register" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="forgot-password" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="meetings/new" options={{ presentation: 'fullScreenModal' }} />
            </Stack>
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
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
