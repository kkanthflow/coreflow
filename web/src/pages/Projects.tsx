import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Search, Plus, Briefcase, X,
  LayoutGrid, List, RefreshCw
} from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, TrajectoryProgress,
  ContextInspector, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

const STATUS_FILTERS = [
  { key: 'all',       label: 'All Workstreams' },
  { key: 'active',    label: 'Active' },
  { key: 'planning',  label: 'Planning' },
  { key: 'review',    label: 'In Review' },
  { key: 'completed', label: 'Completed' },
];

export default function Projects() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { orgId } = useWorkspace();

  const isIndie = !orgId;
  const canCreate = hasPermission(role, 'create_projects');

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [inspectingProject, setInspectingProject] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('projects')
        .select('id, title, description, status, priority, due_date, cover_color, owner:owner_id(full_name, email, avatar_url), department:department_id(name), tasks(id, status, title)')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (isIndie) {
        query = query.eq('owner_id', user.id);
      } else if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setProjects((data || []).map((p: any) => {
        const tasks = p.tasks || [];
        const done  = tasks.filter((t: any) => t.status === 'done').length;
        return { 
          ...p, 
          progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
          totalTasks: tasks.length,
          doneTasks: done
        };
      }));
    } catch (e) {
      console.error('Projects fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, orgId, isIndie]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const projChannel = supabase
      .channel('realtime:projects_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .subscribe();

    return () => { supabase.removeChannel(projChannel); };
  }, [user, fetchProjects]);

  const filtered = projects.filter(p => {
    const matchFilter = filter === 'all' || p.status === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const activeCount = projects.filter(p => p.status === 'active').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const inReviewCount = projects.filter(p => p.status === 'review').length;
  const totalTasksCount = projects.reduce((acc, p) => acc + (p.totalTasks || 0), 0);

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'WORKSTREAMS', value: projects.length < 10 ? `0${projects.length}` : projects.length },
    { label: 'ACTIVE DELIVERY', value: activeCount < 10 ? `0${activeCount}` : activeCount, isOrange: activeCount > 0 },
    { label: 'IN REVIEW', value: inReviewCount < 10 ? `0${inReviewCount}` : inReviewCount },
    { label: 'COMPLETED', value: completedCount < 10 ? `0${completedCount}` : completedCount },
    { label: 'DELIVERABLES', value: totalTasksCount },
    { label: 'PORTFOLIO HEALTH', value: 'Optimal', indicator: '96.2%' },
  ], [projects, activeCount, inReviewCount, completedCount, totalTasksCount]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Projects & Workstreams"
        description="Delivery governance, milestone velocity, and cross-functional engineering scopes."
        actions={
          <>
            <button
              onClick={fetchProjects}
              className="p-2 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors"
              title="Sync projects"
            >
              <RefreshCw size={13} />
            </button>
            {canCreate && (
              <button
                onClick={() => navigate('/projects/new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>New Project</span>
              </button>
            )}
          </>
        }
      />

      {/* ── Continuous Telemetry Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Filter Bar & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0C0D12] border border-white/[0.06] rounded-lg p-2.5">
        <div className="flex items-center gap-3 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search initiatives, scopes, or owners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080B] border border-white/[0.05] focus:border-[#FF6B4A]/40 rounded text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="flex bg-[#07080B] border border-white/[0.05] rounded p-0.5">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-[#151822] text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-[#07080B] border border-white/[0.05] rounded p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'table' ? 'bg-[#151822] text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Table view"
            >
              <List size={13} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-[#151822] text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid cards"
            >
              <LayoutGrid size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main View: Data Table / Structured List ── */}
      {loading ? (
        <SkeletonRow count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects found"
          description={search ? "No initiatives match the current filter query." : "Initialize your first project workstream to coordinate team deliverables."}
          action={canCreate && !search ? { label: "Create First Project", onClick: () => navigate('/projects/new') } : undefined}
        />
      ) : viewMode === 'table' ? (
        <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-white/[0.05] text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider bg-[#090A0E]">
            <div className="col-span-4">Project & Scope</div>
            <div className="col-span-2">Department</div>
            <div className="col-span-2">Stage Status</div>
            <div className="col-span-3">Deliverable Velocity</div>
            <div className="col-span-1 text-right">Target</div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {filtered.map((project, idx) => {
              const progress = Math.round(project.progress);
              return (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  key={project.id}
                  onClick={() => setInspectingProject(project)}
                  className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.025] transition-colors items-center text-xs cursor-pointer group"
                >
                  <div className="col-span-4 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: project.cover_color || '#FF6B4A' }} />
                      <span className="font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                        {project.title}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5 pl-4">{project.description}</p>
                    )}
                  </div>

                  <div className="col-span-2 text-zinc-400 truncate">
                    {project.department?.name || 'Workspace Core'}
                  </div>

                  <div className="col-span-2">
                    <StatusSignal status={project.status} />
                  </div>

                  <div className="col-span-3 pr-4">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                      <span>{project.doneTasks}/{project.totalTasks} Done</span>
                      <span className="text-white font-bold">{progress}%</span>
                    </div>
                    <TrajectoryProgress value={progress} color={project.cover_color || '#FF6B4A'} />
                  </div>

                  <div className="col-span-1 text-right font-mono text-[11px] text-zinc-500">
                    <span className="font-mono text-zinc-500">{project.due_date ? new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Sprint Queue'}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(project => {
            const progress = Math.round(project.progress);
            return (
              <div
                key={project.id}
                onClick={() => setInspectingProject(project)}
                className="bg-[#0C0D12] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <StatusSignal status={project.status} />
                    <span className="text-[10px] font-mono text-zinc-500">
                      {project.due_date ? new Date(project.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No deadline'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-[#FF6B4A] transition-colors truncate mb-1">
                    {project.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 min-h-[32px] font-normal leading-relaxed">
                    {project.description || 'No detailed specifications provided.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.04] mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-500">{project.doneTasks}/{project.totalTasks} Deliverables</span>
                    <span className="text-white font-bold">{progress}%</span>
                  </div>
                  <TrajectoryProgress value={progress} color={project.cover_color || '#FF6B4A'} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Context Inspector Drawer ── */}
      {inspectingProject && (
        <ContextInspector
          title={inspectingProject.title}
          subtitle={inspectingProject.department?.name || 'Workspace Project'}
          badge={inspectingProject.status.toUpperCase()}
          onClose={() => setInspectingProject(null)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <Link
                to={`/projects/${inspectingProject.id}`}
                className="flex-1 py-2 px-3 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded text-center transition-colors"
              >
                Open Project Center
              </Link>
              <button
                onClick={() => setInspectingProject(null)}
                className="py-2 px-3 bg-[#141620] hover:bg-[#1A1D2B] text-zinc-300 text-xs font-medium rounded border border-white/[0.06] transition-colors"
              >
                Close
              </button>
            </div>
          }
        >
          {/* Inspector Content */}
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Scope & Specifications</span>
              <p className="text-zinc-300 bg-[#08090C] p-3 rounded border border-white/[0.04] leading-relaxed">
                {inspectingProject.description || 'No detailed scope documented.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#08090C] p-3 rounded border border-white/[0.04]">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Status</span>
                <StatusSignal status={inspectingProject.status} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Deadline</span>
                <span className="text-white font-mono text-[11px]">
                  {inspectingProject.due_date ? new Date(inspectingProject.due_date).toLocaleDateString() : 'Unscheduled'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Owner</span>
                <span className="text-white font-medium">{inspectingProject.owner?.full_name || 'Organization'}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">Tasks Done</span>
                <span className="text-white font-mono">{inspectingProject.doneTasks} / {inspectingProject.totalTasks}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-2">Recent Tasks in Workstream</span>
              <div className="space-y-1.5">
                {(inspectingProject.tasks || []).slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded bg-[#08090C] border border-white/[0.04]">
                    <span className="text-zinc-200 truncate pr-2">{t.title}</span>
                    <StatusSignal status={t.status || 'todo'} />
                  </div>
                ))}
                {(inspectingProject.tasks || []).length === 0 && (
                  <div className="text-zinc-500 text-[11px] italic py-2">No tasks created yet.</div>
                )}
              </div>
            </div>
          </div>
        </ContextInspector>
      )}

    </div>
  );
}
