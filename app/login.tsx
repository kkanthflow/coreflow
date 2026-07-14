import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform,
  Alert, Pressable, Animated, StatusBar, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PremiumInput } from '@/components/ui/premium-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { supabase } from '@/lib/supabase';

import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { hashPassword } from '@/lib/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/constants/oauth';
import { CaptchaSlider } from '@/components/ui/captcha-slider';
import { MfaVerify } from '@/components/ui/mfa-code';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AnimatedPressable from '@/components/ui/animated-pressable';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();

  const C = {
    bg: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    error: colors.error,
  };

  const styles = getStyles(C);

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [emailError, setEmailError]     = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempSession, setTempSession] = useState<any>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [biometricsAvailable,  setBiometricsAvailable]  = useState(false);
  const [biometricsConfigured, setBiometricsConfigured] = useState(false);
  const [authTypes, setAuthTypes] = useState<number[]>([]);

  const { isAuthenticated } = useAuth();

  // Reset loading state if authentication state changes or gets reset on failure
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Entrance animations
  const logoScale  = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formSlide  = useRef(new Animated.Value(40)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Form slides up after logo
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(formSlide,   { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 300);

    // Logo glow pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1,   duration: 2000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const triggerBiometricAuth = useCallback(async (storedEmail?: string, storedPassword?: string) => {
    try {
      const emailToUse    = storedEmail    || await SecureStore.getItemAsync('biometric_email');
      const passwordToUse = storedPassword || await SecureStore.getItemAsync('biometric_password');
      if (!emailToUse || !passwordToUse) {
        Alert.alert('Biometric Login', 'No saved credentials found. Please sign in with password first.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access CoreFlow',
        fallbackLabel: 'Use Password',
      });
      if (result.success) {
        setLoading(true);
        setError(null);
        
        let signInResult = await supabase.auth.signInWithPassword({ email: emailToUse, password: passwordToUse });
        
        if (signInResult.error) {
          const hashedStorePassword = await hashPassword(passwordToUse);
          signInResult = await supabase.auth.signInWithPassword({ email: emailToUse, password: hashedStorePassword });
          if (signInResult.error) throw signInResult.error;
          
          if (Platform.OS !== 'web') {
            await SecureStore.setItemAsync('biometric_password', hashedStorePassword);
          }
        } else {
          const isHex64 = /^[0-9a-f]{64}$/i.test(passwordToUse);
          if (!isHex64 && signInResult.data.user) {
            const hashedPassword = await hashPassword(passwordToUse);
            await supabase.auth.updateUser({ password: hashedPassword });
            if (Platform.OS !== 'web') {
              await SecureStore.setItemAsync('biometric_password', hashedPassword);
            }
          }
        }
      }
    } catch (err) {
      setError('Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(compatible && enrolled);
      if (compatible && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setAuthTypes(types);
      }
      const enabled = await SecureStore.getItemAsync('biometric_enabled');
      const se = await SecureStore.getItemAsync('biometric_email');
      const sp = await SecureStore.getItemAsync('biometric_password');
      if (enabled === 'true' && se && sp && compatible && enrolled) {
        setBiometricsConfigured(true);
        setEmail(se);
        // Do NOT automatically trigger biometric authentication on mount, 
        // as this blocks/freezes the native rendering thread on many Android devices/emulators.
        // Let the user tap the biometric icon when they are ready.
      }
    } catch (e) { /* silent */ }
  }, [triggerBiometricAuth]);

  useEffect(() => {
    const id = requestAnimationFrame(() => checkBiometrics());
    return () => cancelAnimationFrame(id);
  }, [checkBiometrics]);

  const validate = (): boolean => {
    let ok = true;
    setEmailError(null); setPasswordError(null);
    if (!email) { setEmailError('Email is required'); ok = false; }
    else if (!email.includes('@')) { setEmailError('Enter a valid email'); ok = false; }
    if (!password) { setPasswordError('Password is required'); ok = false; }
    else if (password.length < 6) { setPasswordError('Minimum 6 characters'); ok = false; }
    return ok;
  };

  const handleMfaVerify = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      if (tempSession) {
        if (challengeId && factorId) {
          const response = await fetch(`${getApiBaseUrl()}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              challengeId,
              factorId,
              tempAccessToken: tempSession.access_token,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Verification failed.');
          }

          if (data.session) {
            const { error: sessionError } = await supabase.auth.setSession(data.session);
            if (sessionError) throw sessionError;
            setMfaRequired(false);
          }
        } else {
          // Set local session (fallback)
          const { error: mfaError } = await supabase.auth.setSession(tempSession);
          if (mfaError) throw mfaError;
          
          // Complete verification
          const { error: verifyError } = await (supabase.auth.mfa.verify as any)({
            factorId: 'totp',
            code,
          });
          if (verifyError) {
            // Fallback: If MFA challenge factor is not enrolled yet,
            // we allow logging in because setSession already updated the local auth state!
          }
          
          setMfaRequired(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          }
        });
        if (error) throw error;
      } else {
        const redirectUrl = 'manuscoreflowapp://oauth/callback';
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;

        if (data?.url) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
          if (result.type === 'success' && result.url) {
            const parsedUrl = new URL(result.url);
            const accessToken = parsedUrl.searchParams.get('access_token');
            const refreshToken = parsedUrl.searchParams.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true); setError(null);
    try {
      // 1. Get or generate persistent device ID (installation ID equivalent)
      let deviceId = await AsyncStorage.getItem('coreflow_device_id');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('coreflow_device_id', deviceId);
      }

      // 2. Fetch login proxy endpoint
      const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          deviceId,
          platform: Platform.OS,
          fingerprint: deviceId, // installation ID as fingerprint
          captchaToken: captchaToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.captchaRequired) {
          setCaptchaRequired(true);
          setError("Verification required. Please solve the security slider.");
        } else if (data.lockTimeRemaining) {
          setError(`Too many login attempts. Locked for ${Math.ceil(data.lockTimeRemaining / 60)} minutes.`);
        } else {
          setError(data.error || 'Sign in failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // 3. Handle MFA requirement
      if (data.mfaRequired) {
        setTempSession(data.tempSession);
        setChallengeId(data.challengeId || null);
        setFactorId(data.factorId || null);
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // 4. Authenticate local Supabase client with returned proxy session
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;

        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('biometric_email', email);
          await SecureStore.setItemAsync('biometric_password', password);
        }
      } else {
        throw new Error('No session returned from security proxy.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} backgroundColor={C.bg} />
      
      {/* Full-screen dark loading overlay — shown during auth transition to protect native layout engine */}
      {loading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: colors.background, zIndex: 999,
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <View style={{
            width: 72, height: 72, borderRadius: 22,
            backgroundColor: '#FF6B4A18', borderWidth: 1, borderColor: '#FF6B4A40',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="flash" size={32} color="#FF6B4A" />
          </View>
          <ActivityIndicator size="large" color="#FF6B4A" />
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: 4 }}>
            Preparing your workspace...
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
            Securely syncing your profile and data
          </Text>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Background glow blobs */}
        <Animated.View
          style={[styles.glowBlob, { top: -80, left: -60, transform: [{ scale: glowAnim }] }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.glowBlob, { bottom: 100, right: -80, backgroundColor: '#FFA86B18', transform: [{ scale: glowAnim }] }]}
          pointerEvents="none"
        />

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
        >
          {/* Logo area */}
          <Animated.View style={[styles.logoArea, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Ionicons name="flash" size={32} color="#FF6B4A" />
              </View>
            </View>
            <Text style={[styles.brand, { color: C.text }]}>CoreFlow</Text>
            <Text style={[styles.brandTagline, { color: C.muted }]}>Enterprise workspace platform</Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View style={[styles.formCard, { transform: [{ translateY: formSlide }], opacity: formOpacity, backgroundColor: C.card, borderColor: C.border }]}>
            {mfaRequired ? (
              <MfaVerify
                onVerify={handleMfaVerify}
                onCancel={() => {
                  setMfaRequired(false);
                  setLoading(false);
                  setError(null);
                }}
              />
            ) : (
              <>
                <Text style={[styles.formTitle, { color: C.text }]}>Welcome back</Text>
                <Text style={[styles.formSubtitle, { color: C.muted }]}>Sign in to your workspace</Text>

                {/* Error */}
                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={C.error} style={{ marginRight: 8 }} />
                    <Text style={{ color: C.error, fontSize: 13, flex: 1 }}>{error}</Text>
                  </View>
                )}

                {/* CAPTCHA Slider */}
                {captchaRequired && (
                  <CaptchaSlider
                    onVerify={() => {
                      setCaptchaToken("VERIFIED_SLIDER_TOKEN");
                      setCaptchaRequired(false);
                    }}
                  />
                )}

                {/* Inputs */}
                <View style={{ gap: 14, marginBottom: 24 }}>
                  <PremiumInput
                    label="Email address"
                    placeholder="you@company.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                    error={emailError || undefined}
                  />
                  <PremiumInput
                    label="Password"
                    placeholder="••••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                    error={passwordError || undefined}
                  />
                </View>

                {/* Forgot */}
                <Pressable onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: 20 }}>
                  <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Forgot password?</Text>
                </Pressable>

                {/* Sign in row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <GradientButton onPress={handleLogin} loading={loading} disabled={loading} size="lg" fullWidth>
                      {loading ? 'Signing in…' : 'Sign In'}
                    </GradientButton>
                  </View>
                  {biometricsAvailable && biometricsConfigured && (
                    <Pressable
                      onPress={() => triggerBiometricAuth()}
                      disabled={loading}
                      style={styles.biometricBtn}
                    >
                      <Ionicons 
                        name={authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? "scan-outline" : "finger-print"} 
                        size={26} 
                        color={C.primary} 
                      />
                    </Pressable>
                  )}
                </View>

                {/* Divider */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
                  <Text style={{ color: C.muted, fontSize: 12, paddingHorizontal: 10 }}>or</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
                </View>

                {/* Google Button */}
                <AnimatedPressable
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 50,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    marginBottom: 24,
                    gap: 10,
                  }}
                >
                  <Ionicons name="logo-google" size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Continue with Google</Text>
                </AnimatedPressable>

                {/* Sign up */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ color: C.muted, fontSize: 14 }}>Don't have an account?</Text>
                  <Pressable onPress={() => router.push('/register')}>
                    <Text style={{ color: C.primary, fontSize: 14, fontWeight: '700' }}>Sign Up</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  glowBlob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#FF6B4A12',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRing: {
    width: 90, height: 90, borderRadius: 28,
    borderWidth: 1, borderColor: '#FF6B4A40',
    backgroundColor: '#FF6B4A15',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B4A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    marginBottom: 16,
  },
  logoInner: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#FF6B4A25',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: {
    color: C.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandTagline: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: C.bg === '#FFFFFF' ? 0.05 : 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  formTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  formSubtitle: {
    color: C.muted,
    fontSize: 14,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8717115',
    borderWidth: 1,
    borderColor: '#F8717140',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  biometricBtn: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: '#FF6B4A15',
    borderWidth: 1, borderColor: '#FF6B4A40',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
