import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Search,
  Edit,
  History,
  Sparkles,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  trigger_type: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  execution_count: number;
  failure_count: number;
  last_executed_at?: string;
  actions: any[];
  conditions: any[];
  created_at: string;
}

interface WorkflowUsage {
  current: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  tier: string;
  allowed: boolean;
  upgradeUrl?: string;
}

export default function WorkflowDashboard() {
  const navigate = useNavigate();
  const { orgId, orgName } = useWorkspace();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [usage, setUsage] = useState<WorkflowUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [testModalWorkflow, setTestModalWorkflow] = useState<WorkflowItem | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  const fetchWorkflowsAndUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (orgId) headers['x-organization-id'] = orgId;

      const [wfRes, usageRes] = await Promise.all([
        fetch(`${apiUrl}/workflows${orgId ? `?orgId=${orgId}` : ''}`, { headers }),
        fetch(`${apiUrl}/workflows/usage${orgId ? `?orgId=${orgId}` : ''}`, { headers }),
      ]);

      if (!wfRes.ok) throw new Error('Failed to load workflows.');
      const wfJson = await wfRes.json();
      const usageJson = await usageRes.json();

      setWorkflows(wfJson.workflows || []);
      setUsage(usageJson);
    } catch (err: any) {
      console.error('Workflow dashboard error:', err);
      setError(err.message || 'Failed to load workflow automation telemetry.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, orgId]);

  useEffect(() => {
    fetchWorkflowsAndUsage();
  }, [fetchWorkflowsAndUsage]);

  const handleToggleState = async (wf: WorkflowItem) => {
    try {
      const nextStatus = wf.status === 'active' ? 'paused' : 'active';
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch(`${apiUrl}/workflows/${wf.id}/state${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to change workflow state.');
      }

      setWorkflows((prev) =>
        prev.map((item) => (item.id === wf.id ? { ...item, status: nextStatus } : item))
      );
      // Refresh usage counter
      fetchWorkflowsAndUsage();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestRun = async (wf: WorkflowItem) => {
    setTestModalWorkflow(wf);
    setTestRunning(true);
    setTestResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch(`${apiUrl}/workflows/${wf.id}/test${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
        body: JSON.stringify({}),
      });

      const resJson = await res.json();
      setTestResult(resJson.execution);
    } catch (err: any) {
      setTestResult({ status: 'failed', error_message: err.message });
    } finally {
      setTestRunning(false);
    }
  };

  // Filtered workflows list
  const filteredWorkflows = workflows.filter((w) => {
    const matchesStatus = selectedStatus === 'all' || w.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || w.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.trigger_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const activeCount = workflows.filter((w) => w.status === 'active').length;
  const totalExecutions = workflows.reduce((acc, curr) => acc + (curr.execution_count || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-divider pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
              <Zap size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-main tracking-tight">Workflow Automations</h1>
              <p className="text-xs text-muted mt-0.5">
                Rule-based event triggers, task routing, deadlines, approvals & webhooks for {orgName ? `${orgName} Workspace` : 'Freelancer Workspace'}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quota Indicator Pill */}
          {usage && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-card-bg border border-divider text-xs">
              <span className="text-muted">Workflows:</span>
              <span className="font-mono font-bold text-main">
                {usage.current} / {usage.unlimited ? '∞ Unlimited' : usage.limit}
              </span>
              {!usage.unlimited && usage.remaining !== null && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${usage.remaining > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400 font-bold'}`}>
                  {usage.remaining} remaining
                </span>
              )}
            </div>
          )}

          <Link
            to="/workflows/templates"
            className="px-3.5 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-[#FF6B4A]" />
            <span>Templates</span>
          </Link>

          <Link
            to="/workflows/approvals"
            className="px-3.5 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors flex items-center gap-1.5"
          >
            <Inbox size={14} className="text-sky-400" />
            <span>Approvals</span>
          </Link>

          <Link
            to="/workflows/history"
            className="px-3.5 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors flex items-center gap-1.5"
          >
            <History size={14} />
            <span>Execution Logs</span>
          </Link>

          <button
            onClick={() => {
              if (usage && !usage.allowed) {
                alert(`Workflow quota reached (${usage.limit} max). Please upgrade at /pricing to add more workflows.`);
                navigate('/pricing');
                return;
              }
              navigate('/workflows/new');
            }}
            className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,107,74,0.3)] flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card-bg border border-divider">
          <span className="text-xs text-muted font-medium">Total Automations</span>
          <p className="text-2xl font-extrabold text-main mt-1 font-mono">{workflows.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-card-bg border border-divider">
          <span className="text-xs text-muted font-medium">Active & Armed</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-card-bg border border-divider">
          <span className="text-xs text-muted font-medium">Executions Handled</span>
          <p className="text-2xl font-extrabold text-sky-400 mt-1 font-mono">{totalExecutions}</p>
        </div>
        <div className="p-4 rounded-2xl bg-card-bg border border-divider">
          <span className="text-xs text-muted font-medium">Plan Capacity</span>
          <p className="text-2xl font-extrabold text-main mt-1 font-mono">
            {usage?.unlimited ? 'Unlimited' : `${usage?.remaining ?? 0} Left`}
          </p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-card-bg border border-divider">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows by title, trigger, or actions..."
            className="w-full bg-hover/50 border border-divider rounded-xl pl-9 pr-4 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-hover/50 border border-divider rounded-xl px-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]/50"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
            <option value="draft">Draft Only</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-hover/50 border border-divider rounded-xl px-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]/50"
          >
            <option value="all">All Categories</option>
            <option value="project_task">Project & Tasks</option>
            <option value="deadline_reminder">Deadlines & Escalations</option>
            <option value="team_notifications">Notifications</option>
            <option value="approval">Approvals</option>
            <option value="recurring_task">Recurring Tasks</option>
            <option value="project_status">Project Status</option>
            <option value="client_onboarding">Client Onboarding</option>
            <option value="form_request">Form Requests</option>
            <option value="webhook">Webhooks</option>
            <option value="exception_escalation">Exceptions</option>
          </select>
        </div>
      </div>

      {/* ── Workflow Card Grid ── */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted">SYNCHRONIZING AUTOMATION TELEMETRY...</p>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-card-bg/40 border border-dashed border-divider space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] mx-auto">
            <Zap size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-main">No Workflows Found</h3>
            <p className="text-xs text-muted max-w-md mx-auto mt-1">
              {workflows.length === 0
                ? 'Automate repetitive project, task, notification, and deadline actions with deterministic triggers and conditions.'
                : 'No workflows matched your current filter criteria.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/workflows/templates"
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main hover:border-[#FF6B4A]/40 transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={14} className="text-[#FF6B4A]" />
              <span>Explore Templates</span>
            </Link>
            <Link
              to="/workflows/new"
              className="px-4 py-2 rounded-xl bg-[#FF6B4A] text-white text-xs font-semibold hover:bg-[#FF552B] transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create from Scratch</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows.map((wf) => (
            <div
              key={wf.id}
              className="p-5 rounded-2xl bg-card-bg border border-divider hover:border-divider-strong transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Row: Category & Status */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-hover border border-divider text-muted">
                    {wf.category.replace('_', ' ')}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      wf.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : wf.status === 'paused'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {wf.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-main line-clamp-1 group-hover:text-[#FF6B4A] transition-colors">
                  {wf.name}
                </h3>
                <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                  {wf.description || 'Custom deterministic automation rule.'}
                </p>

                {/* Pipeline overview */}
                <div className="mt-4 pt-3 border-t border-divider space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <span className="font-mono text-[10px] uppercase font-bold text-main/80">Trigger:</span>
                    <span className="font-mono text-[11px] text-[#FF6B4A]">{wf.trigger_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span className="font-mono text-[10px] uppercase font-bold text-main/80">Pipeline:</span>
                    <span className="text-[11px]">
                      {wf.conditions.length} condition{wf.conditions.length === 1 ? '' : 's'} · {wf.actions.length} action{wf.actions.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Telemetry & Actions */}
              <div className="mt-5 pt-3 border-t border-divider flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
                  <span>{wf.execution_count} runs</span>
                  {wf.failure_count > 0 && <span className="text-red-400">{wf.failure_count} errs</span>}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Manual Test Run Button */}
                  <button
                    onClick={() => handleTestRun(wf)}
                    title="Manual Test Run"
                    className="p-1.5 rounded-lg bg-hover border border-divider text-muted hover:text-main transition-colors"
                  >
                    <Play size={13} />
                  </button>

                  {/* Toggle Active / Pause */}
                  <button
                    onClick={() => handleToggleState(wf)}
                    title={wf.status === 'active' ? 'Pause Automation' : 'Activate Automation'}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      wf.status === 'active'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {wf.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>

                  {/* Edit Builder */}
                  <Link
                    to={`/workflows/${wf.id}/edit`}
                    title="Edit Workflow Pipeline"
                    className="p-1.5 rounded-lg bg-hover border border-divider text-muted hover:text-main transition-colors"
                  >
                    <Edit size={13} />
                  </Link>

                  {/* View History */}
                  <Link
                    to={`/workflows/${wf.id}/history`}
                    title="View Execution History"
                    className="p-1.5 rounded-lg bg-hover border border-divider text-muted hover:text-main transition-colors"
                  >
                    <History size={13} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Test Run Result Modal ── */}
      <AnimatePresence>
        {testModalWorkflow && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-card-bg border border-divider p-6 space-y-4 shadow-2xl font-sans"
            >
              <div className="flex items-center justify-between border-b border-divider pb-3">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-[#FF6B4A]" />
                  <h3 className="text-base font-bold text-main">Manual Test Simulation</h3>
                </div>
                <button
                  onClick={() => setTestModalWorkflow(null)}
                  className="text-muted hover:text-main text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div>
                <p className="text-xs text-muted">
                  Simulating workflow: <strong className="text-main">{testModalWorkflow.name}</strong>
                </p>
                <p className="text-[11px] font-mono text-[#FF6B4A] mt-0.5">
                  Trigger: {testModalWorkflow.trigger_type}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-hover/40 border border-divider space-y-2">
                {testRunning ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-xs font-mono text-muted">EVALUATING PIPELINE & EXECUTING ACTIONS...</span>
                  </div>
                ) : testResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Execution Outcome:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          testResult.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : testResult.status === 'waiting_approval'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {testResult.status}
                      </span>
                    </div>

                    {testResult.error_message && (
                      <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        {testResult.error_message}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-divider/60">
                      <span className="text-[11px] font-mono text-muted uppercase font-bold">Action Steps Run:</span>
                      {testResult.actions_attempted?.map((act: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-card-bg/60 border border-divider">
                          <span className="text-main">{act.type}</span>
                          <span className={act.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                            {act.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setTestModalWorkflow(null)}
                  className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main hover:bg-hover/80"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
