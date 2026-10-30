import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  Search, Plus, Briefcase, Building2,
  LayoutGrid, List, RefreshCw, ArrowUpRight,
  Filter, Tag, CheckCircle2, Clock
} from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, TrajectoryProgress,
  EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface DepartmentProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  cover_color: string | null;
  project_type: string;
  workflow_stage: string;
  department_metadata: Record<string, any>;
  department_id: string | null;
  department?: {
    id: string;
    name: string;
    color: string;
    module_configurations?: any;
  } | null;
  owner?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  tasks?: { id: string; status: string; title: string }[];
  progress?: number;
  totalTasks?: number;
  doneTasks?: number;
}

export default function ProjectOversight() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, hasOrgOversight, departments } = useWorkspace();

  const [projects, setProjects] = useState<DepartmentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Guard: ordinary employee without oversight should be routed to their department projects
  useEffect(() => {
    if (!loading && !hasOrgOversight) {
      navigate('/projects', { replace: true });
    }
  }, [hasOrgOversight, loading, navigate]);

  const fetchOversightProjects = useCallback(async () => {
    if (!user || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, title, description, status, priority, due_date, cover_color,
          project_type, workflow_stage, department_metadata, department_id,
          owner:owner_id(full_name, email, avatar_url),
          department:department_id(id, name, color, module_configurations),
          tasks(id, status, title)
        `)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((p: any) => {
        const tasks = p.tasks || [];
        const done = tasks.filter((t: any) => t.status === 'done').length;
        return {
          ...p,
          progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
          totalTasks: tasks.length,
          doneTasks: done,
        };
      });
      setProjects(processed);
    } catch (err) {
      console.error('Failed to load oversight projects:', err);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => {
    fetchOversightProjects();
  }, [fetchOversightProjects]);

  // Extract unique project types present in the loaded set
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    projects.forEach(p => {
      if (p.project_type) types.add(p.project_type);
    });
    return Array.from(types);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchDept = deptFilter === 'all' || p.department_id === deptFilter;
      const matchType = typeFilter === 'all' || p.project_type === typeFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.department?.name && p.department.name.toLowerCase().includes(search.toLowerCase()));
      return matchDept && matchType && matchStatus && matchSearch;
    });
  }, [projects, deptFilter, typeFilter, statusFilter, search]);

  const activeCount = projects.filter(p => p.status === 'active').length;
  const inReviewCount = projects.filter(p => p.status === 'review').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const crossDeptCount = projects.filter(p => p.department_id && p.department_metadata?.is_cross_department).length;
  const totalTasks = projects.reduce((acc, p) => acc + (p.totalTasks || 0), 0);

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'ALL INITIATIVES', value: projects.length < 10 ? `0${projects.length}` : projects.length },
    { label: 'ACTIVE WORKSTREAMS', value: activeCount < 10 ? `0${activeCount}` : activeCount, isOrange: activeCount > 0 },
    { label: 'IN REVIEW', value: inReviewCount < 10 ? `0${inReviewCount}` : inReviewCount },
    { label: 'COMPLETED', value: completedCount < 10 ? `0${completedCount}` : completedCount },
    { label: 'TOTAL DELIVERABLES', value: totalTasks },
    { label: 'CROSS-DEPT ALIGNED', value: crossDeptCount < 10 ? `0${crossDeptCount}` : crossDeptCount },
  ], [projects.length, activeCount, inReviewCount, completedCount, totalTasks, crossDeptCount]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      <PageHeader
        title="Project & Portfolio Oversight"
        description="Cross-department delivery governance, workflow velocity, and department-specific initiative matrices."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOversightProjects()}
              className="p-1.5 rounded bg-surface hover:bg-hover border border-divider text-muted hover:text-main transition-colors cursor-pointer"
              title="Refresh Matrix"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>New Workstream</span>
            </button>
          </div>
        }
      />

      <MetricStrip metrics={metrics} />

      {/* ── Filters & Controls Bar ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-divider px-2.5 py-1.5 rounded text-xs">
            <Building2 size={13} className="text-muted" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-transparent text-main text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments ({projects.length})</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Type Filter */}
          {availableTypes.length > 0 && (
            <div className="flex items-center gap-1.5 bg-surface border border-divider px-2.5 py-1.5 rounded text-xs">
              <Tag size={13} className="text-muted" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-main text-xs focus:outline-none cursor-pointer capitalize"
              >
                <option value="all">All Types</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-divider px-2.5 py-1.5 rounded text-xs">
            <Filter size={13} className="text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-main text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="review">In Review</option>
              <option value="planning">Planning</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across departments..."
              className="w-full bg-surface border border-divider rounded pl-8 pr-3 py-1.5 text-xs text-main placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center border border-divider rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 ${viewMode === 'table' ? 'bg-surface text-accent' : 'bg-transparent text-muted hover:text-main'} transition-colors cursor-pointer`}
              title="Table view"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-surface text-accent' : 'bg-transparent text-muted hover:text-main'} transition-colors cursor-pointer`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View ── */}
      {loading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No department projects found"
          description={
            deptFilter !== 'all' || typeFilter !== 'all' || search
              ? 'No projects match your current filters.'
              : 'Initialize projects within departments to begin tracking cross-department velocity.'
          }
          action={{
            label: 'Initialize First Project',
            onClick: () => navigate('/projects/new'),
          }}
        />
      ) : viewMode === 'table' ? (
        <div className="border border-divider rounded-lg bg-surface/50 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-divider text-[10px] font-mono text-muted uppercase bg-surface/80">
                <th className="py-2.5 px-3 font-semibold">Department</th>
                <th className="py-2.5 px-3 font-semibold">Workstream / Project</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Department Stage</th>
                <th className="py-2.5 px-3 font-semibold">Velocity</th>
                <th className="py-2.5 px-3 font-semibold">Lead</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider/40">
              {filteredProjects.map((p) => {
                const deptColor = p.department?.color || '#FF6B4A';
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="hover:bg-hover/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border"
                        style={{
                          backgroundColor: `${deptColor}15`,
                          borderColor: `${deptColor}30`,
                          color: deptColor,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor }} />
                        {p.department?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-main group-hover:text-accent transition-colors flex items-center gap-1.5">
                        <span>{p.title}</span>
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-muted line-clamp-1 max-w-sm mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface border border-divider text-muted">
                        {(p.project_type || 'standard').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-main capitalize">
                        <Clock size={11} className="text-muted" />
                        {(p.workflow_stage || p.status || 'planning').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <TrajectoryProgress progress={p.progress || 0} size="sm" />
                        <span className="font-mono text-[10px] text-muted">
                          {p.doneTasks}/{p.totalTasks}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] text-muted">
                        {p.owner?.full_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${p.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-hover text-muted hover:text-main border border-divider text-[11px] transition-colors"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const deptColor = p.department?.color || '#FF6B4A';
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="p-4 rounded-lg border border-divider bg-surface hover:border-accent/40 cursor-pointer transition-all flex flex-col justify-between group space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border"
                      style={{
                        backgroundColor: `${deptColor}15`,
                        borderColor: `${deptColor}30`,
                        color: deptColor,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor }} />
                      {p.department?.name || 'Unassigned'}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 border border-divider text-muted">
                      {(p.project_type || 'standard').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-medium text-main group-hover:text-accent transition-colors text-sm line-clamp-1">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="text-xs text-muted line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-divider space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted capitalize">
                      Stage: <strong className="text-main">{(p.workflow_stage || p.status || 'planning').replace(/_/g, ' ')}</strong>
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {Math.round(p.progress || 0)}%
                    </span>
                  </div>
                  <TrajectoryProgress progress={p.progress || 0} size="sm" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
