import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  ArrowLeft,
  AlertTriangle,
  RotateCw,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';

interface ExecutionItem {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: 'completed' | 'failed' | 'running' | 'waiting_approval' | 'cancelled';
  error_message?: string;
  actions_attempted: any[];
  event_reference: any;
  duration_ms?: number;
  created_at: string;
  workflow?: {
    name: string;
    category: string;
  };
}

export default function WorkflowHistory() {
  const { orgId } = useWorkspace();

  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedExec, setSelectedExec] = useState<ExecutionItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (orgId) headers['x-organization-id'] = orgId;

      const res = await fetch(`${apiUrl}/workflows/executions/all${orgId ? `?orgId=${orgId}` : ''}`, { headers });
      if (!res.ok) throw new Error('Failed to load executions.');
      const json = await res.json();
      setExecutions(json.executions || []);
    } catch (err: any) {
      console.error('Executions fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, orgId]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleRetry = async (execId: string) => {
    setRetryingId(execId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch(`${apiUrl}/workflows/executions/${execId}/retry${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
      });

      if (!res.ok) throw new Error('Retry failed');
      const resJson = await res.json();
      alert(`Retry dispatched successfully! Result: ${resJson.execution?.status}`);
      fetchExecutions();
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = executions.filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSearch =
      !search ||
      (e.workflow?.name && e.workflow.name.toLowerCase().includes(search.toLowerCase())) ||
      e.trigger_type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-divider pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/workflows"
            className="p-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <History size={18} className="text-[#FF6B4A]" />
              <h1 className="text-2xl font-extrabold text-main tracking-tight">Execution History & Logs</h1>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Authoritative audit trail of deterministic triggers, condition evaluations, and attempted action steps.
            </p>
          </div>
        </div>

        <button
          onClick={fetchExecutions}
          className="px-3.5 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card-bg border border-divider">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by workflow name or trigger type..."
            className="w-full bg-hover/50 border border-divider rounded-xl pl-9 pr-4 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-hover/50 border border-divider rounded-xl px-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]/50"
        >
          <option value="all">All Execution States</option>
          <option value="completed">Completed Only</option>
          <option value="failed">Failed Only</option>
          <option value="waiting_approval">Waiting Approval</option>
        </select>
      </div>

      {/* ── Executions Table ── */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted">LOADING EXECUTION LOGS...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-card-bg/40 border border-dashed border-divider space-y-2">
          <p className="text-sm font-bold text-main">No Executions Recorded</p>
          <p className="text-xs text-muted">Triggered workflow executions will appear here in chronological order.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card-bg border border-divider overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-hover/50 border-b border-divider text-muted uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider font-sans">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-hover/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-main">
                      {item.workflow?.name || 'Custom Workflow'}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted text-[11px]">
                      {item.trigger_type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'waiting_approval'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted text-[11px]">
                      {item.duration_ms !== undefined ? `${item.duration_ms}ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-muted text-[11px]">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedExec(item)}
                          className="px-2.5 py-1 rounded-lg bg-hover hover:bg-hover/80 text-main border border-divider text-[11px] font-semibold"
                        >
                          Inspect
                        </button>
                        {item.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="px-2.5 py-1 rounded-lg bg-[#FF6B4A]/10 text-[#FF6B4A] hover:bg-[#FF6B4A]/20 border border-[#FF6B4A]/30 text-[11px] font-bold"
                          >
                            {retryingId === item.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Inspection Modal ── */}
      <AnimatePresence>
        {selectedExec && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl bg-card-bg border border-divider p-6 space-y-4 shadow-2xl font-sans"
            >
              <div className="flex items-center justify-between border-b border-divider pb-3">
                <div>
                  <h3 className="text-base font-bold text-main">Execution Trace Details</h3>
                  <p className="text-xs font-mono text-muted mt-0.5">ID: {selectedExec.id}</p>
                </div>
                <button onClick={() => setSelectedExec(null)} className="text-muted hover:text-main text-xs">
                  ✕ Close
                </button>
              </div>

              {selectedExec.error_message && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} />
                    <span>Error Output:</span>
                  </div>
                  <span>{selectedExec.error_message}</span>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-muted">Action Step Execution Log:</span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedExec.actions_attempted?.map((act: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-hover/40 border border-divider space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-main font-bold">#{i + 1} {act.type}</span>
                        <span className={act.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                          {act.status}
                        </span>
                      </div>
                      {act.output && (
                        <pre className="text-[10px] text-muted overflow-x-auto p-2 rounded bg-card-bg">
                          {JSON.stringify(act.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-divider">
                <button
                  onClick={() => setSelectedExec(null)}
                  className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main"
                >
                  Close Trace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
