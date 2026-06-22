import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PremiumButton } from '@/components/ui/premium-button';

export default function ProjectsReportScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          tasks (
            id,
            status
          )
        `)
        .eq('org_id', user.organizationId);

      if (error) throw error;

      const formatted = (data || []).map((p: any) => {
        const total = p.tasks?.length || 0;
        const done = p.tasks?.filter((t: any) => t.status === 'done').length || 0;
        return {
          ...p,
          totalTasks: total,
          doneTasks: done,
          progress: total > 0 ? (done / total) * 100 : 0,
        };
      });

      setProjects(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExportPDF = async () => {
    if (projects.length === 0) {
      Alert.alert('Empty', 'No projects to export.');
      return;
    }

    setExporting(true);
    try {
      const rowsHtml = projects.map(p => `
        <tr>
          <td>${p.title}</td>
          <td><span class="status-badge status-${p.status}">${p.status}</span></td>
          <td><span class="priority-badge priority-${p.priority}">${p.priority}</span></td>
          <td>${p.doneTasks}/${p.totalTasks} tasks</td>
          <td><strong>${Math.round(p.progress)}%</strong></td>
          <td>${p.due_date ? new Date(p.due_date).toLocaleDateString() : 'N/A'}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 32px; color: #1E293B; }
              header { border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 24px; }
              h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0F172A; }
              .subtitle { font-size: 14px; color: #64748B; margin-top: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { text-align: left; padding: 12px; border-bottom: 2px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; }
              td { padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
              .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
              .status-active { background-color: #DBEAFE; color: #1E40AF; }
              .status-completed { background-color: #D1FAE5; color: #065F46; }
              .status-planning { background-color: #F3F4F6; color: #374151; }
              .priority-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
              .priority-critical { background-color: #FEE2E2; color: #991B1B; }
              .priority-high { background-color: #FEF3C7; color: #92400E; }
              .priority-medium { background-color: #E0F2FE; color: #075985; }
              .priority-low { background-color: #F3F4F6; color: #374151; }
              footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 11px; color: #94A3B8; text-align: center; }
            </style>
          </head>
          <body>
            <header>
              <h1>CoreFlow — Project Performance Report</h1>
              <div class="subtitle">Organization: ${user?.organizationName || 'My Workspace'} • Generated: ${new Date().toLocaleString()}</div>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Tasks</th>
                  <th>Progress</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <footer>Generated automatically by CoreFlow Operating System. All rights reserved.</footer>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(file.uri);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Export Failed', e.message || 'An error occurred during PDF generation.');
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Projects Report</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: item.cover_color || colors.primary, borderColor: colors.border }]}>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>
                    Tasks: {item.doneTasks}/{item.totalTasks} ({Math.round(item.progress)}%)
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${item.status === 'completed' ? colors.success : colors.primary}15` }]}>
                  <Text style={[styles.badgeText, { color: item.status === 'completed' ? colors.success : colors.primary }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyText, { color: colors.foreground }]}>No projects found</Text>
              </View>
            }
          />

          {projects.length > 0 && (
            <View style={styles.footer}>
              <PremiumButton
                variant="primary"
                size="lg"
                onPress={handleExportPDF}
                loading={exporting}
                disabled={exporting}
                style={{ width: '100%' }}
              >
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                Print PDF Report
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
    borderLeftWidth: 6,
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

