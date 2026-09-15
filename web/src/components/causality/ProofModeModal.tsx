import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ShieldCheck, Award } from 'lucide-react';
import { causalityApi } from '../../lib/causalityApi';

interface ProofModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
}

export default function ProofModeModal({
  isOpen,
  onClose,
  projectId,
  projectTitle = 'Project Initiative',
}: ProofModeModalProps) {
  const [loading, setLoading] = useState(true);
  const [proofData, setProofData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    setLoading(true);

    causalityApi
      .getProof(projectId)
      .then((data) => {
        if (isMounted) {
          setProofData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load Proof data:', err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-3xl bg-[#0B0C10] border border-divider rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-main"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-divider bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-main tracking-tight flex items-center gap-2">
                Project Proof & Evidence Vault
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  VERIFIED EVIDENCE
                </span>
              </h2>
              <p className="text-xs text-muted truncate">{projectTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-main transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted font-mono">Fetching immutable proof records...</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-hover border border-divider rounded-lg">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Tasks Executed</span>
              <span className="text-lg font-bold text-main mt-1 block">
                {proofData?.stats?.tasksDone} / {proofData?.stats?.tasksTotal}
              </span>
            </div>
            <div className="p-3 bg-hover border border-divider rounded-lg">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Milestones Cleared</span>
              <span className="text-lg font-bold text-main mt-1 block">
                {proofData?.stats?.milestonesCompleted} / {proofData?.stats?.milestonesTotal}
              </span>
            </div>
            <div className="p-3 bg-hover border border-divider rounded-lg">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Evidence Files</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {proofData?.stats?.evidenceCount} Verified
              </span>
            </div>
            <div className="p-3 bg-hover border border-divider rounded-lg">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Project Receipts</span>
              <span className="text-lg font-bold text-[#FF6B4A] mt-1 block font-mono">
                {proofData?.stats?.receiptsCount} Issued
              </span>
            </div>
          </div>

          {/* Receipts Section */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Award size={14} className="text-[#FF6B4A]" />
              Permanent Project Receipts
            </span>

            {proofData?.receipts && proofData.receipts.length > 0 ? (
              <div className="space-y-2">
                {proofData.receipts.map((receipt: any) => (
                  <div key={receipt.id} className="p-3.5 bg-hover border border-divider rounded-lg flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#FF6B4A] px-2 py-0.5 rounded bg-[#FF6B4A]/10 border border-[#FF6B4A]/20">
                          {receipt.receipt_code}
                        </span>
                        <span className="text-xs font-bold text-main">{receipt.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted block mt-1">
                        Issued on {new Date(receipt.signed_at || receipt.created_at).toLocaleString()} • Immutable Record
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      CONFIRMED
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-hover border border-divider rounded-lg text-xs text-muted text-center">
                Receipts will be permanently generated upon milestone approval or change acceptance.
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-divider bg-[#0E1017] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-muted hover:text-main text-xs font-semibold transition-colors"
          >
            Close Proof Vault
          </button>
        </div>
      </motion.div>
    </div>
  );
}
