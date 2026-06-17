import React, { useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/use-colors';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsConfigured, setBiometricsConfigured] = useState(false);

  const triggerBiometricAuth = useCallback(async (storedEmail?: string, storedPassword?: string) => {
    try {
      const emailToUse = storedEmail || await SecureStore.getItemAsync('biometric_email');
      const passwordToUse = storedPassword || await SecureStore.getItemAsync('biometric_password');

      if (!emailToUse || !passwordToUse) {
        Alert.alert("Biometric Login", "Biometric credentials not found. Please log in with password once.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access CoreFlow',
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        setLoading(true);
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: passwordToUse,
        });

        if (signInError) throw signInError;
        // ✅ Auth state change fires → AuthProvider fetches profile → index.tsx navigates
        // Do NOT call router.replace here — avoids race condition with profile loading
      }
    } catch (err) {
      console.error(err);
      setError('Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const checkBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(compatible && enrolled);

      const enabled = await SecureStore.getItemAsync('biometric_enabled');
      const storedEmail = await SecureStore.getItemAsync('biometric_email');
      const storedPassword = await SecureStore.getItemAsync('biometric_password');

      if (enabled === 'true' && storedEmail && storedPassword && compatible && enrolled) {
        setBiometricsConfigured(true);
        // Pre-fill email to show which account is configured
        setEmail(storedEmail);
        // Auto trigger biometric prompt
        setTimeout(() => {
          triggerBiometricAuth(storedEmail, storedPassword);
        }, 500);
      }
    } catch (e) {
      console.warn('Error checking biometrics:', e);
    }
  }, [triggerBiometricAuth]);

  React.useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      checkBiometrics();
    });
    return () => cancelAnimationFrame(frameId);
  }, [checkBiometrics]);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!email.includes('@')) {
      setEmailError('Please enter a valid email');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      
      // Save credentials for biometric login
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('biometric_email', email);
        await SecureStore.setItemAsync('biometric_password', password);
        await SecureStore.setItemAsync('biometric_enabled', 'true');
      }
      
      // ✅ Auth state change fires → AuthProvider fetches profile → index.tsx navigates
      // Do NOT call router.replace here — avoids the black screen race condition
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/register');
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScreenContainer className="justify-between p-6">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* Header */}
          <View className="mt-12 mb-8">
            <Text className="text-4xl font-bold text-foreground mb-2">Welcome</Text>
            <Text className="text-base text-muted">Sign in to CoreFlow</Text>
          </View>

          {/* Error Message */}
          {error && (
            <View className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          )}

          {/* Form */}
          <View className="gap-4 mb-8">
            <PremiumInput
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              error={emailError || undefined}
            />

            <PremiumInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              error={passwordError || undefined}
            />
          </View>

          {/* Forgot Password Link */}
          <PremiumButton
            variant="ghost"
            size="sm"
            onPress={handleForgotPassword}
            disabled={loading}
            className="mb-6 self-start"
          >
            Forgot Password?
          </PremiumButton>

          {/* Login Button with Biometrics Option */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <PremiumButton
                variant="primary"
                size="lg"
                onPress={handleLogin}
                disabled={loading}
                loading={loading}
                className="w-full"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </PremiumButton>
            </View>
            
            {biometricsAvailable && biometricsConfigured && (
              <Pressable
                onPress={() => triggerBiometricAuth()}
                disabled={loading}
                className="w-14 h-14 rounded-2xl items-center justify-center border border-primary"
                style={{ backgroundColor: `${colors.primary}15`, borderColor: colors.primary }}
              >
                <Ionicons name="finger-print" size={28} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Sign Up Link */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-base text-muted">Don&apos;t have an account?</Text>
            <PremiumButton
              variant="ghost"
              size="sm"
              onPress={handleSignUp}
              disabled={loading}
            >
              Sign Up
            </PremiumButton>
          </View>
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
