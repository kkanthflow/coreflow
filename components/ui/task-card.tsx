import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    due_date?: string;
    assignee?: { full_name: string; avatar_url?: string };
    estimated_hours?: number;
    actual_hours?: number;
    tags?: string[];
  };
  onPress: () => void;
  onStatusChange?: (newStatus: string) => void;
}

export function TaskCard({ task, onPress, onStatusChange }: TaskCardProps) {
  const colors = useColors();

  const statusColors: Record<string, string> = {
    todo: '#64748B',
    in_progress: '#3B82F6',
    review: '#8B5CF6',
    done: '#10B981',
    blocked: '#EF4444',
  };

  const priorityColors: Record<string, string> = {
    low: '#10B981',
    medium: '#3B82F6',
    high: '#F59E0B',
    critical: '#EF4444',
  };

  const initials = task.assignee?.full_name
    ? task.assignee.full_name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: `${statusColors[task.status] || '#64748B'}15` }]}>
            <Text style={[styles.badgeText, { color: statusColors[task.status] || '#64748B' }]}>
              {task.status.replace('_', ' ')}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${priorityColors[task.priority] || '#3B82F6'}15` }]}>
            <Text style={[styles.badgeText, { color: priorityColors[task.priority] || '#3B82F6', fontWeight: 'bold' }]}>
              {task.priority}
            </Text>
          </View>
        </View>

        {onStatusChange && task.status !== 'done' && (
          <Pressable 
            onPress={() => onStatusChange('done')}
            style={[styles.completeBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{task.title}</Text>
      
      {task.description ? (
        <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}

      {task.tags && task.tags.length > 0 ? (
        <View style={styles.tagContainer}>
          {task.tags.map((tag, idx) => (
            <View key={idx} style={[styles.tag, { backgroundColor: `${colors.primary}08`, borderColor: colors.border }]}>
              <Text style={[styles.tagText, { color: colors.muted }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.assigneeContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.assigneeName, { color: colors.foreground }]} numberOfLines={1}>
            {task.assignee?.full_name || 'Unassigned'}
          </Text>
        </View>

        <View style={styles.footerRight}>
          {task.estimated_hours ? (
            <View style={styles.timeInfo}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={[styles.timeText, { color: colors.muted }]}>
                {task.actual_hours || 0}/{task.estimated_hours}h
              </Text>
            </View>
          ) : null}

          {task.due_date ? (
            <View style={styles.dateInfo}>
              <Ionicons name="calendar-outline" size={14} color={colors.muted} />
              <Text style={[styles.dateText, { color: colors.muted }]}>
                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  completeBtn: {
    padding: 2,
    borderRadius: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  assigneeName: {
    fontSize: 11,
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
