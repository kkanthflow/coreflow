import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';
import { useAuth } from '@/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { PremiumSelect } from '@/components/ui/premium-select';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumInput } from '@/components/ui/premium-input';

export default function DepartmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [department, setDepartment] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'projects'>('members');

  // Deletion States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [depsEmployees, setDepsEmployees] = useState(0);
  const [depsProjects, setDepsProjects] = useState(0);
  const [otherDepartments, setOtherDepartments] = useState<any[]>([]);
  const [transferUserDeptId, setTransferUserDeptId] = useState('');
  const [transferProjectDeptId, setTransferProjectDeptId] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = hasPermission(user?.role, 'manage_departments');

  useEffect(() => {
    const fetchDeptDetails = async () => {
      try {
        // 1. Fetch department info
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select(`
            id,
            name,
            description,
            color,
            head_user:head_user_id (
              full_name,
              email
            )
          `)
          .eq('id', id)
          .single();

        if (deptError) throw deptError;
        setDepartment(deptData);

        // 2. Fetch members of this department
        const { data: memberData } = await supabase
          .from('user_organizations')
          .select(`
            role,
            user:user_id (
              id,
              full_name,
              email
            )
          `)
          .eq('department_id', id);

        const activeMembers = (memberData || [])
          .filter(m => m.user)
          .map(m => {
            const u = m.user as any;
            return {
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: m.role,
            };
          });
        setMembers(activeMembers);

        // 3. Fetch projects for this department
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, title, description, status, cover_color')
          .eq('department_id', id);

        setProjects(projectData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDeptDetails();
  }, [id]);

  const handleOpenDeleteModal = async () => {
    try {
      setDeleting(true);
      // Fetch dependencies counts
      const { data: depData, error: depError } = await supabase.rpc('check_department_dependencies', { dept_id: id });
      if (depError) throw depError;

      if (depData && depData.length > 0) {
        setDepsEmployees(depData[0].employees_count);
        setDepsProjects(depData[0].projects_count);
      }

      // Fetch other departments in organization
      const { data: otherData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('org_id', user?.organizationId)
        .neq('id', id);

      if (otherData) {
        setOtherDepartments(otherData);
      }

      setDeleteModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not fetch department dependencies.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (depsEmployees > 0 && !transferUserDeptId) {
      Alert.alert('Required', 'Please select a department to transfer employees to.');
      return;
    }
    if (depsProjects > 0 && !transferProjectDeptId) {
      Alert.alert('Required', 'Please select a department to transfer projects to.');
      return;
    }

    const needsTypeConfirmation = depsEmployees > 0 || depsProjects > 0 || members.length > 0 || projects.length > 0;
    if (needsTypeConfirmation && confirmName.trim().toLowerCase() !== department.name.trim().toLowerCase()) {
      Alert.alert('Confirmation Failed', 'Please type the department name exactly to confirm deletion.');
      return;
    }

    try {
      setDeleting(true);
      const { error } = await supabase.rpc('delete_department_safe', {
        dept_id: id,
        transfer_user_dept_id: transferUserDeptId || null,
        transfer_project_dept_id: transferProjectDeptId || null
      });

      if (error) throw error;

      Alert.alert('Success', 'Department has been successfully deleted.');
      setDeleteModalVisible(false);
      router.back();
    } catch (e: any) {
      Alert.alert('Error Deleting Department', e.message || 'An error occurred.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!department) return null;

  return (
    <ScreenContainer>
      {/* Header Banner */}
      <View style={[styles.banner, { backgroundColor: department.color || colors.primary }]}>
        <View style={styles.bannerHeader}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          {canDelete && (
            <Pressable
              onPress={handleOpenDeleteModal}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
        <Text style={styles.bannerTitle}>{department.name}</Text>
        {department.description ? (
          <Text style={styles.bannerDesc}>{department.description}</Text>
        ) : null}

        {department.head_user?.full_name ? (
          <Text style={styles.bannerLead}>
            Lead: <Text style={{ fontWeight: '800' }}>{department.head_user.full_name}</Text>
          </Text>
        ) : null}
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('members')}
          style={[
            styles.tab,
            activeTab === 'members' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'members' ? colors.primary : colors.muted }
            ]}
          >
            Members ({members.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('projects')}
          style={[
            styles.tab,
            activeTab === 'projects' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'projects' ? colors.primary : colors.muted }
            ]}
          >
            Projects ({projects.length})
          </Text>
        </Pressable>
      </View>

      {/* List Render */}
      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/team/${item.id}` as any)}
              style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>{item.full_name}</Text>
                <Text style={[styles.memberEmail, { color: colors.muted }]}>{item.email}</Text>
              </View>
              <RoleBadge role={item.role as any} size="sm" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No team members assigned</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/projects/${item.id}` as any)}
              style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.projectIndicator, { backgroundColor: item.cover_color || colors.primary }]} />
              <View style={styles.projectDetails}>
                <Text style={[styles.projectName, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.projectStatus, { color: colors.muted }]} numberOfLines={1}>
                  Status: <Text style={{ fontWeight: '700', color: colors.foreground, textTransform: 'capitalize' }}>{item.status}</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No projects associated</Text>
            </View>
          }
        />
      )}

      {/* Deletion Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Delete Department</Text>
              <Pressable onPress={() => setDeleteModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.modalWarningText, { color: colors.muted }]}>
                Are you sure you want to delete <Text style={{ fontWeight: 'bold', color: colors.foreground }}>{department.name}</Text>? This action will soft-delete the department and preserve historical records.
              </Text>

              {/* Dependencies Summary */}
              <View style={[styles.depsContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.depsTitle, { color: colors.foreground }]}>Dependencies Summary:</Text>
                <View style={styles.depRow}>
                  <Text style={[styles.depLabel, { color: colors.muted }]}>Employees assigned:</Text>
                  <Text style={[styles.depValue, { color: depsEmployees > 0 ? '#EF4444' : colors.foreground }]}>
                    {depsEmployees}
                  </Text>
                </View>
                <View style={styles.depRow}>
                  <Text style={[styles.depLabel, { color: colors.muted }]}>Projects linked:</Text>
                  <Text style={[styles.depValue, { color: depsProjects > 0 ? '#EF4444' : colors.foreground }]}>
                    {depsProjects}
                  </Text>
                </View>
              </View>

              {/* Reassignment Fields if dependencies exist */}
              {depsEmployees > 0 && (
                <View style={styles.reassignSection}>
                  <PremiumSelect
                    label="Reassign Employees To *"
                    value={transferUserDeptId}
                    options={otherDepartments.map(d => ({ label: d.name, value: d.id }))}
                    onSelect={setTransferUserDeptId}
                    placeholder="Select department for employees"
                  />
                </View>
              )}

              {depsProjects > 0 && (
                <View style={styles.reassignSection}>
                  <PremiumSelect
                    label="Reassign Projects To *"
                    value={transferProjectDeptId}
                    options={otherDepartments.map(d => ({ label: d.name, value: d.id }))}
                    onSelect={setTransferProjectDeptId}
                    placeholder="Select department for projects"
                  />
                </View>
              )}

              {/* Name typing confirmation */}
              {(depsEmployees > 0 || depsProjects > 0 || members.length > 0 || projects.length > 0) && (
                <View style={styles.reassignSection}>
                  <PremiumInput
                    label={`Type "${department.name}" to confirm *`}
                    placeholder="Department name"
                    value={confirmName}
                    onChangeText={setConfirmName}
                    editable={!deleting}
                  />
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                disabled={deleting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 16 }} />
              ) : (
                <Pressable
                  onPress={handleDelete}
                  style={[styles.confirmDeleteBtn, { backgroundColor: '#EF4444' }]}
                >
                  <Text style={styles.confirmDeleteBtnText}>Confirm Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bannerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 12,
  },
  bannerLead: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 12,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    paddingRight: 16,
  },
  projectIndicator: {
    width: 8,
    alignSelf: 'stretch',
  },
  projectDetails: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  projectStatus: {
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    paddingHorizontal: 24,
  },
  modalWarningText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  depsContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  depsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  depRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  depLabel: {
    fontSize: 13,
  },
  depValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  reassignSection: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  confirmDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
