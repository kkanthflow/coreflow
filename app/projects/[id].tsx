import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hasPermission } from '@/lib/permissions';
import { ProgressBar } from '@/components/ui/progress-bar';
import { MilestoneTracker } from '@/components/ui/milestone-tracker';
import { TaskCard } from '@/components/ui/task-card';
import { PremiumInput } from '@/components/ui/premium-input';
import { RoleBadge } from '@/components/ui/role-badge';
import { MemberAssignModal } from '@/components/ui/member-assign-modal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectMember {
  user_id: string;
  assigned_at?: string;
  added_at?: string;
  role: string;
  users: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string;
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'milestones' | 'tasks' | 'members'>('milestones');

  // Milestone form
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState('');

  // Task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Assign members modal
  const [showAssignModal, setShowAssignModal] = useState(false);

  // ── Permissions ──────────────────────────────────────────────────────────────
  const canManageProject = hasPermission(user?.role, 'manage_projects');
  const canCreateTasks = hasPermission(user?.role, 'create_tasks');
  const canDeleteProject =
    hasPermission(user?.role, 'manage_organization') ||
    hasPermission(user?.role, 'manage_departments');
  // assign_projects: owner, administrator, director, senior_manager, manager
  const canAssignMembers =
    hasPermission(user?.role, 'assign_projects') &&
    (hasPermission(user?.role, 'manage_organization') ||
      hasPermission(user?.role, 'manage_departments') ||
      project?.owner_id === user?.id);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchProjectData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Project
      const { data: projData, error: projError } = await supabase
        .from('projects')
        .select(`*, owner:owner_id(full_name), department:department_id(name)`)
        .eq('id', id)
        .single();

      if (projError) throw projError;
      setProject(projData);

      // Milestones
      const { data: milestoneData } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', id)
        .order('order_index', { ascending: true });

      // Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select(`*, assignee:assignee_id(full_name, avatar_url)`)
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      // Members (active only)
      const { data: memberData } = await supabase
        .from('project_members')
        .select(`
          user_id,
          role,
          assigned_at,
          added_at,
          users:users!project_members_user_id_fkey!inner(id, full_name, email, role, avatar_url)
        `)
        .eq('project_id', id)
        .eq('is_active', true);

      // Compute milestone task counts
      const milestonesWithCounts = (milestoneData || []).map((m: any) => {
        const mTasks = (taskData || []).filter((t: any) => t.milestone_id === m.id);
        return {
          ...m,
          tasksCount: mTasks.length,
          completedTasksCount: mTasks.filter((t: any) => t.status === 'done').length,
        };
      });

      setMilestones(milestonesWithCounts);
      setTasks(taskData || []);
      setMembers((memberData as unknown as ProjectMember[]) || []);
    } catch (e: any) {
      console.error('Error fetching project detail:', e);
      Alert.alert('Error', 'Could not load project details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // ── Re-check assign permission once project loads ────────────────────────────
  const resolvedCanAssign =
    hasPermission(user?.role, 'assign_projects') &&
    (hasPermission(user?.role, 'manage_organization') ||
      hasPermission(user?.role, 'manage_departments') ||
      project?.owner_id === user?.id);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleToggleMilestone = async (milestoneId: string, currentCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({
          completed: !currentCompleted,
          completed_at: !currentCompleted ? new Date().toISOString() : null,
          completed_by: !currentCompleted ? user?.id : null,
        })
        .eq('id', milestoneId);

      if (error) throw error;
      fetchProjectData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update milestone.');
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) {
      Alert.alert('Validation Error', 'Milestone title is required.');
      return;
    }
    try {
      const { error } = await supabase.from('project_milestones').insert({
        project_id: id,
        title: newMilestoneTitle.trim(),
        description: newMilestoneDesc.trim() || undefined,
        order_index: milestones.length,
      });
      if (error) throw error;
      setNewMilestoneTitle('');
      setNewMilestoneDesc('');
      setShowAddMilestone(false);
      fetchProjectData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add milestone.');
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }
    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: id,
        org_id: project.org_id,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        status: 'todo',
        priority: 'medium',
        created_by: user?.id,
      });
      if (error) throw error;
      setNewTaskTitle('');
      setNewTaskDesc('');
      setShowAddTask(false);
      fetchProjectData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add task.');
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (deleteConfirmText.trim().toLowerCase() !== project.title.trim().toLowerCase()) {
      Alert.alert('Confirmation Failed', 'The project name you entered does not match.');
      return;
    }
    setIsDeleting(true);
    try {
      await supabase.from('activity_logs').insert({
        org_id: project.org_id,
        user_id: user?.id,
        action: 'project_deleted',
        entity_type: 'project',
        entity_id: project.id,
        metadata: { project_title: project.title, deleted_by: user?.fullName },
      });
      const { error } = await supabase
        .from('projects')
        .update({ status: 'cancelled', deleted_at: new Date().toISOString() })
        .eq('id', project.id);
      if (error) throw error;
      setShowDeleteModal(false);
      Alert.alert(
        '🗑️ Project Deleted',
        `"${project.title}" has been deleted and logged in the audit trail.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/projects' as any) }]
      );
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message || 'Could not delete the project.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────────
  if (loading && !project) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!project) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text className="text-lg text-error">Project not found or deleted.</Text>
      </ScreenContainer>
    );
  }

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const projectProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <ScreenContainer>
      {/* ── Assign Members Modal ─────────────────────────────────────────────── */}
      <MemberAssignModal
        visible={showAssignModal}
        projectId={project.id}
        projectTitle={project.title}
        orgId={project.org_id}
        onClose={() => setShowAssignModal(false)}
        onMembersChanged={() => {
          fetchProjectData();
        }}
      />

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onPress={() => setShowDeleteModal(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[styles.deleteModal, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.deleteIconRing, { backgroundColor: `${colors.error}15` }]}>
                <Ionicons name="trash" size={28} color={colors.error} />
              </View>
              <Text style={[styles.deleteTitle, { color: colors.foreground }]}>Delete Project</Text>
              <Text style={[styles.deleteSubtitle, { color: colors.muted }]}>
                This action is permanent and cannot be undone. Logged in the audit trail.
              </Text>
              <View style={[styles.deleteWarningBox, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30` }]}>
                <Text style={[styles.deleteWarningText, { color: colors.error }]}>
                  Type the project name to confirm:
                </Text>
                <Text style={[styles.deleteProjectName, { color: colors.foreground }]}>
                  {project.title}
                </Text>
              </View>
              <TextInput
                placeholder="Type project name to confirm"
                placeholderTextColor={colors.muted}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                style={[
                  styles.deleteInput,
                  {
                    color: colors.foreground,
                    borderColor:
                      deleteConfirmText &&
                      deleteConfirmText.toLowerCase() === project.title.toLowerCase()
                        ? colors.success || '#22c55e'
                        : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.deleteActions}>
                <Pressable
                  onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  style={[styles.deleteCancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteProject}
                  disabled={isDeleting || deleteConfirmText.toLowerCase() !== project.title.toLowerCase()}
                  style={[
                    styles.deleteConfirmBtn,
                    {
                      backgroundColor:
                        deleteConfirmText.toLowerCase() === project.title.toLowerCase()
                          ? colors.error
                          : `${colors.error}40`,
                    },
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Delete Project</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {project.title}
          </Text>
          {project.department?.name && (
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              🏢 {project.department.name}
            </Text>
          )}
        </View>
        {canDeleteProject && (
          <Pressable
            onPress={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
            style={[styles.iconBtn, { backgroundColor: `${colors.error}15`, borderColor: `${colors.error}30` }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Project Info Card ──────────────────────────────────────────────── */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.description, { color: colors.muted }]}>
            {project.description || 'No description provided.'}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.muted }]}>Owner</Text>
              <Text style={[styles.metaVal, { color: colors.foreground }]}>
                {project.owner?.full_name || 'Unassigned'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.muted }]}>Due Date</Text>
              <Text style={[styles.metaVal, { color: colors.foreground }]}>
                {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'None'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.muted }]}>Status</Text>
              <Text style={[styles.metaVal, { color: colors.primary }]}>
                {project.status?.charAt(0).toUpperCase() + project.status?.slice(1)}
              </Text>
            </View>
          </View>
          <View style={styles.progressSection}>
            <ProgressBar progress={projectProgress} showLabel={true} color={project.cover_color} />
          </View>
        </View>

        {/* ── Team Section ───────────────────────────────────────────────────── */}
        <View style={[styles.teamCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.teamHeader}>
            <View>
              <Text style={[styles.teamTitle, { color: colors.foreground }]}>
                Team
              </Text>
              <Text style={[styles.teamSubtitle, { color: colors.muted }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'} assigned
              </Text>
            </View>
            {resolvedCanAssign && (
              <Pressable
                onPress={() => setShowAssignModal(true)}
                style={[styles.assignBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="person-add" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>
                  Assign
                </Text>
              </Pressable>
            )}
          </View>

          {members.length > 0 ? (
            <View>
              {/* Avatar stack */}
              <View style={styles.avatarStack}>
                {members.slice(0, 6).map((m, idx) => {
                  const u = (m as any).users;
                  const initials = u?.full_name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || '?';
                  return (
                    <View
                      key={m.user_id}
                      style={[
                        styles.stackAvatar,
                        { marginLeft: idx > 0 ? -12 : 0, zIndex: 10 - idx, borderColor: colors.surface },
                      ]}
                    >
                      {u?.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={[styles.stackAvatarFallback, { backgroundColor: `${colors.primary}25` }]}>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
                            {initials}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {members.length > 6 && (
                  <View
                    style={[
                      styles.stackAvatar,
                      styles.stackAvatarMore,
                      { marginLeft: -12, backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                      +{members.length - 6}
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick member preview (first 3) */}
              <View style={{ gap: 8, marginTop: 12 }}>
                {members.slice(0, 3).map((m) => {
                  const u = (m as any).users;
                  const initials = u?.full_name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || '?';
                  return (
                    <View key={m.user_id} style={styles.memberPreviewRow}>
                      {u?.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.memberPreviewAvatar} />
                      ) : (
                        <View style={[styles.memberPreviewAvatar, styles.memberPreviewFallback, { backgroundColor: `${colors.primary}20` }]}>
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{initials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.foreground }}>{u?.full_name}</Text>
                      </View>
                      <RoleBadge role={u?.role || 'employee'} size="sm" variant="subtle" />
                    </View>
                  );
                })}
                {members.length > 3 && (
                  <Pressable onPress={() => setActiveTab('members')}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 6 }}>
                      View all {members.length} members →
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyTeam}>
              <Ionicons name="people-outline" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, fontWeight: '500', textAlign: 'center' }}>
                No members assigned yet.
                {resolvedCanAssign ? '\nTap "Assign" to add team members.' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(['milestones', 'tasks', 'members'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, activeTab === tab && { borderBottomColor: colors.primary }]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.muted }]}>
                {tab === 'milestones'
                  ? `Milestones (${milestones.length})`
                  : tab === 'tasks'
                  ? `Tasks (${tasks.length})`
                  : `Members (${members.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Tab Content ───────────────────────────────────────────────────── */}
        {activeTab === 'milestones' && (
          <View style={styles.tabContent}>
            {canManageProject && !showAddMilestone && (
              <Pressable
                onPress={() => setShowAddMilestone(true)}
                style={[styles.addItemBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Add Milestone</Text>
              </Pressable>
            )}
            {showAddMilestone && (
              <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>New Milestone</Text>
                <PremiumInput
                  placeholder="Milestone title"
                  value={newMilestoneTitle}
                  onChangeText={setNewMilestoneTitle}
                  containerClassName="mb-3"
                />
                <PremiumInput
                  placeholder="Optional description"
                  value={newMilestoneDesc}
                  onChangeText={setNewMilestoneDesc}
                  containerClassName="mb-3"
                />
                <View style={styles.formActions}>
                  <Pressable onPress={() => setShowAddMilestone(false)} style={styles.cancelBtn}>
                    <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleAddMilestone} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <MilestoneTracker
              milestones={milestones}
              onToggleComplete={handleToggleMilestone}
              onPressMilestone={(mId) => router.push(`/projects/${id}/milestone/${mId}` as any)}
              editable={canManageProject}
            />
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.tabContent}>
            {canCreateTasks && !showAddTask && (
              <Pressable
                onPress={() => setShowAddTask(true)}
                style={[styles.addItemBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Add Task</Text>
              </Pressable>
            )}
            {showAddTask && (
              <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>New Task</Text>
                <PremiumInput
                  placeholder="Task title"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  containerClassName="mb-3"
                />
                <PremiumInput
                  placeholder="Task description"
                  value={newTaskDesc}
                  onChangeText={setNewTaskDesc}
                  containerClassName="mb-3"
                />
                <View style={styles.formActions}>
                  <Pressable onPress={() => setShowAddTask(false)} style={styles.cancelBtn}>
                    <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleAddTask} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onPress={() => router.push(`/tasks/${task.id}` as any)} />
            ))}
            {tasks.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>No tasks added yet</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'members' && (
          <View style={styles.tabContent}>
            {/* Members Tab Header */}
            <View style={styles.membersTabHeader}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </Text>
              {resolvedCanAssign && (
                <Pressable
                  onPress={() => setShowAssignModal(true)}
                  style={[styles.assignBtnSmall, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
                >
                  <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginLeft: 4 }}>
                    Manage
                  </Text>
                </Pressable>
              )}
            </View>

            {members.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12, fontWeight: '600', textAlign: 'center' }}>
                  No members assigned to this project yet.
                </Text>
                {resolvedCanAssign && (
                  <Pressable
                    onPress={() => setShowAssignModal(true)}
                    style={[styles.assignBtnEmpty, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="person-add" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Assign Members</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              members.map((m) => {
                const u = (m as any).users;
                const joinDate = m.assigned_at || m.added_at;
                const initials = u?.full_name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || '?';

                return (
                  <View
                    key={m.user_id}
                    style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {/* Avatar */}
                    {u?.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={styles.memberAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarFallback, { backgroundColor: `${colors.primary}20` }]}>
                        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{initials}</Text>
                      </View>
                    )}

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
                        {u?.full_name}
                      </Text>
                      <RoleBadge role={u?.role || 'employee'} size="sm" variant="subtle" />
                      {joinDate && (
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 5 }}>
                          📅 Joined {new Date(joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      )}
                    </View>

                    {/* Project role badge */}
                    <View style={[styles.projectRoleBadge, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {m.role || 'Member'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  // Info Card
  infoCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  metaVal: { fontSize: 14, fontWeight: '700' },
  progressSection: { paddingTop: 12 },

  // Team Card
  teamCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  teamTitle: { fontSize: 16, fontWeight: '800' },
  teamSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
  },
  stackAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  stackAvatarMore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberPreviewAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberPreviewFallback: { alignItems: 'center', justifyContent: 'center' },
  emptyTeam: { alignItems: 'center', paddingVertical: 20 },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 20 },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabContent: { gap: 12 },

  // Add forms
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addForm: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  empty: { padding: 32, alignItems: 'center' },

  // Members tab
  membersTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  assignBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  assignBtnEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  memberAvatar: { width: 52, height: 52, borderRadius: 26 },
  memberAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  projectRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  // Delete Modal
  deleteModal: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, alignItems: 'center' },
  deleteIconRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  deleteSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  deleteWarningBox: { width: '100%', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  deleteWarningText: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  deleteProjectName: { fontSize: 14, fontWeight: '800', fontStyle: 'italic' },
  deleteInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
    fontWeight: '500',
  },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  deleteConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
