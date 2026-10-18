import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCw,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';

interface ApprovalItem {
  id: string;
  workflow_id: string;
  execution_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  approver_role?: string;
  created_at: string;
  workflow?: {
    name: string;
    category: string;
  };
}

export default function WorkflowApprovals() {
  const { orgId } = useWorkspace();

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionModalItem, setDecisionModalItem] = useState<ApprovalItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = '/api';

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (orgId) headers['x-organization-id'] = orgId;

      const res = await fetch(`${apiUrl}/workflows/approvals/pending${orgId ? `?orgId=${orgId}` : ''}`, { headers });
      if (!res.ok) throw new Error('Failed to load pending approvals.');
      const json = await res.json();
      setApprovals(json.approvals || []);
    } catch (err: any) {
      console.error('Approvals fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, orgId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!decisionModalItem) return;
    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch(`${apiUrl}/workflows/approvals/${decisionModalItem.id}/decide${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
        body: JSON.stringify({
          decision,
          notes: decisionNotes.trim(),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Decision failed.');
      }

      setDecisionModalItem(null);
      setDecisionNotes('');
      fetchApprovals();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 py-6 font-sans">
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
              <Inbox size={18} className="text-sky-400" />
              <h1 className="text-2xl font-extrabold text-main tracking-tight">Workflow Approvals Inbox</h1>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Review and sign off on pending automated workflow approval checkpoints before execution resumes.
            </p>
          </div>
        </div>

        <button
          onClick={fetchApprovals}
          className="px-3.5 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* ── Approvals List ── */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted">SYNCHRONIZING PENDING APPROVALS...</p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-card-bg/40 border border-dashed border-divider space-y-2">
          <UserCheck size={32} className="text-emerald-400 mx-auto" />
          <p className="text-sm font-bold text-main">All Clear! No Pending Approvals</p>
          <p className="text-xs text-muted">When a workflow requests manager sign-off, it will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((app) => (
            <div
              key={app.id}
              className="p-5 rounded-2xl bg-card-bg border border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Sign-off Required
                  </span>
                  <span className="text-xs font-mono text-muted">
                    Workflow: <strong className="text-main">{app.workflow?.name || 'Automation'}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-main">{app.title}</h3>
                <p className="text-xs text-muted leading-relaxed">
                  {app.description || 'Manager decision required before remaining downstream actions are performed.'}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted font-mono pt-1">
                  <span>Requested: {new Date(app.created_at).toLocaleString()}</span>
                  <span>Required Role: {app.approver_role || 'Manager / Owner'}</span>
                </div>
              </div>

              <button
                onClick={() => setDecisionModalItem(app)}
                className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold transition-all shadow-md self-start sm:self-center"
              >
                Review & Decide
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Decision Modal ── */}
      <AnimatePresence>
        {decisionModalItem && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-card-bg border border-divider p-6 space-y-4 shadow-2xl font-sans"
            >
              <div className="flex items-center justify-between border-b border-divider pb-3">
                <h3 className="text-base font-bold text-main">Approval Decision Sign-off</h3>
                <button
                  onClick={() => setDecisionModalItem(null)}
                  className="text-muted hover:text-main text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted">
                  Request: <strong className="text-main">{decisionModalItem.title}</strong>
                </p>
                {decisionModalItem.description && (
                  <p className="text-xs text-muted p-3 rounded-xl bg-hover/40 border border-divider">
                    {decisionModalItem.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-main">Decision Audit Notes (Optional)</label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Add comments or review notes..."
                  rows={3}
                  className="w-full bg-hover/40 border border-divider rounded-xl p-3 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-divider">
                <button
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
                <button
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Resuming...' : 'Approve & Resume'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
