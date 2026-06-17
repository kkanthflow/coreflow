import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';
import { ProgressBar } from './progress-bar';

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    due_date?: string;
    cover_color?: string;
    owner?: { full_name: string };
    department?: { name: string };
    progress?: number; // Calculated progress %
  };
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const colors = useColors();

  const statusColors: Record<string, string> = {
    planning: '#64748B',
    active: '#3B82F6',
    on_hold: '#F59E0B',
    review: '#8B5CF6',
    completed: '#10B981',
    cancelled: '#EF4444',
  };

  const priorityColors: Record<string, string> = {
    low: '#10B981',
    medium: '#3B82F6',
    high: '#F59E0B',
    critical: '#EF4444',
  };

  const progress = project.progress !== undefined ? project.progress : 0;

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
      {/* Top Banner or Color Strip */}
      <View style={[styles.colorStrip, { backgroundColor: project.cover_color || '#1F6FEB' }]} />

      <View style={styles.content}>
        {/* Badges row */}
        <View style={styles.badgeRow}>
          {project.department?.name ? (
            <View style={[styles.deptBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.deptText, { color: colors.primary }]}>
                {project.department.name}
              </Text>
            </View>
          ) : <View />}

          <View style={styles.rightBadges}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[project.status] || '#64748B'}15` }]}>
              <Text style={[styles.statusText, { color: statusColors[project.status] || '#64748B' }]}>
                {project.status.replace('_', ' ')}
              </Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: `${priorityColors[project.priority] || '#3B82F6'}15` }]}>
              <Text style={[styles.statusText, { color: priorityColors[project.priority] || '#3B82F6', fontWeight: 'bold' }]}>
                {project.priority}
              </Text>
            </View>
          </View>
        </View>

        {/* Title & Description */}
        <Text style={[styles.title, { color: colors.foreground }]}>{project.title}</Text>
        {project.description ? (
          <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
            {project.description}
          </Text>
        ) : null}

        {/* Progress Tracker */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={progress} showLabel={true} color={project.cover_color} />
        </View>

        {/* Footer info (Owner & Due Date) */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerItem}>
            <Ionicons name="person-circle-outline" size={16} color={colors.muted} />
            <Text style={[styles.footerText, { color: colors.muted }]}>
              {project.owner?.full_name || 'Unassigned'}
            </Text>
          </View>

          {project.due_date ? (
            <View style={styles.footerItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text style={[styles.footerText, { color: colors.muted }]}>
                {new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  colorStrip: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deptText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
