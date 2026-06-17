import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { useAuth } from '@/hooks/use-auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    setEmailError(null);

    if (!email) {
      setEmailError('Email is required');
      return false;
    }

    if (!email.includes('@')) {
      setEmailError('Please enter a valid email');
      return false;
    }

    return true;
  };

  const handleRequestReset = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  if (success) {
    return (
      <ScreenContainer className="justify-center p-6">
        <View className="items-center gap-4">
          <Text className="text-3xl font-bold text-foreground text-center">Check Your Email</Text>
          <Text className="text-base text-muted text-center">
            We&apos;ve sent a password reset link to {email}
          </Text>
          <Text className="text-sm text-muted text-center mt-4">
            Follow the link in the email to reset your password. If you don&apos;t see the email, check your spam folder.
          </Text>

          <PremiumButton
            variant="primary"
            size="lg"
            onPress={handleBackToLogin}
            className="w-full mt-8"
          >
            Back to Login
          </PremiumButton>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScreenContainer className="justify-between p-6">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* Header */}
          <View className="mt-12 mb-8">
            <Text className="text-4xl font-bold text-foreground mb-2">Reset Password</Text>
            <Text className="text-base text-muted">Enter your email to receive a password reset link</Text>
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
          </View>

          {/* Submit Button */}
          <PremiumButton
            variant="primary"
            size="lg"
            onPress={handleRequestReset}
            disabled={loading}
            loading={loading}
            className="w-full mb-4"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </PremiumButton>

          {/* Back to Login Link */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-base text-muted">Remember your password?</Text>
            <PremiumButton
              variant="ghost"
              size="sm"
              onPress={handleBackToLogin}
              disabled={loading}
            >
              Sign In
            </PremiumButton>
          </View>
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
