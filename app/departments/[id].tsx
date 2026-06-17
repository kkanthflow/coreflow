import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { RoleBadge } from '@/components/ui/role-badge';

export default function DepartmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const router = useRouter();

  const [department, setDepartment] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'projects'>('members');

  useEffect(() => {
    const fetchDeptDetails = async () => {
      try {
        // 1. Fetch department info
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select(`
            id,
            name,
            description,
            color,
            head_user:head_user_id (
              full_name,
              email
            )
          `)
          .eq('id', id)
          .single();

        if (deptError) throw deptError;
        setDepartment(deptData);

        // 2. Fetch members of this department
        const { data: memberData } = await supabase
          .from('user_organizations')
          .select(`
            role,
            user:user_id (
              id,
              full_name,
              email
            )
          `)
          .eq('department_id', id);

        const activeMembers = (memberData || [])
          .filter(m => m.user)
          .map(m => {
            const u = m.user as any;
            return {
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: m.role,
            };
          });
        setMembers(activeMembers);

        // 3. Fetch projects for this department
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, title, description, status, cover_color')
          .eq('department_id', id);

        setProjects(projectData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDeptDetails();
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!department) return null;

  return (
    <ScreenContainer>
      {/* Header Banner */}
      <View style={[styles.banner, { backgroundColor: department.color || colors.primary }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.bannerTitle}>{department.name}</Text>
        {department.description ? (
          <Text style={styles.bannerDesc}>{department.description}</Text>
        ) : null}

        {department.head_user?.full_name ? (
          <Text style={styles.bannerLead}>
            Lead: <Text style={{ fontWeight: '800' }}>{department.head_user.full_name}</Text>
          </Text>
        ) : null}
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('members')}
          style={[
            styles.tab,
            activeTab === 'members' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'members' ? colors.primary : colors.muted }
            ]}
          >
            Members ({members.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('projects')}
          style={[
            styles.tab,
            activeTab === 'projects' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'projects' ? colors.primary : colors.muted }
            ]}
          >
            Projects ({projects.length})
          </Text>
        </Pressable>
      </View>

      {/* List Render */}
      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/team/${item.id}` as any)}
              style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>{item.full_name}</Text>
                <Text style={[styles.memberEmail, { color: colors.muted }]}>{item.email}</Text>
              </View>
              <RoleBadge role={item.role as any} size="sm" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No team members assigned</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/projects/${item.id}` as any)}
              style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.projectIndicator, { backgroundColor: item.cover_color || colors.primary }]} />
              <View style={styles.projectDetails}>
                <Text style={[styles.projectName, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.projectStatus, { color: colors.muted }]} numberOfLines={1}>
                  Status: <Text style={{ fontWeight: '700', color: colors.foreground, textTransform: 'capitalize' }}>{item.status}</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={colors.muted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No projects associated</Text>
            </View>
          }
        />
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
  banner: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bannerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 12,
  },
  bannerLead: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 12,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    paddingRight: 16,
  },
  projectIndicator: {
    width: 8,
    alignSelf: 'stretch',
  },
  projectDetails: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  projectStatus: {
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
