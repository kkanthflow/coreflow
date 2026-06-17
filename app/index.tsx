import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/lib/auth-context';

// This is the root index — it handles auth-based routing.
// We use this instead of router.replace() inside login/register screens
// to avoid the race condition between navigation and auth state.
export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Wait until auth state is resolved

    if (isAuthenticated && user) {
      // Profile loaded — safe to navigate to tabs
      router.replace('/(tabs)');
    } else if (!isAuthenticated) {
      // Not logged in — go to login
      router.replace('/login');
    }
    // If isAuthenticated && !user: still loading profile, keep showing spinner
  }, [isLoading, isAuthenticated, user]);

  // Show themed loading screen — never black
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: '500' }}>
        Loading CoreFlow...
      </Text>
    </View>
  );
}
