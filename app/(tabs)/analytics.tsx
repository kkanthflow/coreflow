import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useFocusEffect } from 'expo-router';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = useState(true);
  const [orgStats, setOrgStats] = useState({
    totalProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    doneTasks: 0,
    totalInvoices: 0,
    paidInvoicesValue: 0,
    pendingInvoicesValue: 0,
  });

  const [personalStats, setPersonalStats] = useState({
    myTotalTasks: 0,
    myDoneTasks: 0,
    myInProgressTasks: 0,
    myReviewTasks: 0,
    myTodoTasks: 0,
  });

  const isManagement = ['owner', 'administrator', 'director', 'senior_manager', 'manager'].includes(user?.role || '');

  const fetchAnalytics = useCallback(async () => {
    if (!user?.organizationId) return;
    setLoading(true);

    try {
      if (isManagement) {
        // 1. Fetch organization wide projects
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, status')
          .eq('org_id', user.organizationId);

        // 2. Fetch organization wide tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('org_id', user.organizationId);

        // 3. Fetch organization wide invoices (for revenue calculations)
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, status, total_amount')
          .eq('organization_id', user.organizationId);

        const totalProjects = projectsData?.length || 0;
        const completedProjects = projectsData?.filter(p => p.status === 'completed').length || 0;
        const totalTasks = tasksData?.length || 0;
        const doneTasks = tasksData?.filter(t => t.status === 'done').length || 0;

        let paidInvoicesValue = 0;
        let pendingInvoicesValue = 0;
        (invoicesData || []).forEach((inv: any) => {
          const val = Number(inv.total_amount) || 0;
          if (inv.status === 'paid') {
            paidInvoicesValue += val;
          } else if (inv.status === 'pending' || inv.status === 'sent') {
            pendingInvoicesValue += val;
          }
        });

        setOrgStats({
          totalProjects,
          completedProjects,
          totalTasks,
          doneTasks,
          totalInvoices: invoicesData?.length || 0,
          paidInvoicesValue,
          pendingInvoicesValue,
        });
      } else {
        // Fetch personal stats for employee/intern
        const { data: myTasks } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('assignee_id', user.id);

        const total = myTasks?.length || 0;
        const done = myTasks?.filter(t => t.status === 'done').length || 0;
        const inProgress = myTasks?.filter(t => t.status === 'in_progress').length || 0;
        const review = myTasks?.filter(t => t.status === 'review').length || 0;
        const todo = myTasks?.filter(t => t.status === 'todo').length || 0;

        setPersonalStats({
          myTotalTasks: total,
          myDoneTasks: done,
          myInProgressTasks: inProgress,
          myReviewTasks: review,
          myTodoTasks: todo,
        });
      }
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId, user?.id, isManagement]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const renderManagementView = () => {
    const taskRate = orgStats.totalTasks > 0 ? (orgStats.doneTasks / orgStats.totalTasks) * 100 : 0;
    const projectRate = orgStats.totalProjects > 0 ? (orgStats.completedProjects / orgStats.totalProjects) * 100 : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Workspace Health</Text>
        
        {/* Project & Task Metrics */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>Project Completion</Text>
              <Text style={[styles.cardVal, { color: colors.foreground }]}>
                {orgStats.completedProjects} / {orgStats.totalProjects}
              </Text>
            </View>
            <Text style={[styles.percent, { color: colors.primary }]}>{Math.round(projectRate)}%</Text>
          </View>
          <ProgressBar progress={projectRate} showLabel={false} height={8} />

          <View style={[styles.metricRow, { marginTop: 24 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>Tasks Finished</Text>
              <Text style={[styles.cardVal, { color: colors.foreground }]}>
                {orgStats.doneTasks} / {orgStats.totalTasks}
              </Text>
            </View>
            <Text style={[styles.percent, { color: colors.secondary }]}>{Math.round(taskRate)}%</Text>
          </View>
          <ProgressBar progress={taskRate} showLabel={false} height={8} color={colors.secondary} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Finance & Billing</Text>

        {/* Financial metrics */}
        <View style={styles.row}>
          <View style={[styles.smallCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="cash-outline" size={20} color={colors.success} />
            </View>
            <Text style={[styles.smallCardVal, { color: colors.foreground }]}>
              ${orgStats.paidInvoicesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.smallCardMeta, { color: colors.muted }]}>Received Revenue</Text>
          </View>

          <View style={[styles.smallCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.warning}15` }]}>
              <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.smallCardVal, { color: colors.foreground }]}>
              ${orgStats.pendingInvoicesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.smallCardMeta, { color: colors.muted }]}>Outstanding Invoices</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderPersonalView = () => {
    const taskRate = personalStats.myTotalTasks > 0 ? (personalStats.myDoneTasks / personalStats.myTotalTasks) * 100 : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Task Performance</Text>
        
        {/* Progress tracker */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>Tasks Completed</Text>
              <Text style={[styles.cardVal, { color: colors.foreground }]}>
                {personalStats.myDoneTasks} / {personalStats.myTotalTasks}
              </Text>
            </View>
            <Text style={[styles.percent, { color: colors.primary }]}>{Math.round(taskRate)}%</Text>
          </View>
          <ProgressBar progress={taskRate} showLabel={false} height={8} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Status Breakdown</Text>

        <View style={styles.grid}>
          {[
            { label: 'To Do', value: personalStats.myTodoTasks, icon: 'list-outline', color: colors.primary },
            { label: 'In Progress', value: personalStats.myInProgressTasks, icon: 'play-outline', color: colors.secondary },
            { label: 'Under Review', value: personalStats.myReviewTasks, icon: 'eye-outline', color: colors.warning },
            { label: 'Done', value: personalStats.myDoneTasks, icon: 'checkmark-circle-outline', color: colors.success },
          ].map((item, idx) => (
            <View key={idx} style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[styles.gridVal, { color: colors.foreground }]}>{item.value}</Text>
              <Text style={[styles.gridMeta, { color: colors.muted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Analytics</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
          {isManagement ? 'Organization-wide business metrics' : 'Personal task completions & targets'}
        </Text>
      </View>

      {isManagement ? renderManagementView() : renderPersonalView()}
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
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  percent: {
    fontSize: 24,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  smallCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  smallCardVal: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  smallCardMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'flex-start',
  },
  gridVal: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  gridMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
