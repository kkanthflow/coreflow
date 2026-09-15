import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft, CheckSquare, Check, Trash2,
  HelpCircle, Layers, ShieldCheck, GitBranch, UserPlus,
  Building, User, Edit3, X, Save
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import WhyModal, { type WhyType } from '../components/causality/WhyModal';
import ProjectDnaModal from '../components/causality/ProjectDnaModal';
import ProofModeModal from '../components/causality/ProofModeModal';
import ChangeRequestModal from '../components/causality/ChangeRequestModal';
import InviteClientModal from '../components/causality/InviteClientModal';
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
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Edit Project Details State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      let pData = null;
      const { data: primaryData, error: pError } = await supabase
        .from('projects')
        .select(`
          *,
          owner:owner_id(full_name, email, avatar_url),
          department:department_id(name, color),
          organization:org_id(name),
          client:client_id(name, company_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (pError || !primaryData) {
        // Fallback to simple select without joins if RLS blocked a relation
        const { data: simpleData, error: simpleErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (simpleErr || !simpleData) {
          setProject(null);
          return;
        }
        pData = simpleData;
      } else {
        pData = primaryData;
      }

      setProject(pData);
      if (pData) {
        setEditTitle(pData.title || '');
        setEditDescription(pData.description || '');
        setEditStatus(pData.status || 'active');
        setEditDueDate(pData.due_date ? pData.due_date.split('T')[0] : '');
      }

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

  const handleSaveProjectEdit = async () => {
    if (!project || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const updates: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        status: editStatus,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
      };

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id)
        .select()
        .single();

      if (error) throw error;

      setProject((prev: any) => ({ ...prev, ...data }));
      setIsEditing(false);
      toast.success('Project details updated successfully', 'Saved');
    } catch (e: any) {
      console.error('Failed to update project:', e);
      toast.error(e.message || 'Failed to save changes.', 'Update Failed');
    } finally {
      setSavingEdit(false);
    }
  };

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
      <div className="text-center py-24 font-sans select-none space-y-4">
        <p className="text-muted text-sm font-semibold">Access Denied or Project Not Found</p>
        <p className="text-zinc-600 text-xs max-w-md mx-auto">
          You do not have authorization to view this project initiative, or it does not exist.
        </p>
        <button onClick={() => navigate('/projects')} className="px-4 py-2 bg-[#FF6B4A] text-main rounded text-xs font-semibold hover:bg-[#FF552B] transition-colors">
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
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
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
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                isEditing
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-hover hover:bg-hover text-muted hover:text-main border-divider'
              }`}
            >
              {isEditing ? <X size={13} /> : <Edit3 size={13} />}
              <span>{isEditing ? 'Cancel Edit' : 'Edit Project'}</span>
            </button>
            <button
              onClick={() => { setWhyInitialType('delivery'); setIsWhyOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30 text-xs font-bold transition-colors shadow-sm"
            >
              <HelpCircle size={13} />
              <span>WHY?</span>
            </button>
            <button
              onClick={() => setIsDnaOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold transition-colors"
            >
              <Layers size={13} className="text-emerald-400" />
              <span>Project DNA</span>
            </button>
            <button
              onClick={() => setIsProofOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold transition-colors"
            >
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Proof</span>
            </button>
            <button
              onClick={() => setIsCROpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold transition-colors"
            >
              <GitBranch size={13} className="text-[#FF6B4A]" />
              <span>Change Request</span>
            </button>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] text-main text-xs font-bold transition-colors shadow-sm"
            >
              <UserPlus size={13} />
              <span>Invite Client</span>
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs transition-colors"
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

      {/* ── Internal Provider & Client Reporting Banner ── */}
      <div className="p-4 rounded-xl bg-card-bg border border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-divider flex items-center justify-center text-muted">
            {project.organization?.name ? (
              <Building size={18} className="text-blue-400" />
            ) : (
              <User size={18} className="text-emerald-400" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
              {project.organization?.name ? 'ORGANIZATION REPORTING TO CLIENT' : 'INDEPENDENT FREELANCER REPORTING TO CLIENT'}
            </span>
            <span className="text-sm font-bold text-main mt-0.5 block">
              {project.organization?.name || project.owner?.full_name || 'Project Lead'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-white/[0.03] text-muted border border-divider">
            Mode: <strong className="text-zinc-200">{project.organization?.name ? 'Organization' : 'Freelancer'}</strong>
          </span>
          <button
            onClick={() => navigate(`/projects/${project.id}/client-room`)}
            className="text-[11px] font-mono px-3 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-bold transition-colors"
          >
            Preview Client Project Room →
          </button>
        </div>
      </div>

      {/* ── Interactive Causality Quick Triggers ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card-bg p-3 rounded-lg border border-divider">
        <button
          onClick={() => { setWhyInitialType('progress'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-hover hover:bg-hover border border-divider hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">PROGRESS: {progress}%</span>
            <span className="text-xs font-bold text-main group-hover:text-[#FF6B4A] transition-colors">Why {progress}%?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('delivery'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-hover hover:bg-hover border border-divider hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">DELIVERY: {project.due_date ? new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open'}</span>
            <span className="text-xs font-bold text-main group-hover:text-[#FF6B4A] transition-colors">Why Delivery Date?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('cost'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-hover hover:bg-hover border border-divider hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">PROJECT VALUE</span>
            <span className="text-xs font-bold text-main group-hover:text-[#FF6B4A] transition-colors">Why Project Cost?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>

        <button
          onClick={() => { setWhyInitialType('scope'); setIsWhyOpen(true); }}
          className="flex items-center justify-between p-2.5 rounded bg-hover hover:bg-hover border border-divider hover:border-[#FF6B4A]/40 transition-all text-left group"
        >
          <div>
            <span className="text-[9px] font-mono text-muted uppercase tracking-wider block">SCOPE: {tasks.length} DELIVERABLES</span>
            <span className="text-xs font-bold text-main group-hover:text-[#FF6B4A] transition-colors">Why Scope Count?</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF6B4A]/10 text-[#FF6B4A]">WHY?</span>
        </button>
      </div>

      {/* ── 2-Column Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Tasks Queue */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-card-bg border border-divider rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-divider">
              <div className="flex items-center gap-2">
                <CheckSquare size={14} className="text-[#FF6B4A]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-main">Project Deliverables ({tasks.length})</h2>
              </div>
            </div>

            {/* Quick Add Task */}
            <form onSubmit={handleQuickAddTask} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Assign quick deliverable to this workstream..."
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="flex-1 bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={addingTask || !taskTitle.trim()}
                className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
              >
                {addingTask ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Deliverables List */}
            {tasks.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted font-mono">No tasks recorded for this project.</p>
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
                            : 'border-divider hover:border-[#FF6B4A]'
                        }`}
                      >
                        {t.status === 'done' && <Check size={11} />}
                      </button>
                      <span className={`text-xs truncate ${t.status === 'done' ? 'line-through text-muted' : 'text-muted'}`}>
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
          <div className="bg-card-bg border border-divider rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-divider pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-main">
                {isEditing ? 'Edit Project Settings' : 'Workstream Scope'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: coverColor }} />
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] font-mono text-[#FF6B4A] hover:underline flex items-center gap-1"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3 font-sans">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A] rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none"
                    placeholder="Project title..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Scope & Objectives Description
                  </label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A] rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none resize-none"
                    placeholder="Outline key deliverables, scope, and objectives..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A] rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="review">In Review</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                      Target Deadline
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A] rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-divider">
                  <button
                    onClick={handleSaveProjectEdit}
                    disabled={savingEdit || !editTitle.trim()}
                    className="flex-1 px-3 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 text-main font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Save size={13} />
                    <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={savingEdit}
                    className="px-3 py-2 bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">Description</span>
                  <p className="text-xs text-muted leading-relaxed bg-[#07080B] p-2.5 rounded border border-divider">
                    {project.description || 'No detailed scope description provided.'}
                  </p>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-divider">
                    <span className="text-muted">INITIATIVE ID</span>
                    <span className="text-muted">{project.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-divider">
                    <span className="text-muted">CREATION DATE</span>
                    <span className="text-muted">{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">ASSIGNED MEMBERS</span>
                    <span className="text-muted">{project.project_members?.length || 0} Operators</span>
                  </div>
                </div>
              </>
            )}
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

      <InviteClientModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
      />

    </div>
  );
}
