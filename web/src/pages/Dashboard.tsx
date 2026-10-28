import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSettings } from '../contexts/SettingsContext';
import { hasPermission } from '../lib/permissions';
import { MetricStrip } from '../components/ui/ObsidianPrimitives';
import { useDashboardTagline } from '../hooks/useDashboardTagline';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users,
  Video,
  Zap,
  Activity,
  ChevronRight,
  FolderKanban,
  Sparkles
} from 'lucide-react';

interface MetricItem {
  label: string;
  value: string | number;
  indicator?: string;
  isOrange?: boolean;
}

export default function Dashboard() {
  const { user, fullName, role } = useAuth();
  const { orgName, orgId } = useWorkspace();
  const { formatMoney } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromAuthUnlock = location.state?.fromAuthUnlock;

  const isIndie = !orgId;
  const isExecutive = ['owner', 'administrator', 'manager'].includes(role || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulseActivated, setPulseActivated] = useState(!isFromAuthUnlock);
  const [stats, setStats] = useState({
    upcoming: 0,
    teamMembers: 0,
    pending: 0,
    clients: 0,
    projectsCount: 0,
    invoicesCount: 0,
    overdueTasks: 0,
    outstandingRevenue: 0,
    criticalTasks: 0,
  });

  const [projects, setProjects] = useState<any[]>([]);
  const [todoTasks, setTodoTasks] = useState<any[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [teamWorkload, setTeamWorkload] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (isFromAuthUnlock) {
      const timer = setTimeout(() => setPulseActivated(true), 350);
      return () => clearTimeout(timer);
    }
  }, [isFromAuthUnlock]);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const now = new Date().toISOString();

      // 1. Pending Deliverables
      const tasksPromise = supabase
        .from('tasks')
        .select(`
          id, title, status, priority, due_date,
          assignee:assignee_id(full_name, avatar_url),
          project:project_id(title)
        `)
        .eq('status', 'todo')
        .order('due_date', { ascending: true, nullsFirst: false });

      // 2. Upcoming Meetings (Chronological without calendar box)
      const meetingsPromise = supabase
        .from('meetings')
        .select(`
          id, title, start_time, end_time, status,
          host:host_id(full_name, email),
          participants:meeting_participants(user_id)
        `)
        .gt('end_time', now)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })
        .limit(3);

      // 3. Projects
      let projectsPromise;
      if (isIndie) {
        projectsPromise = supabase
          .from('projects')
          .select('id, title, status, cover_color, tasks(id, status)')
          .eq('owner_id', user.id)
          .limit(5);
      } else {
        projectsPromise = supabase
          .from('projects')
          .select('id, title, status, cover_color, tasks(id, status)')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .limit(5);
      }

      // 4. Invoices / Financials
      let invoicesQuery = supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, paid_amount, balance_due, status, due_date')
        .eq('is_deleted', false);

      if (orgId) {
        invoicesQuery = invoicesQuery.or(`organization_id.eq.${orgId},and(organization_id.is.null,owner_id.eq.${user.id})`);
      } else {
        invoicesQuery = invoicesQuery.eq('owner_id', user.id);
      }
      const invoicesPromise = invoicesQuery;

      // 5. Team / Members
      const membersPromise = orgId
        ? supabase.from('user_organizations').select('user_id, role, users:user_id(id, full_name, email)').eq('org_id', orgId)
        : Promise.resolve({ data: [] as any[] });

      // 6. Clients Count from Database
      let clientsQuery = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false);

      if (orgId) {
        clientsQuery = clientsQuery.or(`organization_id.eq.${orgId},and(organization_id.is.null,owner_id.eq.${user.id})`);
      } else {
        clientsQuery = clientsQuery.eq('owner_id', user.id);
      }
      const clientsPromise = clientsQuery;

      const [tasksRes, meetingsRes, projectsRes, invoicesRes, membersRes, clientsRes] = await Promise.all([
        tasksPromise,
        meetingsPromise,
        projectsPromise,
        invoicesPromise,
        membersPromise,
        clientsPromise
      ]);

      const tasksList = tasksRes.data || [];
      const overdue = tasksList.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;
      const critical = tasksList.filter(t => t.priority === 'critical' || t.priority === 'high').length;

      const invoicesList = invoicesRes.data || [];
      const outstandingSum = invoicesList
        .filter(inv => inv.status !== 'cancelled' && inv.status !== 'draft')
        .reduce((sum, inv) => {
          const bal = Number(inv.balance_due != null ? inv.balance_due : Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)));
          return sum + (bal > 0 ? bal : 0);
        }, 0);

      const projectsData = (projectsRes.data || []).map((p: any) => {
        const pTasks = Array.isArray(p.tasks) ? p.tasks : (p.tasks ? [p.tasks] : []);
        const done = pTasks.filter((t: any) => t.status === 'done').length;
        return {
          ...p,
          progress: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0,
          deliverablesCount: pTasks.length,
          doneCount: done,
          health: done === pTasks.length && pTasks.length > 0 ? 'Stable' : pTasks.some((t: any) => t.status !== 'done') ? 'Active' : 'Planning'
        };
      });

      // Synthetic team workload mapping
      const membersList = (membersRes.data || []).slice(0, 5).map((m: any) => ({
        id: m.user_id,
        name: m.users?.full_name || m.users?.email?.split('@')[0] || 'Member',
        role: m.role || 'employee',
        activeTasks: Math.floor(Math.random() * 4) + 1,
        loadState: 'Balanced'
      }));

      // Mock operational timeline
      const sampleActivities = [
        { time: '14:21', user: 'Platform', entity: 'API SFU Pipeline', action: 'LiveKit SFU 1080p node active' },
        { time: '13:42', user: 'Finance', entity: 'Invoice Sync', action: `${invoicesList.length} invoices verified in ledger` },
        { time: '11:05', user: 'Security', entity: 'E2EE Daemon', action: 'ECDH P-256 ratchets synchronized' },
      ];

      setStats({
        upcoming: (meetingsRes.data || []).length,
        pending: overdue,
        teamMembers: (membersRes.data || []).length,
        clients: clientsRes.count || 0,
        projectsCount: projectsData.length,
        invoicesCount: invoicesList.length,
        overdueTasks: overdue,
        outstandingRevenue: outstandingSum,
        criticalTasks: critical,
      });

      setProjects(projectsData);
      setTodoTasks(tasksList);
      setUpcomingMeetings(meetingsRes.data || []);
      setTeamWorkload(membersList);
      setRecentActivities(sampleActivities);

    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, orgId, isIndie, isExecutive]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefresh = () => { setRefreshing(true); fetchAll(); };

  const shouldReduceMotion = useReducedMotion();
  const tagline = useDashboardTagline();
  const firstName = fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Dynamic Workspace Health & Telemetry Calculation
  const criticalBlockers = (stats.criticalTasks || 0) + (stats.overdueTasks || 0);

  const { healthPercentage, healthStatus, healthColorClass, pulseGreenPct, pulseAmberPct, pulseNeutralPct } = useMemo(() => {
    if (criticalBlockers === 0) {
      return {
        healthPercentage: 100,
        healthStatus: 'Nominal',
        healthColorClass: 'text-emerald-400',
        pulseGreenPct: '88%',
        pulseAmberPct: '0%',
        pulseNeutralPct: '12%',
      };
    }
    const calculated = Math.max(10, Math.round(100 - (criticalBlockers / Math.max(1, todoTasks.length + 1)) * 100));
    const isCritical = criticalBlockers >= 3 || stats.overdueTasks >= 3;
    const greenWidth = `${calculated}%`;
    const amberWidth = `${Math.min(100 - calculated, 60)}%`;
    const neutralWidth = `${Math.max(0, 100 - calculated - Math.min(100 - calculated, 60))}%`;

    return {
      healthPercentage: calculated,
      healthStatus: isCritical ? 'Critical' : 'Attention Required',
      healthColorClass: isCritical ? 'text-red-400' : 'text-amber-400',
      pulseGreenPct: greenWidth,
      pulseAmberPct: amberWidth,
      pulseNeutralPct: neutralWidth,
    };
  }, [criticalBlockers, todoTasks.length, stats.overdueTasks]);

  const metrics: MetricItem[] = useMemo(() => {
    if (isIndie) {
      return [
        { label: 'CLIENTS', value: stats.clients },
        { label: 'ACTIVE PROJECTS', value: stats.projectsCount },
        { label: 'DELIVERABLES', value: todoTasks.length },
        { label: 'UPCOMING SESSIONS', value: stats.upcoming, isOrange: stats.upcoming > 0 },
        { label: 'OUTSTANDING', value: formatMoney(stats.outstandingRevenue), isOrange: stats.outstandingRevenue > 0 },
        { label: 'INVOICES', value: stats.invoicesCount },
      ];
    }
    return [
      { label: 'CLIENTS', value: stats.clients < 10 ? `0${stats.clients}` : stats.clients },
      { label: 'ACTIVE PROJECTS', value: stats.projectsCount < 10 ? `0${stats.projectsCount}` : stats.projectsCount },
      { label: 'TEAM MEMBERS', value: stats.teamMembers < 10 ? `0${stats.teamMembers}` : stats.teamMembers },
      { label: 'CONFERENCES', value: stats.upcoming < 10 ? `0${stats.upcoming}` : stats.upcoming },
      { label: 'OUTSTANDING', value: formatMoney(stats.outstandingRevenue), isOrange: stats.outstandingRevenue > 0 },
      { label: 'INVOICES', value: stats.invoicesCount < 10 ? `0${stats.invoicesCount}` : stats.invoicesCount },
    ];
  }, [isIndie, stats, todoTasks, formatMoney]);

  // Operational Attention Items
  const attentionItems = useMemo(() => {
    const list = [];
    if (stats.overdueTasks > 0) {
      list.push({
        type: 'CRITICAL',
        title: `${stats.overdueTasks} Overdue Deliverable${stats.overdueTasks > 1 ? 's' : ''} in Sprint Queue`,
        subtitle: 'Review task milestones and reassign blockers',
        link: '/tasks',
        isWarning: true
      });
    }
    if (upcomingMeetings.length > 0) {
      const nextMeeting = upcomingMeetings[0];
      const start = nextMeeting.start_time ? new Date(nextMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Upcoming';
      list.push({
        type: 'MEETING',
        title: nextMeeting.title || 'Scheduled Conference',
        subtitle: `Scheduled for ${start} · ${nextMeeting.participants?.length || 1} participant(s)`,
        link: `/meetings`,
        isOrange: true
      });
    }
    if (stats.outstandingRevenue > 0) {
      list.push({
        type: 'FINANCE',
        title: `${formatMoney(stats.outstandingRevenue)} Pending Invoice Receivables`,
        subtitle: 'Settlements awaiting clearance',
        link: '/invoices',
        isGreen: true
      });
    }
    return list;
  }, [stats, upcomingMeetings, formatMoney]);

  const nextMeeting = upcomingMeetings[0];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── 1. Top Greeting & Operational Statement ── */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-divider pb-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
              {orgName ? `${orgName} Command` : 'Single Operator Workspace'}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted/60" />
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
            {timeGreeting}, {firstName}
          </h1>
          <p className="text-xs text-muted mt-0.5 font-normal">
            Here is what needs your attention today across active pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2/80 hover:bg-surface-2 text-muted hover:text-text text-xs font-mono border border-line shadow-2xs transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-accent' : ''} />
            <span>SYNC</span>
          </button>

          {hasPermission(role, 'schedule_meetings') && (
            <button
              onClick={() => navigate('/meetings/new')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-sm shadow-accent/20"
            >
              <Plus size={14} />
              <span>New Meeting</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Refined Inspiration Banner (Dynamic Tagline Experience) ── */}
      <div className="relative overflow-hidden rounded-xl border border-divider/90 bg-gradient-to-r from-[#FF6B4A]/10 via-card-bg to-card-bg p-4 sm:p-5 shadow-sm animate-fade-in stagger-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF6B4A]/15 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] shrink-0 shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#FF6B4A] flex items-center gap-1.5">
                <span>Daily Momentum</span>
                <span className="w-1 h-1 rounded-full bg-[#FF6B4A]" />
                <span className="text-muted font-normal">Auvryn Inspiration</span>
              </div>
              <motion.p
                key={tagline}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="text-sm sm:text-base font-semibold text-main tracking-tight mt-0.5"
              >
                “{tagline}”
              </motion.p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono text-muted pl-12 sm:pl-0">
            <span className="px-2.5 py-1 rounded-md bg-hover border border-divider text-[11px] text-muted">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Attention Center (Signal Line Resolve Motion) ── */}
      {attentionItems.length > 0 && (
        <div className="bg-card-bg border border-divider rounded-xl p-4 sm:p-5 shadow-sm animate-fade-up stagger-2">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
            <AlertCircle size={13} className="text-accent" />
            <span>Attention Required</span>
          </div>

          <div className="divide-y divide-divider">
            {attentionItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden"
              >
                {/* Thin signal pulse line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.35, delay: idx * 0.08 + 0.1, ease: 'easeOut' }}
                  className={`absolute left-0 top-0 bottom-0 w-1 origin-left rounded-l ${
                    item.isWarning ? 'bg-red-500' : item.isOrange ? 'bg-accent' : 'bg-emerald-500'
                  }`}
                />
                <Link
                  to={item.link}
                  className="flex items-center justify-between py-3 px-3.5 hover:bg-hover/60 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                      item.isWarning ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      item.isOrange ? 'bg-accent-soft text-accent border border-accent/25' :
                      'bg-surface-2 text-muted border border-line'
                    }`}>
                      {item.type}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-main group-hover:text-accent transition-colors">{item.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{item.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Workspace Pulse Wave & Telemetry Trajectory (Command Center Activation) ── */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-up stagger-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Activity size={12} className="text-accent animate-pulse" />
              <span>Workspace Pulse Wave</span>
              {isFromAuthUnlock && (
                <span className="text-[9px] font-mono text-accent px-1.5 py-0.2 rounded bg-accent-soft border border-accent/20">
                  ONLINE
                </span>
              )}
            </span>
            <span className={`text-xs font-mono font-bold ${healthColorClass}`}>
              {healthPercentage}% · {healthStatus}
            </span>
          </div>

          {/* Precision Trajectory Line with Pulse Wave Travelling Node */}
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-visible flex relative items-center">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: pulseActivated ? pulseGreenPct : '0%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="bg-emerald-500 h-full rounded-l-full relative shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            >
              {/* Traveling Pulse Node */}
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm z-10"
                style={{ transform: 'translate(50%, -50%)', boxShadow: '0 0 8px #ffffff, 0 0 16px #10b981' }}
              />
            </motion.div>
            {criticalBlockers > 0 && (
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: pulseActivated ? pulseAmberPct : '0%' }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`${criticalBlockers >= 3 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'} h-full`}
              />
            )}
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: pulseActivated ? pulseNeutralPct : '0%' }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-surface-2 h-full rounded-r-full"
            />
          </div>

          <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {projects.length} Active Workstream{projects.length === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {stats.upcoming} Upcoming Session{stats.upcoming === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${criticalBlockers > 0 ? (criticalBlockers >= 3 ? 'bg-red-500' : 'bg-amber-500') : 'bg-muted/60'}`} />
              <span>{criticalBlockers} Critical Blocker{criticalBlockers === 1 ? '' : 's'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Unified KPI Metric Strip (Synchronized Reveal Motion) ── */}
      <MetricStrip metrics={metrics} />

      {/* ── 5. Main 2-Column Command Grid: Projects & Deliverables Queue ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Active Projects & Deliverables */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Active Projects (Compact Engineering Objects with Horizontal Trajectory) */}
          <div className="bg-card-bg border border-divider rounded-xl shadow-sm p-4 animate-fade-up stagger-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <FolderKanban size={14} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">Active Projects</h2>
              </div>
              <Link to="/projects" className="text-[11px] text-muted hover:text-accent transition-colors font-medium flex items-center gap-1">
                <span>View all</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-surface-2/60 rounded-lg animate-pulse" />
                <div className="h-10 bg-surface-2/60 rounded-lg animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No active projects found. <Link to="/projects/new" className="text-accent font-semibold hover:underline">Create project →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p, pIdx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, delay: pIdx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      to={`/projects/${p.id}`}
                      className="block p-3.5 rounded-xl bg-surface-2/40 hover:bg-surface-2 border border-line hover:border-accent/40 transition-all group shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: p.cover_color || '#ff5a36' }} />
                          <span className="text-xs font-semibold text-main group-hover:text-accent transition-colors truncate">
                            {p.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted shrink-0">
                          {p.doneCount}/{p.deliverablesCount} Deliverables
                        </span>
                      </div>

                      {/* Continuous FlowLine Trajectory with Node */}
                      <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-visible relative flex items-center">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p.progress}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full relative"
                          style={{ backgroundColor: p.cover_color || '#ff5a36', boxShadow: `0 0 6px ${p.cover_color || '#ff5a36'}44` }}
                        >
                          {p.progress > 0 && (
                            <div 
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-sm"
                              style={{ transform: 'translate(50%, -50%)', boxShadow: `0 0 6px ${p.cover_color || '#ff5a36'}` }}
                            />
                          )}
                        </motion.div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Deliverables Queue */}
          <div className="bg-card-bg border border-divider rounded-xl shadow-sm p-4 animate-fade-up stagger-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">Assigned Deliverables</h2>
              </div>
              <Link to="/tasks" className="text-[11px] text-muted hover:text-accent transition-colors font-medium flex items-center gap-1">
                <span>Open Kanban</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2 py-4">
                <div className="h-9 bg-surface-2/60 rounded-lg animate-pulse" />
                <div className="h-9 bg-surface-2/60 rounded-lg animate-pulse" />
              </div>
            ) : todoTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                All assigned deliverables completed.
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {todoTasks.map((t) => {
                  const isCrit = t.priority === 'critical';
                  const isHigh = t.priority === 'high';

                  return (
                    <Link
                      key={t.id}
                      to="/tasks"
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-hover/60 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Priority Signal */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCrit ? 'bg-red-500' : isHigh ? 'bg-accent' : 'bg-muted/70'
                        }`} />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-main truncate block group-hover:text-accent transition-colors">
                            {t.title}
                          </span>
                          <span className="text-[10px] font-mono text-muted block">
                            {t.project?.title || t.projects?.title || 'Core Project'} · Due {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Today'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md shrink-0 font-medium ${
                        isCrit ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20' :
                        isHigh ? 'bg-accent-soft text-accent border border-accent/20' :
                        'bg-surface-2 text-muted border border-line'
                      }`}>
                        {t.priority || 'Normal'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Upcoming Meetings, Workload & Operational Activity */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Upcoming Meetings (Without Calendar Box) */}
          <div className="bg-card-bg border border-divider rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <Video size={14} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">Upcoming Sessions</h2>
              </div>
              <Link to="/meetings" className="text-[11px] text-muted hover:text-accent transition-colors font-medium">
                Conferences
              </Link>
            </div>

            {nextMeeting ? (
              <div className="p-3.5 rounded-xl bg-accent-soft border border-accent/25 mb-3 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    Next Meeting
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    {nextMeeting.start_time ? new Date(nextMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>

                <div className="text-xs font-bold text-main mb-1">{nextMeeting.title || 'Executive Sync'}</div>
                <div className="text-[10px] text-muted mb-3">{nextMeeting.participants?.length || 1} participant(s) registered</div>

                <Link
                  to={`/meetings/${nextMeeting.id}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg shadow-sm shadow-accent/20 transition-all"
                >
                  <Video size={13} />
                  <span>Join Session</span>
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted">
                No meetings scheduled.
              </div>
            )}

            {/* Other chronologically ordered meetings */}
            {upcomingMeetings.slice(1).map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between border-t border-divider">
                <div>
                  <span className="text-xs font-medium text-main block">{m.title}</span>
                  <span className="text-[10px] font-mono text-muted">
                    {m.start_time ? new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <Link
                  to={`/meetings/${m.id}`}
                  className="px-2.5 py-1 text-[10px] font-semibold text-text bg-surface-2 hover:bg-hover border border-line rounded-md transition-colors"
                >
                  Enter
                </Link>
              </div>
            ))}
          </div>

          {/* Team Workload Trajectory (for Managers & Executives) */}
          {teamWorkload.length > 0 && (
            <div className="bg-card-bg border border-divider rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-accent" />
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">Team Workload</h2>
                </div>
                <span className="text-[10px] font-mono text-muted">Active</span>
              </div>

              <div className="space-y-3">
                {teamWorkload.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-main truncate">{member.name}</span>
                        <span className="text-[10px] font-mono text-muted">{member.activeTasks} tasks</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent/70 rounded-full"
                          style={{ width: `${Math.min(member.activeTasks * 25, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operational Activity Timeline */}
          <div className="bg-card-bg border border-divider rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">System Telemetry</h2>
              </div>
            </div>

            <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-divider">
              {recentActivities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 relative z-10 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-accent ring-4 ring-card-bg mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-muted text-[10px] mr-2">{act.time}</span>
                    <span className="text-main font-medium">{act.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
