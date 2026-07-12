import React, { useRef, useEffect, useState } from 'react';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { ScrollView, Text, View, Pressable, StyleSheet, Animated, StatusBar, Platform, Alert, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RoleBadge } from '@/components/ui/role-badge';
import { hasPermission } from '@/lib/permissions';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { GlassCard } from '@/components/ui/glass-card';
import * as Notifications from 'expo-notifications';

import { useColors } from '@/hooks/use-colors';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
  badge?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

function MenuRow({ item, isLast }: { item: MenuItem; isLast: boolean }) {
  const colors = useColors();
  const C = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    purple: '#8B5CF6',
  };

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={item.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', padding: 14,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: C.border,
          backgroundColor: pressed ? '#FFFFFF06' : 'transparent',
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${item.color}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={item.icon as any} size={18} color={item.color} />
        </View>
        <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '600' }}>{item.label}</Text>
        {item.badge && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${item.color}20`, marginRight: 8 }}>
            <Text style={{ color: item.color, fontSize: 11, fontWeight: '800' }}>{item.badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </Pressable>
    </Animated.View>
  );
}

export default function MenuScreen() {
  const { user, isAuthenticated, isLoading, activeWorkspace } = useAuth();
  const router  = useRouter();
  const colors  = useColors();
  const colorScheme = useColorScheme();

  const C = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    purple: '#8B5CF6',
  };

  const fadAnim = useRef(new Animated.Value(0)).current;
  const slidAnim = useRef(new Animated.Value(20)).current;

  const [permission, setPermission] = useState<string>('checking');
  const [pushToken, setPushToken] = useState<string>('checking');
  const [isSynced, setIsSynced] = useState<boolean | 'checking'>('checking');
  const [registering, setRegistering] = useState<boolean>(false);

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const checkDiagnostics = async () => {
    if (Platform.OS === 'web') {
      setPermission('unsupported');
      setPushToken('unsupported');
      setIsSynced(false);
      return;
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermission(status);

      if (status !== 'granted') {
        setPushToken('no-permission');
        setIsSynced(false);
        if (user?.id) {
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', user.id);
        }
        return;
      }

      const Constants = require('expo-constants').default;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const token = tokenData.data;
      setPushToken(token || 'failed');

      if (token && user?.id) {
        const { data, error } = await supabase
          .from('user_push_tokens')
          .select('token')
          .eq('user_id', user.id)
          .eq('token', token)
          .maybeSingle();

        if (error) throw error;
        setIsSynced(!!data);
      } else {
        setIsSynced(false);
      }
    } catch (err) {
      console.warn('Diagnostics error:', err);
      setPushToken('error');
      setIsSynced(false);
    }
  };

  const forceRegister = async () => {
    if (!user?.id || Platform.OS === 'web') return;
    setRegistering(true);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Notification permission is required');
        return;
      }

      const Constants = require('expo-constants').default;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const token = tokenData.data;

      if (token) {
        const { error } = await supabase
          .from('user_push_tokens')
          .upsert({ user_id: user.id, token });
        
        if (error) throw error;
        alert('Device registered successfully!');
      } else {
        alert('Failed to generate push token');
      }
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      setRegistering(false);
      await checkDiagnostics();
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slidAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    if (user?.id) {
      checkDiagnostics();
    }
  }, [user?.id]);

  if (isLoading || !isAuthenticated || !user) return null;

  const canManageRoles  = hasPermission(user, 'manage_roles');
  const canViewAuditLog = hasPermission(user, 'view_audit_logs');
  const canViewInvoices = hasPermission(user, 'view_invoices');
  const canViewReports  = hasPermission(user, 'view_reports');

  const canViewDirectory = hasPermission(user, 'view_team_directory');
  const hasOrg = !!user.organizationId;

  const workspaceItems: MenuItem[] = [];
  if (canViewDirectory) {
    workspaceItems.push({ id: 'team', label: 'Team Directory', icon: 'people-outline', color: C.info, onPress: () => router.push('/team/directory' as any) });
    workspaceItems.push({ id: 'hierarchy', label: 'Org Hierarchy', icon: 'git-network-outline', color: C.purple, onPress: () => router.push('/workspace/hierarchy' as any) });
  }
  if (hasOrg) {
    workspaceItems.push({ id: 'departments', label: 'Departments', icon: 'business-outline', color: C.secondary, onPress: () => router.push('/departments' as any) });
  }
  workspaceItems.push({ id: 'files', label: 'File Browser', icon: 'folder-open-outline', color: '#FBBF24', onPress: () => router.push('/files' as any) });
  
  if (canViewReports) {
    workspaceItems.push({ id: 'reports', label: 'Reports Hub', icon: 'document-text-outline', color: C.info, onPress: () => router.push('/reports' as any) });
  }
  if (canViewInvoices) {
    workspaceItems.push({ id: 'invoices', label: 'Invoice Dashboard', icon: 'receipt-outline', color: C.success, onPress: () => router.push('/invoices' as any) });
  }

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        { id: 'profile',        label: 'My Profile',              icon: 'person-outline',         color: C.primary,   onPress: () => router.push(`/team/${user.id}` as any) },
        { id: 'settings',       label: 'App Settings',            icon: 'settings-outline',        color: C.info,      onPress: () => router.push('/settings' as any) },
        { id: 'notifications',  label: 'Notification Preferences',icon: 'notifications-outline',   color: C.secondary, onPress: () => router.push('/settings/notifications' as any) },
      ],
    },
    {
      title: 'Workspace',
      items: workspaceItems,
    },
  ];

  if (canManageRoles || canViewAuditLog) {
    const adminItems: MenuItem[] = [];
    if (canManageRoles)  adminItems.push({ id: 'roles', label: 'Manage Roles', icon: 'shield-checkmark-outline', color: C.error, onPress: () => router.push('/admin/roles' as any) });
    if (canViewAuditLog) {
      adminItems.push({ id: 'audit', label: 'Audit Log', icon: 'list-outline', color: C.warning, onPress: () => router.push('/admin/audit' as any) });
      adminItems.push({ id: 'test-accounts', label: 'Test Accounts', icon: 'trash-bin-outline', color: C.error, onPress: () => router.push('/admin/test-accounts' as any) });
    }
    sections.push({ title: 'Administration', items: adminItems });
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <TabScreenWrapper>
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadAnim, transform: [{ translateY: slidAnim }] }]}>
          <Text style={[styles.title, { color: C.text }]}>Profile</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* User hero card */}
          <GlassCard bob={true} bobDelay={0} glowColor={C.primary} padding={20} radius={24} style={{ marginBottom: 28 }}>
            {/* Subtle gradient glow overlay */}
            <View style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: '#FF6B4A06' }]} pointerEvents="none" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <AvatarUpload size={72} editable={true} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 2 }}>{user.fullName}</Text>
                {user.organizationName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary }} />
                    <Text style={{ color: C.textSec, fontSize: 13, fontWeight: '500' }}>{user.organizationName}</Text>
                  </View>
                ) : null}
                <RoleBadge role={(activeWorkspace?.roles?.[0] || user.role) as any} size="sm" />
              </View>
              <Pressable onPress={() => router.push(`/team/${user.id}` as any)}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FF6B4A20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pencil" size={16} color={C.primary} />
                </View>
              </Pressable>
            </View>

            {user.department && (
              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business-outline" size={14} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 13 }}>{user.department}</Text>
              </View>
            )}
          </GlassCard>

          {/* Push Diagnostics Card */}
          {Platform.OS !== 'web' && (
            <GlassCard bob={true} bobDelay={150} padding={16} radius={20} style={{ marginBottom: 24 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>
                Push Notifications Diagnostic
              </Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.textSec, fontSize: 13 }}>Permission</Text>
                  <Text style={{ color: permission === 'granted' ? C.success : C.error, fontSize: 13, fontWeight: '700' }}>
                    {permission.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.textSec, fontSize: 13 }}>Expo Token</Text>
                  <Text style={{ color: pushToken.startsWith('ExponentPushToken') ? C.success : C.error, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {pushToken.startsWith('ExponentPushToken') ? 'GENERATED' : pushToken.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.textSec, fontSize: 13 }}>Supabase Sync</Text>
                  <Text style={{ color: isSynced === true ? C.success : C.error, fontSize: 13, fontWeight: '700' }}>
                    {isSynced === 'checking' ? 'CHECKING...' : isSynced ? 'ACTIVE ✅' : 'NOT SYNCED ❌'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={forceRegister}
                disabled={registering}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? `${C.primary}20` : 'transparent',
                  borderWidth: 1,
                  borderColor: C.primary,
                  borderRadius: 12,
                  padding: 10,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: C.primary, fontSize: 13, fontWeight: '700' }}>
                  {registering ? 'REGISTERING...' : 'RE-REGISTER DEVICE'}
                </Text>
              </Pressable>
            </GlassCard>
          )}

          {/* Menu sections */}
          {sections.map((section, idx) => (
            <View key={idx} style={{ marginBottom: 24 }}>
              <Text style={[styles.sectionLabel, { color: C.muted }]}>{section.title}</Text>
              <GlassCard bob={true} bobDelay={200 + idx * 100} padding={0} radius={18} style={{ overflow: 'hidden' }}>
                {section.items.map((item, i) => (
                  <MenuRow key={item.id} item={item} isLast={i === section.items.length - 1} />
                ))}
              </GlassCard>
            </View>
          ))}

          {/* Sign out */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              padding: 16, borderRadius: 18,
              backgroundColor: pressed ? '#F8717120' : '#F8717110',
              borderWidth: 1, borderColor: '#F8717140',
              gap: 10, marginBottom: 12,
            })}
          >
            <Ionicons name="log-out-outline" size={20} color={C.error} />
            <Text style={{ color: C.error, fontSize: 16, fontWeight: '700' }}>Sign Out</Text>
          </Pressable>

          {/* Delete Account */}
          <Pressable
            onPress={() => {
              setIsDeleteModalVisible(true);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              padding: 16, borderRadius: 18,
              backgroundColor: pressed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.05)',
              borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
              gap: 10, marginBottom: 20,
            })}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete Account Password Confirmation Modal */}
      {isDeleteModalVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} className="justify-end bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => { if (!isDeleting) setIsDeleteModalVisible(false); }} />
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-foreground">Confirm Password</Text>
                <Pressable
                  onPress={() => { if (!isDeleting) setIsDeleteModalVisible(false); }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              
              <Text className="text-sm text-muted mb-4">
                Please enter your password to confirm account deletion. This action is irreversible.
              </Text>

              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isDeleting}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                style={{ backgroundColor: colors.surface }}
              />

              <Pressable
                onPress={async () => {
                  if (!confirmPassword.trim()) {
                    Alert.alert('Verification Required', 'Please enter your password.');
                    return;
                  }
                  setIsDeleting(true);
                  try {
                    const { hashPassword } = require('@/lib/crypto');
                    const hashedPassword = await hashPassword(confirmPassword);

                    let verifyResult = await supabase.auth.signInWithPassword({
                      email: user.email,
                      password: hashedPassword
                    });

                    if (verifyResult.error) {
                      verifyResult = await supabase.auth.signInWithPassword({
                        email: user.email,
                        password: confirmPassword
                      });
                      if (verifyResult.error) {
                        throw new Error('Incorrect password. Please verify and try again.');
                      }
                    }

                    const { error: deleteError } = await supabase.rpc('delete_own_user');
                    if (deleteError) throw deleteError;

                    setIsDeleteModalVisible(false);
                    setConfirmPassword('');
                    await supabase.auth.signOut();
                  } catch (e: any) {
                    Alert.alert('Authentication Failed', e.message || 'Verification failed.');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="p-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: '#EF4444', opacity: isDeleting ? 0.6 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-base">Permanently Delete Account</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sectionLabel: { color: '#7A7A92', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
});
