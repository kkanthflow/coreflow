import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hasPermission } from '@/lib/permissions';
import { ProgressBar } from '@/components/ui/progress-bar';
import { TaskCard } from '@/components/ui/task-card';
import { PremiumInput } from '@/components/ui/premium-input';

export default function MilestoneDetailScreen() {
  const { id, milestoneId } = useLocalSearchParams();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [milestone, setMilestone] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  const canManageProject = hasPermission(user?.role, 'manage_projects');
  const canCreateTasks = hasPermission(user?.role, 'create_tasks');

  const fetchMilestoneData = useCallback(async () => {
    if (!milestoneId) return;
    setLoading(true);

    try {
      // Fetch milestone
      const { data: milData, error: milError } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('id', milestoneId)
        .single();

      if (milError) throw milError;
      setMilestone(milData);

      // Fetch milestone tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assignee_id(full_name, avatar_url)
        `)
        .eq('milestone_id', milestoneId)
        .order('created_at', { ascending: false });

      setTasks(taskData || []);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Could not load milestone details.');
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => {
    fetchMilestoneData();
  }, [fetchMilestoneData]);

  const handleToggleComplete = async () => {
    if (!milestone) return;
    try {
      const nextCompleted = !milestone.completed;
      const { error } = await supabase
        .from('project_milestones')
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
          completed_by: nextCompleted ? user?.id : null,
        })
        .eq('id', milestoneId);

      if (error) throw error;
      setMilestone((prev: any) => ({
        ...prev,
        completed: nextCompleted
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update milestone.');
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }

    try {
      // Find the project's org_id
      const { data: proj } = await supabase
        .from('projects')
        .select('org_id')
        .eq('id', id)
        .single();

      if (!proj) throw new Error('Project not found');

      const { error } = await supabase
        .from('tasks')
        .insert({
          project_id: id,
          milestone_id: milestoneId,
          org_id: proj.org_id,
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
      fetchMilestoneData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add task.');
    }
  };

  if (loading && !milestone) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!milestone) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text style={{ color: colors.error }}>Milestone not found.</Text>
      </ScreenContainer>
    );
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Milestone Details
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Milestone info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{milestone.title}</Text>
            {canManageProject && (
              <Pressable onPress={handleToggleComplete} style={styles.checkboxBtn}>
                <Ionicons 
                  name={milestone.completed ? "checkbox" : "square-outline"} 
                  size={24} 
                  color={milestone.completed ? colors.primary : colors.muted} 
                />
              </Pressable>
            )}
          </View>

          {milestone.description ? (
            <Text style={[styles.description, { color: colors.muted }]}>
              {milestone.description}
            </Text>
          ) : null}

          {milestone.due_date ? (
            <View style={styles.dueRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                Due Date: {new Date(milestone.due_date).toLocaleDateString()}
              </Text>
            </View>
          ) : null}

          <View style={styles.progressRow}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
              Milestone Tasks Progress
            </Text>
            <ProgressBar progress={progressPercent} showLabel={true} height={6} />
          </View>
        </View>

        {/* Milestone Tasks list header */}
        <View style={styles.tasksHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tasks ({tasks.length})</Text>
          {canCreateTasks && !showAddTask && (
            <Pressable
              onPress={() => setShowAddTask(true)}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>New Task</Text>
            </Pressable>
          )}
        </View>

        {showAddTask && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>New Milestone Task</Text>
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

        <View style={styles.tasksList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => router.push(`/tasks/${task.id}` as any)}
            />
          ))}

          {tasks.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ color: colors.muted }}>No tasks assigned to this milestone yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  checkboxBtn: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressRow: {
    marginTop: 8,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addForm: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tasksList: {
    gap: 12,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
});
