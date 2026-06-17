import { ScrollView, Text, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { RoleBadge } from '@/components/ui/role-badge';
import { PremiumButton } from '@/components/ui/premium-button';
import { ActivityFeed } from '@/components/ui/activity-feed';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { hasPermission } from '@/lib/permissions';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/ui/progress-bar';

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const router = useRouter();

  // Redirect freelancer immediately to their portal via AuthGate in _layout.tsx
  // No local redirect needed here — prevents double navigation

  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({
    upcoming: 0,
    teamMembers: 0,
    pending: 0,
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [todoTasks, setTodoTasks] = useState<any[]>([]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (e) {
      console.error('Error fetching unread notification count:', e);
    }
  }, [user]);

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const now = new Date().toISOString();

      // Get upcoming accepted meetings
      const { count: upcomingCount } = await supabase
        .from('meeting_attendees')
        .select(`meeting_id, meetings!inner(start_time)`, { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('rsvp_status', 'accepted')
        .gt('meetings.start_time', now);

      // Get pending meetings
      const { count: pendingCount } = await supabase
        .from('meeting_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('rsvp_status', 'pending');

      // Get team members count
      let teamMembersCount = 0;
      const { data: myOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id);
        
      if (myOrgs && myOrgs.length > 0) {
        const orgIds = myOrgs.map(o => o.organization_id);
        // Count unique users in those orgs
        const { data: teamMembersData } = await supabase
          .from('user_organizations')
          .select('user_id')
          .in('organization_id', orgIds);
          
        if (teamMembersData) {
          const uniqueIds = new Set(teamMembersData.map(t => t.user_id));
          teamMembersCount = uniqueIds.size;
        }
      }

      setStats({
        upcoming: upcomingCount || 0,
        pending: pendingCount || 0,
        teamMembers: teamMembersCount,
      });

      // Fetch projects for progress tracker
      if (user.organizationId) {
        const { data: projData } = await supabase
          .from('projects')
          .select(`
            id,
            title,
            cover_color,
            tasks (id, status)
          `)
          .eq('org_id', user.organizationId)
          .limit(3);

        const formatted = (projData || []).map((p: any) => {
          const tList = p.tasks || [];
          const total = tList.length;
          const done = tList.filter((t: any) => t.status === 'done').length;
          return {
            id: p.id,
            title: p.title,
            cover_color: p.cover_color,
            progress: total > 0 ? (done / total) * 100 : 0
          };
        });
        setProjects(formatted);
      }

      // Fetch assigned to-do tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          due_date
        `)
        .eq('assignee_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(5);

      setTodoTasks(taskData || []);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user) {
        fetchDashboardStats();
        fetchUnreadCount();
      }
    }, [isAuthenticated, user?.id, fetchDashboardStats, fetchUnreadCount])
  );

  useEffect(() => {
    let frameId: number;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (isAuthenticated && user) {
      frameId = requestAnimationFrame(() => {
        fetchDashboardStats();
        fetchUnreadCount();
      });

      // Remove any existing channel with this name before creating a new one
      // to avoid "cannot add postgres_changes callbacks after subscribe()" error
      const channelName = `notifications:count:${user.id}`;
      const existing = supabase.getChannels().find(
        (ch: any) => ch.topic === `realtime:${channelName}`
      );
      if (existing) {
        supabase.removeChannel(existing);
      }

      // Subscribe to real-time notifications count
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[HomeScreen] Realtime channel error for notifications count');
          }
        });
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, fetchDashboardStats, fetchUnreadCount]);


  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm text-muted mt-3">Loading your workspace...</Text>
      </ScreenContainer>
    );
  }

  // Handle case where user is authenticated but has no profile (orphan account)
  if (isAuthenticated && !user) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text className="text-2xl font-bold text-error mb-4">Profile Missing</Text>
        <Text className="text-base text-muted text-center mb-8">
          Your account exists but your profile could not be found. This can happen if an error occurred during registration.
        </Text>
        <PremiumButton
          variant="outline"
          size="lg"
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          Sign Out
        </PremiumButton>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ScreenContainer className="justify-center items-center p-6">
        <Text className="text-2xl font-bold text-foreground mb-4">Welcome to CoreFlow</Text>
        <Text className="text-base text-muted text-center mb-8">
          Please sign in to continue
        </Text>
        <PremiumButton
          variant="primary"
          size="lg"
          onPress={() => router.push('/login')}
        >
          Sign In
        </PremiumButton>
      </ScreenContainer>
    );
  }

  const getRoleGreeting = () => {
    switch (user.role) {
      case 'managing_director':
        return 'Managing Director Dashboard';
      case 'ceo':
        return 'Executive Dashboard';
      case 'cto':
        return 'Technology Dashboard';
      case 'project_manager':
        return 'Project Dashboard';
      case 'hr':
        return 'HR Dashboard';
      case 'developer':
        return 'Developer Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const canManageRoles = hasPermission(user?.role, 'manage_roles');
  const canScheduleMeetings = hasPermission(user?.role, 'schedule_meetings');
  const canViewDirectory = hasPermission(user?.role, 'view_team_directory');
  const canViewInvoices = hasPermission(user?.role, 'view_invoices');
  const canViewReports = hasPermission(user?.role, 'view_reports');
  const canViewDepartments = user?.role !== 'freelancer';

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-1 pr-4">
            <Text className="text-3xl font-bold text-foreground mb-1">
              {getRoleGreeting()}
            </Text>
            <Text className="text-sm text-muted">
              Welcome back, {user.fullName}
            </Text>
          </View>
          
          <Pressable
            onPress={() => router.push('/notifications' as any)}
            className="w-11 h-11 rounded-full items-center justify-center border border-border"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
            {unreadCount > 0 && (
              <View className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary border-2 border-background items-center justify-center px-1">
                <Text className="text-[9px] text-white font-bold">{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* User Info Card */}
        <View
          className="p-6 rounded-2xl mb-5 border border-border"
          style={{ backgroundColor: colors.surface }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-semibold text-foreground">
                {user.fullName}
              </Text>
              {user.organizationName ? (
                <Text className="text-sm text-primary font-semibold mt-1">
                  🏢 {user.organizationName}
                </Text>
              ) : null}
              <Text className="text-xs text-muted mt-0.5">
                {user.email}
              </Text>
            </View>
            <RoleBadge role={user.role as any} size="md" />
          </View>

          {user.department && (
            <Text className="text-sm text-muted">
              Department: {user.department}
            </Text>
          )}
        </View>

        {/* Quick Actions — 2×2 Premium Grid */}
        <View className="mb-5">
          <Text className="text-lg font-bold text-foreground mb-4">
            Quick Actions
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {canScheduleMeetings && (
              <Pressable
                onPress={() => router.push('/meetings/new')}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.primary}18` }]}>
                  <Ionicons name="calendar" size={22} color={colors.primary} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Schedule</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>New Meeting</Text>
              </Pressable>
            )}

            {canScheduleMeetings && (
              <Pressable
                onPress={() => router.push('/meetings')}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.secondary}18` }]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.secondary} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Meetings</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>View All</Text>
              </Pressable>
            )}

            {canViewDirectory && (
              <Pressable
                onPress={() => router.push('/team/directory' as any)}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.tertiary || colors.primary}18` }]}>
                  <Ionicons name="people" size={22} color={colors.tertiary || colors.primary} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Team</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>Directory</Text>
              </Pressable>
            )}

            {canViewDepartments && (
              <Pressable
                onPress={() => router.push('/departments' as any)}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.primary}18` }]}>
                  <Ionicons name="business" size={22} color={colors.primary} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Departments</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>Browse</Text>
              </Pressable>
            )}

            {canViewReports && (
              <Pressable
                onPress={() => router.push('/reports' as any)}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.secondary}18` }]}>
                  <Ionicons name="bar-chart" size={22} color={colors.secondary} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Reports</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>Analytics Hub</Text>
              </Pressable>
            )}

            {canViewInvoices && (
              <Pressable
                onPress={() => router.push('/invoices' as any)}
                style={[quickActionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.success || '#22c55e'}18` }]}>
                  <Ionicons name="receipt" size={22} color={colors.success || '#22c55e'} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Invoices</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>Billing</Text>
              </Pressable>
            )}

            {canManageRoles && (
              <Pressable
                onPress={() => router.push('/admin/roles' as any)}
                style={[quickActionStyles.card, { backgroundColor: `${colors.error}08`, borderColor: `${colors.error}25`, width: '47%' }]}
              >
                <View style={[quickActionStyles.iconRing, { backgroundColor: `${colors.error}18` }]}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.error} />
                </View>
                <Text style={[quickActionStyles.cardTitle, { color: colors.foreground }]}>Roles</Text>
                <Text style={[quickActionStyles.cardSub, { color: colors.muted }]}>Manage Access</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Stats */}
        <View className="mb-5">
          <Text className="text-lg font-bold text-foreground mb-4">
            Overview
          </Text>

          <View className="flex-row gap-3">
            <View
              className="flex-1 p-4 rounded-xl items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-2xl font-bold text-primary">{stats.upcoming}</Text>
              <Text className="text-xs text-muted mt-2">Upcoming</Text>
            </View>

            <View
              className="flex-1 p-4 rounded-xl items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-2xl font-bold text-secondary">{stats.teamMembers}</Text>
              <Text className="text-xs text-muted mt-2">Team Members</Text>
            </View>

            <View
              className="flex-1 p-4 rounded-xl items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-2xl font-bold text-tertiary">{stats.pending}</Text>
              <Text className="text-xs text-muted mt-2">Pending</Text>
            </View>
          </View>
        </View>

        {/* Projects Progress Tracker */}
        {projects.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-foreground mb-4">
              Project Progress
            </Text>
            <View 
              className="p-4 rounded-2xl border border-border"
              style={{ backgroundColor: colors.surface }}
            >
              {projects.map((proj, idx) => (
                <Pressable
                  key={proj.id}
                  onPress={() => router.push(`/projects/${proj.id}` as any)}
                  style={{
                    marginBottom: idx < projects.length - 1 ? 16 : 0,
                  }}
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {proj.title}
                    </Text>
                    <Text className="text-xs font-bold text-primary">
                      {Math.round(proj.progress)}%
                    </Text>
                  </View>
                  <ProgressBar progress={proj.progress} showLabel={false} height={6} color={proj.cover_color} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* My To-Do Tasks */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">
            My To-Do Tasks
          </Text>
          <View 
            className="p-4 rounded-2xl border border-border"
            style={{ backgroundColor: colors.surface }}
          >
            {todoTasks.map((t, idx) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/tasks/${t.id}` as any)}
                className="flex-row justify-between items-center py-2"
                style={{
                  borderBottomWidth: idx < todoTasks.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {t.title}
                  </Text>
                  {t.due_date ? (
                    <Text className="text-xs text-muted mt-1">
                      📅 Due: {new Date(t.due_date).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                <View 
                  className="px-2 py-1 rounded bg-muted/10"
                  style={{ backgroundColor: `${t.priority === 'critical' ? colors.error : t.priority === 'high' ? colors.warning : colors.primary}15` }}
                >
                  <Text 
                    className="text-[10px] font-bold uppercase"
                    style={{ color: t.priority === 'critical' ? colors.error : t.priority === 'high' ? colors.warning : colors.primary }}
                  >
                    {t.priority}
                  </Text>
                </View>
              </Pressable>
            ))}

            {todoTasks.length === 0 && (
              <View className="py-4 items-center">
                <Text className="text-sm text-muted">🎉 You have no pending tasks!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Activity Feed */}
        <View className="mb-5">
          <Text className="text-lg font-bold text-foreground mb-4">
            Recent Activity
          </Text>
          <ActivityFeed />
        </View>

        {/* Status */}
        <View
          className="p-4 rounded-xl border border-border mb-5"
          style={{ backgroundColor: colors.surface }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="text-sm font-semibold text-foreground">
              Status: Active
            </Text>
          </View>
          <Text className="text-xs text-muted">
            Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Today'}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const quickActionStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'flex-start',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '500',
  },
});
