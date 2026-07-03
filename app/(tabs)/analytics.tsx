import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Animated, StatusBar, RefreshControl,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { formatCurrency } from '@/lib/currency';
import { Ionicons } from '@expo/vector-icons';
import { HealthRing } from '@/components/ui/health-ring';
import { GlassCard } from '@/components/ui/glass-card';
import { ShimmerCard, ShimmerLoader } from '@/components/ui/shimmer-loader';

import { useColors } from '@/hooks/use-colors';

type Period = 'week' | 'month' | 'all';

function AnimatedBar({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const colors = useColors();
  const C = {
    bg: colors.background,
    surface: colors.surface,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    purple: '#8B5CF6',
  };

  const widthAnim = useRef(new Animated.Value(0)).current;
  const pct = total > 0 ? (value / total) * 100 : 0;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
  }, [pct]);

  const width = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: C.textSec, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: color, fontSize: 13, fontWeight: '800' }}>
          {value} / {total} <Text style={{ color: C.muted, fontSize: 11 }}>({Math.round(pct)}%)</Text>
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.border, overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: 8, borderRadius: 4, backgroundColor: color,
            width,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: string; color: string; sub?: string }) {
  const colors = useColors();
  const C = {
    bg: colors.background,
    surface: colors.surface,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    purple: '#8B5CF6',
  };

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
      <GlassCard glowColor={color} padding={16} radius={18} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${color}25`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</Text>
        {sub && <Text style={{ color: color, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{sub}</Text>}
      </GlassCard>
    </Animated.View>
  );
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const C = {
    bg: colors.background,
    surface: colors.surface,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    secondary: colors.secondary,
    text: colors.foreground,
    textSec: colors.secondary_text,
    muted: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    purple: '#8B5CF6',
  };

  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod]     = useState<Period>('month');
  const [orgCurrency, setOrgCurrency] = useState('USD');
  const headerAnim = useRef(new Animated.Value(-16)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const [orgStats, setOrgStats] = useState({
    totalProjects: 0, completedProjects: 0,
    totalTasks: 0, doneTasks: 0, inProgressTasks: 0,
    totalInvoices: 0, paidValue: 0, pendingValue: 0,
  });
  const [personalStats, setPersonalStats] = useState({
    total: 0, done: 0, inProgress: 0, review: 0, todo: 0,
  });

  const isManagement = ['owner', 'administrator', 'director', 'senior_manager', 'manager'].includes(user?.role || '');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('default_currency')
        .eq('id', user.organizationId)
        .single();
      
      if (orgData && orgData.default_currency) {
        setOrgCurrency(orgData.default_currency);
      }
      if (isManagement) {
        const [projRes, taskRes, invRes] = await Promise.all([
          supabase.from('projects').select('id, status').eq('org_id', user.organizationId),
          supabase.from('tasks').select('id, status').eq('org_id', user.organizationId),
          supabase.from('invoices').select('id, status, total_amount').eq('organization_id', user.organizationId),
        ]);

        let paid = 0, pending = 0;
        (invRes.data || []).forEach((inv: any) => {
          const val = Number(inv.total_amount) || 0;
          if (inv.status === 'paid') paid += val;
          else if (inv.status === 'pending' || inv.status === 'sent') pending += val;
        });

        setOrgStats({
          totalProjects: projRes.data?.length || 0,
          completedProjects: projRes.data?.filter((p: any) => p.status === 'completed').length || 0,
          totalTasks: taskRes.data?.length || 0,
          doneTasks: taskRes.data?.filter((t: any) => t.status === 'done').length || 0,
          inProgressTasks: taskRes.data?.filter((t: any) => t.status === 'in_progress').length || 0,
          totalInvoices: invRes.data?.length || 0,
          paidValue: paid, pendingValue: pending,
        });
      } else {
        const { data } = await supabase.from('tasks').select('id, status').eq('assignee_id', user.id);
        const tasks = data || [];
        setPersonalStats({
          total: tasks.length,
          done:  tasks.filter((t: any) => t.status === 'done').length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          review: tasks.filter((t: any) => t.status === 'review').length,
          todo:   tasks.filter((t: any) => t.status === 'todo').length,
        });
      }
    } catch (e) {
      console.error('Analytics error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.organizationId, user?.id, isManagement]);

  useFocusEffect(useCallback(() => { fetchAnalytics(); }, [fetchAnalytics]));

  const onRefresh = () => { setRefreshing(true); fetchAnalytics(); };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
        <View style={{ paddingHorizontal: 24, paddingTop: 64 }}>
          <ShimmerLoader height={36} width="50%" borderRadius={10} style={{ marginBottom: 8 }} />
          <ShimmerLoader height={14} width="70%" borderRadius={6} style={{ marginBottom: 32 }} />
          <ShimmerCard />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ShimmerCard style={{ flex: 1 }} />
            <ShimmerCard style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    );
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { transform: [{ translateY: headerAnim }], opacity: headerFade }]}>
          <View>
            <Text style={[styles.title, { color: C.text }]}>Analytics</Text>
            <Text style={styles.subtitle}>
              {isManagement ? 'Organization-wide business metrics' : 'Personal performance & targets'}
            </Text>
          </View>
          {/* Period chips */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
            {PERIODS.map(p => (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: period === p.key ? C.primary : C.card,
                  borderWidth: 1,
                  borderColor: period === p.key ? C.primary : C.border,
                }}
              >
                <Text style={{ color: period === p.key ? '#FFF' : C.muted, fontSize: 12, fontWeight: '700' }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          {isManagement ? (
            <>
              {/* Org KPIs */}
              <Text style={styles.sectionTitle}>Workspace Health</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <StatCard label="Projects" value={orgStats.totalProjects} icon="folder" color={C.primary} sub={`${orgStats.completedProjects} done`} />
                <StatCard label="Tasks" value={orgStats.totalTasks} icon="checkmark-circle" color={C.info} sub={`${orgStats.doneTasks} done`} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <StatCard label="Revenue" value={formatCurrency(orgStats.paidValue, orgCurrency)} icon="cash" color={C.success} />
                <StatCard label="Outstanding" value={formatCurrency(orgStats.pendingValue, orgCurrency)} icon="hourglass" color={C.warning} />
              </View>

              {/* Progress bars */}
              <Text style={styles.sectionTitle}>Completion Rates</Text>
              <GlassCard padding={20} radius={20} style={{ marginBottom: 24 }}>
                <AnimatedBar value={orgStats.completedProjects} total={orgStats.totalProjects} color={C.primary} label="Project Completion" />
                <AnimatedBar value={orgStats.doneTasks} total={orgStats.totalTasks} color={C.info} label="Task Completion" />
                <AnimatedBar value={orgStats.inProgressTasks} total={orgStats.totalTasks} color={C.warning} label="In Progress" />
              </GlassCard>

              {/* Health rings */}
              <Text style={styles.sectionTitle}>Visual Health</Text>
              <GlassCard padding={20} radius={20} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                  <HealthRing
                    progress={orgStats.totalProjects > 0 ? (orgStats.completedProjects / orgStats.totalProjects) * 100 : 0}
                    size={90} strokeWidth={7} label="Projects"
                  />
                  <HealthRing
                    progress={orgStats.totalTasks > 0 ? (orgStats.doneTasks / orgStats.totalTasks) * 100 : 0}
                    size={90} strokeWidth={7} label="Tasks"
                  />
                  <HealthRing
                    progress={orgStats.paidValue > 0 ? (orgStats.paidValue / (orgStats.paidValue + orgStats.pendingValue)) * 100 : 0}
                    size={90} strokeWidth={7} label="Revenue"
                  />
                </View>
              </GlassCard>

              {/* Finance breakdown */}
              <Text style={styles.sectionTitle}>Finance & Billing</Text>
              <GlassCard glowColor={C.success} padding={20} radius={20} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ color: C.textSec, fontSize: 13, fontWeight: '600' }}>Total Invoices</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{orgStats.totalInvoices}</Text>
                </View>
                <View style={styles.financeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.success }} />
                    <Text style={{ color: C.textSec, fontSize: 13 }}>Received Revenue</Text>
                  </View>
                  <Text style={{ color: C.success, fontSize: 15, fontWeight: '800' }}>
                    {formatCurrency(orgStats.paidValue, orgCurrency)}
                  </Text>
                </View>
                <View style={styles.financeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.warning }} />
                    <Text style={{ color: C.textSec, fontSize: 13 }}>Outstanding</Text>
                  </View>
                  <Text style={{ color: C.warning, fontSize: 15, fontWeight: '800' }}>
                    {formatCurrency(orgStats.pendingValue, orgCurrency)}
                  </Text>
                </View>
              </GlassCard>
            </>
          ) : (
            <>
              {/* Personal stats */}
              <Text style={styles.sectionTitle}>My Performance</Text>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <HealthRing
                  progress={personalStats.total > 0 ? (personalStats.done / personalStats.total) * 100 : 0}
                  size={120} strokeWidth={9} label="Overall Completion"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <StatCard label="Total" value={personalStats.total} icon="list" color={C.info} />
                <StatCard label="Done" value={personalStats.done} icon="checkmark-circle" color={C.success} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <StatCard label="In Progress" value={personalStats.inProgress} icon="play" color={C.warning} />
                <StatCard label="Review" value={personalStats.review} icon="eye" color={C.purple} />
              </View>

              <Text style={styles.sectionTitle}>Task Breakdown</Text>
              <GlassCard padding={20} radius={20} style={{ marginBottom: 24 }}>
                <AnimatedBar value={personalStats.done}       total={personalStats.total} color={C.success} label="Completed" />
                <AnimatedBar value={personalStats.inProgress} total={personalStats.total} color={C.warning} label="In Progress" />
                <AnimatedBar value={personalStats.review}     total={personalStats.total} color={C.purple}  label="Under Review" />
                <AnimatedBar value={personalStats.todo}       total={personalStats.total} color={C.info}    label="To Do" />
              </GlassCard>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20 },
  title: { color: '#F5F5FA', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#7A7A92', fontSize: 14, marginTop: 4 },
  sectionTitle: { color: '#F5F5FA', fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2A2A3A' },
});

