import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HealthRing } from './health-ring';

const C = {
  card: '#181822', border: '#2A2A3A',
  text: '#F5F5FA', textSec: '#B4B4C7', muted: '#7A7A92',
  success: '#34D399', warning: '#FBBF24', error: '#F87171', info: '#60A5FA',
};

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
    progress?: number;
  };
  onPress: () => void;
  index?: number;
}

const STATUS_COLORS: Record<string, string> = {
  planning: '#7A7A92', active: '#60A5FA', on_hold: '#FBBF24',
  review: '#8B5CF6', completed: '#34D399', cancelled: '#F87171',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#34D399', medium: '#60A5FA', high: '#FBBF24', critical: '#F87171',
};

export function ProjectCard({ project, onPress, index = 0 }: ProjectCardProps) {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const progress      = project.progress ?? 0;
  const coverColor    = project.cover_color || '#FF6B4A';
  const statusColor   = STATUS_COLORS[project.status] || C.muted;
  const priorityColor = PRIORITY_COLORS[project.priority] || C.info;

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim, marginBottom: 14 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: pressed ? `${coverColor}50` : C.border,
            shadowColor: coverColor,
            shadowOpacity: pressed ? 0.25 : 0.08,
            shadowRadius: pressed ? 16 : 6,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {/* Top color strip with gradient effect */}
        <View style={{ height: 5, backgroundColor: coverColor }} />
        <View style={{ height: 2, backgroundColor: `${coverColor}40` }} />

        <View style={{ padding: 16 }}>
          {/* Badges row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{project.status.replace('_', ' ')}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${priorityColor}20` }]}>
                <Text style={[styles.badgeText, { color: priorityColor, fontWeight: '800' }]}>{project.priority}</Text>
              </View>
            </View>
            {project.department?.name && (
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600' }}>{project.department.name}</Text>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{project.title}</Text>
          {project.description ? (
            <Text style={styles.desc} numberOfLines={2}>{project.description}</Text>
          ) : <View style={{ height: 8 }} />}

          {/* Progress row with ring */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <HealthRing progress={progress} size={56} strokeWidth={5} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Progress</Text>
                <Text style={{ color: coverColor, fontSize: 12, fontWeight: '800' }}>{Math.round(progress)}%</Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' }}>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: coverColor, width: `${progress}%` }} />
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="person-circle-outline" size={15} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '500' }}>
                {project.owner?.full_name || 'Unassigned'}
              </Text>
            </View>
            {project.due_date && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="calendar-outline" size={14} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  {new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  badgeText: {
    fontSize: 10, fontWeight: '700', textTransform: 'capitalize',
  },
  title: {
    color: '#F5F5FA', fontSize: 17, fontWeight: '800', marginBottom: 6,
  },
  desc: {
    color: '#7A7A92', fontSize: 13, lineHeight: 18, marginBottom: 14,
  },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A3A',
  },
});
