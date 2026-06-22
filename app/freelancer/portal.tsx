import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
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

export default function FreelancerPortalScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Fetch assigned projects via project_members
      const { data: memberData, error: memberError } = await supabase
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
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      const assignedProjects = (memberData || []).map((m: any) => m.project).filter(Boolean);
      setProjects(assignedProjects);

      if (assignedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(assignedProjects[0].id);
      }

      // 2. Fetch assigned tasks
      const { data: tasksData, error: tasksError } = await supabase
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
        .order('due_date', { ascending: true });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

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

    } catch (e) {
      console.error('Error fetching freelancer portal data:', e);
      Alert.alert('Error', 'Failed to retrieve portal data.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedProjectId]);

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

            // Log activity
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

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Contractor Portal</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Your assigned tasks, projects, and deliverables
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/invoices')}
            style={[styles.scheduleBtn, { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}40`, borderWidth: 1 }]}
          >
            <Ionicons name="receipt" size={16} color={colors.success} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>Invoices</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/meetings/new')}
            style={[styles.scheduleBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40`, borderWidth: 1 }]}
          >
            <Ionicons name="calendar" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Schedule</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Section 1: Assigned Projects */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Projects ({projects.length})</Text>
            {projects.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="briefcase-outline" size={32} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, marginTop: 8 }]}>
                  You are not assigned to any projects.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectList}>
                {projects.map((proj) => (
                  <View key={proj.id} style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Section 2: Project Task List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Task List ({tasks.length})</Text>
            {tasks.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="checkbox-outline" size={32} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, marginTop: 8 }]}>
                  No tasks assigned to you.
                </Text>
              </View>
            ) : (
              Object.entries(tasksByProject).map(([projId, group]: any) => (
                <View key={projId} style={styles.projectGroup}>
                  <View style={styles.projectGroupHeader}>
                    <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
                    <Text style={[styles.projectGroupTitle, { color: colors.foreground }]}>{group.projectTitle}</Text>
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
                      <View key={task.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.taskHeader}>
                          <View style={{ flex: 1 }}>
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
                          <Text style={[styles.taskDesc, { color: colors.muted }]}>{task.description}</Text>
                        ) : null}

                        <View style={styles.taskFooter}>
                          <View style={styles.metaItem}>
                            <Ionicons name="flag-outline" size={14} color={colors.muted} />
                            <Text style={[styles.metaText, { color: colors.muted, textTransform: 'uppercase' }]}>
                              {task.priority}
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                            <Text style={[styles.metaText, { color: colors.muted }]}>
                              Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>

          {/* Section 3: Deliverables File Uploader */}
          {projects.length > 0 && (
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
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  projectList: {
    gap: 12,
  },
  projectCard: {
    width: 220,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 12,
    lineHeight: 16,
    height: 32,
    marginBottom: 12,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  taskProject: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  taskFooter: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  uploadSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  noFilesText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  projectGroup: {
    marginBottom: 20,
  },
  projectGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  projectGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  projectBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  projectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

