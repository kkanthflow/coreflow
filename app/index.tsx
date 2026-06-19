import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useColors } from '@/hooks/use-colors';

// This is the root index — it handles auth-based routing.
// We use this instead of router.replace() inside login/register screens
// to avoid the race condition between navigation and auth state.
export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return; // Wait until auth state is resolved

    if (isAuthenticated && user) {
      // Profile loaded — safe to navigate to portal/tabs based on role
      if (user.role === 'freelancer') {
        router.replace('/freelancer/portal' as any);
      } else {
        router.replace('/(tabs)');
      }
    } else if (!isAuthenticated) {
      // Not logged in — go to login
      router.replace('/login');
    }
    // If isAuthenticated && !user: still loading profile, keep showing spinner
  }, [isLoading, isAuthenticated, user]);

  // Show themed loading screen — never black
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary || "#3B82F6"} />
      <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14, fontWeight: '500' }}>
        Loading CoreFlow...
      </Text>
    </View>
  );
}
