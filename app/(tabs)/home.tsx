import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import {
  ScrollView, Text, View, Pressable, StyleSheet,
  Animated, StatusBar, RefreshControl, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { useSharedValue, useAnimatedScrollHandler, FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollapsibleHeaderWrapper } from '@/components/ui/collapsible-header-wrapper';
import FreelancerPortalScreen from '../freelancer/portal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import { Ionicons } from '@expo/vector-icons';
import { PremiumKPI } from '@/components/ui';
import { AIInsightBanner } from '@/components/ui/ai-insight-banner';
import { GlassCard } from '@/components/ui/glass-card';
import { HealthRing } from '@/components/ui/health-ring';
import { ShimmerCard, ShimmerLoader } from '@/components/ui/shimmer-loader';
import { RoleBadge } from '@/components/ui/role-badge';
import { TiltCard } from '@/components/ui/tilt-card';
import { FloatingWrapper } from '@/components/ui/floating-wrapper';
import AnimatedPressable from '@/components/ui/animated-pressable';

const COLORS = {
  bg:       '#07070B',
  surface:  '#111118',
  card:     '#181822',
  border:   '#2A2A3A',
  primary:  '#FF6B4A',
  secondary:'#FFA86B',
  text:     '#F5F5FA',
  textSec:  '#B4B4C7',
  muted:    '#7A7A92',
  success:  '#34D399',
  warning:  '#FBBF24',
  error:    '#F87171',
  info:     '#60A5FA',
};

const QUICK_ACTIONS = (perms: Record<string, boolean>, router: any, colors: any, role: string) => [
  perms.meetings && {
    id: 'schedule', label: 'Schedule', sub: 'Meeting', icon: 'calendar' as const,
    color: colors.primary, onPress: () => router.push('/meetings/new'),
  },
  perms.meetings && {
    id: 'meetings', label: 'Meetings', sub: 'View All', icon: 'calendar-outline' as const,
    color: colors.secondary, onPress: () => router.push('/(tabs)/meetings'),
  },
  perms.directory && {
    id: 'team', 
    label: ['owner', 'ceo', 'managing_director', 'administrator'].includes(role) ? 'Employees' : 'Team', 
    sub: 'Directory', 
    icon: 'people' as const,
    color: colors.info || '#60A5FA', onPress: () => router.push('/team/directory'),
  },
  perms.departments && {
    id: 'departments', label: 'Departments', sub: 'Browse', icon: 'business' as const,
    color: '#8B5CF6', onPress: () => router.push('/departments'),
  },
  perms.reports && {
    id: 'reports', label: 'Reports', sub: 'Analytics', icon: 'bar-chart' as const,
    color: colors.info || '#60A5FA', onPress: () => router.push('/(tabs)/analytics'),
  },
  perms.invoices && {
    id: 'invoices', label: 'Invoices', sub: 'Billing', icon: 'receipt' as const,
    color: colors.success, onPress: () => router.push('/invoices'),
  },
  perms.roles && {
    id: 'roles', label: 'Roles', sub: 'Access Ctrl', icon: 'shield-checkmark' as const,
    color: colors.error, onPress: () => router.push('/admin/roles'),
  },
].filter(Boolean) as any[];


function MainHomeScreen() {
  const { user, isAuthenticated, isLoading, activeWorkspace, availableWorkspaces, switchWorkspace, hasWorkspacePermission } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerAnim = useRef(new Animated.Value(-20)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    upcoming: 0,
    teamMembers: 0,
    pending: 0,
    clients: 0,
    projectsCount: 0,
    invoicesCount: 0,
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [todoTasks, setTodoTasks] = useState<any[]>([]);
  const isFirstLoad = useRef(true);
  const [isWorkspaceModalVisible, setIsWorkspaceModalVisible] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const loadCachedData = async () => {
      try {
        const [cachedStats, cachedProjects, cachedTasks] = await Promise.all([
          AsyncStorage.getItem('cached_home_stats'),
          AsyncStorage.getItem('cached_home_projects'),
          AsyncStorage.getItem('cached_home_tasks'),
        ]);

        if (cachedStats) setStats(JSON.parse(cachedStats));
        if (cachedProjects) setProjects(JSON.parse(cachedProjects));
        if (cachedTasks) setTodoTasks(JSON.parse(cachedTasks));

        if (cachedStats || cachedProjects || cachedTasks) {
          setLoading(false);
          isFirstLoad.current = false;
        }
      } catch (e) { /* silent */ }
    };
    loadCachedData();
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    if (isFirstLoad.current) {
      setLoading(true);
    }
    try {
      const now = new Date().toISOString();

      const unreadPromise = supabase.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false);

      const tasksPromise = supabase.from('tasks').select('id, title, status, priority, due_date')
        .eq('assignee_id', user.id).neq('status', 'done')
        .order('due_date', { ascending: true }).limit(5);

      const isIndie = activeWorkspace?.type === 'independent';

      let meetingsRes: any = { count: 0 };
      let pendingRes: any = { count: 0 };
      let memberCountRes: any = { count: 0 };
      let projectsRes: any = { data: [] as any[] };
      let clientsRes: any = { count: 0 };
      let projectsCountRes: any = { count: 0 };
      let invoicesRes: any = { count: 0 };

      if (isIndie) {
        const [clientsVal, projectsCountVal, invoicesVal, projectsVal] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('is_deleted', false),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('is_deleted', false),
          supabase.from('projects').select('id, title, cover_color, tasks(id, status)').eq('owner_id', user.id).limit(4)
        ]);
        clientsRes = clientsVal;
        projectsCountRes = projectsCountVal;
        invoicesRes = invoicesVal;
        projectsRes = projectsVal as any;
      } else {
        const orgId = activeWorkspace?.id === 'independent' ? null : activeWorkspace?.id;
        const [meetingsVal, pendingVal, memberCountVal, projectsVal] = await Promise.all([
          supabase.from('meetings').select('id', { count: 'exact', head: true }).gt('start_time', now).is('is_cancelled', false),
          supabase.from('meeting_attendees').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('rsvp_status', 'pending'),
          orgId
            ? supabase.from('user_organizations').select('user_id', { count: 'exact', head: true }).eq('org_id', orgId)
            : Promise.resolve({ count: 0 }),
          orgId
            ? supabase.from('projects').select('id, title, cover_color, tasks(id, status)').eq('org_id', orgId).is('deleted_at', null).limit(4)
            : Promise.resolve({ data: [] })
        ]);
        meetingsRes = meetingsVal;
        pendingRes = pendingVal;
        memberCountRes = memberCountVal;
        projectsRes = projectsVal as any;
      }

      const [unreadRes, tasksRes] = await Promise.all([unreadPromise, tasksPromise]);

      setUnreadCount(unreadRes.count || 0);
      const newStats = {
        upcoming: meetingsRes.count || 0,
        pending: pendingRes.count || 0,
        teamMembers: memberCountRes.count || 0,
        clients: clientsRes.count || 0,
        projectsCount: projectsCountRes.count || 0,
        invoicesCount: invoicesRes.count || 0,
      };
      setStats(newStats);

      const newProjects = (projectsRes.data || []).map((p: any) => {
        const tasks = p.tasks || [];
        const done = tasks.filter((t: any) => t.status === 'done').length;
        return { ...p, progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0 };
      });
      setProjects(newProjects);

      const newTasks = tasksRes.data || [];
      setTodoTasks(newTasks);

      Promise.all([
        AsyncStorage.setItem('cached_home_stats', JSON.stringify(newStats)),
        AsyncStorage.setItem('cached_home_projects', JSON.stringify(newProjects)),
        AsyncStorage.setItem('cached_home_tasks', JSON.stringify(newTasks)),
      ]).catch(() => {});
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFirstLoad.current = false;
    }
  }, [user, activeWorkspace]);

  useFocusEffect(useCallback(() => { if (isAuthenticated && user) fetchAll(); }, [isAuthenticated, user?.id, fetchAll]));

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  if (isLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={{ paddingHorizontal: 24, paddingTop: 64 }}>
          <ShimmerLoader height={32} width="60%" borderRadius={10} style={{ marginBottom: 8 }} />
          <ShimmerLoader height={16} width="40%" borderRadius={6} style={{ marginBottom: 32 }} />
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) return null;
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={{ paddingHorizontal: 24, paddingTop: 64 }}>
          <ShimmerLoader height={32} width="60%" borderRadius={10} style={{ marginBottom: 8 }} />
          <ShimmerLoader height={16} width="40%" borderRadius={6} style={{ marginBottom: 32 }} />
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      </View>
    );
  }

  const isIndie = activeWorkspace?.type === 'independent';

  const perms = {
    meetings: hasWorkspacePermission("schedule_meetings" as any) || hasPermission(user?.role, 'schedule_meetings'),
    directory: hasWorkspacePermission("organization.view") || hasPermission(user?.role, 'view_team_directory'),
    departments: hasWorkspacePermission("department.view"),
    reports: hasWorkspacePermission("audit.view") || hasPermission(user?.role, 'view_reports'),
    invoices: hasWorkspacePermission("invoice.view"),
    roles: hasWorkspacePermission("organization.edit") || hasPermission(user?.role, 'manage_roles'),
  };

  const quickActions = isIndie
    ? [
        {
          id: 'clients', label: 'Clients', sub: 'CRM', icon: 'people' as const,
          color: '#10B981', onPress: () => router.push('/clients' as any),
        },
        {
          id: 'projects', label: 'Projects', sub: 'Work', icon: 'folder-open' as const,
          color: '#3B82F6', onPress: () => router.push('/(tabs)/projects' as any),
        },
        {
          id: 'invoices', label: 'Invoices', sub: 'Billing', icon: 'receipt' as const,
          color: '#F59E0B', onPress: () => router.push('/invoices' as any),
        }
      ]
    : QUICK_ACTIONS(perms, router, colors, user.role || '');

  const isOwner = ['owner', 'ceo', 'managing_director', 'administrator'].includes(user?.role || '');

  const kpiData1 = isIndie ? {
    title: 'Clients',
    value: stats.clients,
    progress: stats.clients > 0 ? Math.min(stats.clients / 10, 1) : 0,
    subtitle: stats.clients > 0 ? `${stats.clients} Active` : 'All Clear',
    status: 'success' as const,
  } : {
    title: 'Upcoming',
    value: stats.upcoming,
    progress: stats.upcoming > 0 ? Math.min(stats.upcoming / 10, 1) : 0,
    subtitle: stats.upcoming > 0 ? `${stats.upcoming} Scheduled` : 'All Clear',
    status: 'info' as const,
  };

  const kpiData2 = isIndie ? {
    title: 'Projects',
    value: stats.projectsCount,
    progress: stats.projectsCount > 0 ? Math.min(stats.projectsCount / 10, 1) : 0,
    subtitle: stats.projectsCount > 0 ? `${stats.projectsCount} Active` : 'All Clear',
    status: 'info' as const,
  } : {
    title: isOwner ? 'Employees' : 'Team Members',
    value: stats.teamMembers,
    progress: stats.teamMembers > 0 ? Math.min(stats.teamMembers / 50, 1) : 0,
    subtitle: stats.teamMembers > 0 ? `${stats.teamMembers} Active` : 'Ready to Invite',
    status: 'success' as const,
  };

  const kpiData3 = isIndie ? {
    title: 'Invoices',
    value: stats.invoicesCount,
    progress: stats.invoicesCount > 0 ? Math.min(stats.invoicesCount / 20, 1) : 0,
    subtitle: stats.invoicesCount > 0 ? `${stats.invoicesCount} Invoices` : 'All Clear',
    status: 'warning' as const,
  } : {
    title: 'Pending RSVPs',
    value: stats.pending,
    progress: stats.pending > 0 ? Math.min(stats.pending / 10, 1) : 0,
    subtitle: stats.pending > 0 ? `${stats.pending} Awaiting` : 'Everything Approved',
    status: 'warning' as const,
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user.fullName?.split(' ')[0] || 'there';

  const workspaceScore = Math.min(100, Math.round(
    ((isIndie ? stats.projectsCount : stats.upcoming) > 0 ? 20 : 0) +
    ((isIndie ? stats.clients : stats.teamMembers) > 1 ? 30 : 0) +
    (projects.length > 0 ? 30 : 0) +
    (todoTasks.length < 3 ? 20 : 10)
  ));

  const aiInsight =
    projects.length === 0
      ? 'Your workspace is set up. Start by creating your first project to track team progress.'
      : todoTasks.length === 0
      ? `Excellent! No pending tasks. Your team has ${projects.length} active project${projects.length > 1 ? 's' : ''} running smoothly.`
      : `You have ${todoTasks.length} pending task${todoTasks.length > 1 ? 's' : ''} across ${projects.length} project${projects.length > 1 ? 's' : ''}. Prioritize your critical items first.`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <CollapsibleHeaderWrapper
        scrollY={scrollY}
        title={`${greeting()}, ${firstName} 👋`}
        subtitle={
          <Pressable
            onPress={() => setIsWorkspaceModalVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>
              {activeWorkspace?.name || 'Personal Workspace'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Pressable>
        }
        rightComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RoleBadge role={(isIndie ? 'freelancer' : (activeWorkspace?.roles?.[0] || user.role)) as any} size="sm" />
            <Pressable
              onPress={() => router.push('/notifications' as any)}
              style={[styles.notifBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        }
      />

      <Reanimated.ScrollView
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ height: 110 + insets.top }} />

        <View style={styles.content}>
          <Reanimated.View entering={FadeInDown.delay(100).duration(500).springify()}>
            <FloatingWrapper bob={true} bobDelay={50} bobDepth={3}>
              <AIInsightBanner
                insight={aiInsight}
                score={workspaceScore}
                onPress={() => router.push('/(tabs)/analytics' as any)}
              />
            </FloatingWrapper>
          </Reanimated.View>

          <Reanimated.View entering={FadeInDown.delay(200).duration(500).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Overview</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28, justifyContent: 'space-between' }}>
              <PremiumKPI
                data={kpiData1}
                icon={<Ionicons name={isIndie ? "people" : "calendar"} size={18} color={isIndie ? "#34D399" : "#FF6B4A"} />}
                onPress={() => router.push(isIndie ? ('/clients' as any) : ('/(tabs)/meetings' as any))}
                isLoading={isLoading || loading}
              />
              <PremiumKPI
                data={kpiData2}
                icon={<Ionicons name={isIndie ? "folder-open" : "people"} size={18} color="#4DA3FF" />}
                onPress={() => router.push(isIndie ? ('/(tabs)/projects' as any) : ('/team/directory' as any))}
                isLoading={isLoading || loading}
              />
              <PremiumKPI
                data={kpiData3}
                icon={<Ionicons name={isIndie ? "cash" : "hourglass"} size={18} color={isIndie ? "#FBBF24" : "#FFC542"} />}
                onPress={() => router.push(isIndie ? ('/invoices' as any) : ('/(tabs)/meetings' as any))}
                isLoading={isLoading || loading}
              />
            </View>
          </Reanimated.View>

          {/* ── QUICK ACTIONS ── */}
          {quickActions.length > 0 && (
            <Reanimated.View entering={FadeInDown.delay(300).duration(500).springify()}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
                {quickActions.map((action, i) => (
                  <QuickActionCard key={action.id} action={action} index={i} />
                ))}
              </View>
            </Reanimated.View>
          )}

          {/* ── PROJECT HEALTH ── */}
          {projects.length > 0 && (
            <Reanimated.View entering={FadeInDown.delay(400).duration(500).springify()}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Project Health</Text>
                <Pressable onPress={() => router.push('/(tabs)/projects' as any)}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>See all →</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
                {projects.map((proj, i) => (
                  <ProjectHealthCard
                    key={proj.id}
                    project={proj}
                    index={i}
                    onPress={() => router.push(`/projects/${proj.id}` as any)}
                  />
                ))}
              </View>
            </Reanimated.View>
          )}

          {/* ── MY TASKS ── */}
          <Reanimated.View entering={FadeInDown.delay(500).duration(500).springify()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Tasks</Text>
              <Pressable onPress={() => router.push('/(tabs)/projects' as any)}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>View all →</Text>
              </Pressable>
            </View>
            <GlassCard bob={true} bobDelay={100} padding={0} radius={20} style={{ marginBottom: 28, overflow: 'hidden' }}>
              {todoTasks.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${colors.success}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '700' }}>All caught up!</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>No pending tasks. Great work! 🎉</Text>
                </View>
              ) : (
                todoTasks.map((task, idx) => (
                  <TaskRow key={task.id} task={task} isLast={idx === todoTasks.length - 1} onPress={() => router.push(`/tasks/${task.id}` as any)} />
                ))
              )}
            </GlassCard>
          </Reanimated.View>

          {/* ── STATUS CARD ── */}
          <Reanimated.View entering={FadeInDown.delay(600).duration(500).springify()}>
            <GlassCard bob={true} bobDelay={300} glowColor={colors.success} padding={16} radius={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, shadowColor: colors.success, shadowOpacity: 0.8, shadowRadius: 6 }} />
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }}>
                  Workspace Active
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Today'}
                </Text>
              </View>
            </GlassCard>
          </Reanimated.View>
        </View>
      </Reanimated.ScrollView>

      {/* Workspace Switcher Modal */}
      <Modal
        visible={isWorkspaceModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsWorkspaceModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setIsWorkspaceModalVisible(false)}
        >
          <View
            style={{
              width: '85%',
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 16 }}>
              Switch Workspace
            </Text>
            
            {availableWorkspaces.map((workspace) => {
              const isActive = activeWorkspace?.id === workspace.id;
              return (
                <Pressable
                  key={workspace.id}
                  onPress={async () => {
                    setIsWorkspaceModalVisible(false);
                    await switchWorkspace(workspace.id);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: isActive ? `${colors.primary}15` : 'transparent',
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ionicons
                      name={workspace.type === 'independent' ? 'person-outline' : 'business-outline'}
                      size={20}
                      color={isActive ? colors.primary : colors.muted}
                    />
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: isActive ? colors.primary : colors.foreground }}>
                        {workspace.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted, textTransform: 'capitalize' }}>
                        {workspace.type} Workspace
                      </Text>
                    </View>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickActionCard({ action, index }: { action: any; index: number }) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);

  const iconScale = useSharedValue(1);

  useEffect(() => {
    iconScale.value = withSpring(isPressed ? 1.08 : 1, { damping: 12, stiffness: 200 });
  }, [isPressed]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <Reanimated.View 
      entering={FadeInDown.delay(index * 60 + 300).duration(500).springify().mass(0.8)}
      style={{ width: '47.5%', minWidth: 135 }}
    >
      <AnimatedPressable
        scaleTo={0.93}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${action.label}, ${action.sub || ''}`}
        style={{
          height: 64,
          borderRadius: 32,
          borderWidth: 1,
          borderColor: isPressed ? '#43E8D8' : 'rgba(255, 255, 255, 0.08)',
          backgroundColor: '#131C33',
          overflow: 'hidden',
          shadowColor: isPressed ? '#43E8D8' : '#000000',
          shadowOffset: { width: 0, height: isPressed ? 10 : 8 },
          shadowOpacity: isPressed ? 0.24 : 0.18,
          shadowRadius: isPressed ? 18 : 12,
          elevation: isPressed ? 8 : 4,
        }}
      >
        <LinearGradient
          colors={isPressed ? ['#1B294A', '#243A66'] : ['#131C33', '#1B2946']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }]}
        >
          {/* Icon wrapper */}
          <Reanimated.View 
            style={[
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(67, 232, 216, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              },
              iconAnimatedStyle
            ]}
          >
            <Ionicons name={action.icon} size={22} color="#43E8D8" />
          </Reanimated.View>

          {/* Label centered vertically beside icon */}
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {action.label}
          </Text>
        </LinearGradient>
      </AnimatedPressable>
    </Reanimated.View>
  );
}

function ProjectHealthCard({ project, index, onPress }: { project: any; index: number; onPress: () => void }) {
  const colors = useColors();

  return (
    <Reanimated.View 
      entering={FadeInDown.delay(index * 80 + 300).duration(500).springify()}
      style={{ width: '47%' }}
    >
      <FloatingWrapper bob={true} bobDelay={index * 150} bobDepth={3}>
        <TiltCard
          onPress={onPress}
          style={{
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <HealthRing progress={project.progress} size={64} strokeWidth={5} />
          <Text
            style={{ color: colors.foreground, fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' }}
            numberOfLines={2}
          >
            {project.title}
          </Text>
        </TiltCard>
      </FloatingWrapper>
    </Reanimated.View>
  );
}

function TaskRow({ task, isLast, onPress }: { task: any; isLast: boolean; onPress: () => void }) {
  const colors = useColors();
  const priorityColors: Record<string, string> = {
    critical: colors.error,
    high:     colors.warning,
    medium:   colors.info || '#60A5FA',
    low:      colors.success,
  };
  const color = priorityColors[task.priority] || colors.muted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? '#FFFFFF06' : 'transparent',
        gap: 12,
      })}
    >
      {/* Priority indicator */}
      <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: color }} />

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {task.title}
        </Text>
        {task.due_date && (
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
            Due {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${color}20` }}>
        <Text style={{ color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
          {task.priority}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
  },
  greeting: {
    color: '#7A7A92',
    fontSize: 14,
    fontWeight: '500',
  },
  name: {
    color: '#F5F5FA',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  orgName: {
    color: '#B4B4C7',
    fontSize: 13,
    fontWeight: '500',
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#181822',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B4A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  content: { paddingHorizontal: 20 },
  sectionTitle: {
    color: '#F5F5FA',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
});

export default function HomeScreen() {
  const { user } = useAuth();
  if (user?.role === 'freelancer') {
    return (
      <TabScreenWrapper>
        <FreelancerPortalScreen />
      </TabScreenWrapper>
    );
  }
  return (
    <TabScreenWrapper>
      <MainHomeScreen />
    </TabScreenWrapper>
  );
}

