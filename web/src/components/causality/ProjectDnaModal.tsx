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
        className="w-full max-w-4xl bg-card-bg border border-divider rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] text-main"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-divider bg-card-bg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-main tracking-tight flex items-center gap-2">
                Project DNA Causal Graph
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  REAL RELATIONSHIPS
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

        {/* Graph Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline / Nodes List */}
          <div className="w-1/2 border-r border-divider overflow-y-auto p-4 space-y-3 bg-app">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-2">
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
                        : 'bg-hover border-divider hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-muted">
                        {node.type}
                      </span>
                      <span className="text-[10px] font-mono text-muted">
                        {node.occurredAt ? new Date(node.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-main mt-1">{node.title}</span>
                    <span className="text-[11px] text-muted line-clamp-1">{node.description}</span>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-muted py-6 text-center">No causality events recorded yet.</p>
            )}
          </div>

          {/* Node Inspector */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-4 bg-card-bg">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Inspecting Causal Node</span>
                  <h3 className="text-base font-bold text-main mt-1">{selectedNode.title}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-emerald-400 mt-2 inline-block">
                    {selectedNode.type}
                  </span>
                </div>

                <div className="p-3 bg-hover border border-divider rounded-lg space-y-2">
                  <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Description & Reason</span>
                  <p className="text-xs text-muted">{selectedNode.description || 'No additional details recorded.'}</p>
                </div>

                {selectedNode.impact && (
                  <div className="p-3 bg-hover border border-divider rounded-lg space-y-2">
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Deterministic Impact</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {selectedNode.impact.costDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-divider">
                          <span className="text-muted text-[10px] block">Cost Delta</span>
                          <span className="text-main font-bold">{selectedNode.impact.costDelta >= 0 ? '+' : ''}₹{selectedNode.impact.costDelta}</span>
                        </div>
                      )}
                      {selectedNode.impact.daysDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-divider">
                          <span className="text-muted text-[10px] block">Schedule Delta</span>
                          <span className="text-main font-bold">{selectedNode.impact.daysDelta >= 0 ? '+' : ''}{selectedNode.impact.daysDelta} Days</span>
                        </div>
                      )}
                      {selectedNode.impact.scopeDelta !== undefined && (
                        <div className="p-2 rounded bg-white/[0.02] border border-divider">
                          <span className="text-muted text-[10px] block">Scope Delta</span>
                          <span className="text-main font-bold">{selectedNode.impact.scopeDelta >= 0 ? '+' : ''}{selectedNode.impact.scopeDelta} Items</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-hover border border-divider rounded-lg space-y-1">
                  <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Causal Lineage & Timestamp</span>
                  <p className="text-xs font-mono text-muted">
                    Occurred: {new Date(selectedNode.occurredAt).toLocaleString()}
                  </p>
                  <p className="text-xs font-mono text-muted">
                    Visibility: {selectedNode.visibility}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-muted text-xs">
                Select a node to inspect its causal consequences.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-divider bg-card-bg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-muted hover:text-main text-xs font-semibold transition-colors"
          >
            Close DNA Explorer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
