import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { ProjectCard } from '@/components/ui/project-card';
import { hasPermission } from '@/lib/permissions';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProjectsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreateProject = hasPermission(user?.role, 'create_projects');

  const fetchProjects = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);

    try {
      // Fetch projects with department, owner and tasks count to compute progress
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          cover_color,
          owner:owner_id(full_name),
          department:department_id(name),
          tasks(id, status)
        `)
        .eq('org_id', user.organizationId)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate progress on client side
      const projectsWithProgress = (data || []).map((proj: any) => {
        const tasks = proj.tasks || [];
        const total = tasks.length;
        const done = tasks.filter((t: any) => t.status === 'done').length;
        const progress = total > 0 ? (done / total) * 100 : 0;
        return { ...proj, progress };
      });

      setProjects(projectsWithProgress);
    } catch (e) {
      console.error('Error fetching projects:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [fetchProjects])
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Projects</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
          Manage org milestones and deliverables
        </Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/projects/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.muted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No projects yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Create a project to start planning milestones and tracking progress.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) for adding project - permission gated */}
      {canCreateProject && (
        <Pressable
          onPress={() => router.push('/projects/new' as any)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Leave room for FAB
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
