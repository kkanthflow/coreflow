import React, { useRef, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, Animated, StatusBar } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RoleBadge } from '@/components/ui/role-badge';
import { hasPermission } from '@/lib/permissions';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { GlassCard } from '@/components/ui/glass-card';

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
  const { user, isAuthenticated, isLoading } = useAuth();
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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slidAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isLoading || !isAuthenticated || !user) return null;

  const canManageRoles  = hasPermission(user.role, 'manage_roles');
  const canViewAuditLog = hasPermission(user.role, 'view_audit_logs');
  const canViewInvoices = hasPermission(user.role, 'view_invoices');
  const canViewReports  = hasPermission(user.role, 'view_reports');

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
      items: [
        { id: 'team',       label: 'Team Directory',       icon: 'people-outline',       color: C.info,    onPress: () => router.push('/team/directory' as any) },
        { id: 'hierarchy',  label: 'Org Hierarchy',        icon: 'git-network-outline',  color: C.purple,  onPress: () => router.push('/workspace/hierarchy' as any) },
        { id: 'departments',label: 'Departments',          icon: 'business-outline',     color: C.secondary,onPress: () => router.push('/departments' as any) },
        { id: 'files',      label: 'File Browser',         icon: 'folder-open-outline',  color: '#FBBF24', onPress: () => router.push('/files' as any) },
        ...(canViewReports  ? [{ id: 'reports',  label: 'Reports Hub',     icon: 'document-text-outline', color: C.info,    onPress: () => router.push('/reports' as any) }] : []),
        ...(canViewInvoices ? [{ id: 'invoices', label: 'Invoice Dashboard',icon: 'receipt-outline',      color: C.success, onPress: () => router.push('/invoices' as any) }] : []),
      ],
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadAnim, transform: [{ translateY: slidAnim }] }]}>
          <Text style={[styles.title, { color: C.text }]}>Profile</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* User hero card */}
          <GlassCard glowColor={C.primary} padding={20} radius={24} style={{ marginBottom: 28 }}>
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
                <RoleBadge role={user.role as any} size="sm" />
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

          {/* Menu sections */}
          {sections.map((section, idx) => (
            <View key={idx} style={{ marginBottom: 24 }}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              <GlassCard padding={0} radius={18} style={{ overflow: 'hidden' }}>
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
              gap: 10, marginBottom: 20,
            })}
          >
            <Ionicons name="log-out-outline" size={20} color={C.error} />
            <Text style={{ color: C.error, fontSize: 16, fontWeight: '700' }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sectionLabel: { color: '#7A7A92', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
});
