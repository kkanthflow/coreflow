import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Registration Mode
  const [accountType, setAccountType] = useState<'join' | 'create' | 'freelancer'>('join');
  
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('general_member'); // Default for joining
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    let isValid = true;

    if (!fullName) {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    }

    if (accountType !== 'freelancer' && !organization) {
      newErrors.organization = 'Organization is required';
      isValid = false;
    }

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Check if organization exists (skip for freelancers)
      let orgId = null;
      let existingOrg = null;
      
      if (accountType !== 'freelancer') {
        const { data: orgData, error: orgSearchError } = await supabase
          .from('organizations')
          .select('id')
          .eq('name', organization)
          .single();

        if (orgSearchError && orgSearchError.code !== 'PGRST116') { // PGRST116 is not found
          throw orgSearchError;
        }
        existingOrg = orgData;

        if (accountType === 'join' && !existingOrg) {
          throw new Error('Organization not found. Please check the name or create a new one.');
        }
        if (accountType === 'create' && existingOrg) {
          throw new Error('Organization already exists. Please join it or choose a different name.');
        }
      }

      // 2. Sign up the user
      let userId = null;
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: accountType === 'freelancer' ? 'freelancer' : undefined,
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw new Error('This email is already registered. Please sign in instead.');
          userId = signInData.user?.id;
        } else {
          throw signUpError;
        }
      } else {
        userId = authData.user?.id;
      }
      
      if (!userId) throw new Error('Failed to get user ID after registration');

      if (accountType !== 'freelancer') {
        if (accountType === 'join' && existingOrg) {
          orgId = existingOrg.id;
          const assignedRole = role || 'employee';
          
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({ user_id: userId, org_id: orgId, role: assignedRole });
          if (linkError) throw linkError;

          await supabase.from('users').update({ role: assignedRole }).eq('id', userId);
        } else if (accountType === 'create') {
          const { data: newOrg, error: createOrgError } = await supabase
            .from('organizations')
            .insert({ name: organization })
            .select('id')
            .single();
            
          if (createOrgError) throw createOrgError;
          orgId = newOrg.id;
          
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({ user_id: userId, org_id: orgId, role: 'owner' });
          if (linkError) throw linkError;

          await supabase.from('users').update({ role: 'owner' }).eq('id', userId);
        }
      }

      await refreshUser();
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      console.error(err);
      
      let errorMessage = 'Registration failed. Please try again.';
      if (err instanceof Error || err?.message) {
        const rawMessage = err.message || err.toString();
        
        // Map generic Supabase/Postgres errors to user-friendly messages
        if (rawMessage.includes('User already registered') || rawMessage.includes('Database error saving new user') || rawMessage.includes('duplicate key value violates unique constraint "users_email_key"')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (rawMessage.includes('organizations_name_key')) {
          errorMessage = 'This organization name is already registered.';
        } else {
          errorMessage = rawMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.back();
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
            <Text className="text-4xl font-bold text-foreground mb-2">Create Account</Text>
            <Text className="text-base text-muted">Join CoreFlow today</Text>
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
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
              error={errors.fullName || undefined}
            />

            <PremiumInput
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              error={errors.email || undefined}
            />

            {/* Account Type Selector */}
            <View className="mb-4">
              <Text className="text-base font-bold text-foreground mb-3">I want to...</Text>
              
              <View className="gap-2">
                <Pressable 
                  className={`flex-row items-center p-3 rounded-xl border ${accountType === 'join' ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onPress={() => setAccountType('join')}
                >
                  <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${accountType === 'join' ? 'border-primary' : 'border-muted'}`}>
                    {accountType === 'join' && <View className="w-3 h-3 rounded-full bg-primary" />}
                  </View>
                  <Text className="text-base text-foreground font-medium">Join an existing organization</Text>
                </Pressable>

                <Pressable 
                  className={`flex-row items-center p-3 rounded-xl border ${accountType === 'create' ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onPress={() => setAccountType('create')}
                >
                  <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${accountType === 'create' ? 'border-primary' : 'border-muted'}`}>
                    {accountType === 'create' && <View className="w-3 h-3 rounded-full bg-primary" />}
                  </View>
                  <Text className="text-base text-foreground font-medium">Create a new organization</Text>
                </Pressable>

                <Pressable 
                  className={`flex-row items-center p-3 rounded-xl border ${accountType === 'freelancer' ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onPress={() => setAccountType('freelancer')}
                >
                  <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${accountType === 'freelancer' ? 'border-primary' : 'border-muted'}`}>
                    {accountType === 'freelancer' && <View className="w-3 h-3 rounded-full bg-primary" />}
                  </View>
                  <Text className="text-base text-foreground font-medium">Register as a Freelancer</Text>
                </Pressable>
              </View>
            </View>

            {accountType !== 'freelancer' && (
              <>
                <PremiumInput
                  label={accountType === 'create' ? "New Organization Name" : "Organization Name to Join"}
                  placeholder="Acme Corp"
                  value={organization}
                  onChangeText={setOrganization}
                  editable={!loading}
                  error={errors.organization || undefined}
                />

                {accountType === 'join' && (
                  <View className="mb-4">
                    <Text className="text-sm font-bold text-foreground mb-2 ml-1">Select Your Role</Text>
                    <View className="border border-border rounded-xl overflow-hidden bg-surface">
                      {[
                        { value: 'administrator',   label: 'Administrator',   desc: 'Org-wide management' },
                        { value: 'director',        label: 'Director',        desc: 'Senior leadership' },
                        { value: 'senior_manager',  label: 'Senior Manager',  desc: 'Cross-team leadership' },
                        { value: 'manager',         label: 'Manager',         desc: 'Team management' },
                        { value: 'team_lead',       label: 'Team Lead',       desc: 'Frontline leadership' },
                        { value: 'senior_employee', label: 'Senior Employee', desc: 'Experienced contributor' },
                        { value: 'employee',        label: 'Employee',        desc: 'Team member' },
                        { value: 'intern',          label: 'Intern',          desc: 'Entry level' },
                        { value: 'freelancer',      label: 'Freelancer',      desc: 'External contractor' },
                      ].map((r, idx, arr) => (
                        <Pressable
                          key={r.value}
                          className={`p-3 flex-row items-center justify-between ${role === r.value ? 'bg-primary/10' : ''}`}
                          style={{ borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderBottomColor: '#E2E8F0' }}
                          onPress={() => setRole(r.value)}
                        >
                          <View>
                            <Text className="text-sm font-semibold text-foreground">{r.label}</Text>
                            <Text className="text-xs text-muted">{r.desc}</Text>
                          </View>
                          {role === r.value && <Ionicons name="checkmark-circle" size={20} color="#1F6FEB" />}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {accountType === 'create' && (
                  <View className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <Text className="text-sm text-primary font-bold mb-1">🏛️ Role: Owner</Text>
                    <Text className="text-xs text-muted">As the founder of this organization, you receive the Owner role — full access to all modules, billing, roles, audit logs, and analytics.</Text>
                  </View>
                )}
              </>
            )}

            <PremiumInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              error={errors.password || undefined}
            />

            <PremiumInput
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
              error={errors.confirmPassword || undefined}
            />
          </View>

          {/* Register Button */}
          <PremiumButton
            variant="primary"
            size="lg"
            onPress={handleRegister}
            disabled={loading}
            loading={loading}
            className="w-full mb-4"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </PremiumButton>

          {/* Sign In Link */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-base text-muted">Already have an account?</Text>
            <PremiumButton
              variant="ghost"
              size="sm"
              onPress={handleSignIn}
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
