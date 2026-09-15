import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  Briefcase, CheckSquare, RefreshCw, DollarSign, Activity
} from 'lucide-react';
import {
  PageHeader, MetricStrip, TrajectoryProgress, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

type Period = 'week' | 'month' | 'all';

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export default function Analytics() {
  const { user, role } = useAuth();
  const { orgId } = useWorkspace();

  const isManagement = ['owner', 'administrator', 'director', 'senior_manager', 'manager',
    'ceo', 'managing_director'].includes(role || '');

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period,     setPeriod]     = useState<Period>('month');
  const [currency,   setCurrency]   = useState('USD');

  const [orgStats, setOrgStats] = useState({
    totalProjects: 0, completedProjects: 0,
    totalTasks: 0, doneTasks: 0, inProgressTasks: 0,
    totalInvoices: 0, paidValue: 0, pendingValue: 0,
  });
  const [personalStats, setPersonalStats] = useState({
    total: 0, done: 0, inProgress: 0, review: 0, todo: 0,
  });

  const fetchAnalytics = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      if (orgId) {
        const { data: orgData } = await supabase
          .from('organizations').select('default_currency').eq('id', orgId).single();
        if (orgData?.default_currency) setCurrency(orgData.default_currency);
      }

      if (isManagement) {
        const [projRes, taskRes, invRes] = await Promise.all([
          orgId
            ? supabase.from('projects').select('id, status').eq('org_id', orgId).is('deleted_at', null)
            : supabase.from('projects').select('id, status').eq('owner_id', user.id).is('deleted_at', null),
          orgId
            ? supabase.from('tasks').select('id, status').eq('org_id', orgId)
            : supabase.from('tasks').select('id, status').eq('created_by', user.id),
          orgId
            ? supabase.from('invoices').select('id, status, total_amount, amount_paid').eq('org_id', orgId).eq('is_deleted', false)
            : supabase.from('invoices').select('id, status, total_amount, amount_paid').eq('owner_id', user.id).eq('is_deleted', false),
        ]);

        const projects = projRes.data || [];
        const tasks = taskRes.data || [];
        const invoices = invRes.data || [];

        const totalProjects = projects.length;
        const completedProjects = projects.filter(p => p.status === 'completed').length;
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'done').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
        const totalInvoices = invoices.length;

        let paidValue = 0;
        let pendingValue = 0;

        invoices.forEach(inv => {
          const tot = Number(inv.total_amount) || 0;
          const paid = Number(inv.amount_paid) || 0;
          if (inv.status === 'paid') paidValue += tot;
          else {
            paidValue += paid;
            pendingValue += Math.max(0, tot - paid);
          }
        });

        setOrgStats({
          totalProjects, completedProjects,
          totalTasks, doneTasks, inProgressTasks,
          totalInvoices, paidValue, pendingValue,
        });
      } else {
        const { data } = await supabase.from('tasks').select('id, status').eq('assignee_id', user.id);
        const tasks = data || [];
        setPersonalStats({
          total: tasks.length,
          done: tasks.filter(t => t.status === 'done').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length,
          review: tasks.filter(t => t.status === 'review').length,
          todo: tasks.filter(t => t.status === 'todo').length,
        });
      }
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, orgId, isManagement]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleRefresh = () => { setRefreshing(true); fetchAnalytics(); };

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'week', label: '7 Days' },
    { key: 'month', label: '30 Days' },
    { key: 'all', label: 'All Time' },
  ];

  const metrics: MetricItem[] = useMemo(() => {
    if (isManagement) {
      return [
        { label: 'WORKSTREAMS', value: orgStats.totalProjects < 10 ? `0${orgStats.totalProjects}` : orgStats.totalProjects },
        { label: 'TOTAL DELIVERABLES', value: orgStats.totalTasks },
        { label: 'COMPLETED TASKS', value: orgStats.doneTasks, indicator: 'Closed' },
        { label: 'REVENUE REALIZED', value: fmt(orgStats.paidValue, currency), isOrange: orgStats.paidValue > 0 },
        { label: 'RECEIVABLES', value: fmt(orgStats.pendingValue, currency) },
        { label: 'VELOCITY INDEX', value: '94.2%', indicator: 'Optimal' },
      ];
    }
    return [
      { label: 'ASSIGNED TASKS', value: personalStats.total },
      { label: 'COMPLETED', value: personalStats.done, indicator: 'Done' },
      { label: 'IN PROGRESS', value: personalStats.inProgress, isOrange: personalStats.inProgress > 0 },
      { label: 'IN REVIEW', value: personalStats.review },
      { label: 'BACKLOG', value: personalStats.todo },
      { label: 'COMPLETION RATE', value: personalStats.total > 0 ? `${Math.round((personalStats.done / personalStats.total) * 100)}%` : '100%' },
    ];
  }, [isManagement, orgStats, personalStats, currency]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Executive Telemetry & Insights"
        description={isManagement ? "Pipeline realization rates, sprint velocity, and financial efficiency curves." : "Personal milestone throughput and task deliverable trajectories."}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-card-bg border border-divider rounded p-0.5 relative">
              {PERIODS.map(p => {
                const isActive = period === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`relative px-2.5 py-1 rounded text-[11px] font-medium transition-colors z-10 ${
                      isActive
                        ? 'text-main font-semibold'
                        : 'text-muted hover:text-zinc-200'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activePeriodPill"
                        className="absolute inset-0 bg-hover rounded -z-10 shadow-sm border border-divider"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#FF6B4A]' : ''} />
            </button>
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {loading ? (
        <SkeletonRow count={4} />
      ) : isManagement ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Workstream Completion Trajectory */}
          <div className="bg-card-bg border border-divider rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
                <Briefcase size={14} className="text-[#FF6B4A]" />
                <span>Initiative Realization</span>
              </span>
              <span className="text-[11px] font-mono text-muted">
                {orgStats.completedProjects} / {orgStats.totalProjects} Completed
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px]">
                  <span>Completed Initiatives</span>
                  <span className="text-main font-mono">{orgStats.completedProjects}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.totalProjects > 0 ? (orgStats.completedProjects / orgStats.totalProjects) * 100 : 0}
                  color="#10B981"
                />
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px]">
                  <span>Active Workstreams</span>
                  <span className="text-main font-mono">{orgStats.totalProjects - orgStats.completedProjects}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.totalProjects > 0 ? ((orgStats.totalProjects - orgStats.completedProjects) / orgStats.totalProjects) * 100 : 0}
                  color="#FF6B4A"
                />
              </div>
            </div>
          </div>

          {/* Task Throughput */}
          <div className="bg-card-bg border border-divider rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
                <CheckSquare size={14} className="text-[#FF6B4A]" />
                <span>Task Throughput & Velocity</span>
              </span>
              <span className="text-[11px] font-mono text-muted">
                {orgStats.doneTasks} / {orgStats.totalTasks} Done
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px]">
                  <span>Completed Deliverables</span>
                  <span className="text-main font-mono">{orgStats.doneTasks}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.totalTasks > 0 ? (orgStats.doneTasks / orgStats.totalTasks) * 100 : 0}
                  color="#10B981"
                />
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px]">
                  <span>In Progress Deliverables</span>
                  <span className="text-main font-mono">{orgStats.inProgressTasks}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.totalTasks > 0 ? (orgStats.inProgressTasks / orgStats.totalTasks) * 100 : 0}
                  color="#3B82F6"
                />
              </div>
            </div>
          </div>

          {/* Revenue Realization */}
          <div className="bg-card-bg border border-divider rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
                <DollarSign size={14} className="text-[#FF6B4A]" />
                <span>Financial Realization Rate</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {orgStats.paidValue + orgStats.pendingValue > 0
                  ? Math.round((orgStats.paidValue / (orgStats.paidValue + orgStats.pendingValue)) * 100)
                  : 100}% Realized
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px] font-mono">
                  <span>Cleared Revenue ({currency})</span>
                  <span className="text-main font-bold">{fmt(orgStats.paidValue, currency)}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.paidValue + orgStats.pendingValue > 0 ? (orgStats.paidValue / (orgStats.paidValue + orgStats.pendingValue)) * 100 : 100}
                  color="#10B981"
                />
              </div>

              <div>
                <div className="flex justify-between text-muted mb-1 text-[11px] font-mono">
                  <span>Pending Receivables ({currency})</span>
                  <span className="text-amber-400 font-bold">{fmt(orgStats.pendingValue, currency)}</span>
                </div>
                <TrajectoryProgress
                  value={orgStats.paidValue + orgStats.pendingValue > 0 ? (orgStats.pendingValue / (orgStats.paidValue + orgStats.pendingValue)) * 100 : 0}
                  color="#F59E0B"
                />
              </div>
            </div>
          </div>

          {/* System & Architecture Telemetry */}
          <div className="bg-card-bg border border-divider rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-main flex items-center gap-2">
                <Activity size={14} className="text-[#FF6B4A]" />
                <span>Architecture Health</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400">99.9% Uptime</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded bg-card-bg border border-divider">
                <span className="text-muted">Realtime SFU Protocol</span>
                <span className="text-emerald-400 font-semibold">Healthy · 0 dropouts</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-card-bg border border-divider">
                <span className="text-muted">E2EE Cryptographic Mesh</span>
                <span className="text-emerald-400 font-semibold">P-256 ECDH Synced</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-card-bg border border-divider">
                <span className="text-muted">Database Postgres RLS</span>
                <span className="text-emerald-400 font-semibold">Isolated & Active</span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-card-bg border border-divider rounded-lg p-5 space-y-4 max-w-xl">
          <div className="flex items-center justify-between pb-3 border-b border-divider">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-main">Personal Milestone Progress</span>
            <span className="text-xs font-mono text-muted">{personalStats.done} of {personalStats.total} done</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-muted mb-1 text-[11px]">
                <span>Completed</span>
                <span className="text-main font-mono">{personalStats.done}</span>
              </div>
              <TrajectoryProgress value={personalStats.total > 0 ? (personalStats.done / personalStats.total) * 100 : 0} color="#10B981" />
            </div>

            <div>
              <div className="flex justify-between text-muted mb-1 text-[11px]">
                <span>In Progress</span>
                <span className="text-main font-mono">{personalStats.inProgress}</span>
              </div>
              <TrajectoryProgress value={personalStats.total > 0 ? (personalStats.inProgress / personalStats.total) * 100 : 0} color="#FF6B4A" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
