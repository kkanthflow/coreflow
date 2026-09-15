import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  CheckSquare, Plus, Search, LayoutGrid, List,
  Send, X, RefreshCw
} from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, ContextInspector,
  EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { FlowStepper } from '../components/ui/FlowMotion';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  created_at: string;
  project?: { title: string };
  assignee?: { id: string; full_name: string; email: string; avatar_url: string | null };
}

const STATUS_COLUMNS: { key: Task['status']; label: string; dot: string }[] = [
  { key: 'todo',        label: 'To Do',       dot: 'bg-zinc-400' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-400' },
  { key: 'review',      label: 'In Review',   dot: 'bg-purple-400' },
  { key: 'done',        label: 'Completed',   dot: 'bg-emerald-400' },
];

export default function Tasks() {
  const { user, role } = useAuth();
  const { orgId } = useWorkspace();
  const canManage = hasPermission(role, 'manage_tasks');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Details Inspector
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newHours, setNewHours] = useState('');
  const [creating, setCreating] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:project_id(title),
          assignee:assignee_id(id, full_name, email, avatar_url)
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('org_id', orgId);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);

      // Fetch projects
      let pQuery = supabase.from('projects').select('id, title').is('deleted_at', null);
      if (orgId) pQuery = pQuery.eq('org_id', orgId);
      else pQuery = pQuery.eq('owner_id', user.id);
      const { data: pData } = await pQuery;
      setProjects(pData || []);

      // Fetch org members
      if (orgId) {
        const { data: uData } = await supabase
          .from('user_organizations')
          .select('users:user_id(id, full_name, email)')
          .eq('org_id', orgId);
        if (uData) {
          const list = uData.map((d: any) => d.users).filter(Boolean);
          setMembers(list);
        }
      }
    } catch (e) {
      console.error('Error fetching tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const taskChannel = supabase
      .channel('realtime:tasks_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
        if (selectedTask && payload.new && (payload.new as any).task_id === selectedTask.id) {
          loadComments(selectedTask.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(taskChannel); };
  }, [user, fetchTasks, selectedTask]);

  const loadComments = useCallback(async (taskId: string) => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('task_comments')
        .select(`*, author:author_id(full_name, avatar_url)`)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      setComments(data || []);
    } catch (e) {
      console.error('Error fetching comments:', e);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    loadComments(task.id);
  };

  const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error('Failed to update task status:', e);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask || !user) return;
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: selectedTask.id,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select(`*, author:author_id(full_name, avatar_url)`)
        .single();

      if (error) throw error;
      setComments(prev => [...prev, data]);
      setNewComment('');
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    setTaskError(null);
    try {
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const { data: uo } = await supabase.from('user_organizations').select('org_id').eq('user_id', user.id).limit(1).maybeSingle();
        if (uo?.org_id) targetOrgId = uo.org_id;
      }
      if (!targetOrgId) {
        const { data: owned } = await supabase.from('organizations').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
        if (owned?.id) targetOrgId = owned.id;
      }
      if (!targetOrgId && newProject) {
        const { data: prj } = await supabase.from('projects').select('org_id').eq('id', newProject).maybeSingle();
        if (prj?.org_id) targetOrgId = prj.org_id;
      }

      const payload: any = {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        status: 'todo',
        created_by: user.id,
        project_id: newProject || null,
        assignee_id: newAssignee || null,
        due_date: newDueDate || null,
        estimated_hours: newHours ? parseFloat(newHours) : null,
      };

      if (targetOrgId) payload.org_id = targetOrgId;

      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select(`*, project:project_id(title), assignee:assignee_id(id, full_name, email, avatar_url)`)
        .single();

      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewProject('');
      setNewAssignee('');
      setNewDueDate('');
      setNewHours('');
    } catch (e: any) {
      console.error('Failed to create task:', e);
      setTaskError(e.message || 'Failed to create task.');
    } finally {
      setCreating(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchProject = projectFilter === 'all' || t.project_id === projectFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchProject && matchPriority;
  });

  const completedCount = tasks.filter(t => t.status === 'done').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const reviewCount = tasks.filter(t => t.status === 'review').length;
  const todoCount = tasks.filter(t => t.status === 'todo').length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'TOTAL QUEUE', value: tasks.length < 10 ? `0${tasks.length}` : tasks.length },
    { label: 'TO DO', value: todoCount < 10 ? `0${todoCount}` : todoCount },
    { label: 'IN PROGRESS', value: inProgressCount < 10 ? `0${inProgressCount}` : inProgressCount, isOrange: inProgressCount > 0 },
    { label: 'IN REVIEW', value: reviewCount < 10 ? `0${reviewCount}` : reviewCount },
    { label: 'COMPLETED', value: completedCount < 10 ? `0${completedCount}` : completedCount },
    { label: 'SPRINT VELOCITY', value: '88.5%', indicator: 'On Schedule' },
  ], [tasks, todoCount, inProgressCount, reviewCount, completedCount]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header ── */}
      <PageHeader
        title="Deliverables & Execution"
        description="High-density sprint backlog, task priorities, and cross-functional ownership."
        actions={
          <>
            <button
              onClick={fetchTasks}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync deliverables"
            >
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>New Task</span>
              </button>
            )}
          </>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Toolbar & Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search deliverables, scopes, or assignees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080B] border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="bg-[#07080B] border border-divider text-[11px] font-medium text-muted rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-[#07080B] border border-divider text-[11px] font-medium text-muted rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {/* View Switcher */}
          <div className="flex bg-[#07080B] border border-divider rounded p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'board' ? 'bg-hover text-main' : 'text-muted hover:text-muted'
              }`}
              title="Kanban board"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'list' ? 'bg-hover text-main' : 'text-muted hover:text-muted'
              }`}
              title="Table view"
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Viewport: Kanban Board / Data Table ── */}
      {loading ? (
        <SkeletonRow count={6} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No deliverables found"
          description={search ? "No tasks match the active filters." : "Create your first task deliverable to begin sprint execution."}
          action={canManage && !search ? { label: "Create First Task", onClick: () => setIsCreateModalOpen(true) } : undefined}
        />
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start pb-6">
          {STATUS_COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                className="bg-card-bg border border-divider rounded-lg p-3 flex flex-col min-h-[460px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-divider px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-main">{col.label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/[0.03] text-muted">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                  {colTasks.map(task => {
                    const isCrit = task.priority === 'critical';
                    const isHigh = task.priority === 'high';

                    return (
                      <motion.div
                        layout
                        layoutId={`task-${task.id}`}
                        key={task.id}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectTask(task)}
                        className={`p-3 bg-card-bg hover:bg-hover border rounded transition-all cursor-pointer group space-y-2 ${
                          isCrit ? 'border-red-500/30 hover:border-red-500/60' :
                          isHigh ? 'border-[#FF6B4A]/30 hover:border-[#FF6B4A]/60' :
                          'border-divider hover:border-white/[0.12]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                            isCrit ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            isHigh ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20' :
                            'bg-white/[0.03] text-muted border border-divider'
                          }`}>
                            {task.priority}
                          </span>
                          {task.project && (
                            <span className="text-[10px] font-mono text-muted truncate max-w-[120px]">
                              {task.project.title}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold text-main group-hover:text-[#FF6B4A] transition-colors leading-snug">
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-divider text-[10px] font-mono text-muted">
                          <span>{task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No deadline'}</span>
                          <span className="text-muted">{task.assignee?.full_name?.split(' ')[0] || 'Unassigned'}</span>
                        </div>
                      </motion.div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="h-24 flex items-center justify-center border border-dashed border-divider rounded text-[11px] text-zinc-600">
                      Empty column
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card-bg border border-divider rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-divider text-[10px] font-mono font-bold text-muted uppercase tracking-wider bg-card-bg">
            <div className="col-span-5">Task Deliverable</div>
            <div className="col-span-2">Project Scope</div>
            <div className="col-span-2">Stage Status</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2 text-right">Assignee & Due</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {filteredTasks.map(t => (
              <div
                key={t.id}
                onClick={() => handleSelectTask(t)}
                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer items-center text-xs group"
              >
                <div className="col-span-5 min-w-0 pr-3">
                  <div className="font-semibold text-main group-hover:text-[#FF6B4A] transition-colors truncate">
                    {t.title}
                  </div>
                  {t.description && <div className="text-muted text-[11px] truncate mt-0.5">{t.description}</div>}
                </div>

                <div className="col-span-2 text-muted font-medium truncate">
                  {t.project?.title || 'Workspace Core'}
                </div>

                <div className="col-span-2">
                  <StatusSignal status={t.status} />
                </div>

                <div className="col-span-1">
                  <span className="text-[10px] font-mono uppercase text-muted">
                    {t.priority}
                  </span>
                </div>

                <div className="col-span-2 text-right text-[11px] font-mono">
                  <span className="text-main block">{t.assignee?.full_name?.split(' ')[0] || 'Unassigned'}</span>
                  <span className="text-muted text-[10px]">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Task Context Inspector Drawer ── */}
      {selectedTask && (
        <ContextInspector
          title={selectedTask.title}
          subtitle={selectedTask.project?.title || 'General Deliverable'}
          badge={selectedTask.priority.toUpperCase()}
          onClose={() => setSelectedTask(null)}
          footer={
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Post comment to thread..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                className="flex-1 bg-card-bg border border-divider rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]/50"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="p-2 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main rounded transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          }
        >
          {/* Inspector Content */}
          <div className="space-y-4 text-xs">
            {selectedTask.description && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1">Specifications</span>
                <p className="text-muted bg-card-bg p-3 rounded border border-divider leading-relaxed whitespace-pre-wrap">
                  {selectedTask.description}
                </p>
              </div>
            )}

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-1.5">Stage Workflow</span>
              <FlowStepper
                steps={[
                  { key: 'todo', label: 'To Do' },
                  { key: 'in_progress', label: 'In Progress' },
                  { key: 'review', label: 'Review' },
                  { key: 'done', label: 'Done' }
                ]}
                activeStepKey={selectedTask.status}
                onStepClick={(stepKey) => handleUpdateStatus(selectedTask.id, stepKey as Task['status'])}
                className="mb-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-card-bg p-3 rounded border border-divider">
              <div>
                <span className="text-[10px] font-mono text-muted block mb-0.5">Assignee</span>
                <span className="text-main font-medium">{selectedTask.assignee?.full_name || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted block mb-0.5">Due Date</span>
                <span className="text-main font-mono text-[11px]">
                  {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'Continuous'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted block mb-0.5">Project Scope</span>
                <span className="text-main font-medium">{selectedTask.project?.title || 'General'}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted block mb-0.5">Estimated Hours</span>
                <span className="text-main font-mono">{selectedTask.estimated_hours ? `${selectedTask.estimated_hours}h` : '—'}</span>
              </div>
            </div>

            {/* Comments Thread */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-2">
                Activity Stream ({comments.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {loadingComments ? (
                  <div className="h-12 bg-white/[0.02] rounded animate-pulse" />
                ) : comments.length === 0 ? (
                  <div className="text-muted text-[11px] italic py-2">No notes logged yet.</div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="bg-card-bg p-2.5 rounded border border-divider text-[11px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-main">{c.author?.full_name || 'User'}</span>
                        <span className="text-[9px] font-mono text-zinc-600">
                          {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-muted">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ContextInspector>
      )}

      {/* ── Create Task Modal ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <div>
                <h2 className="text-sm font-bold text-main uppercase tracking-wider font-mono">New Deliverable</h2>
                <p className="text-[11px] text-muted mt-0.5">Assign backlog item, set priority and estimate effort</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-muted hover:text-main">
                <X size={15} />
              </button>
            </div>

            {taskError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2.5 text-xs text-red-400">
                {taskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Deliverable Title <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement LiveKit SFU node optimization"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Specifications & Requirements
                </label>
                <textarea
                  rows={2}
                  placeholder="Task details, criteria, architecture notes..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-[#07080B] border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Project Workstream
                  </label>
                  <select
                    value={newProject}
                    onChange={e => setNewProject(e.target.value)}
                    className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  >
                    <option value="">General Workspace</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Assignee
                  </label>
                  <select
                    value={newAssignee}
                    onChange={e => setNewAssignee(e.target.value)}
                    className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-[#07080B] border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors"
                >
                  {creating ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
