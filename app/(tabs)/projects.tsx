import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Animated, StatusBar, TextInput,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/glass-card';
import { HealthRing } from '@/components/ui/health-ring';
import { ShimmerCard, ShimmerLoader } from '@/components/ui/shimmer-loader';
import { GradientButton } from '@/components/ui/gradient-button';

import { useColors } from '@/hooks/use-colors';

function ProjectCard({ project, onPress, index }: { project: any; onPress: () => void; index: number }) {
  const colors = useColors();
  const C = {
    bg: colors.background,
    surface: colors.surface,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };

  const STATUS_COLORS: Record<string, string> = {
    planning: '#7A7A92', active: C.info, on_hold: C.warning,
    review: '#8B5CF6', completed: C.success, cancelled: C.error,
  };
  const PRIORITY_COLORS: Record<string, string> = {
    low: C.success, medium: C.info, high: C.warning, critical: C.error,
  };

  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 70, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const statusColor   = STATUS_COLORS[project.status] || C.muted;
  const priorityColor = PRIORITY_COLORS[project.priority] || C.info;
  const coverColor    = project.cover_color || C.primary;

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim, marginBottom: 14 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: C.card,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: pressed ? `${coverColor}40` : C.border,
          shadowColor: coverColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: pressed ? 0.25 : 0.08,
          shadowRadius: pressed ? 16 : 8,
          elevation: 4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        {/* Color banner */}
        <View style={{ height: 5, backgroundColor: coverColor }} />

        <View style={{ padding: 16 }}>
          {/* Badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${statusColor}20` }}>
                <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>
                  {project.status?.replace('_', ' ')}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${priorityColor}20` }}>
                <Text style={{ color: priorityColor, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>
                  {project.priority}
                </Text>
              </View>
            </View>
            {project.department?.name && (
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600' }}>{project.department.name}</Text>
            )}
          </View>

          {/* Title & description */}
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 4 }}>{project.title}</Text>
          {project.description ? (
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginBottom: 14 }} numberOfLines={2}>
              {project.description}
            </Text>
          ) : <View style={{ marginBottom: 14 }} />}

          {/* Progress & ring row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <HealthRing progress={project.progress ?? 0} size={56} strokeWidth={5} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: C.textSec, fontSize: 12, fontWeight: '600' }}>Progress</Text>
                <Text style={{ color: coverColor, fontSize: 12, fontWeight: '800' }}>{Math.round(project.progress ?? 0)}%</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: coverColor, width: `${project.progress ?? 0}%` }} />
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="person-circle-outline" size={15} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{project.owner?.full_name || 'Unassigned'}</Text>
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

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'planning', label: 'Planning' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Done' },
];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const colors   = useColors();
  const colorScheme = useColorScheme();

  const C = {
    bg: colors.background,
    surface: colors.surface,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  const canCreateProject = hasPermission(user, 'create_projects');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchProjects = useCallback(async () => {
    const isIndependent = user?.role === 'freelancer' && user?.freelancerType === 'independent';
    if (!user?.organizationId && !isIndependent) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('projects')
        .select('id, title, description, status, priority, due_date, cover_color, owner:owner_id(full_name), department:department_id(name), tasks(id, status)')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (isIndependent) {
        query = query.eq('owner_id', user.id);
      } else {
        query = query.eq('org_id', user.organizationId);
      }

      const { data } = await query;

      setProjects((data || []).map((p: any) => {
        const tasks = p.tasks || [];
        const done  = tasks.filter((t: any) => t.status === 'done').length;
        return { ...p, progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0 };
      }));
    } catch (e) {
      console.error('Projects fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  const filtered = projects.filter(p => {
    const matchFilter = filter === 'all' || p.status === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <TabScreenWrapper>
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View>
            <Text style={[styles.title, { color: C.text }]}>Projects</Text>
            <Text style={styles.subtitle}>{projects.length} active workspace{projects.length !== 1 ? 's' : ''}</Text>
          </View>
          {canCreateProject && (
            <GradientButton onPress={() => router.push('/projects/new' as any)} size="sm">
              + New
            </GradientButton>
          )}
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name="search-outline" size={16} color={C.muted} />
          <TextInput
            placeholder="Search projects..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: C.text, fontSize: 14, marginLeft: 8 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </Pressable>
          )}
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={i => i.key}
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: filter === item.key ? C.primary : C.card,
                borderWidth: 1, borderColor: filter === item.key ? C.primary : C.border,
                marginRight: 8,
              }}
            >
              <Text style={{ color: filter === item.key ? '#FFF' : C.muted, fontSize: 13, fontWeight: '700' }}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </Animated.View>

      {loading && projects.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}
          renderItem={({ item, index }) => (
            <ProjectCard project={item} index={index} onPress={() => router.push(`/projects/${item.id}` as any)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="folder-open-outline" size={40} color={C.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.text }]}>{search ? 'No matches found' : 'No projects yet'}</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try a different search term' : 'Create your first project to start tracking progress.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#7A7A92', fontSize: 14, marginTop: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#181822',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2A2A3A', gap: 4,
  },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#181822', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#2A2A3A' },
  emptyTitle: { color: '#F5F5FA', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#7A7A92', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

