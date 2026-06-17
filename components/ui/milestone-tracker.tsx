import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import { ProgressBar } from './progress-bar';

interface Milestone {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  tasksCount?: number;
  completedTasksCount?: number;
}

interface MilestoneTrackerProps {
  milestones: Milestone[];
  onToggleComplete?: (id: string, currentStatus: boolean) => void;
  onPressMilestone?: (id: string) => void;
  editable?: boolean;
}

export function MilestoneTracker({ milestones, onToggleComplete, onPressMilestone, editable = false }: MilestoneTrackerProps) {
  const colors = useColors();

  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.completed).length;
  const progressPercent = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Overall milestones progress */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.progressTitle, { color: colors.foreground }]}>Milestones Progress</Text>
          <Text style={[styles.progressCount, { color: colors.primary }]}>
            {completedMilestones}/{totalMilestones} Completed
          </Text>
        </View>
        <ProgressBar progress={progressPercent} showLabel={false} height={6} />
      </View>

      {/* Milestones list */}
      <View style={styles.list}>
        {milestones.map((milestone) => {
          // Calculate task-level progress inside milestone if tasksCount is available
          const hasTasks = milestone.tasksCount !== undefined && milestone.tasksCount > 0;
          const milestoneTaskProgress = hasTasks 
            ? ((milestone.completedTasksCount || 0) / (milestone.tasksCount || 1)) * 100 
            : 0;

          return (
            <Pressable
              key={milestone.id}
              onPress={() => onPressMilestone?.(milestone.id)}
              style={({ pressed }) => [
                styles.itemCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.95 : 1
                }
              ]}
            >
              <View style={styles.itemRow}>
                {onToggleComplete && editable ? (
                  <Pressable 
                    onPress={() => onToggleComplete(milestone.id, milestone.completed)}
                    style={styles.checkbox}
                  >
                    <Ionicons 
                      name={milestone.completed ? "checkbox" : "square-outline"} 
                      size={22} 
                      color={milestone.completed ? colors.primary : colors.muted} 
                    />
                  </Pressable>
                ) : (
                  <View style={styles.checkbox}>
                    <Ionicons 
                      name={milestone.completed ? "checkmark-circle" : "ellipse-outline"} 
                      size={22} 
                      color={milestone.completed ? colors.success : colors.muted} 
                    />
                  </View>
                )}

                <View style={styles.itemDetails}>
                  <Text style={[
                    styles.itemTitle, 
                    { 
                      color: colors.foreground,
                      textDecorationLine: milestone.completed ? 'line-through' : 'none'
                    }
                  ]}>
                    {milestone.title}
                  </Text>
                  
                  {milestone.description ? (
                    <Text style={[styles.itemDesc, { color: colors.muted }]} numberOfLines={1}>
                      {milestone.description}
                    </Text>
                  ) : null}

                  {milestone.due_date ? (
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                      <Text style={[styles.dateText, { color: colors.muted }]}>
                        Due: {new Date(milestone.due_date).toLocaleDateString()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>

              {hasTasks ? (
                <View style={styles.taskProgress}>
                  <View style={styles.taskProgressTextRow}>
                    <Text style={[styles.taskProgressText, { color: colors.muted }]}>
                      Tasks Progress: {milestone.completedTasksCount || 0}/{milestone.tasksCount}
                    </Text>
                    <Text style={[styles.taskProgressPercent, { color: colors.foreground }]}>
                      {Math.round(milestoneTaskProgress)}%
                    </Text>
                  </View>
                  <ProgressBar progress={milestoneTaskProgress} showLabel={false} height={4} />
                </View>
              ) : null}
            </Pressable>
          );
        })}

        {totalMilestones === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No milestones added yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  progressCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  itemCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
  },
  taskProgress: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  taskProgressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  taskProgressText: {
    fontSize: 11,
    fontWeight: '500',
  },
  taskProgressPercent: {
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
