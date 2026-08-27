import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Layers } from 'lucide-react';
import { causalityApi } from '../../lib/causalityApi';

interface ProjectDnaModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
}

export default function ProjectDnaModal({
  isOpen,
  onClose,
  projectId,
  projectTitle = 'Project Initiative',
}: ProjectDnaModalProps) {
  const [loading, setLoading] = useState(true);
  const [dnaData, setDnaData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    setLoading(true);

    causalityApi
      .getProjectDNA(projectId)
      .then((data) => {
        if (isMounted) {
          setDnaData(data);
          setLoading(false);
          if (data?.nodes?.length > 0) {
            setSelectedNode(data.nodes[0]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load Project DNA:', err);
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
        className="w-full max-w-4xl bg-[#0B0C10] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Project DNA Causal Graph
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  REAL RELATIONSHIPS
                </span>
              </h2>
              <p className="text-xs text-zinc-400 truncate">{projectTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Graph Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline / Nodes List */}
          <div className="w-1/2 border-r border-white/[0.06] overflow-y-auto p-4 space-y-3 bg-[#08090D]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">
              Causal Graph Nodes ({dnaData?.nodes?.length || 0})
            </span>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : dnaData?.nodes && dnaData.nodes.length > 0 ? (
              dnaData.nodes.map((node: any) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-[#10121A] border-white/[0.05] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400">
                        {node.type}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {node.occurredAt ? new Date(node.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white mt-1">{node.title}</span>
                    <span className="text-[11px] text-zinc-400 line-clamp-1">{node.description}</span>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">No causality events recorded yet.</p>
            )}
          </div>

          {/* Node Inspector */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-4 bg-[#0B0C10]">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Inspecting Causal Node</span>
                  <h3 className="text-base font-bold text-white mt-1">{selectedNode.title}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-emerald-400 mt-2 inline-block">
                    {selectedNode.type}
                  </span>
                </div>

                <div className="p-3 bg-[#10121A] border border-white/[0.06] rounded-lg space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Description & Reason</span>
                  <p className="text-xs text-zinc-300">{selectedNode.description || 'No additional details recorded.'}</p>
                </div>

                {selectedNode.impact && (
                  <div className="p-3 bg-[#10121A] border border-white/[0.06] rounded-lg space-y-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Deterministic Impact</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {selectedNode.impact.costDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-zinc-500 text-[10px] block">Cost Delta</span>
                          <span className="text-white font-bold">{selectedNode.impact.costDelta >= 0 ? '+' : ''}₹{selectedNode.impact.costDelta}</span>
                        </div>
                      )}
                      {selectedNode.impact.daysDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-zinc-500 text-[10px] block">Schedule Delta</span>
                          <span className="text-white font-bold">{selectedNode.impact.daysDelta >= 0 ? '+' : ''}{selectedNode.impact.daysDelta} Days</span>
                        </div>
                      )}
                      {selectedNode.impact.scopeDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-zinc-500 text-[10px] block">Scope Delta</span>
                          <span className="text-white font-bold">{selectedNode.impact.scopeDelta >= 0 ? '+' : ''}{selectedNode.impact.scopeDelta} Items</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-[#10121A] border border-white/[0.06] rounded-lg space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Causal Lineage & Timestamp</span>
                  <p className="text-xs font-mono text-zinc-400">
                    Occurred: {new Date(selectedNode.occurredAt).toLocaleString()}
                  </p>
                  <p className="text-xs font-mono text-zinc-400">
                    Visibility: {selectedNode.visibility}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-zinc-500 text-xs">
                Select a node to inspect its causal consequences.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0E1017] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
          >
            Close DNA Explorer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
