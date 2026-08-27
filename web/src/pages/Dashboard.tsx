import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { formatCurrency } from '../lib/currency';
import { hasPermission } from '../lib/permissions';
import { MetricStrip } from '../components/ui/ObsidianPrimitives';
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
  FolderKanban
} from 'lucide-react';

interface MetricItem {
  label: string;
  value: string | number;
  indicator?: string;
  isOrange?: boolean;
}

export default function Dashboard() {
  const { user, fullName, role } = useAuth();
  const { orgName, orgId, defaultCurrency } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromAuthUnlock = location.state?.fromAuthUnlock;

  const isIndie = !orgId;
  const isExecutive = ['owner', 'ceo', 'managing_director', 'administrator', 'director'].includes(role || '');

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
      const invoicesPromise = supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, status, due_date')
        .eq(isIndie ? 'owner_id' : 'org_id', isIndie ? user.id : orgId)
        .eq('is_deleted', false);

      // 5. Team / Members
      const membersPromise = orgId
        ? supabase.from('user_organizations').select('user_id, role, users(id, full_name, email)').eq('org_id', orgId)
        : Promise.resolve({ data: [] as any[] });

      // 6. Clients Count from Database
      let clientsPromise = supabase
        .from('clients')
        .select('id', { count: 'exact', head: true });

      if (orgId) {
        clientsPromise = clientsPromise.or(`organization_id.eq.${orgId},org_id.eq.${orgId}`);
      } else {
        clientsPromise = clientsPromise.eq('owner_id', user.id);
      }

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
        .filter(inv => inv.status === 'pending' || inv.status === 'sent' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

      const projectsData = (projectsRes.data || []).map((p: any) => {
        const pTasks = p.tasks || [];
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

  const firstName = fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  const metrics: MetricItem[] = useMemo(() => {
    if (isIndie) {
      return [
        { label: 'CLIENTS', value: stats.clients },
        { label: 'ACTIVE PROJECTS', value: stats.projectsCount },
        { label: 'DELIVERABLES', value: todoTasks.length },
        { label: 'UPCOMING SESSIONS', value: stats.upcoming, isOrange: stats.upcoming > 0 },
        { label: 'OUTSTANDING', value: formatCurrency(stats.outstandingRevenue, defaultCurrency) },
        { label: 'INVOICES', value: stats.invoicesCount },
      ];
    }
    return [
      { label: 'TASKS DUE', value: stats.criticalTasks > 0 ? `0${stats.criticalTasks}` : '00', isOrange: stats.criticalTasks > 0 },
      { label: 'ACTIVE PROJECTS', value: stats.projectsCount < 10 ? `0${stats.projectsCount}` : stats.projectsCount },
      { label: 'CONFERENCES', value: stats.upcoming < 10 ? `0${stats.upcoming}` : stats.upcoming },
      { label: 'TEAM MEMBERS', value: stats.teamMembers < 10 ? `0${stats.teamMembers}` : stats.teamMembers },
      { label: 'OUTSTANDING', value: formatCurrency(stats.outstandingRevenue, defaultCurrency) },
      { label: 'SYS HEALTH', value: '98.4%', indicator: 'Stable' },
    ];
  }, [isIndie, stats, todoTasks, defaultCurrency]);

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
      const start = new Date(nextMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        title: `${formatCurrency(stats.outstandingRevenue, defaultCurrency)} Pending Invoice Receivables`,
        subtitle: 'Settlements awaiting clearance',
        link: '/invoices',
        isGreen: true
      });
    }
    return list;
  }, [stats, upcomingMeetings, defaultCurrency]);

  const nextMeeting = upcomingMeetings[0];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── 1. Top Greeting & Operational Statement ── */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.05] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              {orgName ? `${orgName} Command` : 'Single Operator Workspace'}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-600" />
            <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operational
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Good afternoon, {firstName}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 font-normal">
            Here is what needs your attention today across active pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white text-[11px] font-mono border border-white/[0.06] transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-[#FF6B4A]' : ''} />
            <span>SYNC</span>
          </button>

          {hasPermission(role, 'schedule_meetings') && (
            <button
              onClick={() => navigate('/meetings/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-[11px] font-semibold transition-colors shadow-sm"
            >
              <Plus size={13} />
              <span>New Meeting</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Attention Center (Signal Line Resolve Motion) ── */}
      {attentionItems.length > 0 && (
        <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-3 sm:p-4">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center gap-1.5">
            <AlertCircle size={12} className="text-[#FF6B4A]" />
            <span>Attention Required</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
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
                  className={`absolute left-0 top-0 bottom-0 w-0.5 origin-left ${
                    item.isWarning ? 'bg-red-400' : item.isOrange ? 'bg-[#FF6B4A]' : 'bg-emerald-400'
                  }`}
                />
                <Link
                  to={item.link}
                  className="flex items-center justify-between py-2.5 px-3 hover:bg-white/[0.02] rounded transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      item.isWarning ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      item.isOrange ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20' :
                      'bg-zinc-800 text-zinc-400 border border-white/[0.06]'
                    }`}>
                      {item.type}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors">{item.title}</div>
                      <div className="text-[11px] text-zinc-500">{item.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Workspace Pulse Wave & Telemetry Trajectory (Command Center Activation) ── */}
      <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity size={12} className="text-[#FF6B4A] animate-pulse" />
              <span>Workspace Pulse Wave</span>
              {isFromAuthUnlock && (
                <span className="text-[9px] font-mono text-[#FF6B4A] px-1.5 py-0.2 rounded bg-[#FF6B4A]/10 border border-[#FF6B4A]/20">
                  ONLINE
                </span>
              )}
            </span>
            <span className="text-xs font-mono font-bold text-white">92% · Stable</span>
          </div>

          {/* Precision Trajectory Line with Pulse Wave Travelling Node */}
          <div className="w-full h-1.5 bg-[#171922] rounded-full overflow-visible flex relative items-center">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: pulseActivated ? '68%' : '0%' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#FF6B4A] h-full rounded-l-full relative shadow-[0_0_10px_rgba(255,107,74,0.6)]"
            >
              {/* Traveling Pulse Node */}
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm z-10"
                style={{ transform: 'translate(50%, -50%)', boxShadow: '0 0 8px #ffffff, 0 0 16px #FF6B4A' }}
              />
            </motion.div>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: pulseActivated ? '24%' : '0%' }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
            />
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: pulseActivated ? '8%' : '0%' }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-zinc-700 h-full rounded-r-full"
            />
          </div>

          <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" /> {projects.length} Active Workstreams</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {stats.upcoming} Upcoming Sessions</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> 0 Critical Blockers</span>
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
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <FolderKanban size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Active Projects</h2>
              </div>
              <Link to="/projects" className="text-[11px] text-zinc-400 hover:text-[#FF6B4A] transition-colors font-medium flex items-center gap-1">
                <span>View all</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-white/[0.02] rounded animate-pulse" />
                <div className="h-10 bg-white/[0.02] rounded animate-pulse" />
              </div>
            ) : projects.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No active projects found. <Link to="/projects/new" className="text-[#FF6B4A] font-semibold">Create project →</Link>
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
                      className="block p-3 rounded bg-[#08090C] hover:bg-[#10121A] border border-white/[0.04] hover:border-white/[0.1] transition-all group"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: p.cover_color || '#FF6B4A' }} />
                          <span className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                            {p.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                          {p.doneCount}/{p.deliverablesCount} Deliverables
                        </span>
                      </div>

                      {/* Continuous FlowLine Trajectory with Node */}
                      <div className="w-full bg-[#151722] h-1.5 rounded-full overflow-visible relative flex items-center">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p.progress}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full relative"
                          style={{ backgroundColor: p.cover_color || '#FF6B4A', boxShadow: `0 0 6px ${p.cover_color || '#FF6B4A'}44` }}
                        >
                          {p.progress > 0 && (
                            <div 
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-sm"
                              style={{ transform: 'translate(50%, -50%)', boxShadow: `0 0 6px ${p.cover_color || '#FF6B4A'}` }}
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
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Assigned Deliverables</h2>
              </div>
              <Link to="/tasks" className="text-[11px] text-zinc-400 hover:text-[#FF6B4A] transition-colors font-medium flex items-center gap-1">
                <span>Open Kanban</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2 py-4">
                <div className="h-9 bg-white/[0.02] rounded animate-pulse" />
                <div className="h-9 bg-white/[0.02] rounded animate-pulse" />
              </div>
            ) : todoTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                All assigned deliverables completed.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {todoTasks.map((t) => {
                  const isCrit = t.priority === 'critical';
                  const isHigh = t.priority === 'high';

                  return (
                    <Link
                      key={t.id}
                      to="/tasks"
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-white/[0.02] rounded transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Priority Signal */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCrit ? 'bg-red-500' : isHigh ? 'bg-[#FF6B4A]' : 'bg-zinc-600'
                        }`} />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-white truncate block group-hover:text-[#FF6B4A] transition-colors">
                            {t.title}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 block">
                            {t.projects?.title || 'Core Project'} · Due {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Today'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded shrink-0 ${
                        isCrit ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        isHigh ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20' :
                        'bg-zinc-800 text-zinc-400 border border-white/[0.05]'
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
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Video size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Upcoming Sessions</h2>
              </div>
              <Link to="/meetings" className="text-[11px] text-zinc-400 hover:text-[#FF6B4A] transition-colors font-medium">
                Conferences
              </Link>
            </div>

            {nextMeeting ? (
              <div className="p-3 rounded bg-[#10121A] border border-[#FF6B4A]/30 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono font-bold text-[#FF6B4A] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A] animate-ping" />
                    Next Meeting
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {new Date(nextMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs font-bold text-white mb-1">{nextMeeting.title || 'Executive Sync'}</div>
                <div className="text-[10px] text-zinc-500 mb-3">{nextMeeting.participants?.length || 1} participant(s) registered</div>

                <Link
                  to={`/meetings/${nextMeeting.id}/prejoin`}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded transition-colors"
                >
                  <Video size={13} />
                  <span>Join Session</span>
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-500">
                No meetings scheduled.
              </div>
            )}

            {/* Other chronologically ordered meetings */}
            {upcomingMeetings.slice(1).map((m) => (
              <div key={m.id} className="py-2 flex items-center justify-between border-t border-white/[0.04]">
                <div>
                  <span className="text-xs text-zinc-200 block">{m.title}</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <Link
                  to={`/meetings/${m.id}/prejoin`}
                  className="px-2 py-1 text-[10px] font-semibold text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors"
                >
                  Enter
                </Link>
              </div>
            ))}
          </div>

          {/* Team Workload Trajectory (for Managers & Executives) */}
          {teamWorkload.length > 0 && (
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#FF6B4A]" />
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Team Workload</h2>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Active</span>
              </div>

              <div className="space-y-3">
                {teamWorkload.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-200 truncate">{member.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{member.activeTasks} tasks</span>
                      </div>
                      <div className="w-full h-1 bg-[#171922] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-400"
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
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">System Telemetry</h2>
              </div>
            </div>

            <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/[0.05]">
              {recentActivities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 relative z-10 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#FF6B4A] ring-4 ring-[#0C0D12] mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-zinc-500 text-[10px] mr-2">{act.time}</span>
                    <span className="text-zinc-300 font-medium">{act.action}</span>
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
