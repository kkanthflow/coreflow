import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AccessDeniedScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.iconWrapper, { backgroundColor: `${colors.error}15` }]}>
          <Ionicons name="shield-outline" size={48} color={colors.error} />
        </View>
        
        <Text style={[styles.title, { color: colors.foreground }]}>Access Denied</Text>
        
        <Text style={[styles.description, { color: colors.muted }]}>
          You do not have the required permissions to view this resource. If you believe this is an error, please contact your organization administrator.
        </Text>
        
        <Pressable
          onPress={() => router.replace('/(tabs)/home' as any)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="home-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Go Back Home</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
