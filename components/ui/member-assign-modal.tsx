import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { RoleBadge } from '@/components/ui/role-badge';
import { hasPermission } from '@/lib/permissions';

interface OrgMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  department?: string;
  isAssigned: boolean;
  assignedAt?: string;
}

interface MemberAssignModalProps {
  visible: boolean;
  projectId: string;
  projectTitle: string;
  orgId: string;
  onClose: () => void;
  onMembersChanged: () => void;
}

export function MemberAssignModal({
  visible,
  projectId,
  projectTitle,
  orgId,
  onClose,
  onMembersChanged,
}: MemberAssignModalProps) {
  const colors = useColors();
  const { user } = useAuth();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [filtered, setFiltered] = useState<OrgMember[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const canRemove = hasPermission(user?.role, 'assign_projects');

  const fetchMembers = useCallback(async () => {
    if (!orgId || !projectId) return;
    setLoading(true);
    try {
      // Fetch all org members
      const { data: orgMembers } = await supabase
        .from('user_organizations')
        .select(`
          user_id,
          users!inner(
            id, full_name, email, role, avatar_url
          )
        `)
        .eq('organization_id', orgId);

      // Fetch already-assigned active members
      const { data: assigned } = await supabase
        .from('project_members')
        .select('user_id, assigned_at, added_at')
        .eq('project_id', projectId)
        .eq('is_active', true);

      const assignedIds = new Set((assigned || []).map((a: any) => a.user_id));
      const assignedMap = new Map(
        (assigned || []).map((a: any) => [a.user_id, a.assigned_at || a.added_at])
      );

      const list: OrgMember[] = (orgMembers || [])
        .map((row: any) => ({
          id: row.users.id,
          full_name: row.users.full_name,
          email: row.users.email,
          role: row.users.role,
          avatar_url: row.users.avatar_url,
          isAssigned: assignedIds.has(row.users.id),
          assignedAt: assignedMap.get(row.users.id),
        }))
        .filter((m) => m.id !== user?.id) // exclude self
        .sort((a, b) => {
          // Assigned first, then alphabetical
          if (a.isAssigned !== b.isAssigned) return a.isAssigned ? -1 : 1;
          return a.full_name.localeCompare(b.full_name);
        });

      setMembers(list);
      setFiltered(list);
    } catch (e) {
      console.error('[MemberAssignModal] Error fetching members:', e);
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, user?.id]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      fetchMembers();
    }
  }, [visible, fetchMembers]);

  // Live search filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(members);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        members.filter(
          (m) =>
            m.full_name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q)
        )
      );
    }
  }, [search, members]);

  const handleAssign = async (member: OrgMember) => {
    setActionUserId(member.id);
    try {
      const { error } = await supabase
        .from('project_members')
        .upsert(
          {
            project_id: projectId,
            user_id: member.id,
            assigned_by: user?.id,
            assigned_at: new Date().toISOString(),
            is_active: true,
            removed_by: null,
            removed_at: null,
            role: 'member',
            added_by: user?.id,
          },
          { onConflict: 'project_id,user_id' }
        );

      if (error) throw error;

      // Optimistic update
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, isAssigned: true, assignedAt: new Date().toISOString() }
            : m
        )
      );
      onMembersChanged();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to assign member.');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRemove = (member: OrgMember) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.full_name} from "${projectTitle}"?\n\nThey will lose access to project tasks, milestones, and files.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => executeRemove(member),
        },
      ]
    );
  };

  const executeRemove = async (member: OrgMember) => {
    setActionUserId(member.id);
    try {
      const { error } = await supabase
        .from('project_members')
        .update({
          is_active: false,
          removed_by: user?.id,
          removed_at: new Date().toISOString(),
        })
        .eq('project_id', projectId)
        .eq('user_id', member.id);

      if (error) throw error;

      // Optimistic update
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, isAssigned: false, assignedAt: undefined } : m
        )
      );
      onMembersChanged();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove member.');
    } finally {
      setActionUserId(null);
    }
  };

  const renderMember = ({ item }: { item: OrgMember }) => {
    const isActioning = actionUserId === item.id;
    const initials = item.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View
        style={[
          memberStyles.row,
          {
            backgroundColor: item.isAssigned
              ? `${colors.primary}08`
              : colors.surface,
            borderColor: item.isAssigned ? `${colors.primary}30` : colors.border,
          },
        ]}
      >
        {/* Avatar */}
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={memberStyles.avatar}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              memberStyles.avatar,
              memberStyles.avatarFallback,
              { backgroundColor: `${colors.primary}25` },
            ]}
          >
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>
              {initials}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text
              style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}
              numberOfLines={1}
            >
              {item.full_name}
            </Text>
            {item.isAssigned && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: `${colors.success || '#22c55e'}18`,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={11}
                  color={colors.success || '#22c55e'}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: colors.success || '#22c55e',
                  }}
                >
                  Assigned
                </Text>
              </View>
            )}
          </View>
          <RoleBadge role={item.role} size="sm" variant="subtle" />
          {item.isAssigned && item.assignedAt && (
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
              Joined {new Date(item.assignedAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Action Button */}
        {isActioning ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : item.isAssigned ? (
          canRemove ? (
            <Pressable
              onPress={() => handleRemove(item)}
              style={[
                memberStyles.actionBtn,
                { backgroundColor: `${colors.error}12`, borderColor: `${colors.error}30` },
              ]}
            >
              <Ionicons name="person-remove-outline" size={16} color={colors.error} />
            </Pressable>
          ) : (
            <View style={[memberStyles.actionBtn, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
              <Ionicons name="checkmark" size={16} color={colors.primary} />
            </View>
          )
        ) : (
          <Pressable
            onPress={() => handleAssign(item)}
            style={[
              memberStyles.actionBtn,
              { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` },
            ]}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>
    );
  };

  const assignedCount = members.filter((m) => m.isAssigned).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* Header */}
        <View
          style={[
            memberStyles.header,
            { borderBottomColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground }}>
              Assign Members
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {projectTitle} · {assignedCount} assigned
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={[memberStyles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View
          style={[
            memberStyles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search by name, email or role..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Stats Row */}
        <View style={[memberStyles.statsRow, { borderBottomColor: colors.border }]}>
          <View style={memberStyles.statItem}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>
              {assignedCount}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>Assigned</Text>
          </View>
          <View style={[memberStyles.statDivider, { backgroundColor: colors.border }]} />
          <View style={memberStyles.statItem}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground }}>
              {members.length}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>Total Members</Text>
          </View>
          <View style={[memberStyles.statDivider, { backgroundColor: colors.border }]} />
          <View style={memberStyles.statItem}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground }}>
              {members.length - assignedCount}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>Available</Text>
          </View>
        </View>

        {/* Member List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>Loading org members...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderMember}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="search-outline" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12, fontWeight: '600' }}>
                  No members match "{search}"
                </Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const memberStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
