import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';

export default function SecurityScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updatePreferences, requestPasswordReset } = useAuth();

  const [isUpdatingBiometrics, setIsUpdatingBiometrics] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isBiometricEnabled = user?.preferences?.biometricLogin ?? false;

  const handleToggleBiometrics = async (value: boolean) => {
    setIsUpdatingBiometrics(true);
    try {
      if (value) {
        // Check if device supports biometrics
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          Alert.alert('Not Supported', 'Biometric authentication is not set up or supported on this device.');
          setIsUpdatingBiometrics(false);
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          fallbackLabel: 'Use Passcode',
        });

        if (!result.success) {
          setIsUpdatingBiometrics(false);
          return; // User cancelled or failed
        }
      }

      await updatePreferences({ biometricLogin: value });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update security settings');
    } finally {
      setIsUpdatingBiometrics(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    Alert.alert(
      'Reset Password',
      'Are you sure you want to send a password reset link to your email?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Link', 
          onPress: async () => {
            setIsResettingPassword(true);
            try {
              await requestPasswordReset(user.email);
              Alert.alert('Email Sent', 'Check your inbox for password reset instructions.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send reset link');
            } finally {
              setIsResettingPassword(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Security Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Authentication</Text>
        
        <GlassCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="finger-print" size={22} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Biometric Login</Text>
              <Text style={[styles.settingDesc, { color: colors.secondary_text }]}>
                Use Face ID or Touch ID to securely log in
              </Text>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={handleToggleBiometrics}
              disabled={isUpdatingBiometrics}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isBiometricEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <Pressable 
            style={[styles.settingRow, { opacity: isResettingPassword ? 0.5 : 1 }]} 
            onPress={handlePasswordReset}
            disabled={isResettingPassword}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${colors.info}20` }]}>
              <Ionicons name="key" size={22} color={colors.info} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Change Password</Text>
              <Text style={[styles.settingDesc, { color: colors.secondary_text }]}>
                Send a secure reset link to your email
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Session</Text>

        <GlassCard style={styles.card}>
          <Pressable style={styles.settingRow} onPress={() => Alert.alert('Active Sessions', 'You are currently logged into 1 device.')}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.secondary}20` }]}>
              <Ionicons name="desktop" size={22} color={colors.secondary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Active Sessions</Text>
              <Text style={[styles.settingDesc, { color: colors.secondary_text }]}>
                Review devices currently logged into your account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </GlassCard>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginLeft: -8 },
  title: { fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    width: '100%',
  }
});
