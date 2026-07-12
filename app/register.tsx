import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { hashPassword } from '@/lib/crypto';

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Registration Mode
  const [accountType, setAccountType] = useState<'join' | 'create' | 'freelancer'>('join');
  const [freelancerWorkType, setFreelancerWorkType] = useState<'organization' | 'independent'>('organization');
  
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('general_member'); // Default for joining
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [agreed, setAgreed] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    let isValid = true;

    if (!fullName) {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    }

    const needsOrg = accountType !== 'freelancer' || (accountType === 'freelancer' && freelancerWorkType === 'organization');
    if (needsOrg && !organization) {
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

    if (!agreed) {
      newErrors.agreed = 'You must agree to the Privacy Policy and Terms & Conditions to proceed.';
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
      let orgId = null;
      let existingOrg = null;
      const cleanOrgName = organization.trim();
      const needsOrg = accountType !== 'freelancer' || (accountType === 'freelancer' && freelancerWorkType === 'organization');

      if (needsOrg) {
        const { data: orgData, error: orgSearchError } = await supabase
          .from('organizations')
          .select('id')
          .ilike('name', cleanOrgName)
          .maybeSingle();

        if (orgSearchError) {
          throw orgSearchError;
        }
        existingOrg = orgData;

        if ((accountType === 'join' || accountType === 'freelancer') && !existingOrg) {
          throw new Error(`Organization "${cleanOrgName}" not found. Please check the spelling or ask your administrator.`);
        }
        if (accountType === 'create' && existingOrg) {
          throw new Error(`Organization "${cleanOrgName}" already exists. Please join it instead.`);
        }
      }

      // Hash password client-side
      const hashedPassword = await hashPassword(password);

      // 2. Sign up the user
      let userId = null;
      const metaRole = accountType === 'freelancer'
        ? 'freelancer'
        : (accountType === 'create' ? 'owner' : role);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: hashedPassword,
        options: {
          data: {
            full_name: fullName,
            role: metaRole,
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          let signInResult = await supabase.auth.signInWithPassword({ email, password: hashedPassword });
          if (signInResult.error) {
            signInResult = await supabase.auth.signInWithPassword({ email, password });
            if (signInResult.error) throw new Error('This email is already registered. Please sign in instead.');
            
            if (signInResult.data.user) {
              await supabase.auth.updateUser({ password: hashedPassword });
            }
          }
          userId = signInResult.data.user?.id;
        } else {
          throw signUpError;
        }
      } else {
        userId = authData.user?.id;
      }
      
      if (!userId) throw new Error('Failed to get user ID after registration');

      if (accountType === 'freelancer') {
        if (freelancerWorkType === 'organization' && existingOrg) {
          orgId = existingOrg.id;
          
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({ user_id: userId, org_id: orgId, role: 'freelancer' });
          if (linkError) {
            await supabase.auth.signOut();
            throw linkError;
          }

          const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'freelancer', freelancer_type: 'organization' })
            .eq('id', userId);
          if (updateError) {
            await supabase.auth.signOut();
            throw updateError;
          }
        } else {
          // Independent freelancer (no organization link)
          const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'freelancer', freelancer_type: 'independent' })
            .eq('id', userId);
          if (updateError) {
            await supabase.auth.signOut();
            throw updateError;
          }
        }
      } else {
        if (accountType === 'join' && existingOrg) {
          orgId = existingOrg.id;
          const assignedRole = role || 'employee';
          
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({ user_id: userId, org_id: orgId, role: assignedRole });
          if (linkError) {
            await supabase.auth.signOut();
            throw linkError;
          }

          const { error: updateError } = await supabase.from('users').update({ role: assignedRole }).eq('id', userId);
          if (updateError) {
            await supabase.auth.signOut();
            throw updateError;
          }
        } else if (accountType === 'create') {
          const { data: newOrg, error: createOrgError } = await supabase
            .from('organizations')
            .insert({ name: cleanOrgName, default_currency: defaultCurrency })
            .select('id')
            .single();
            
          if (createOrgError) {
            await supabase.auth.signOut();
            throw createOrgError;
          }
          orgId = newOrg.id;
          
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({ user_id: userId, org_id: orgId, role: 'owner' });
          if (linkError) {
            await supabase.auth.signOut();
            throw linkError;
          }

          const { error: updateError } = await supabase.from('users').update({ role: 'owner' }).eq('id', userId);
          if (updateError) {
            await supabase.auth.signOut();
            throw updateError;
          }
        }
      }

      // Refresh the user profile in AuthContext so that it fetches the newly created org/role
      await refreshUser();

      // Do NOT manually navigate — AuthGate in _layout.tsx watches auth state
      // and will redirect to /(tabs) once profile is loaded. Manual navigation
      // here races with onAuthStateChange and causes black screen.

    } catch (err: any) {
      console.error('[RegisterScreen] Registration error:', err);
      
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
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Full-screen dark loading overlay — shown while creating account + during auth transition */}
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
            Setting up your workspace...
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
            Creating your account and organization
          </Text>
        </View>
      )}
      <ScreenContainer className="justify-between p-6">

        <ScrollView 
          style={{ flex: 1 }} 
          keyboardShouldPersistTaps="handled" 
          keyboardDismissMode="on-drag" 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ flexGrow: 1 }}
        >
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

            {accountType === 'freelancer' && (
              <View className="mb-4">
                <Text className="text-base font-bold text-foreground mb-3">How do you want to work?</Text>
                <View className="gap-2">
                  <Pressable 
                    className={`flex-row items-center p-3 rounded-xl border ${freelancerWorkType === 'organization' ? 'border-primary bg-primary/10' : 'border-border'}`}
                    onPress={() => setFreelancerWorkType('organization')}
                  >
                    <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${freelancerWorkType === 'organization' ? 'border-primary' : 'border-muted'}`}>
                      {freelancerWorkType === 'organization' && <View className="w-3 h-3 rounded-full bg-primary" />}
                    </View>
                    <Text className="text-base text-foreground font-medium">Join an Organization</Text>
                  </Pressable>

                  <Pressable 
                    className={`flex-row items-center p-3 rounded-xl border ${freelancerWorkType === 'independent' ? 'border-primary bg-primary/10' : 'border-border'}`}
                    onPress={() => setFreelancerWorkType('independent')}
                  >
                    <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${freelancerWorkType === 'independent' ? 'border-primary' : 'border-muted'}`}>
                      {freelancerWorkType === 'independent' && <View className="w-3 h-3 rounded-full bg-primary" />}
                    </View>
                    <Text className="text-base text-foreground font-medium">Work Independently</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {((accountType !== 'freelancer' && accountType !== 'create') || (accountType === 'freelancer' && freelancerWorkType === 'organization')) && (
              <PremiumInput
                label="Organization Name to Join"
                placeholder="Acme Corp"
                value={organization}
                onChangeText={setOrganization}
                editable={!loading}
                error={errors.organization || undefined}
              />
            )}

            {accountType === 'create' && (
              <PremiumInput
                label="New Organization Name"
                placeholder="Acme Corp"
                value={organization}
                onChangeText={setOrganization}
                editable={!loading}
                error={errors.organization || undefined}
              />
            )}

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
                  <>
                    <View className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <Text className="text-sm text-primary font-bold mb-1">🏛️ Role: Owner</Text>
                      <Text className="text-xs text-muted">As the founder of this organization, you receive the Owner role — full access to all modules, billing, roles, audit logs, and analytics.</Text>
                    </View>

                    <View className="mb-4">
                      <Text className="text-sm font-bold text-foreground mb-2 ml-1">Default Currency</Text>
                      <View className="border border-border rounded-xl overflow-hidden bg-surface py-2">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                          {SUPPORTED_CURRENCIES.map((curr) => {
                            const isSelected = defaultCurrency === curr.code;
                            return (
                              <Pressable
                                key={curr.code}
                                onPress={() => setDefaultCurrency(curr.code)}
                                className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                              >
                                <Text style={{ color: isSelected ? '#FFF' : '#7A7A92', fontSize: 12, fontWeight: '700' }}>
                                  {curr.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
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

          {/* Consent Checkbox */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 20 }}>
            <Pressable
              onPress={() => setAgreed(!agreed)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: agreed ? colors.primary : colors.border,
                backgroundColor: agreed ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel="I agree to the Privacy Policy and Terms & Conditions"
            >
              {agreed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </Pressable>
            
            <Text style={{ color: colors.foreground, fontSize: 14, flex: 1, fontWeight: '400' }}>
              I agree to the{' '}
              <Text
                style={{ color: colors.primary, fontWeight: '700' }}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open('/privacy-policy', '_blank');
                  } else {
                    router.push('/privacy-policy' as any);
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text
                style={{ color: colors.primary, fontWeight: '700' }}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open('/terms-and-conditions', '_blank');
                  } else {
                    router.push('/terms-and-conditions' as any);
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel="Terms and Conditions"
              >
                Terms & Conditions
              </Text>
              .
            </Text>
          </View>
          {errors.agreed && (
            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: -12, marginBottom: 16, marginLeft: 4 }}>
              {errors.agreed}
            </Text>
          )}

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
