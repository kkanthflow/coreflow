import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, DollarSign, Activity, Layers, X,
  CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';
import { causalityApi } from '../../lib/causalityApi';

export type WhyType = 'delivery' | 'cost' | 'progress' | 'scope';

interface WhyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialType?: WhyType;
  projectTitle?: string;
  onOpenDNA?: () => void;
  onOpenProof?: () => void;
}

export default function WhyModal({
  isOpen,
  onClose,
  projectId,
  initialType = 'delivery',
  projectTitle = 'Project Initiative',
  onOpenDNA,
  onOpenProof,
}: WhyModalProps) {
  const [activeTab, setActiveTab] = useState<WhyType>(initialType);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
    }
  }, [isOpen, initialType]);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        let res: any;
        if (activeTab === 'delivery') {
          res = await causalityApi.getWhyDelivery(projectId);
        } else if (activeTab === 'cost') {
          res = await causalityApi.getWhyCost(projectId);
        } else if (activeTab === 'progress') {
          res = await causalityApi.getWhyProgress(projectId);
        } else if (activeTab === 'scope') {
          res = await causalityApi.getWhyScope(projectId);
        }

        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to compute causality.');
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [isOpen, projectId, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl bg-[#0B0C10] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white select-none"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] font-bold text-xs tracking-wider">
              WHY?
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Project Causality Engine
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.06]">
                  DETERMINISTIC
                </span>
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-md">{projectTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/[0.06] bg-[#08090D] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'delivery'
                ? 'border-[#FF6B4A] text-[#FF6B4A] bg-white/[0.03]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar size={13} />
            <span>Delivery</span>
          </button>
          <button
            onClick={() => setActiveTab('cost')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'cost'
                ? 'border-[#FF6B4A] text-[#FF6B4A] bg-white/[0.03]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <DollarSign size={13} />
            <span>Cost</span>
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'progress'
                ? 'border-[#FF6B4A] text-[#FF6B4A] bg-white/[0.03]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity size={13} />
            <span>Progress</span>
          </button>
          <button
            onClick={() => setActiveTab('scope')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'scope'
                ? 'border-[#FF6B4A] text-[#FF6B4A] bg-white/[0.03]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={13} />
            <span>Scope</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-mono tracking-wider">Tracing causal graph & recorded commitments...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Calculation Error</p>
                <p className="text-zinc-400 mt-0.5">{error}</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ── 1. WHY DELIVERY ── */}
              {activeTab === 'delivery' && (
                <motion.div
                  key="tab-delivery"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between bg-[#12141C] p-3.5 rounded-lg border border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Target Delivery</span>
                      <span className="text-lg font-bold text-white tracking-tight">
                        {data?.currentDeliveryDate ? new Date(data.currentDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pending'}
                      </span>
                    </div>
                    {data?.totalScheduleDeltaDays !== 0 && (
                      <span className="px-2.5 py-1 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] text-xs font-mono font-bold border border-[#FF6B4A]/20">
                        {data?.totalScheduleDeltaDays > 0 ? `+${data.totalScheduleDeltaDays}` : data.totalScheduleDeltaDays} Days Adjusted
                      </span>
                    )}
                  </div>

                  {/* Causal Chain */}
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-zinc-700 before:via-[#FF6B4A] before:to-emerald-500">
                    {/* Baseline Step */}
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#12141C] border-2 border-zinc-500 flex items-center justify-center text-[10px] font-mono">
                        0
                      </div>
                      <div className="flex-1 bg-[#10121A] border border-white/[0.05] p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-300">Original Baseline Commitment</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {data?.baselineDate ? new Date(data.baselineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">Contractual start date and initial agreed milestone trajectory.</p>
                      </div>
                    </div>

                    {/* Change Request Adjustments */}
                    {data?.adjustments && data.adjustments.length > 0 ? (
                      data.adjustments.map((adj: any, idx: number) => (
                        <div key={adj.id} className="relative flex items-start gap-3">
                          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#12141C] border-2 border-[#FF6B4A] flex items-center justify-center text-[10px] font-mono text-[#FF6B4A]">
                            {idx + 1}
                          </div>
                          <div className="flex-1 bg-[#10121A] border border-[#FF6B4A]/20 p-3 rounded-lg hover:border-[#FF6B4A]/40 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="font-mono text-[#FF6B4A]">{adj.code}</span>
                                {adj.title}
                              </span>
                              <span className="text-xs font-mono font-bold text-[#FF6B4A]">{adj.impact}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1">{adj.reason || 'Approved change request impact.'}</p>
                            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                              <span>Requested by: {adj.requestedBy?.toUpperCase()}</span>
                              <span>Approved {adj.approvedAt ? new Date(adj.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-zinc-500 py-1 italic">
                        No accepted schedule adjustments recorded. Project matches original baseline.
                      </div>
                    )}

                    {/* Current Committed Step */}
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#12141C] border-2 border-emerald-500 flex items-center justify-center text-[10px] text-emerald-400">
                        ✓
                      </div>
                      <div className="flex-1 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400">Current Committed Delivery</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {data?.currentDeliveryDate ? new Date(data.currentDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── 2. WHY COST ── */}
              {activeTab === 'cost' && (
                <motion.div
                  key="tab-cost"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between bg-[#12141C] p-3.5 rounded-lg border border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Current Project Value</span>
                      <span className="text-xl font-bold text-white tracking-tight font-mono">
                        ₹{Number(data?.currentCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {data?.totalCostDelta !== 0 && (
                      <span className="px-2.5 py-1 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] text-xs font-mono font-bold border border-[#FF6B4A]/20">
                        {data?.totalCostDelta > 0 ? `+₹${data.totalCostDelta.toLocaleString('en-IN')}` : `-₹${Math.abs(data.totalCostDelta).toLocaleString('en-IN')}`}
                      </span>
                    )}
                  </div>

                  {/* Step Breakdown */}
                  <div className="space-y-2.5">
                    <div className="p-3 bg-[#10121A] border border-white/[0.05] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-300">Baseline Commitment (V1)</span>
                        <span className="text-[10px] font-mono text-zinc-500 block">Initial contract estimate</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-zinc-300">
                        ₹{Number(data?.baselineCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {data?.costSteps && data.costSteps.length > 0 ? (
                      data.costSteps.map((step: any) => (
                        <div key={step.id} className="p-3 bg-[#10121A] border border-white/[0.06] rounded-lg flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20 font-bold">
                                {step.code}
                              </span>
                              <span className="text-xs font-medium text-white">{step.title}</span>
                            </div>
                            {step.reason && <span className="text-[10px] text-zinc-500 block mt-0.5">{step.reason}</span>}
                          </div>
                          <span className={`text-xs font-mono font-bold ${step.costDelta >= 0 ? 'text-[#FF6B4A]' : 'text-emerald-400'}`}>
                            {step.formattedDelta}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-zinc-500 py-1 italic">
                        No accepted cost modifications. Value matches Commitment V1.
                      </div>
                    )}

                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">Total Validated Current Value</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        ₹{Number(data?.currentCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── 3. WHY PROGRESS ── */}
              {activeTab === 'progress' && (
                <motion.div
                  key="tab-progress"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between bg-[#12141C] p-3.5 rounded-lg border border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Deterministic Weighted Progress</span>
                      <span className="text-2xl font-bold text-[#FF6B4A] tracking-tight font-mono">
                        {data?.overallProgress}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Deliverables Completed</span>
                      <span className="text-xs font-mono text-zinc-300 font-semibold">
                        {data?.completedTasks} / {data?.totalTasks} Tasks Done
                      </span>
                    </div>
                  </div>

                  {/* Weighted Milestones Breakdown */}
                  <div className="space-y-3">
                    {data?.breakdown?.map((stage: any) => (
                      <div key={stage.id} className="p-3.5 bg-[#10121A] border border-white/[0.06] rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{stage.title}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400">
                              Weight: {stage.weight}%
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-zinc-300">{stage.progress}%</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FF6B4A] transition-all duration-500"
                            style={{ width: `${stage.progress}%` }}
                          />
                        </div>

                        {/* Task List under Milestone */}
                        {stage.tasks && stage.tasks.length > 0 && (
                          <div className="pt-2 border-t border-white/[0.04] space-y-1">
                            {stage.tasks.map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span className="flex items-center gap-1.5 truncate max-w-sm">
                                  {t.status === 'done' ? (
                                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                                  ) : (
                                    <span className="w-2.5 h-2.5 rounded-full border border-zinc-500 shrink-0 inline-block" />
                                  )}
                                  <span className={t.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                                    {t.title}
                                  </span>
                                </span>
                                <span className="font-mono text-[9px] uppercase text-zinc-500">{t.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── 4. WHY SCOPE ── */}
              {activeTab === 'scope' && (
                <motion.div
                  key="tab-scope"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between bg-[#12141C] p-3.5 rounded-lg border border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Scope Evolution</span>
                      <span className="text-lg font-bold text-white tracking-tight">
                        {data?.currentScopeCount} Total Deliverables
                      </span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      Original: {data?.baselineScopeCount} Deliverables
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-[#10121A] border border-white/[0.05] rounded-lg flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">Baseline Agreement Deliverables</span>
                      <span className="text-xs font-mono text-zinc-400">{data?.baselineScopeCount} items</span>
                    </div>

                    {data?.scopeChanges && data.scopeChanges.length > 0 ? (
                      data.scopeChanges.map((change: any) => (
                        <div key={change.id} className="p-3 bg-[#10121A] border border-white/[0.06] rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] font-bold">
                              {change.code}
                            </span>
                            <span className="text-xs text-white">{change.title}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#FF6B4A]">{change.formattedScope}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-zinc-500 py-1 italic">
                        Scope matches original baseline. No approved additions or removals.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onOpenDNA && (
              <button
                onClick={onOpenDNA}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Layers size={13} />
                <span>Explore Project DNA</span>
              </button>
            )}
            {onOpenProof && (
              <button
                onClick={onOpenProof}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Proof Mode</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
