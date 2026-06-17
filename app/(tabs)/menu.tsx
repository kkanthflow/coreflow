import { ScrollView, Text, View, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RoleBadge } from '@/components/ui/role-badge';
import { hasPermission } from '@/lib/permissions';
import { AvatarUpload } from '@/components/ui/avatar-upload';

export default function MenuScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const router = useRouter();

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text className="text-base text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  const canManageRoles = hasPermission(user?.role, 'manage_roles');
  const canViewAuditLog = hasPermission(user?.role, 'view_audit_logs');
  const canViewInvoices = hasPermission(user?.role, 'view_invoices');
  const canViewReports = hasPermission(user?.role, 'view_reports');

  const workspaceItems = [
    { id: 'team', label: 'Team Directory', icon: 'people-outline', onPress: () => router.push('/team/directory' as any) },
    { id: 'hierarchy', label: 'Organization Hierarchy', icon: 'git-network-outline', onPress: () => router.push('/workspace/hierarchy' as any) },
    { id: 'departments', label: 'Departments Browser', icon: 'business-outline', onPress: () => router.push('/departments' as any) },
    { id: 'files', label: 'File Browser', icon: 'folder-open-outline', onPress: () => router.push('/files' as any) },
  ];

  if (canViewReports) {
    workspaceItems.push({ id: 'reports', label: 'Reports Hub', icon: 'document-text-outline', onPress: () => router.push('/reports' as any) });
  }

  if (canViewInvoices) {
    workspaceItems.push({ id: 'invoices', label: 'Invoice Dashboard', icon: 'receipt-outline', onPress: () => router.push('/invoices' as any) });
  }

  const menuSections = [
    {
      title: 'Profile & Settings',
      items: [
        { id: 'profile', label: 'My Profile', icon: 'person-outline', onPress: () => router.push(`/team/${user.id}` as any) },
        { id: 'settings', label: 'App Settings', icon: 'settings-outline', onPress: () => router.push('/settings' as any) },
        { id: 'notifications', label: 'Notification Preferences', icon: 'notifications-outline', onPress: () => router.push('/settings/notifications' as any) },
      ],
    },
    {
      title: 'Workspace',
      items: workspaceItems,
    },
  ];

  if (canManageRoles || canViewAuditLog) {
    const adminItems = [];
    if (canManageRoles) {
      adminItems.push({ id: 'roles', label: 'Manage Roles', icon: 'shield-checkmark-outline', onPress: () => router.push('/admin/roles' as any) });
    }
    if (canViewAuditLog) {
      adminItems.push({ id: 'audit', label: 'Audit Log', icon: 'list-outline', onPress: () => router.push('/admin/audit' as any) });
      adminItems.push({ id: 'test-accounts', label: 'Test Accounts', icon: 'trash-bin-outline', onPress: () => router.push('/admin/test-accounts' as any) });
    }

    menuSections.push({
      title: 'Administration',
      items: adminItems,
    });
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-8 mt-2">
          <Text className="text-3xl font-bold text-foreground">Menu</Text>
        </View>

        {/* User Card */}
        <View 
          className="flex-row items-center p-4 rounded-2xl mb-8 border border-border"
          style={{ backgroundColor: colors.surface }}
        >
          <View className="mr-4">
            <AvatarUpload size={64} editable={true} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground mb-0.5">{user.fullName}</Text>
            {user.organizationName ? (
              <Text className="text-xs text-muted mb-2 font-medium">🏢 {user.organizationName}</Text>
            ) : null}
            <RoleBadge role={user.role as any} size="sm" />
          </View>
          <Pressable 
            onPress={() => router.push(`/team/${user.id}` as any)}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, idx) => (
          <View key={idx} className="mb-8">
            <Text className="text-sm font-bold text-muted mb-3 uppercase tracking-wider ml-1">
              {section.title}
            </Text>
            <View 
              className="rounded-2xl overflow-hidden border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              {section.items.map((item, itemIdx) => (
                <Pressable
                  key={item.id}
                  onPress={item.onPress}
                  className="flex-row items-center p-4"
                  style={{
                    borderBottomWidth: itemIdx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View 
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${colors.primary}15` }}
                  >
                    <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  </View>
                  <Text className="flex-1 text-base font-medium text-foreground">
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center justify-center p-4 rounded-xl border border-error mb-12"
          style={{ backgroundColor: `${colors.error}10` }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} className="mr-2" />
          <Text className="text-error font-bold text-base">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
