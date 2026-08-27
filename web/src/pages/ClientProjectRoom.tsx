import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, DollarSign, Activity, Layers,
  ShieldCheck, Award, GitBranch, ArrowLeft,
  Clock, HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { causalityApi } from '../lib/causalityApi';
import WhyModal, { type WhyType } from '../components/causality/WhyModal';
import ProjectDnaModal from '../components/causality/ProjectDnaModal';
import ProofModeModal from '../components/causality/ProofModeModal';
import ChangeRequestModal from '../components/causality/ChangeRequestModal';

export default function ClientProjectRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'journey' | 'changes' | 'approvals' | 'proof' | 'passport'>('overview');

  // Causality Engine Modals
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [whyType, setWhyType] = useState<WhyType>('delivery');
  const [isDnaOpen, setIsDnaOpen] = useState(false);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [isCROpen, setIsCROpen] = useState(false);

  // Causality State
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [scopeData, setScopeData] = useState<any>(null);
  const [respData, setRespData] = useState<any>(null);
  const [pendingCRs, setPendingCRs] = useState<any[]>([]);

  const fetchRoomData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Fetch Project
      const { data: pData, error: pErr } = await supabase
        .from('projects')
        .select('*, owner:owner_id(full_name, email), tasks(*), project_milestones(*)')
        .eq('id', id)
        .single();

      if (pErr) throw pErr;
      setProject(pData);

      // 2. Fetch Deterministic Causality Summaries
      const [dRes, cRes, pRes, sRes, rRes] = await Promise.all([
        causalityApi.getWhyDelivery(id).catch(() => null),
        causalityApi.getWhyCost(id).catch(() => null),
        causalityApi.getWhyProgress(id).catch(() => null),
        causalityApi.getWhyScope(id).catch(() => null),
        causalityApi.getResponsibility(id).catch(() => null),
      ]);

      setDeliveryData(dRes);
      setCostData(cRes);
      setProgressData(pRes);
      setScopeData(sRes);
      setRespData(rRes);

      // 3. Fetch Pending Change Requests
      const { data: crs } = await supabase
        .from('project_change_requests')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      setPendingCRs(crs || []);
    } catch (err) {
      console.error('Failed to load Client Project Room:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomData();
  }, [id]);

  const handleDecision = async (crId: string, decision: 'accepted' | 'rejected') => {
    try {
      await causalityApi.decideChangeRequest(crId, decision, `Client decided: ${decision}`);
      fetchRoomData();
    } catch (err) {
      console.error('Decision error:', err);
    }
  };

  const handleSeal = async () => {
    if (!id) return;
    try {
      await causalityApi.sealProject(id, 'Client signed final project acceptance.');
      fetchRoomData();
      setActiveTab('passport');
    } catch (err) {
      console.error('Seal error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p className="text-xs">Project not found or access restricted.</p>
        <button onClick={() => navigate('/projects')} className="mt-4 px-3 py-1.5 bg-[#FF6B4A] text-white rounded text-xs">
          Return to Projects
        </button>
      </div>
    );
  }

  const isSealed = project.status === 'completed';

  return (
    <div className="flex-1 space-y-6 pb-16 font-sans select-none text-white max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20 font-bold uppercase tracking-wider">
              {isSealed ? 'PROJECT PASSPORT' : 'CLIENT PROJECT ROOM'}
            </span>
            <span className="text-xs text-zinc-500 font-mono">CF-PRJ-{project.id.slice(0, 6)}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">{project.title}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{project.description || 'Transparent client portal & verified project records'}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWhyType('delivery'); setIsWhyOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold transition-colors shadow-sm"
          >
            <HelpCircle size={14} />
            <span>ASK WHY?</span>
          </button>
          <button
            onClick={() => setIsDnaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold"
          >
            <Layers size={14} className="text-emerald-400" />
            <span>Project DNA</span>
          </button>
          <button
            onClick={() => setIsProofOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Proof Mode</span>
          </button>
          <button
            onClick={() => navigate(`/projects/${project.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] text-xs"
          >
            <ArrowLeft size={13} />
            <span>Workspace</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/[0.06] gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'OVERVIEW' },
          { id: 'journey', label: 'PROJECT JOURNEY' },
          { id: 'changes', label: `CHANGE REQUESTS (${pendingCRs.length})` },
          { id: 'proof', label: 'PROOF & RECEIPTS' },
          ...(isSealed ? [{ id: 'passport', label: 'PERMANENT PASSPORT' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold tracking-wider rounded-t-lg transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[#FF6B4A] text-[#FF6B4A] bg-white/[0.02]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 1. OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Responsibility Clock Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#12141F] to-[#0A0B10] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">CURRENT RESPONSIBILITY CLOCK</span>
                <span className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                  With {respData?.held_by === 'CLIENT' ? 'CLIENT (Your Review)' : 'PROJECT OWNER (Active Sprint)'}
                  <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                    {respData?.durationFormatted || 'Active'}
                  </span>
                </span>
              </div>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{respData?.action_item || 'Execution ongoing'}</span>
          </div>

          {/* 4 Flagship WHY Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Progress */}
            <div className="p-4 rounded-xl bg-[#0C0D12] border border-white/[0.06] flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PROJECT PROGRESS</span>
                <Activity size={16} className="text-[#FF6B4A]" />
              </div>
              <div>
                <span className="text-3xl font-extrabold text-[#FF6B4A] tracking-tight font-mono">
                  {progressData?.overallProgress || 0}%
                </span>
                <span className="text-[10px] text-zinc-400 block mt-1">
                  {progressData?.completedTasks || 0} / {progressData?.totalTasks || 0} Deliverables Done
                </span>
              </div>
              <button
                onClick={() => { setWhyType('progress'); setIsWhyOpen(true); }}
                className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#FF6B4A] border border-[#FF6B4A]/20 text-xs font-bold transition-all"
              >
                WHY {progressData?.overallProgress || 0}%?
              </button>
            </div>

            {/* Delivery */}
            <div className="p-4 rounded-xl bg-[#0C0D12] border border-white/[0.06] flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">COMMITTED DELIVERY</span>
                <Calendar size={16} className="text-blue-400" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-white tracking-tight">
                  {deliveryData?.currentDeliveryDate ? new Date(deliveryData.currentDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Open'}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Baseline: {deliveryData?.baselineDate ? new Date(deliveryData.baselineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </span>
              </div>
              <button
                onClick={() => { setWhyType('delivery'); setIsWhyOpen(true); }}
                className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-blue-400 border border-blue-400/20 text-xs font-bold transition-all"
              >
                WHY THIS DATE?
              </button>
            </div>

            {/* Cost */}
            <div className="p-4 rounded-xl bg-[#0C0D12] border border-white/[0.06] flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PROJECT VALUE</span>
                <DollarSign size={16} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white tracking-tight font-mono">
                  ₹{Number(costData?.currentCost || 45000).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-1">
                  {costData?.totalCostDelta !== 0 ? `${costData?.totalCostDelta > 0 ? '+' : ''}₹${costData?.totalCostDelta} adjusted` : 'Matches Baseline V1'}
                </span>
              </div>
              <button
                onClick={() => { setWhyType('cost'); setIsWhyOpen(true); }}
                className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-emerald-400 border border-emerald-400/20 text-xs font-bold transition-all"
              >
                WHY THIS COST?
              </button>
            </div>

            {/* Scope */}
            <div className="p-4 rounded-xl bg-[#0C0D12] border border-white/[0.06] flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">SCOPE COUNT</span>
                <Layers size={16} className="text-purple-400" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white tracking-tight">
                  {scopeData?.currentScopeCount || 8} Deliverables
                </span>
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Original: {scopeData?.baselineScopeCount || 8} Items
                </span>
              </div>
              <button
                onClick={() => { setWhyType('scope'); setIsWhyOpen(true); }}
                className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-purple-400 border border-purple-400/20 text-xs font-bold transition-all"
              >
                WHY THIS SCOPE?
              </button>
            </div>
          </div>

          {/* Seal / Completion Action for Completed Project */}
          {!isSealed && (
            <div className="p-4 rounded-xl bg-[#10121A] border border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Project Ready for Final Delivery Seal?</span>
                <span className="text-[11px] text-zinc-400">Lock immutable project passport and seal contractual records permanently.</span>
              </div>
              <button
                onClick={handleSeal}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-2"
              >
                <Award size={14} />
                <span>SIGN FINAL ACCEPTANCE & SEAL</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. PROJECT JOURNEY TAB ── */}
      {activeTab === 'journey' && (
        <div className="p-6 bg-[#0C0D12] border border-white/[0.06] rounded-xl space-y-6">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Milestone Execution Trajectory</h2>
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.1]">
            {project.project_milestones && project.project_milestones.length > 0 ? (
              project.project_milestones.map((m: any, idx: number) => (
                <div key={m.id} className="relative flex items-start gap-4">
                  <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    m.completed ? 'bg-emerald-500 text-black' : 'bg-[#181A24] border-2 border-zinc-500 text-zinc-400'
                  }`}>
                    {m.completed ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1 bg-[#10121A] border border-white/[0.05] p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{m.title}</span>
                      <span className="text-xs font-mono text-zinc-400">
                        {m.due_date ? new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Open'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{m.description || 'Milestone deliverables and validation criteria.'}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span>Status: {m.completed ? 'COMPLETED & VERIFIED' : 'IN PROGRESS'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">No milestones mapped for this initiative.</p>
            )}
          </div>
        </div>
      )}

      {/* ── 3. CHANGE REQUESTS TAB ── */}
      {activeTab === 'changes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
              Formal Change Requests & Impact Decisions
            </h2>
            <button
              onClick={() => setIsCROpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <GitBranch size={13} />
              <span>Propose Change Request</span>
            </button>
          </div>

          {pendingCRs.length > 0 ? (
            <div className="space-y-3">
              {pendingCRs.map((cr) => (
                <div key={cr.id} className="p-4 bg-[#0C0D12] border border-white/[0.06] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20">
                        {cr.cr_code}
                      </span>
                      <span className="text-sm font-bold text-white">{cr.title}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                      cr.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      cr.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {cr.status}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400">{cr.description || 'No additional rationale.'}</p>

                  <div className="grid grid-cols-3 gap-2 bg-[#12141C] p-3 rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Cost Impact</span>
                      <span className="text-white font-bold">{cr.cost_impact >= 0 ? '+' : ''}₹{cr.cost_impact}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Schedule Impact</span>
                      <span className="text-white font-bold">{cr.schedule_impact_days >= 0 ? '+' : ''}{cr.schedule_impact_days} Days</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Scope Impact</span>
                      <span className="text-white font-bold">{cr.scope_impact_count >= 0 ? '+' : ''}{cr.scope_impact_count} Deliverables</span>
                    </div>
                  </div>

                  {cr.status === 'pending' && (
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.04]">
                      <button
                        onClick={() => handleDecision(cr.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
                      >
                        Reject Change
                      </button>
                      <button
                        onClick={() => handleDecision(cr.id, 'accepted')}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                      >
                        Accept & Update Commitment Baseline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-[#0C0D12] border border-white/[0.04] rounded-xl text-center text-xs text-zinc-500">
              No change requests submitted. Contractual commitment matches Baseline V1.
            </div>
          )}
        </div>
      )}

      {/* ── 4. PROOF & RECEIPTS TAB ── */}
      {activeTab === 'proof' && (
        <div className="p-6 bg-[#0C0D12] border border-white/[0.06] rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Award size={16} className="text-[#FF6B4A]" />
              Immutable Project Receipts & Proof Vault
            </h2>
            <button
              onClick={() => setIsProofOpen(true)}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold rounded border border-white/[0.06]"
            >
              Open Proof Inspector
            </button>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Every client approval, milestone acceptance, scope alteration, and final handover generates a permanent verifiable receipt code (e.g. CF-PR-00291) sealed cryptographically in the CoreFlow database.
          </p>
        </div>
      )}

      {/* ── 5. PASSPORT TAB (For Sealed Projects) ── */}
      {activeTab === 'passport' && isSealed && (
        <div className="p-6 bg-[#0C0D12] border border-emerald-500/30 rounded-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">OFFICIAL PROJECT PASSPORT</span>
              <h2 className="text-xl font-bold text-white mt-1">Permanent Handover Record</h2>
            </div>
            <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold">
              SEALED & ARCHIVED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#10121A] rounded-lg border border-white/[0.05]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Deliverables Delivered</span>
              <span className="text-lg font-bold text-white mt-1 block font-mono">100% Complete</span>
            </div>
            <div className="p-4 bg-[#10121A] rounded-lg border border-white/[0.05]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Warranty Period</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">90 Days Active</span>
            </div>
            <div className="p-4 bg-[#10121A] rounded-lg border border-white/[0.05]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Handover Repository</span>
              <span className="text-lg font-bold text-white mt-1 block">Production Handoff Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* Causality Modals */}
      <WhyModal
        isOpen={isWhyOpen}
        onClose={() => setIsWhyOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
        initialType={whyType}
        onOpenDNA={() => { setIsWhyOpen(false); setIsDnaOpen(true); }}
        onOpenProof={() => { setIsWhyOpen(false); setIsProofOpen(true); }}
      />

      <ProjectDnaModal
        isOpen={isDnaOpen}
        onClose={() => setIsDnaOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
      />

      <ProofModeModal
        isOpen={isProofOpen}
        onClose={() => setIsProofOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
      />

      <ChangeRequestModal
        isOpen={isCROpen}
        onClose={() => setIsCROpen(false)}
        projectId={project.id}
        onCreated={() => fetchRoomData()}
      />
    </div>
  );
}
