import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, Modal, TextInput, KeyboardAvoidingView, Alert, Platform, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { hasPermission } from '@/lib/permissions';

import { LinearGradient } from 'expo-linear-gradient';

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, activeWorkspace } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [member, setMember] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Profile States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [stats, setStats] = useState<any>({
    clients: 0,
    projects: 0,
    invoices: 0,
    assignedProjects: [] as string[],
    workspaces: [] as string[],
    roles: [] as string[]
  });

  const fetchMemberProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
        
      if (data && !error) {
        setMember(data);

        // Fetch user's workspaces and organization memberships to determine display mode
        const [orgMems, projMems, workspacesRes] = await Promise.all([
          supabase.from('user_organizations').select('role, organizations(name)').eq('user_id', id),
          supabase.from('project_members').select('projects(title)').eq('user_id', id),
          supabase.from('workspace_members').select('workspace_id, workspaces(id, name, type)').eq('user_id', id).eq('status', 'active')
        ]);

        const orgMemsData = (orgMems?.data || []) as any[];
        const projMemsData = (projMems?.data || []) as any[];
        const workspaceMemberships = (workspacesRes?.data || []) as any[];

        // Filter and find if the user has an organization workspace membership
        const orgWorkspacesList = workspaceMemberships
          .map(wm => wm.workspaces)
          .filter(ws => ws && ws.type === 'organization');

        const isIndie = data.role === 'freelancer' && data.freelancer_type === 'independent';

        if (isIndie) {
          const [clientsRes, projectsRes, invoicesRes] = await Promise.all([
            supabase.from('clients').select('id', { count: 'exact', head: true }).eq('owner_id', id).eq('is_deleted', false),
            supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', id),
            supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('owner_id', id).eq('is_deleted', false),
          ]);
          setStats({
            clients: clientsRes.count || 0,
            projects: projectsRes.count || 0,
            invoices: invoicesRes.count || 0,
            assignedProjects: [],
            workspaces: ['Independent Freelancing'],
            roles: ['Independent Freelancer']
          });
        } else {
          // Organization / Corporate mode
          const projectTitles = projMemsData.map((pm: any) => pm.projects?.title).filter(Boolean);
          const workspaceNames = orgWorkspacesList.length > 0 
            ? orgWorkspacesList.map((ws: any) => ws.name).filter(Boolean)
            : orgMemsData.map((om: any) => om.organizations?.name).filter(Boolean);
          const rolesList = orgMemsData.map((om: any) => om.role).filter(Boolean);
          
          if (rolesList.length === 0) {
            // Default workspace role fallbacks
            rolesList.push(data.role === 'freelancer' ? 'Collaborator' : data.role);
          }

          setStats({
            clients: 0,
            projects: 0,
            invoices: 0,
            assignedProjects: projectTitles,
            workspaces: Array.from(new Set(workspaceNames)),
            roles: Array.from(new Set(rolesList))
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let frameId: number;
    if (id) {
      frameId = requestAnimationFrame(() => {
        fetchMemberProfile();
      });
    }
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [id, fetchMemberProfile]);

  const canManageRoles = hasPermission(user?.role, 'manage_roles');

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!member) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Ionicons name="person-outline" size={48} color={colors.muted} className="mb-4" />
        <Text className="text-xl font-bold text-foreground mb-2">Member Not Found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 rounded-xl bg-primary">
          <Text className="text-primary-foreground font-bold">Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable 
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            </Pressable>
            <Text className="text-base font-bold text-foreground text-center flex-1 mr-10">
              {user?.id === member.id ? 'My Profile' : 'Member Profile'}
            </Text>
          </View>
          {user?.id === member.id && (
            <Pressable 
              onPress={() => {
                setFullName(member.full_name || '');
                setIsEditModalVisible(true);
              }}
              className="px-4 py-2 rounded-xl flex-row items-center gap-1.5"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text className="text-sm font-bold" style={{ color: colors.primary }}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Profile Info Card styled after design image */}
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
            style={styles.gradientCard}
          >
            {/* Decorative background shapes */}
            <View style={styles.decoCircle1} />
            <View style={styles.decoCircle2} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Avatar Column */}
              <View style={styles.avatarContainer}>
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.avatarPlaceholderText, { color: colors.primary }]}>
                      {member.full_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                {/* Active/Online indicator status badge */}
                <View style={[styles.onlineDot, { borderColor: colors.background }]} />
              </View>

              {/* Text Info Column */}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {member.full_name}
                </Text>
                <Text style={[styles.profileTitle, { color: colors.muted }]}>
                  {stats.roles[0] || 'Member'}
                </Text>
                <Text style={[styles.profileOrg, { color: colors.muted }]}>
                  {stats.workspaces[0] || activeWorkspace?.name || 'LeakQoara'} • {member.department || 'Engineering'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Action Menu List styled after design image */}
        <View className="px-6 mb-6">
          {user?.id === member.id ? (
            <>
              <Pressable onPress={() => router.push('/settings')} className="flex-row items-center justify-between p-4 rounded-2xl border border-border mb-3" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row items-center gap-3">
                  <Ionicons name="settings-outline" size={20} color={colors.primary} />
                  <Text className="text-base text-foreground font-semibold">Settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>

              <Pressable onPress={() => router.push('/notifications')} className="flex-row items-center justify-between p-4 rounded-2xl border border-border mb-3" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row items-center gap-3">
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                  <Text className="text-base text-foreground font-semibold">Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>

              <Pressable onPress={() => router.push('/settings/privacy')} className="flex-row items-center justify-between p-4 rounded-2xl border border-border" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row items-center gap-3">
                  <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                  <Text className="text-base text-foreground font-semibold">Privacy & Security</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => router.push(`/chat/new?userId=${member.id}` as any)} className="flex-row items-center justify-between p-4 rounded-2xl border border-border mb-3" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row items-center gap-3">
                  <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                  <Text className="text-base text-foreground font-semibold">Send Message</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </>
          )}
        </View>

        {/* Dynamic Scoped Stats / Assignments */}
        {stats.roles.includes('Independent Freelancer') ? (
          <View className="px-6 mb-8">
            <Text className="text-lg font-bold text-foreground mb-4">Independent Statistics</Text>
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
              <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>{stats.clients}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Clients</Text>
              </View>
              <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#60A5FA' }}>{stats.projects}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Projects</Text>
              </View>
              <View style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.success }}>{stats.invoices}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Invoices</Text>
              </View>
            </View>
          </View>
        ) : stats.assignedProjects.length > 0 ? (
          <View className="px-6 mb-8">
            <Text className="text-lg font-bold text-foreground mb-4">Assigned Projects</Text>
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              {stats.assignedProjects.map((title: string, index: number) => (
                <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: index === stats.assignedProjects.length - 1 ? 0 : 8 }}>
                  <Ionicons name="folder-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>{title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Contact Info Card */}
        <View className="px-6 mb-8">
          <Text className="text-lg font-bold text-foreground mb-4">Contact Information</Text>
          <View className="p-4 rounded-2xl border border-border" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 mr-4">
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Email</Text>
                <Text className="text-base text-foreground font-medium">{member.email}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10 mr-4">
                <Ionicons name="time-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Joined</Text>
                <Text className="text-base text-foreground font-medium">
                  {new Date(member.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Admin Actions */}
        {canManageRoles && user?.id !== member.id && (
          <View className="px-6 pb-12">
            <Text className="text-lg font-bold text-error mb-4">Admin Actions</Text>
            <View className="p-4 rounded-2xl border border-error/30" style={{ backgroundColor: `${colors.error}10` }}>
              <Text className="text-sm text-foreground mb-4">
                You have permission to manage this user&apos;s role and access level within the organization.
              </Text>
              <Pressable 
                onPress={() => router.push(`/admin/roles?userId=${member.id}` as any)}
                className="flex-row items-center justify-center py-3 rounded-xl bg-error"
              >
                <Ionicons name="shield" size={18} color="#fff" className="mr-2" />
                <Text className="text-white font-bold text-base">Manage Role</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditModalVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} className="justify-end bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => { if (!isUpdating) setIsEditModalVisible(false); }} />
            <View className="p-6 rounded-t-3xl border-t border-border" style={{ backgroundColor: colors.background }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-foreground">Edit Profile</Text>
                <Pressable
                  onPress={() => { if (!isUpdating) setIsEditModalVisible(false); }}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              
              <Text className="text-xs text-muted mb-4">
                Update your public profile display name.
              </Text>

              <Text className="text-xs font-bold text-muted uppercase tracking-wider mb-2 ml-1">Full Name *</Text>
              <TextInput
                placeholder="Krishnakanth"
                placeholderTextColor={colors.muted}
                value={fullName}
                onChangeText={setFullName}
                editable={!isUpdating}
                className="px-4 py-3 rounded-2xl border border-border text-base text-foreground mb-6"
                style={{ backgroundColor: colors.surface }}
              />

              <Pressable
                onPress={async () => {
                  if (!fullName.trim()) {
                    Alert.alert('Validation Error', 'Full Name is required.');
                    return;
                  }
                  setIsUpdating(true);
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ full_name: fullName.trim() })
                      .eq('id', user?.id);

                    if (error) throw error;

                    Alert.alert('Success', 'Profile updated successfully.');
                    setIsEditModalVisible(false);
                    fetchMemberProfile();
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Could not update profile.');
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                disabled={isUpdating}
                className="p-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.primary, opacity: isUpdating ? 0.6 : 1 }}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-base">Save Changes</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  gradientCard: {
    padding: 24,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  decoCircle1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  decoCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  profileTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileOrg: {
    fontSize: 12,
    fontWeight: '500',
  },
});
