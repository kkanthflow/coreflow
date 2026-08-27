import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, GitBranch, AlertCircle } from 'lucide-react';
import { causalityApi } from '../../lib/causalityApi';

interface ChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: () => void;
}

export default function ChangeRequestModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: ChangeRequestModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costImpact, setCostImpact] = useState<number>(5000);
  const [scheduleImpactDays, setScheduleImpactDays] = useState<number>(3);
  const [scopeImpactCount, setScopeImpactCount] = useState<number>(1);
  const [requesterType] = useState<'client' | 'owner' | 'lead'>('client');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await causalityApi.createChangeRequest({
        projectId,
        title: title.trim(),
        description: description.trim(),
        costImpact: Number(costImpact),
        scheduleImpactDays: Number(scheduleImpactDays),
        scopeImpactCount: Number(scopeImpactCount),
        requesterType,
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit Change Request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-xl bg-[#0B0C10] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
              <GitBranch size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Submit Formal Change Request
              </h2>
              <p className="text-xs text-zinc-400">Proposes scope, cost, and schedule adjustments with branching preview</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Change Request Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Add Google Authentication Flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Business Rationale & Description</label>
            <textarea
              rows={3}
              placeholder="Explain why this change is requested..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]"
            />
          </div>

          {/* Impact Matrix Inputs */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Cost Impact (₹)</label>
              <input
                type="number"
                value={costImpact}
                onChange={(e) => setCostImpact(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#12141C] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-[#FF6B4A]"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Schedule (+Days)</label>
              <input
                type="number"
                value={scheduleImpactDays}
                onChange={(e) => setScheduleImpactDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#12141C] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-[#FF6B4A]"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Scope (+Items)</label>
              <input
                type="number"
                value={scopeImpactCount}
                onChange={(e) => setScopeImpactCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#12141C] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-[#FF6B4A]"
              />
            </div>
          </div>

          {/* Project Branch Preview */}
          <div className="p-3.5 bg-[#12141C] border border-white/[0.06] rounded-lg mt-2 space-y-2">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block flex items-center gap-1">
              <GitBranch size={12} className="text-[#FF6B4A]" />
              Deterministic Project Branching Preview
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] font-mono text-zinc-500 block">KEEP CURRENT PATH</span>
                <span className="text-zinc-300 font-semibold mt-1 block">Maintains Existing Schedule & Cost</span>
              </div>
              <div className="p-2.5 rounded bg-[#FF6B4A]/10 border border-[#FF6B4A]/20">
                <span className="text-[10px] font-mono text-[#FF6B4A] block">ACCEPT CHANGE PATH</span>
                <span className="text-white font-semibold mt-1 block">
                  +{scheduleImpactDays}d • {costImpact >= 0 ? '+' : ''}₹{costImpact}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Change Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
