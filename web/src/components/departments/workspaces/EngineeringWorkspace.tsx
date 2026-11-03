import React, { useState, useEffect, useMemo } from 'react';
import {
  Code, Zap, Bug, CheckCircle2, Rocket, Layers, Cpu,
  Plus, Search, Filter, Clock, AlertTriangle, RefreshCw,
  Users, Shield, ArrowRight, GitFork, ExternalLink, Tag,
  User, Check, X, Calendar
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { DepartmentHeader } from '../DepartmentHeader';
import { DepartmentTabs, type TabDefinition } from '../DepartmentTabs';
import type { DepartmentOperationalRecord } from '../modules/ModuleDetailView';

interface EngineeringWorkspaceProps {
  department: any;
  deptId: string;
  orgId: string;
  members: any[];
  canAdminWorkspace: boolean;
  isOwner: boolean;
  hasOrgOversight: boolean;
  onRefresh: () => void;
}

export function EngineeringWorkspace({
  department,
  deptId,
  orgId,
  members,
  canAdminWorkspace,
  isOwner,
  hasOrgOversight,
  onRefresh,
}: EngineeringWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sprints, setSprints] = useState<DepartmentOperationalRecord[]>([]);
  const [bugs, setBugs] = useState<DepartmentOperationalRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sprint Form
  const [sprintTitle, setSprintTitle] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintPoints, setSprintPoints] = useState('40');
  const [sprintEndDate, setSprintEndDate] = useState('');

  // Bug Form
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugSeverity, setBugSeverity] = useState('high');
  const [bugComponent, setBugComponent] = useState('Backend API');
  const [bugAssignee, setBugAssignee] = useState('');

  // Load Engineering Records
  const loadEngineeringData = async () => {
    setLoading(true);
    try {
      // 1. Load department records (sprints and bugs)
      const { data: recordsData, error: recordsErr } = await supabase
        .from('department_records')
        .select(`
          *,
          assigned_user:users!assigned_to(id, full_name, email)
        `)
        .eq('department_id', deptId);

      if (recordsErr) {
        console.warn('Error loading department_records:', recordsErr);
      } else {
        const allRecords = recordsData || [];
        setSprints(allRecords.filter(r => r.module_key === 'sprint_board'));
        setBugs(allRecords.filter(r => r.module_key === 'bug_tracker'));
      }

      // 2. Load department projects from public.projects
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('id, title, description, status, project_type, workflow_stage, created_at')
        .eq('department_id', deptId);

      if (projErr) {
        console.warn('Error loading projects:', projErr);
      } else {
        setProjects((projData || []).map(p => ({ ...p, name: p.title || p.name })));
      }

      // 3. Load department tasks
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('department_id', deptId);

      if (taskErr) {
        console.warn('Error loading tasks:', taskErr);
      } else {
        setTasks(taskData || []);
      }
    } catch (err: any) {
      console.error('Error loading engineering workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEngineeringData();
  }, [deptId, orgId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const activeSprint = sprints.find(s => s.status === 'active') || sprints[0];
    const sprintVelocity = Number(activeSprint?.metadata?.story_points || 0);

    const openBugs = bugs.filter(b => b.status !== 'resolved' && b.status !== 'closed');
    const criticalBugs = openBugs.filter(b => b.priority === 'urgent' || b.priority === 'high');

    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

    return {
      sprintVelocity,
      activeSprintName: activeSprint?.title || 'Sprint Planning',
      openBugsCount: openBugs.length,
      criticalBugsCount: criticalBugs.length,
      activeProjectsCount: projects.filter(p => p.status === 'active').length,
      inProgressTasksCount: inProgressTasks.length,
    };
  }, [sprints, bugs, projects, tasks]);

  // Handle Create Sprint
  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'sprint_board',
        title: sprintTitle.trim(),
        description: sprintGoal.trim() || null,
        status: 'active',
        priority: 'high',
        due_date: sprintEndDate || null,
        metadata: {
          story_points: parseInt(sprintPoints, 10) || 0,
          sprint_goal: sprintGoal.trim(),
        },
      });

      if (error) throw error;
      toast.success('Sprint created successfully.');
      setIsSprintModalOpen(false);
      setSprintTitle('');
      setSprintGoal('');
      loadEngineeringData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sprint.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Log Bug
  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('department_records').insert({
        org_id: orgId,
        department_id: deptId,
        module_key: 'bug_tracker',
        title: bugTitle.trim(),
        description: bugDesc.trim() || null,
        status: 'open',
        priority: bugSeverity === 'critical' ? 'urgent' : (bugSeverity as any),
        assigned_to: bugAssignee || null,
        metadata: {
          severity: bugSeverity,
          component: bugComponent,
        },
      });

      if (error) throw error;
      toast.success('Bug defect logged.');
      setIsBugModalOpen(false);
      setBugTitle('');
      setBugDesc('');
      loadEngineeringData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log bug.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Bug Status Update
  const handleBugStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('department_records')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Bug marked as ${newStatus}.`);
      loadEngineeringData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update bug status.');
    }
  };

  // Engineering Navigation Tabs
  const engineeringTabs: TabDefinition[] = [
    { id: 'overview', label: 'Engineering Command', icon: Code },
    { id: 'sprints', label: 'Sprint Board', count: sprints.length, icon: Zap },
    { id: 'bugs', label: 'Bug & Defect Tracker', count: bugs.length, icon: Bug },
    { id: 'projects', label: 'Development Projects', count: projects.length, icon: Layers },
    { id: 'qa', label: 'QA & Regression Runs', icon: CheckCircle2 },
    { id: 'releases', label: 'Releases & Deployments', icon: Rocket },
    { id: 'team', label: 'Engineering Team', count: members.length, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <DepartmentHeader
        name={department.name}
        description={department.description || 'Software development lifecycle, sprints, defect triage, releases, and architecture.'}
        color={department.color || '#06B6D4'}
        badge="ENGINEERING & TECHNOLOGY"
        headUser={department.head_user}
        parentDepartmentName={department.parent_department?.name}
      />

      {/* ── ENGINEERING KPI METRIC STRIP ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Sprint Velocity</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {metrics.sprintVelocity} Pts
          </div>
          <div className="text-[10px] text-text-muted mt-1 truncate">{metrics.activeSprintName}</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Open Defects</div>
          <div className="text-xl font-bold font-mono text-text-primary mt-1">
            {metrics.openBugsCount}
          </div>
          <div className="text-[10px] text-red-400 font-semibold mt-1">{metrics.criticalBugsCount} Critical Severity</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Epics / Projects</div>
          <div className="text-xl font-bold font-mono text-accent mt-1">
            {projects.length}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{metrics.activeProjectsCount} In Progress</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Active Dev Tasks</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {tasks.length}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{metrics.inProgressTasksCount} Currently in Development</div>
        </div>
      </div>

      {/* ── ENGINEERING TABS ── */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={engineeringTabs}
      />

      {/* ── TAB 1: ENGINEERING OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Active Sprint Health */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>Active Agile Sprint & Velocity</span>
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">Tracking sprint deliverables against capacity targets.</p>
                  </div>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsSprintModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Sprint</span>
                    </button>
                  )}
                </div>

                {sprints.length === 0 ? (
                  <p className="text-xs text-text-muted py-2">No sprints created yet. Click 'New Sprint' to start planning.</p>
                ) : (
                  <div className="p-4 bg-surface-2 border border-border-subtle rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-text-primary">{sprints[0].title}</div>
                        <div className="text-xs text-text-muted mt-0.5">{sprints[0].description || 'Active sprint delivery cycle.'}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {sprints[0].status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
                      <div className="p-2 bg-surface-1 rounded-lg border border-border-subtle">
                        <div className="text-[10px] text-text-muted uppercase">Capacity</div>
                        <div className="text-base font-bold text-cyan-400">{sprints[0].metadata?.story_points || 40} Pts</div>
                      </div>
                      <div className="p-2 bg-surface-1 rounded-lg border border-border-subtle">
                        <div className="text-[10px] text-text-muted uppercase">Linked Tasks</div>
                        <div className="text-base font-bold text-text-primary">{tasks.length}</div>
                      </div>
                      <div className="p-2 bg-surface-1 rounded-lg border border-border-subtle">
                        <div className="text-[10px] text-text-muted uppercase">Target Date</div>
                        <div className="text-base font-bold text-text-muted truncate">
                          {sprints[0].due_date ? new Date(sprints[0].due_date).toLocaleDateString() : 'In 12 Days'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bug Defect Triage Queue */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Bug className="w-4 h-4 text-red-400" />
                    <span>Defect Triage & Hotfixes ({metrics.openBugsCount})</span>
                  </h3>
                  {canAdminWorkspace && (
                    <button
                      onClick={() => setIsBugModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Defect</span>
                    </button>
                  )}
                </div>

                {bugs.length === 0 ? (
                  <p className="text-xs text-text-muted">Zero defects recorded. Code quality is in a healthy state.</p>
                ) : (
                  <div className="space-y-2">
                    {bugs.slice(0, 4).map(b => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded-lg text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-text-primary flex items-center gap-2">
                            <span>{b.title}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-surface-1 border border-border-subtle text-text-muted">
                              {b.metadata?.component || 'Core'}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Assigned to: {b.assigned_user?.full_name || 'Triage Pool'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            b.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {b.priority}
                          </span>
                          {canAdminWorkspace && b.status !== 'resolved' && (
                            <button
                              onClick={() => handleBugStatus(b.id, 'resolved')}
                              className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 font-semibold"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Releases & Tech Stack */}
            <div className="space-y-6">
              {/* Releases & Pipeline */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-cyan-400" />
                  <span>Deployment Milestones</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-text-primary">Production v2.4.0</span>
                      <span className="text-emerald-400 text-[10px] uppercase font-bold">Live</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Dynamic capability architecture rollout with Supabase RLS.</p>
                  </div>

                  <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-text-primary">Staging v2.5.0-rc</span>
                      <span className="text-cyan-400 text-[10px] uppercase font-bold">Testing</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Domain workspace optimizations and defect triage updates.</p>
                  </div>
                </div>
              </div>

              {/* Dev Environment Governance */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span>DevOps & Infrastructure</span>
                </h3>
                <div className="text-xs text-text-muted space-y-2">
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>CI/CD Pipelines:</span>
                    <strong className="text-emerald-400">Passing</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle">
                    <span>Code Review Policy:</span>
                    <strong className="text-text-primary">Strict (2 Sign-offs)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Engineering Lead:</span>
                    <strong className="text-text-primary">{department.head_user?.full_name || 'Unassigned'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SPRINTS ── */}
      {activeTab === 'sprints' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Agile Sprint Management</h3>
              <p className="text-xs text-text-muted">Sprint planning, story point velocity, and burn-down commitments.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsSprintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Sprint</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sprints.map(s => (
              <div key={s.id} className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-2 border border-border-subtle text-cyan-400">
                    {s.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400">{s.metadata?.story_points || 40} Pts</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">{s.title}</h4>
                  <p className="text-xs text-text-muted mt-1">{s.description || 'Sprint deliverables'}</p>
                </div>
                <div className="pt-3 border-t border-border-subtle text-xs text-text-muted flex justify-between">
                  <span>Target Date:</span>
                  <strong className="text-text-primary">{s.due_date ? new Date(s.due_date).toLocaleDateString() : 'Unscheduled'}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: BUGS ── */}
      {activeTab === 'bugs' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Bug & Defect Triage Queue</h3>
              <p className="text-xs text-text-muted">Log software defects, reproduction steps, severity levels, and resolution states.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsBugModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Defect</span>
              </button>
            )}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Defect Summary</th>
                  <th className="py-3 px-4">Component</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Status</th>
                  {canAdminWorkspace && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {bugs.map(b => (
                  <tr key={b.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary">{b.title}</div>
                      {b.description && <div className="text-[11px] text-text-muted truncate max-w-sm">{b.description}</div>}
                    </td>
                    <td className="py-3 px-4 text-text-muted">{b.metadata?.component || 'API'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        b.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        b.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {b.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-muted">{b.assigned_user?.full_name || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        b.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    {canAdminWorkspace && (
                      <td className="py-3 px-4 text-right">
                        {b.status !== 'resolved' && (
                          <button
                            onClick={() => handleBugStatus(b.id, 'resolved')}
                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 font-semibold"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: PROJECTS ── */}
      {activeTab === 'projects' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Department Development Epics & Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(p => (
              <div key={p.id} className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-text-primary">{p.title || p.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-cyan-500/10 text-cyan-400">
                    {p.workflow_stage || p.status}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{p.description || 'Core engineering project.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: QA ── */}
      {activeTab === 'qa' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Quality Assurance Checklists & Test Suites</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <CheckCircle2 className="w-8 h-8 mx-auto text-cyan-400 mb-2" />
            <p className="font-semibold text-text-primary">QA Regression Suite Active</p>
            <p className="mt-1">Automated test runners and manual verification checklists run before every major deployment.</p>
          </div>
        </div>
      )}

      {/* ── TAB 6: RELEASES ── */}
      {activeTab === 'releases' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Release Tags & Staging Pipeline</h3>
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center text-xs text-text-muted">
            <Rocket className="w-8 h-8 mx-auto text-cyan-400 mb-2" />
            <p className="font-semibold text-text-primary">Release Pipelines Synchronized</p>
            <p className="mt-1">Continuous integration tags and production artifacts are tracked here.</p>
          </div>
        </div>
      )}

      {/* ── TAB 7: TEAM ── */}
      {activeTab === 'team' && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary">Software Engineers & Tech Leads</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                  {m.user?.full_name?.charAt(0) || 'E'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate">{m.user?.full_name || m.user?.email}</div>
                  <div className="text-[11px] text-text-muted capitalize">{m.department_role || 'engineer'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODALS: CREATE SPRINT ── */}
      {isSprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">Create Agile Sprint</h3>
              <button onClick={() => setIsSprintModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSprint} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Sprint Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 25 — API Scalability"
                  value={sprintTitle}
                  onChange={e => setSprintTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Story Points Capacity</label>
                  <input
                    type="number"
                    required
                    placeholder="40"
                    value={sprintPoints}
                    onChange={e => setSprintPoints(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-mono text-text-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Target End Date</label>
                  <input
                    type="date"
                    value={sprintEndDate}
                    onChange={e => setSprintEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary">Sprint Goal</label>
                <textarea
                  rows={2}
                  placeholder="What is the key objective of this sprint?"
                  value={sprintGoal}
                  onChange={e => setSprintGoal(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsSprintModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg"
                >
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODALS: LOG BUG ── */}
      {isBugModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">Log Defect / Bug</h3>
              <button onClick={() => setIsBugModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBug} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-primary">Bug Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Edge function connection timeout"
                  value={bugTitle}
                  onChange={e => setBugTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-primary">Severity</label>
                  <select
                    value={bugSeverity}
                    onChange={e => setBugSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical / Blocker</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-primary">Component</label>
                  <input
                    type="text"
                    value={bugComponent}
                    onChange={e => setBugComponent(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary">Reproduction Steps & Details</label>
                <textarea
                  rows={2}
                  placeholder="Steps to trigger defect..."
                  value={bugDesc}
                  onChange={e => setBugDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-hidden resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsBugModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg"
                >
                  Log Defect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
