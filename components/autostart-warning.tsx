import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Reanimated, { ZoomIn } from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';

export function AutostartWarning() {
  const [visible, setVisible] = useState(false);
  const colors = useColors();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || Platform.OS !== 'android') return;

    const checkDevice = async () => {
      try {
        const hasSeenWarning = await AsyncStorage.getItem('cf_autostart_warning_seen');
        if (hasSeenWarning === 'true') return;

        const manufacturer = (Device.manufacturer || '').toLowerCase();
        const strictOEMs = ['xiaomi', 'oppo', 'vivo', 'realme', 'oneplus', 'huawei', 'redmi', 'poco', 'samsung'];
        
        if (strictOEMs.includes(manufacturer)) {
          setVisible(true);
        }
      } catch (e) {
        console.warn('Failed to check autostart warning', e);
      }
    };

    // Small delay so it doesn't immediately jump in user's face after login
    setTimeout(checkDevice, 1500);
  }, [isAuthenticated]);

  const handleDismiss = async () => {
    await AsyncStorage.setItem('cf_autostart_warning_seen', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
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
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="battery-charging-outline" size={32} color={colors.primary} />
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
            Important Notice
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: 'center',
              marginBottom: 20,
              lineHeight: 20,
            }}
          >
            Your {Device.manufacturer} device may block push notifications when this app is fully closed to save battery.
            {'\n\n'}
            To receive notifications reliably, please go to your phone's Settings and enable <Text style={{fontWeight: '700', color: colors.foreground}}>Autostart</Text> or <Text style={{fontWeight: '700', color: colors.foreground}}>Unrestricted Battery</Text> for this app.
          </Text>

          <Pressable
            onPress={handleDismiss}
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
              I Understand
            </Text>
          </Pressable>
        </Reanimated.View>
      </View>
    </Modal>
  );
}
