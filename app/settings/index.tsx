import React, { useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useThemeContext } from '@/lib/theme-provider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform, Modal, TextInput, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { useEffect } from 'react';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { user, updatePreferences } = useAuth();
  
  const hapticsEnabled = user?.preferences?.hapticFeedback ?? true;
  const biometricsEnabled = user?.preferences?.biometricLogin ?? false;

  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Company Profile details state
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgGst, setOrgGst] = useState('');

  useEffect(() => {
    if (user?.organizationId) {
      setOrgId(user.organizationId);
      
      // Check role
      supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', user.organizationId)
        .maybeSingle()
        .then(({ data }) => {
          if (data && (data.role === 'owner' || data.role === 'administrator')) {
            setIsOwnerOrAdmin(true);
          }
        });

      // Fetch organization currency & details
      supabase
        .from('organizations')
        .select('name, address, gst_number, default_currency')
        .eq('id', user.organizationId)
        .single()
        .then(({ data }) => {
          if (data) {
            if (data.default_currency) {
              setDefaultCurrency(data.default_currency);
            }
            setOrgName(data.name || '');
            setOrgAddress(data.address || '');
            setOrgGst(data.gst_number || '');
          }
        });
    }
  }, [user]);

  const handleUpdateCurrency = async (currencyCode: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ default_currency: currencyCode })
        .eq('id', orgId);

      if (error) throw error;
      setDefaultCurrency(currencyCode);
      Alert.alert('Success', `Organization default currency updated to ${currencyCode}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update currency');
    }
  };

  const handleSaveOrgDetails = async () => {
    if (!orgName.trim() || !orgAddress.trim()) {
      Alert.alert('Validation Error', 'Company Name and Address are required');
      return;
    }
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName.trim(),
          address: orgAddress.trim(),
          gst_number: orgGst.trim() || null,
        })
        .eq('id', orgId);

      if (error) throw error;
      setIsCompanyModalVisible(false);
      Alert.alert('Success', 'Company profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update company details');
    }
  };

  const toggleTheme = async () => {
    const nextScheme = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(nextScheme);
    await updatePreferences({ theme: nextScheme });
  };

  const toggleHaptics = async (value: boolean) => {
    await updatePreferences({ hapticFeedback: value });
  };

  const toggleBiometrics = async (value: boolean) => {
    if (Platform.OS === 'web') {
      Alert.alert("Not Supported", "Biometric login is not supported in web browsers.");
      return;
    }

    try {
      if (value) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!compatible || !enrolled) {
          Alert.alert("Biometrics Not Available", "Your device does not support or have biometrics configured.");
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm biometric setup',
          fallbackLabel: 'Cancel',
        });

        if (result.success) {
          await SecureStore.setItemAsync('biometric_enabled', 'true');
          await updatePreferences({ biometricLogin: true });
          Alert.alert("Success", "Biometric login enabled successfully.");
        }
      } else {
        await SecureStore.setItemAsync('biometric_enabled', 'false');
        await updatePreferences({ biometricLogin: false });
        Alert.alert("Disabled", "Biometric login disabled.");
      }
    } catch (e) {
      console.error('Biometric toggle error:', e);
      Alert.alert("Error", "An error occurred during biometric setup.");
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">App Settings</Text>
        </View>

        {/* Display Settings */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Display</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="moon-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Dark Mode</Text>
                  <Text className="text-xs text-muted">Use dark theme across the app</Text>
                </View>
              </View>
              <Switch 
                value={colorScheme === 'dark'} 
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Preferences Settings */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Preferences</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Haptic Feedback</Text>
                  <Text className="text-xs text-muted">Vibrate on button presses</Text>
                </View>
              </View>
              <Switch 
                value={hapticsEnabled} 
                onValueChange={toggleHaptics}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">Biometric Login</Text>
                  <Text className="text-xs text-muted">Unlock app with FaceID or Fingerprint</Text>
                </View>
              </View>
              <Switch 
                value={biometricsEnabled} 
                onValueChange={toggleBiometrics}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Organization settings for owners/admins */}
        {isOwnerOrAdmin && (
          <>
            <View className="px-6 mb-6">
              <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Organization Currency</Text>
              <View className="rounded-2xl border border-border overflow-hidden py-3" style={{ backgroundColor: colors.surface }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                  {SUPPORTED_CURRENCIES.map((curr) => {
                    const isSelected = defaultCurrency === curr.code;
                    return (
                      <Pressable
                        key={curr.code}
                        onPress={() => handleUpdateCurrency(curr.code)}
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

            <View className="px-6 mb-6">
              <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Organization Settings</Text>
              <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
                <Pressable 
                  onPress={() => setIsCompanyModalVisible(true)}
                  className="flex-row items-center justify-between p-4"
                >
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                      <Ionicons name="business-outline" size={18} color={colors.primary} />
                    </View>
                    <Text className="text-base font-semibold text-foreground">Company Profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Security & Privacy */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">Security & Privacy</Text>
          <View className="rounded-2xl border border-border overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <Pressable 
              onPress={() => router.push('/settings/privacy' as any)}
              className="flex-row items-center justify-between p-4 border-b border-border"
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="shield-outline" size={18} color={colors.primary} />
                </View>
                <Text className="text-base font-semibold text-foreground">Privacy Controls</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            <Pressable 
              onPress={() => router.push('/forgot-password' as any)}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-primary/10">
                  <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                </View>
                <Text className="text-base font-semibold text-foreground">Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Info */}
        <View className="px-6 mb-12">
          <Text className="text-xs font-bold text-muted mb-3 uppercase tracking-wider ml-1">About</Text>
          <View className="p-4 rounded-2xl border border-border" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">App Version</Text>
              <Text className="text-sm font-semibold text-foreground">1.0.0 (Production)</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">Supabase Environment</Text>
              <Text className="text-sm font-semibold text-foreground">Connected</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted">Signed In As</Text>
              <Text className="text-sm font-semibold text-foreground">{user?.email}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Company Profile Modal */}
      {isCompanyModalVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} className="justify-end bg-black/50">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setIsCompanyModalVisible(false)} />
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-foreground">Edit Company Profile</Text>
                <Pressable 
                  onPress={() => setIsCompanyModalVisible(false)}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <Text className="text-xs text-muted mb-4">
                Update details for Billed From configurations. These will be automatically populated on all future invoices.
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} className="max-h-96" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Company Name *</Text>
                <TextInput
                  placeholder="CoreFlow Labs Ltd"
                  placeholderTextColor={colors.muted}
                  value={orgName}
                  onChangeText={setOrgName}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
                  style={{ backgroundColor: colors.surface }}
                />

                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Company Address *</Text>
                <TextInput
                  placeholder="Mumbai, Maharashtra, India"
                  placeholderTextColor={colors.muted}
                  value={orgAddress}
                  onChangeText={setOrgAddress}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-4"
                  style={{ backgroundColor: colors.surface }}
                />

                <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">GSTIN Tax Details</Text>
                <TextInput
                  placeholder="27CFFLOW1234A1Z9"
                  placeholderTextColor={colors.muted}
                  value={orgGst}
                  onChangeText={setOrgGst}
                  className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                  style={{ backgroundColor: colors.surface }}
                />
              </ScrollView>

              <Pressable
                onPress={handleSaveOrgDetails}
                className="p-4 rounded-2xl items-center justify-center mt-2"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-bold text-base">Save Details</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </ScreenContainer>
  );
}
