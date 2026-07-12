import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Alert, ScrollView, Platform, Dimensions, Animated } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui/premium-button';
import { PremiumSelect } from '@/components/ui/premium-select';
import { FileUploader } from '@/components/ui/file-uploader';
import { FileCard, FileData } from '@/components/ui/file-card';
import { GlassCard } from '@/components/ui/glass-card';
import { TiltCard } from '@/components/ui/tilt-card';

const { width } = Dimensions.get('window');

export default function FreelancerPortalScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const isIndependent = user?.freelancerType === 'independent';

  // Entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 160, friction: 13, useNativeDriver: true }),
    ]).start();
  }, []);

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientsCount, setClientsCount] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      if (isIndependent) {
        // Parallelize independent freelancer queries
        const [projResult, invResult, clientResult, tasksResult] = await Promise.all([
          supabase
            .from('projects')
            .select('id, title, description, status, priority, due_date')
            .eq('owner_id', user.id)
            .is('deleted_at', null),
          supabase
            .from('invoices')
            .select('*, clients(name, company_name)')
            .eq('owner_id', user.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user.id)
            .eq('is_deleted', false),
          supabase
            .from('tasks')
            .select(`
              id,
              title,
              description,
              status,
              priority,
              due_date,
              project_id,
              project:project_id (
                title
              )
            `)
            .eq('assignee_id', user.id)
            .order('due_date', { ascending: true })
        ]);

        if (projResult.error) throw projResult.error;
        if (invResult.error) throw invResult.error;
        if (clientResult.error) throw clientResult.error;
        if (tasksResult.error) throw tasksResult.error;

        const projData = projResult.data || [];
        setProjects(projData);
        if (projData.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projData[0].id);
        }

        setInvoices(invResult.data || []);
        setClientsCount(clientResult.count || 0);
        setTasks(tasksResult.data || []);

      } else {
        // Organization Freelancer - parallelize projects and tasks fetches
        const [memberResult, tasksResult] = await Promise.all([
          supabase
            .from('project_members')
            .select(`
              project:project_id (
                id,
                title,
                description,
                status,
                priority,
                due_date
              )
            `)
            .eq('user_id', user.id),
          supabase
            .from('tasks')
            .select(`
              id,
              title,
              description,
              status,
              priority,
              due_date,
              project_id,
              project:project_id (
                title
              )
            `)
            .eq('assignee_id', user.id)
            .order('due_date', { ascending: true })
        ]);

        if (memberResult.error) throw memberResult.error;
        if (tasksResult.error) throw tasksResult.error;

        const assignedProjects = (memberResult.data || []).map((m: any) => m.project).filter(Boolean);
        setProjects(assignedProjects);

        if (assignedProjects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(assignedProjects[0].id);
        }

        setTasks(tasksResult.data || []);

        // 3. Fetch files uploaded by the freelancer or related to assigned projects
        if (user.organizationId) {
          const projectIds = assignedProjects.map((p: any) => p.id);
          
          let filesQuery = supabase
            .from('files')
            .select(`
              id,
              file_name,
              file_size,
              mime_type,
              storage_path,
              bucket,
              created_at,
              uploader_id,
              project_id,
              uploader:uploader_id (
                full_name
              )
            `)
            .eq('org_id', user.organizationId)
            .order('created_at', { ascending: false });

          if (projectIds.length > 0) {
            filesQuery = filesQuery.in('project_id', projectIds);
          } else {
            filesQuery = filesQuery.eq('uploader_id', user.id);
          }

          const { data: filesData, error: filesError } = await filesQuery;
          if (!filesError && filesData) {
            setFiles(filesData as unknown as FileData[]);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching freelancer portal data:', e);
      Alert.alert('Error', 'Failed to retrieve portal data.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedProjectId, isIndependent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateStatus = async (taskId: string, currentStatus: string) => {
    const statuses = ['todo', 'in_progress', 'review', 'done', 'blocked'];
    Alert.alert(
      'Update Task Status',
      'Select the new status for this task:',
      statuses.map(status => ({
        text: status.replace('_', ' ').toUpperCase(),
        style: status === 'done' ? 'default' : 'default',
        onPress: async () => {
          if (status === currentStatus) return;
          setUpdatingTaskId(taskId);
          try {
            const { error } = await supabase
              .from('tasks')
              .update({ status, updated_at: new Date().toISOString() })
              .eq('id', taskId);

            if (error) throw error;

            if (user?.organizationId) {
              await supabase.from('activity_logs').insert({
                org_id: user.organizationId,
                actor_id: user.id,
                action: 'task_status_updated',
                entity_type: 'task',
                entity_id: taskId,
                new_value: { status },
              });
            }

            setTasks(prev =>
              prev.map(t => (t.id === taskId ? { ...t, status } : t))
            );
          } catch (err: any) {
            console.error('Error updating task status:', err);
            Alert.alert('Error', err.message || 'Failed to update status.');
          } finally {
            setUpdatingTaskId(null);
          }
        },
      })),
      { cancelable: true }
    );
  };

  const handleFileDelete = async (id: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to permanently delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const fileToDelete = files.find(f => f.id === id);
              if (!fileToDelete) return;

              const { error: storageError } = await supabase.storage
                .from(fileToDelete.bucket)
                .remove([fileToDelete.storage_path]);

              if (storageError) throw storageError;

              const { error: dbError } = await supabase
                .from('files')
                .delete()
                .eq('id', id);

              if (dbError) throw dbError;

              setFiles(prev => prev.filter(f => f.id !== id));
            } catch (e: any) {
              console.error(e);
              Alert.alert('Error', e.message || 'Failed to delete file.');
            }
          },
        },
      ]
    );
  };

  const tasksByProject = tasks.reduce((groups: Record<string, { projectTitle: string; tasks: any[] }>, task) => {
    const projectId = task.project_id || 'general';
    const projectTitle = task.project?.title || 'General Tasks';
    if (!groups[projectId]) {
      groups[projectId] = { projectTitle, tasks: [] };
    }
    groups[projectId].tasks.push(task);
    return groups;
  }, {});

  const projectOptions = projects.map(p => ({
    label: p.title,
    value: p.id,
  }));

  // Calculations for Independent Freelancer Overview
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

  const outstandingRevenue = invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
    <ScreenContainer edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Hello, {user?.fullName || 'Freelancer'} 👋
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]} numberOfLines={1}>
            Welcome back! Here is your dashboard.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* WIDGET 1: Quick Stats Overview */}
          {isIndependent ? (
            <View style={styles.statsContainer}>
              <GlassCard bob={true} bobDelay={0} glowColor={colors.success} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Total Earnings</Text>
                <Text style={[styles.statValue, { color: colors.success }]} numberOfLines={1}>
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </GlassCard>

              <GlassCard bob={true} bobDelay={150} glowColor={colors.warning} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Outstanding</Text>
                <Text style={[styles.statValue, { color: colors.warning }]} numberOfLines={1}>
                  ${outstandingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </GlassCard>

              <GlassCard bob={true} bobDelay={300} glowColor={colors.info} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Total Clients</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
                  {clientsCount}
                </Text>
              </GlassCard>
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <GlassCard bob={true} bobDelay={0} glowColor={colors.primary} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Active Projects</Text>
                <Text style={[styles.statValue, { color: colors.primary }]} numberOfLines={1}>
                  {projects.length}
                </Text>
              </GlassCard>

              <GlassCard bob={true} bobDelay={150} glowColor={colors.info} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>My Tasks</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
                  {tasks.length}
                </Text>
              </GlassCard>

              <GlassCard bob={true} bobDelay={300} glowColor={colors.success} padding={16} radius={20} style={styles.statCard}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
                <Text style={[styles.statValue, { color: colors.success }]} numberOfLines={1}>
                  {tasks.filter(t => t.status === 'done').length}
                </Text>
              </GlassCard>
            </View>
          )}

          {/* WIDGET 2: Quick Actions Widget */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
            {isIndependent ? (
              <View style={styles.actionsGrid}>
                <Pressable
                  onPress={() => router.push('/invoices' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.success}15` }]}>
                    <Ionicons name="receipt-outline" size={20} color={colors.success} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Invoices</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/meetings/new' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Schedule</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/invoices' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.info}15` }]}>
                    <Ionicons name="people-outline" size={20} color={colors.info} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Clients</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/settings' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.muted}15` }]}>
                    <Ionicons name="settings-outline" size={20} color={colors.muted} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Settings</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionsGrid}>
                <Pressable
                  onPress={() => router.push('/(tabs)/chat' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Open Chat</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/invoices' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.success}15` }]}>
                    <Ionicons name="receipt-outline" size={20} color={colors.success} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>My Invoices</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/meetings/new' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.info}15` }]}>
                    <Ionicons name="calendar-outline" size={20} color={colors.info} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>Schedule</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/files' as any)}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.actionIconWrapper, { backgroundColor: `${colors.muted}15` }]}>
                    <Ionicons name="folder-open-outline" size={20} color={colors.muted} />
                  </View>
                  <Text style={[styles.actionLabelText, { color: colors.foreground }]}>All Files</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* WIDGET 3: Projects Widget */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isIndependent ? 'Managed Projects' : 'Assigned Projects'} ({projects.length})
            </Text>
            {projects.length === 0 ? (
              <GlassCard padding={24} radius={20} style={{ ...styles.emptyWidget, borderColor: colors.border }}>
                <Ionicons name="briefcase-outline" size={32} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, marginTop: 8 }]}>
                  {isIndependent ? 'Create your first project to get started.' : 'You are not assigned to any projects.'}
                </Text>
              </GlassCard>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectList}>
                {projects.map((proj) => (
                  <TiltCard key={proj.id} style={[styles.projectCard, { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderColor: colors.border, borderWidth: 1 }]}>
                    <Text style={[styles.projectTitle, { color: colors.foreground }]} numberOfLines={1}>{proj.title}</Text>
                    <Text style={[styles.projectDesc, { color: colors.muted }]} numberOfLines={2}>
                      {proj.description || 'No description provided.'}
                    </Text>
                    <View style={styles.projectMeta}>
                      <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                      <Text style={[styles.projectMetaText, { color: colors.muted }]}>
                        {proj.due_date ? new Date(proj.due_date).toLocaleDateString() : 'No Due Date'}
                      </Text>
                    </View>
                  </TiltCard>
                ))}
              </ScrollView>
            )}
          </View>

          {/* WIDGET 4: Tasks List Widget */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Tasks ({tasks.length})</Text>
            {tasks.length === 0 ? (
              <GlassCard padding={24} radius={20} style={{ ...styles.emptyWidget, borderColor: colors.border }}>
                <Ionicons name="checkbox-outline" size={32} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, marginTop: 8 }]}>
                  No tasks currently on your list.
                </Text>
              </GlassCard>
            ) : (
              Object.entries(tasksByProject).map(([projId, group]: any) => (
                <View key={projId} style={styles.projectGroup}>
                  <View style={styles.projectGroupHeader}>
                    <Ionicons name="folder-open-outline" size={14} color={colors.primary} />
                    <Text style={[styles.projectGroupTitle, { color: colors.foreground }]} numberOfLines={1}>{group.projectTitle}</Text>
                    <View style={[styles.projectBadge, { backgroundColor: `${colors.primary}15` }]}>
                      <Text style={[styles.projectBadgeText, { color: colors.primary }]}>{group.tasks.length}</Text>
                    </View>
                  </View>

                  {group.tasks.map((task: any) => {
                    let statusColor = colors.muted;
                    if (task.status === 'done') statusColor = colors.success;
                    if (task.status === 'in_progress') statusColor = colors.primary;
                    if (task.status === 'review') statusColor = colors.warning;
                    if (task.status === 'blocked') statusColor = colors.error;

                    return (
                      <TiltCard key={task.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderColor: colors.border, borderWidth: 1 }]}>
                        <View style={styles.taskHeader}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text>
                          </View>
                          <Pressable
                            onPress={() => handleUpdateStatus(task.id, task.status)}
                            disabled={updatingTaskId === task.id}
                            style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}
                          >
                            {updatingTaskId === task.id ? (
                              <ActivityIndicator size="small" color={statusColor} />
                            ) : (
                              <>
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                  {task.status.replace('_', ' ')}
                                </Text>
                                <Ionicons name="chevron-down" size={12} color={statusColor} style={{ marginLeft: 4 }} />
                              </>
                            )}
                          </Pressable>
                        </View>
                        
                        {task.description ? (
                          <Text style={[styles.taskDesc, { color: colors.muted }]} numberOfLines={2}>{task.description}</Text>
                        ) : null}

                        <View style={styles.taskFooter}>
                          <View style={styles.metaItem}>
                            <Ionicons name="flag-outline" size={12} color={colors.muted} />
                            <Text style={[styles.metaText, { color: colors.muted, textTransform: 'uppercase' }]}>
                              {task.priority}
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                            <Text style={[styles.metaText, { color: colors.muted }]}>
                              {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No deadline'}
                            </Text>
                          </View>
                        </View>
                      </TiltCard>
                    );
                  })}
                </View>
              ))
            )}
          </View>

          {/* WIDGET 5: Files and Deliverables Upload (Only for Organization Mode) */}
          {!isIndependent && projects.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Deliverables & File Upload</Text>
              
              <View style={styles.uploadSelector}>
                <Text style={[styles.selectorLabel, { color: colors.foreground }]}>Select Project</Text>
                <PremiumSelect
                  label="Project"
                  options={projectOptions}
                  value={selectedProjectId}
                  onSelect={setSelectedProjectId}
                  placeholder="Select project for upload..."
                />
              </View>

              {selectedProjectId ? (
                <FileUploader
                  projectId={selectedProjectId}
                  onUploadSuccess={fetchData}
                />
              ) : null}

              <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>Project Files</Text>
              {files.length === 0 ? (
                <Text style={[styles.noFilesText, { color: colors.muted }]}>No files uploaded for your projects yet.</Text>
              ) : (
                files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    canDelete={user ? file.uploader_id === user.id : false}
                    onDelete={handleFileDelete}
                  />
                ))
              )}
            </View>
          )}

        </ScrollView>
      )}
    </ScreenContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 64) / 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyWidget: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  projectList: {
    gap: 10,
  },
  projectCard: {
    width: 190,
    marginRight: 2,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 11,
    lineHeight: 15,
    height: 30,
    marginBottom: 10,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectMetaText: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: (width - 58) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskCard: {
    marginBottom: 10,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  taskFooter: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  uploadSelector: {
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  noFilesText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  projectGroup: {
    marginBottom: 16,
  },
  projectGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  projectGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: width - 120,
  },
  projectBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  projectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
