import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { hasPermission } from '@/lib/permissions';

export default function DepartmentsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    setLoading(true);

    try {
      // 1. Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select(`
          id,
          name,
          description,
          color,
          head_user:head_user_id (
            full_name
          )
        `)
        .eq('org_id', user.organizationId);

      if (deptError) throw deptError;

      // 2. Fetch member counts per department from user_organizations
      const { data: memberData } = await supabase
        .from('user_organizations')
        .select('department_id')
        .eq('org_id', user.organizationId);

      const countMap: Record<string, number> = {};
      (memberData || []).forEach((m: any) => {
        if (m.department_id) {
          countMap[m.department_id] = (countMap[m.department_id] || 0) + 1;
        }
      });

      const formatted = (deptData || []).map(d => ({
        ...d,
        memberCount: countMap[d.id] || 0,
      }));

      setDepartments(formatted);
    } catch (e) {
      console.error('Error fetching departments:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useFocusEffect(
    useCallback(() => {
      fetchDepartments();
    }, [fetchDepartments])
  );

  const canManageDept = hasPermission(user?.role, 'manage_departments');

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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Departments</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Browse organizational units and teams
          </Text>
        </View>

        {canManageDept && (
          <Pressable
            onPress={() => router.push('/departments/new' as any)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/departments/${item.id}` as any)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {/* Department Indicator Block */}
              <View style={[styles.colorBlock, { backgroundColor: item.color || colors.primary }]} />

              <View style={styles.cardDetails}>
                <Text style={[styles.deptName, { color: colors.foreground }]}>{item.name}</Text>
                {item.description ? (
                  <Text style={[styles.deptDesc, { color: colors.muted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>
                      {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>

                  {item.head_user?.full_name ? (
                    <View style={[styles.metaItem, { marginLeft: 16 }]}>
                      <Ionicons name="person-outline" size={14} color={colors.muted} style={{ marginRight: 4 }} />
                      <Text style={[styles.metaText, { color: colors.muted }]}>
                        Lead: {item.head_user.full_name}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.muted} style={{ marginLeft: 8 }} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={64} color={colors.muted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No departments found</Text>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    paddingRight: 16,
    overflow: 'hidden',
  },
  colorBlock: {
    width: 10,
    alignSelf: 'stretch',
  },
  cardDetails: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  deptName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  deptDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

