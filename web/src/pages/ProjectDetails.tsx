import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft, CheckSquare, Check, Trash2,
  HelpCircle, Layers, ShieldCheck, GitBranch
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import WhyModal, { type WhyType } from '../components/causality/WhyModal';
import ProjectDnaModal from '../components/causality/ProjectDnaModal';
import ProofModeModal from '../components/causality/ProofModeModal';
import ChangeRequestModal from '../components/causality/ChangeRequestModal';
import {
  PageHeader, MetricStrip, StatusSignal, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Causality Modals State
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [whyInitialType, setWhyInitialType] = useState<WhyType>('delivery');
  const [isDnaOpen, setIsDnaOpen] = useState(false);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [isCROpen, setIsCROpen] = useState(false);

  // Quick Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: pData, error: pError } = await supabase
        .from('projects')
        .select(`
          *,
          owner:owner_id(full_name, email, avatar_url),
          department:department_id(name, color)
        `)
        .eq('id', id)
        .single();

      if (pError) throw pError;
      setProject(pData);

      // Fetch project tasks
      const { data: tData } = await supabase
        .from('tasks')
        .select(`*, assignee:assignee_id(full_name, avatar_url)`)
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      setTasks(tData || []);
    } catch (e) {
      console.error('Failed to load project:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !user || !project) return;
    setAddingTask(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: taskTitle.trim(),
          project_id: project.id,
          org_id: project.org_id,
          created_by: user.id,
          status: 'todo',
          priority: 'medium',
        })
        .select(`*, assignee:assignee_id(full_name, avatar_url)`)
        .single();

      if (error) throw error;
      setTasks(prev => [data, ...prev]);
      setTaskTitle('');
    } catch (e) {
      console.error('Failed to add task:', e);
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await supabase.from('tasks').update({ status: nextStatus }).eq('id', taskId);
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: nextStatus } : t)));
    } catch (e) {
      console.error('Error toggling task:', e);
    }
  };

  const confirmDeleteProject = async () => {
    if (!project || !user) return;
    try {
      // 1. Delete dependent associations if needed, then delete project from database
      await supabase.from('project_members').delete().eq('project_id', project.id);
      await supabase.from('tasks').delete().eq('project_id', project.id);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      toast.success('Project permanently deleted from database', 'Project Deleted');
      navigate('/projects');
    } catch (e: any) {
      console.error('Failed to delete project:', e);
      toast.error(e.message || 'Failed to delete project.', 'Delete Failed');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 font-sans select-none">
        <p className="text-zinc-500 text-xs">Project initiative not found.</p>
        <button onClick={() => navigate('/projects')} className="mt-4 px-3.5 py-1.5 bg-[#FF6B4A] text-white rounded text-xs font-semibold">
          Return to Projects
        </button>
      </div>
    );
  }

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const coverColor = project.cover_color || '#FF6B4A';

  const metrics: MetricItem[] = [
    { label: 'COMPLETION', value: `${progress}%`, isOrange: progress > 0 },
    { label: 'DELIVERABLES', value: `${doneCount}/${tasks.length}` },
    { label: 'STAGE STATUS', value: project.status?.toUpperCase() || 'ACTIVE' },
    { label: 'LEAD', value: project.owner?.full_name?.split(' ')[0] || 'Lead' },
    { label: 'DEPARTMENT', value: project.department?.name || 'Workspace' },
    { label: 'DEADLINE', value: project.due_date ? new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open' },
  ];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header ── */}
      <PageHeader
        title={project.title}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.title }
        ]}
        description={project.description || 'Project initiative and task deliverables queue.'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setWhyInitialType('delivery'); setIsWhyOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30 text-xs font-bold transition-colors shadow-sm"
            >
              <HelpCircle size={13} />
              <span>WHY?</span>
            </button>
            <button
              onClick={() => setIsDnaOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors"
            >
              <Layers size={13} className="text-emerald-400" />
              <span>Project DNA</span>
            </button>
            <button
              onClick={() => setIsProofOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors"
            >
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Proof</span>
            </button>
            <button
              onClick={() => setIsCROpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors"
            >
              <GitBranch size={13} className="text-[#FF6B4A]" />
              <span>Change Request</span>
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] text-xs transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Projects</span>
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Interactive Causality Quick Triggers ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0C0D12] p-3 rounded-lg border border-white/[0.06]">
        <button
          onClick={() => { setWhyInitialType('progress'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-[#10121A] hover:bg-[#151822] border border-white/[0.04] hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">PROGRESS: {progress}%</span>
            <span className="text-xs font-bold text-white group-hover:text-[#FF6B4A] transition-colors">Why {progress}%?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('delivery'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-[#10121A] hover:bg-[#151822] border border-white/[0.04] hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">DELIVERY: {project.due_date ? new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open'}</span>
            <span className="text-xs font-bold text-white group-hover:text-[#FF6B4A] transition-colors">Why Delivery Date?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('cost'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-[#10121A] hover:bg-[#151822] border border-white/[0.04] hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">PROJECT VALUE</span>
            <span className="text-xs font-bold text-white group-hover:text-[#FF6B4A] transition-colors">Why Project Cost?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('scope'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-[#10121A] hover:bg-[#151822] border border-white/[0.04] hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">SCOPE: {tasks.length} DELIVERABLES</span>
            <span className="text-xs font-bold text-white group-hover:text-[#FF6B4A] transition-colors">Why Scope Count?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>
      </div>

      {/* ── 2-Column Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Tasks Queue */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <CheckSquare size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Project Deliverables ({tasks.length})</h2>
              </div>
            </div>

            {/* Quick Add Task */}
            <form onSubmit={handleQuickAddTask} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Assign quick deliverable to this workstream..."
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="flex-1 bg-[#07080B] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={addingTask || !taskTitle.trim()}
                className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors shadow-sm"
              >
                {addingTask ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Deliverables List */}
            {tasks.length === 0 ? (
              <p className="text-center py-6 text-xs text-zinc-500 font-mono">No tasks recorded for this project.</p>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {tasks.map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => handleToggleTaskStatus(t.id, t.status)}
                        className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ${
                          t.status === 'done'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-white/20 hover:border-[#FF6B4A]'
                        }`}
                      >
                        {t.status === 'done' && <Check size={11} />}
                      </button>
                      <span className={`text-xs truncate ${t.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusSignal status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metadata & Workstream Info */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Workstream Scope
              </h3>
              <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: coverColor }} />
            </div>
            
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 block mb-1">Description</span>
              <p className="text-xs text-zinc-300 leading-relaxed bg-[#07080B] p-2.5 rounded border border-white/[0.04]">
                {project.description || 'No detailed scope description provided.'}
              </p>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-500">INITIATIVE ID</span>
                <span className="text-zinc-300">{project.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-500">CREATION DATE</span>
                <span className="text-zinc-300">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">ASSIGNED MEMBERS</span>
                <span className="text-zinc-300">{project.project_members?.length || 0} Operators</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Dialogue */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Project Workstream"
        message={`Are you sure you want to permanently delete "${project.title}"? All associated tasks and assignments will be removed from the database.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteProject}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Causality Modals */}
      <WhyModal
        isOpen={isWhyOpen}
        onClose={() => setIsWhyOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
        initialType={whyInitialType}
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
        onCreated={() => fetchDetails()}
      />

    </div>
  );
}
