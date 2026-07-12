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
import { PremiumInput } from '@/components/ui/premium-input';
import { PremiumSelect } from '@/components/ui/premium-select';
import { PremiumButton } from '@/components/ui/premium-button';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing/updating state
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);

  const canManageTask = hasPermission(user, 'manage_tasks');

  const fetchTaskDetails = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assignee_id(id, full_name, email, avatar_url),
          project:project_id(title)
        `)
        .eq('id', id)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      // Fetch comments
      const { data: commentData } = await supabase
        .from('task_comments')
        .select(`
          *,
          author:author_id(full_name, avatar_url)
        `)
        .eq('task_id', id)
        .order('created_at', { ascending: true });

      setComments(commentData || []);

      // Fetch activity logs
      const { data: activityData } = await supabase
        .from('task_activity')
        .select(`
          *,
          user:user_id(full_name)
        `)
        .eq('task_id', id)
        .order('created_at', { ascending: false });

      setActivity(activityData || []);

      // Fetch org users for assignee selection
      if (user?.organizationId) {
        const { data: orgUserData } = await supabase
          .from('user_organizations')
          .select(`
            user_id,
            users:user_id (
              id,
              full_name
            )
          `)
          .eq('org_id', user.organizationId);

        if (orgUserData) {
          const list = orgUserData.map((d: any) => d.users).filter(Boolean);
          setOrgUsers(list);
        }
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Could not load task details.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.organizationId]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const handleUpdateField = async (field: string, val: any) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: val, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Update local task state
      setTask((prev: any) => ({ ...prev, [field]: val }));
      fetchTaskDetails();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update task.');
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || postingComment) return;
    setPostingComment(true);

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: id,
          author_id: user?.id,
          content: newComment.trim(),
        });

      if (error) throw error;
      setNewComment('');
      
      // Refresh details to include comment & activity log
      fetchTaskDetails();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  if (loading && !task) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!task) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text style={{ color: colors.error }}>Task not found or deleted.</Text>
      </ScreenContainer>
    );
  }

  const statusOptions = [
    { label: 'Todo', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Review', value: 'review' },
    { label: 'Done', value: 'done' },
    { label: 'Blocked', value: 'blocked' },
  ];

  const priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' },
  ];

  const assigneeOptions = [
    { label: 'Unassigned', value: '' },
    ...orgUsers.map(u => ({ label: u.full_name, value: u.id }))
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Task Details
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Proj: {task.project?.title || 'Standalone'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Task Title & Description */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text>
          {task.description ? (
            <Text style={[styles.taskDesc, { color: colors.muted }]}>{task.description}</Text>
          ) : (
            <Text style={[styles.taskDesc, { color: colors.muted, fontStyle: 'italic' }]}>
              No description provided.
            </Text>
          )}

          {task.due_date && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
                Due Date: {new Date(task.due_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Task Settings / Update Fields (Gated by permissions or own task check) */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Properties</Text>
          
          <PremiumSelect
            label="Status"
            value={task.status}
            options={statusOptions}
            onSelect={(val) => handleUpdateField('status', val)}
            disabled={!canManageTask && task.assignee_id !== user?.id}
          />

          <PremiumSelect
            label="Priority"
            value={task.priority}
            options={priorityOptions}
            onSelect={(val) => handleUpdateField('priority', val)}
            disabled={!canManageTask}
          />

          <PremiumSelect
            label="Assignee"
            value={task.assignee_id || ''}
            options={assigneeOptions}
            onSelect={(val) => handleUpdateField('assignee_id', val || null)}
            disabled={!canManageTask}
          />
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>
            Discussion ({comments.length})
          </Text>

          <View style={styles.commentInputRow}>
            <PremiumInput
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              containerClassName="flex-1 mr-2"
              editable={!postingComment}
            />
            <Pressable
              onPress={handlePostComment}
              disabled={!newComment.trim() || postingComment}
              style={[
                styles.sendBtn,
                { 
                  backgroundColor: newComment.trim() ? colors.primary : colors.border,
                  opacity: postingComment ? 0.7 : 1
                }
              ]}
            >
              {postingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          <View style={styles.commentsList}>
            {comments.map((comment) => (
              <View 
                key={comment.id} 
                style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.commentHeader}>
                  <Text style={[styles.authorName, { color: colors.foreground }]}>
                    {comment.author?.full_name || 'System'}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {new Date(comment.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.commentBody, { color: colors.foreground }]}>{comment.content}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Task Activity Log */}
        <View style={styles.activitySection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Activity Log</Text>
          <View style={[styles.activityList, { borderColor: colors.border }]}>
            {activity.map((act) => {
              let actionText = '';
              if (act.action === 'status_changed') {
                actionText = `changed status from ${act.old_value} to ${act.new_value}`;
              } else if (act.action === 'assignee_changed') {
                actionText = `changed assignee from ${act.old_value || 'Unassigned'} to ${act.new_value || 'Unassigned'}`;
              } else {
                actionText = act.action;
              }

              return (
                <View key={act.id} style={styles.activityItem}>
                  <Ionicons name="git-commit-outline" size={14} color={colors.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.foreground }}>
                      <Text style={{ fontWeight: '700' }}>{act.user?.full_name || 'System'}</Text> {actionText}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>
                      {new Date(act.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}

            {activity.length === 0 && (
              <Text style={{ color: colors.muted, textAlign: 'center', padding: 16 }}>No activity logged yet.</Text>
            )}
          </View>
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
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  taskDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  commentsSection: {
    marginBottom: 24,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  activitySection: {
    marginBottom: 16,
  },
  activityList: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginLeft: 6,
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
