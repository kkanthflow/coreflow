import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Share, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui/premium-button';

export default function TasksReportScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          due_date,
          assignee:assignee_id (
            full_name
          )
        `)
        .eq('org_id', user.organizationId);

      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExportCSV = async () => {
    if (tasks.length === 0) {
      Alert.alert('Empty', 'No tasks to export.');
      return;
    }

    setExporting(true);
    try {
      // 1. Compile CSV string
      const headers = ['Task Title', 'Status', 'Priority', 'Assignee', 'Due Date'];
      const rows = tasks.map(t => [
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        t.assignee?.full_name ? `"${t.assignee.full_name.replace(/"/g, '""')}"` : 'Unassigned',
        t.due_date ? t.due_date : 'No Due Date',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      // 2. Share using built-in OS share sheet (works on all devices)
      await Share.share({
        message: csvContent,
        title: 'CoreFlow Tasks Report',
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Export Failed', e.message || 'An error occurred during CSV export.');
    } finally {
      setExporting(false);
    }
  };

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tasks Report</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>
                    Assignee: {item.assignee?.full_name || 'Unassigned'} • Priority: <Text style={{ textTransform: 'uppercase', fontWeight: '700' }}>{item.priority}</Text>
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${item.status === 'done' ? colors.success : colors.warning}15` }]}>
                  <Text style={[styles.badgeText, { color: item.status === 'done' ? colors.success : colors.warning }]}>
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="checkbox-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyText, { color: colors.foreground }]}>No tasks found</Text>
              </View>
            }
          />

          {tasks.length > 0 && (
            <View style={styles.footer}>
              <PremiumButton
                variant="primary"
                size="lg"
                onPress={handleExportCSV}
                loading={exporting}
                disabled={exporting}
                style={{ width: '100%' }}
              >
                <Ionicons name="share-social-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                Share CSV Report
              </PremiumButton>
            </View>
          )}
        </View>
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
    fontSize: 20,
    fontWeight: '800',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});

