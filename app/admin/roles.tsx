import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { hasPermission, UserRole, getRoleLevel, isHigherRole } from '@/lib/permissions';

// Full role catalog with hierarchy levels visible to admin
const ALL_ROLES: { role: UserRole; label: string; description: string; level: number }[] = [
  { role: 'owner', label: 'Owner', description: 'Full system access and top-level control.', level: 9 },
  { role: 'administrator', label: 'Administrator', description: 'Full org admin access with role management.', level: 8 },
  { role: 'director', label: 'Director', description: 'Department oversight and project management.', level: 7 },
  { role: 'senior_manager', label: 'Senior Manager', description: 'Advanced project and invoice management.', level: 6 },
  { role: 'manager', label: 'Manager', description: 'Project coordination and team management.', level: 5 },
  { role: 'team_lead', label: 'Team Lead', description: 'Task and project visibility with team coordination.', level: 4 },
  { role: 'senior_employee', label: 'Senior Employee', description: 'Extended task creation and file management.', level: 3 },
  { role: 'employee', label: 'Employee', description: 'Standard member access to projects and tasks.', level: 2 },
  { role: 'intern', label: 'Intern', description: 'Limited read access. No project creation.', level: 1 },
  { role: 'freelancer', label: 'Freelancer', description: 'External contractor – project-scoped only.', level: 0 },
];

export default function RoleManagementScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const myLevel = getRoleLevel(user?.role);

  // Only show roles that are strictly BELOW the current user's level
  // An owner (9) can assign up to administrator (8) etc.
  const assignableRoles = ALL_ROLES.filter((r) => r.level < myLevel);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (userId) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        if (data && !error) {
          setSelectedUser(data);
        }
        return;
      }

      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user!.id);

      const orgIds = myOrgs?.map((o) => o.org_id) || [];

      if (orgIds.length === 0) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role, avatar_url');
        if (data && !error) {
          setMembers(data);
        }
      } else {
        const { data, error } = await supabase
          .from('user_organizations')
          .select('user_id, users:users!user_organizations_user_id_fkey!inner(id, full_name, email, role, avatar_url)')
          .in('org_id', orgIds);

        if (data && !error) {
          const uniqueUsers = new Map<string, any>();
          data.forEach((d: any) => {
            if (d.users && !uniqueUsers.has(d.users.id)) {
              uniqueUsers.set(d.users.id, d.users);
            }
          });
          setMembers(Array.from(uniqueUsers.values()));
        }
      }
    } catch (e) {
      console.error('[RoleManagement] Error fetching data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, userId]);

  useEffect(() => {
    let frameId: number;
    if (user) {
      frameId = requestAnimationFrame(() => {
        fetchData();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [user, userId, fetchData]);

  const handleRoleChange = (newRole: UserRole) => {
    if (!selectedUser || selectedUser.role === newRole) return;

    // 🔒 Security: Prevent self-role modification
    if (selectedUser.id === user?.id) {
      Alert.alert(
        '🔒 Action Not Permitted',
        'You cannot modify your own role. This is a security restriction to prevent privilege escalation.',
        [{ text: 'Understood', style: 'default' }]
      );
      return;
    }

    // 🔒 Security: Cannot assign a role equal to or higher than your own
    const newRoleLevel = getRoleLevel(newRole);
    if (newRoleLevel >= myLevel) {
      Alert.alert(
        '🔒 Insufficient Privilege',
        `You cannot assign the "${newRole}" role because it is at or above your own authority level (${user?.role}).`,
        [{ text: 'Understood', style: 'default' }]
      );
      return;
    }

    // 🔒 Security: Cannot manage a user with equal or higher authority
    const targetLevel = getRoleLevel(selectedUser.role);
    if (targetLevel >= myLevel) {
      Alert.alert(
        '🔒 Restricted',
        `You cannot modify ${selectedUser.full_name}'s role because they hold equal or higher authority than you.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Role Change',
      `Change ${selectedUser.full_name}'s role from "${selectedUser.role}" to "${newRole}"?\n\nThis action is permanently recorded in the Audit Log.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Update',
          style: 'destructive',
          onPress: () => executeRoleChange(newRole, 'Role updated via admin console'),
        },
      ]
    );
  };

  const executeRoleChange = async (newRole: UserRole, reason: string) => {
    setIsUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      // Explicit audit log with reason + changed_by
      const { error: auditError } = await supabase
        .from('role_change_audit')
        .insert({
          user_id: selectedUser.id,
          changed_by_id: user!.id,
          old_role: selectedUser.role,
          new_role: newRole,
          reason: reason,
        });

      if (auditError) console.error('Audit log error:', auditError);

      Alert.alert('✅ Role Updated', `${selectedUser.full_name}'s role has been updated to "${newRole}" successfully.`);
      setSelectedUser({ ...selectedUser, role: newRole });
      if (!userId) fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const canManageRoles = hasPermission(user?.role, 'manage_roles');

  if (!canManageRoles) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.error}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="lock-closed" size={36} color={colors.error} />
        </View>
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center">You do not have permission to manage roles.</Text>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
        <Pressable
          onPress={() => {
            if (selectedUser && !userId) setSelectedUser(null);
            else router.back();
          }}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground }}>
            {selectedUser ? 'Edit Role' : 'Role Management'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Your authority level: <Text style={{ color: colors.primary, fontWeight: '700' }}>{user?.role}</Text>
          </Text>
        </View>
      </View>

      {selectedUser ? (
        <FlatList
          data={assignableRoles}
          keyExtractor={(item) => item.role}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Profile Card */}
              <View style={{ marginHorizontal: 24, marginBottom: 8, padding: 20, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  {selectedUser.avatar_url ? (
                    <Image source={{ uri: selectedUser.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32, marginRight: 16 }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 24 }}>
                        {selectedUser.full_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 4 }}>
                      {selectedUser.full_name}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>{selectedUser.email}</Text>
                    <RoleBadge role={selectedUser.role} size="sm" />
                  </View>
                </View>

                {/* Self-modification warning */}
                {selectedUser.id === user?.id && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: `${colors.warning || '#f59e0b'}15`, borderWidth: 1, borderColor: `${colors.warning || '#f59e0b'}30` }}>
                    <Ionicons name="warning-outline" size={18} color={colors.warning || '#f59e0b'} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.warning || '#f59e0b', fontWeight: '600', flex: 1 }}>
                      You cannot modify your own role. Self-modification is restricted for security.
                    </Text>
                  </View>
                )}

                {/* Target has higher authority warning */}
                {selectedUser.id !== user?.id && getRoleLevel(selectedUser.role) >= myLevel && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: `${colors.error}10`, borderWidth: 1, borderColor: `${colors.error}30` }}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600', flex: 1 }}>
                      This user has equal or higher authority than you. Role changes are restricted.
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ paddingHorizontal: 24, marginTop: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Assignable Roles
                </Text>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isCurrentRole = selectedUser.role === item.role;
            const isSelf = selectedUser.id === user?.id;
            const targetHasHigherAuth = getRoleLevel(selectedUser.role) >= myLevel;
            const isBlocked = isSelf || targetHasHigherAuth;

            return (
              <Pressable
                disabled={isUpdating || isCurrentRole || isBlocked}
                onPress={() => handleRoleChange(item.role)}
                style={{
                  padding: 16,
                  marginBottom: 10,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: isCurrentRole ? colors.primary : colors.border,
                  backgroundColor: isCurrentRole ? `${colors.primary}08` : colors.surface,
                  opacity: isBlocked ? 0.45 : isUpdating ? 0.6 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isCurrentRole ? colors.primary : colors.foreground }}>
                    {item.label}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {isCurrentRole && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.primary, borderRadius: 20 }}>
                        <Text style={{ fontSize: 10, color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current</Text>
                      </View>
                    )}
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.border, borderRadius: 20 }}>
                      <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '700' }}>Level {item.level}</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>{item.description}</Text>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600', lineHeight: 18 }}>
                Select a team member below to modify their role. You can only assign roles below your own authority level.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelf = item.id === user?.id;
            const hasHigherAuth = getRoleLevel(item.role) >= myLevel;
            const isBlocked = isSelf || hasHigherAuth;
            return (
              <Pressable
                onPress={() => setSelectedUser(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  marginBottom: 10,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: isBlocked ? 0.5 : 1,
                }}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 14 }} />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}20`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>
                      {item.full_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>{item.full_name}</Text>
                    {isSelf && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: `${colors.primary}20`, borderRadius: 8 }}>
                        <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '800', textTransform: 'uppercase' }}>You</Text>
                      </View>
                    )}
                  </View>
                  <RoleBadge role={item.role} size="sm" />
                </View>
                {isBlocked ? (
                  <Ionicons name="lock-closed" size={16} color={colors.muted} />
                ) : (
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
