import { View, ActivityIndicator, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

// This is the root index — it acts as a static splash/loading view.
// Centralized AuthGate in _layout.tsx handles all navigation and routing decisions.
// This prevents conflicting router.replace calls from corrupting the Expo Router stack.
export default function Index() {
  const colors = useColors();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary || "#3B82F6"} />
      <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14, fontWeight: '500' }}>
        Loading CoreFlow...
      </Text>
    </View>
  );
}
