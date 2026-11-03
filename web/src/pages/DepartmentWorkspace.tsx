import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  CheckSquare, Briefcase, Plus, X, Clock, ArrowRight,
  UserPlus, Shield, CheckCircle2, Target, Layers, ArrowLeftRight,
  GitFork, Archive, ShieldCheck, CheckCircle
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { EmptyState } from '../components/ui/ObsidianPrimitives';
import {
  DepartmentHeader,
  DepartmentTabs,
  DepartmentMetricStrip,
  type TabDefinition,
} from '../components/departments';
import {
  getActiveModulesForCapabilities,
} from '../lib/capabilityEngine';
import { ModuleDetailView } from '../components/departments/modules/ModuleDetailView';

interface DepartmentDetail {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  is_archived?: boolean;
  parent_department_id?: string | null;
  head_user_id: string | null;
  objectives?: string[] | null;
  responsibilities?: string[] | null;
  operational_requirements?: string | null;
  expected_outcomes?: string | null;
  created_at: string;
  head_user?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  parent_department?: { id: string; name: string } | null;
}

interface DeptMember {
  id: string;
  department_id: string;
  user_id: string;
  department_role: string;
  can_manage: boolean;
  is_primary: boolean;
  joined_at: string;
  user?: { id: string; full_name: string; email: string; role: string; job_title?: string; avatar_url?: string };
}

interface DeptTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  assignee?: { id: string; full_name: string };
}

interface DeptProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_type?: string;
  workflow_stage?: string;
  due_date: string | null;
  cover_color: string | null;
}

interface CollabRequest {
  id: string;
  requesting_department_id: string;
  target_department_id: string;
  request_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  requester?: { id: string; full_name: string; email: string };
  requesting_department?: { id: string; name: string };
  target_department?: { id: string; name: string };
}

interface DeptActivity {
  id: string;
  actor_id: string;
  activity_type: string;
  title: string;
  details: any;
  created_at: string;
  actor?: { id: string; full_name: string };
}

const DEPT_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

export default function DepartmentWorkspace() {
  const { id: deptId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, isOwner, canManageDepartments, hasOrgOversight, assignedDepartmentId } = useWorkspace();

  const [department, setDepartment] = useState<DepartmentDetail | null>(null);
  const [activeCapabilities, setActiveCapabilities] = useState<string[]>([]);
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [tasks, setTasks] = useState<DeptTask[]>([]);
  const [projects, setProjects] = useState<DeptProject[]>([]);
  const [collabRequests, setCollabRequests] = useState<CollabRequest[]>([]);
  const [activities, setActivities] = useState<DeptActivity[]>([]);
  const [allOrgDepartments, setAllOrgDepartments] = useState<{ id: string; name: string }[]>([]);
  const [availableOrgMembers, setAvailableOrgMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Permissions in this workspace
  const userMemberRecord = useMemo(() => {
    return members.find(m => m.user_id === user?.id);
  }, [members, user?.id]);

  const isDeptHead = userMemberRecord?.department_role === 'head' || department?.head_user_id === user?.id;
  const isDeptManager = isDeptHead || userMemberRecord?.can_manage || userMemberRecord?.department_role === 'manager';
  const canAdminWorkspace = isOwner || hasOrgOversight || isDeptManager;

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Cross-Dept Collab Modal
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [collabTargetDeptId, setCollabTargetDeptId] = useState('');
  const [collabType, setCollabType] = useState('task_assignment');
  const [collabTitle, setCollabTitle] = useState('');
  const [collabDesc, setCollabDesc] = useState('');
  const [collabPriority, setCollabPriority] = useState('medium');
  const [savingCollab, setSavingCollab] = useState(false);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState<'head' | 'manager' | 'member'>('member');
  const [selectedAddIsPrimary, setSelectedAddIsPrimary] = useState(true);
  const [addingMember, setAddingMember] = useState(false);

  // Settings Edit State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState(DEPT_COLORS[0]);
  const [editParentId, setEditParentId] = useState('');
  const [editObjectives, setEditObjectives] = useState<string[]>([]);
  const [newObjInput, setNewObjInput] = useState('');
  const [editResponsibilities, setEditResponsibilities] = useState<string[]>([]);
  const [newRespInput, setNewRespInput] = useState('');
  const [editOutcomes, setEditOutcomes] = useState('');
  const [editRequirements, setEditRequirements] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  // Fetch full workspace data
  const fetchWorkspaceData = useCallback(async () => {
    if (!deptId || !orgId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch Department Details
      const { data: deptData, error: deptErr } = await supabase
        .from('departments')
        .select(`
          *,
          head_user:head_user_id(id, full_name, email, avatar_url),
          parent_department:parent_department_id(id, name)
        `)
        .eq('id', deptId)
        .eq('org_id', orgId)
        .single();

      if (deptErr || !deptData) {
        toast.error('Department not found or inaccessible.');
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setDepartment(deptData);
      setEditName(deptData.name);
      setEditDesc(deptData.description || '');
      setEditColor(deptData.color || DEPT_COLORS[0]);
      setEditParentId(deptData.parent_department_id || '');
      setEditObjectives(Array.isArray(deptData.objectives) ? deptData.objectives : []);
      setEditResponsibilities(Array.isArray(deptData.responsibilities) ? deptData.responsibilities : []);
      setEditOutcomes(deptData.expected_outcomes || '');
      setEditRequirements(deptData.operational_requirements || '');

      // 2. Verify backend authorization via RPC
      const { data: accessGranted } = await supabase.rpc('can_access_department', {
        p_user_id: user.id,
        p_dept_id: deptId,
      });

      if (!accessGranted && !isOwner && !hasOrgOversight) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setHasAccess(true);

      // 3. Fetch Capabilities
      const { data: capsData } = await supabase
        .from('department_capabilities')
        .select('capability_key')
        .eq('department_id', deptId)
        .eq('is_active', true);

      setActiveCapabilities((capsData || []).map(c => c.capability_key));

      // 4. Fetch Department Members
      const { data: membersData } = await supabase
        .from('department_members')
        .select(`
          *,
          user:user_id(id, full_name, email, role, job_title, avatar_url)
        `)
        .eq('department_id', deptId)
        .order('department_role', { ascending: true });

      setMembers(membersData || []);

      // 5. Fetch Department Tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, due_date, assignee_id, created_at,
          assignee:assignee_id(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      setTasks((tasksData as any) || []);

      // 6. Fetch Department Projects
      const { data: projData } = await supabase
        .from('projects')
        .select('id, title, description, status, priority, project_type, workflow_stage, due_date, cover_color')
        .eq('department_id', deptId)
        .order('created_at', { ascending: false });

      setProjects(projData || []);

      // 7. Fetch Cross-Department Collaboration Requests
      const { data: collabData } = await supabase
        .from('department_collaboration_requests')
        .select(`
          *,
          requester:requester_id(id, full_name, email),
          requesting_department:requesting_department_id(id, name),
          target_department:target_department_id(id, name)
        `)
        .or(`requesting_department_id.eq.${deptId},target_department_id.eq.${deptId}`)
        .order('created_at', { ascending: false });

      setCollabRequests((collabData as any) || []);

      // 8. Fetch Activities Audit Log
      const { data: actData } = await supabase
        .from('department_activities')
        .select(`
          *,
          actor:actor_id(id, full_name)
        `)
        .eq('department_id', deptId)
        .order('created_at', { ascending: false })
        .limit(25);

      setActivities((actData as any) || []);

      // 9. Fetch other org departments for parent selection & collaboration
      const { data: deptsList } = await supabase
        .from('departments')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('is_deleted', false)
        .neq('id', deptId)
        .order('name');

      setAllOrgDepartments(deptsList || []);

      // 10. Fetch org members for assignment
      const { data: uData } = await supabase
        .from('user_organizations')
        .select('users:user_id(id, full_name, email)')
        .eq('org_id', orgId);

      if (uData) {
        setAvailableOrgMembers(uData.map((d: any) => d.users).filter(Boolean));
      }
    } catch (e: any) {
      console.error('Failed to load department workspace:', e);
      toast.error('Failed to load department workspace.');
    } finally {
      setLoading(false);
    }
  }, [deptId, orgId, user, isOwner, hasOrgOversight]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Compute Active Modules
  const activeModules = useMemo(() => {
    return getActiveModulesForCapabilities(activeCapabilities);
  }, [activeCapabilities]);

  // Dynamic Tabs Configuration
  const tabs: TabDefinition[] = useMemo(() => {
    const list: TabDefinition[] = [
      { id: 'overview', label: 'Overview' },
      { id: 'tasks', label: 'Work & Tasks', count: tasks.filter(t => t.status !== 'done').length },
      { id: 'projects', label: 'Projects', count: projects.length },
      { id: 'modules', label: 'Capability Modules', count: activeModules.length },
      { id: 'members', label: 'Team & Leadership', count: members.length },
      { id: 'collaboration', label: 'Cross-Dept Collab', count: collabRequests.filter(r => r.status === 'pending' && r.target_department_id === deptId).length },
      { id: 'analytics', label: 'Analytics' },
    ];

    if (canAdminWorkspace) {
      list.push({ id: 'settings', label: 'Settings' });
    }
    return list;
  }, [tasks, projects, activeModules, members, collabRequests, deptId, canAdminWorkspace]);

  // Create Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !deptId || !orgId) return;

    setSavingTask(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          priority: taskPriority,
          status: 'todo',
          assignee_id: taskAssigneeId || null,
          due_date: taskDueDate || null,
          department_id: deptId,
          org_id: orgId,
          created_by: user?.id,
        });

      if (error) throw error;
      toast.success('Task created successfully.');
      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      setTaskAssigneeId('');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task.');
    } finally {
      setSavingTask(false);
    }
  };

  // Dispatch Collaboration Request Handler
  const handleCreateCollabRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabTitle.trim() || !collabTargetDeptId || !deptId || !orgId) return;

    setSavingCollab(true);
    try {
      const { error } = await supabase.rpc('create_collaboration_request', {
        p_org_id: orgId,
        p_requesting_department_id: deptId,
        p_target_department_id: collabTargetDeptId,
        p_request_type: collabType,
        p_title: collabTitle.trim(),
        p_description: collabDesc.trim() || null,
        p_priority: collabPriority,
        p_payload: {},
      });

      if (error) throw error;
      toast.success('Cross-department collaboration request dispatched.');
      setIsCollabModalOpen(false);
      setCollabTitle('');
      setCollabDesc('');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send collaboration request.');
    } finally {
      setSavingCollab(false);
    }
  };

  // Resolve Collaboration Request Handler
  const handleResolveCollab = async (requestId: string, status: 'approved' | 'rejected' | 'in_progress' | 'completed') => {
    if (!orgId) return;
    try {
      const { error } = await supabase.rpc('resolve_collaboration_request', {
        p_org_id: orgId,
        p_request_id: requestId,
        p_status: status,
      });

      if (error) throw error;
      toast.success(`Request marked as ${status}.`);
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update request.');
    }
  };

  // Assign Member via atomic RPC with multi-tier fallback
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !selectedAddUserId) return;

    setAddingMember(true);
    try {
      // 1. Primary RPC signature
      let { error } = await supabase.rpc('assign_department_member', {
        p_dept_id: deptId,
        p_user_id: selectedAddUserId,
        p_department_role: selectedAddRole,
        p_is_primary: selectedAddIsPrimary,
      });

      // 2. Fallback to legacy parameter names if schema cache or signature mismatch
      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        const legacyRes = await supabase.rpc('assign_department_member', {
          p_department_id: deptId,
          p_target_user_id: selectedAddUserId,
          p_department_role: selectedAddRole,
          p_is_primary: selectedAddIsPrimary,
        });
        error = legacyRes.error;
      }

      // 3. Resilient fallback to direct table upsert if RPC is unavailable in schema cache
      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        const { error: upsertErr } = await supabase
          .from('department_members')
          .upsert({
            department_id: deptId,
            user_id: selectedAddUserId,
            org_id: orgId,
            department_role: selectedAddRole,
            is_primary: selectedAddIsPrimary,
            assigned_by: user?.id,
          }, { onConflict: 'department_id,user_id' });

        if (upsertErr) throw upsertErr;

        if (selectedAddIsPrimary && orgId) {
          await supabase
            .from('user_organizations')
            .update({ department_id: deptId })
            .eq('org_id', orgId)
            .eq('user_id', selectedAddUserId);

          if (department?.name) {
            await supabase
              .from('users')
              .update({ department: department.name })
              .eq('id', selectedAddUserId);
          }
        }
        error = null;
      }

      if (error) throw error;
      toast.success('Member assigned to department successfully.');
      setIsAddMemberOpen(false);
      setSelectedAddUserId('');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign member.');
    } finally {
      setAddingMember(false);
    }
  };

  // Save Settings Changes
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId || !orgId || !editName.trim()) return;

    setSavingSettings(true);
    try {
      const { error } = await supabase.rpc('update_dynamic_department', {
        p_org_id: orgId,
        p_department_id: deptId,
        p_name: editName.trim(),
        p_description: editDesc.trim() || null,
        p_color: editColor,
        p_parent_department_id: editParentId || null,
        p_objectives: editObjectives,
        p_operational_requirements: editRequirements.trim() || null,
        p_expected_outcomes: editOutcomes.trim() || null,
        p_capability_keys: activeCapabilities,
      });

      if (error) throw error;
      toast.success('Department configuration saved.');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update configuration.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Safe Archive Department
  const handleArchiveDepartment = async () => {
    if (!deptId || !orgId) return;
    try {
      const { error } = await supabase.rpc('archive_department_safe', {
        p_org_id: orgId,
        p_department_id: deptId,
      });

      if (error) throw error;
      toast.success('Department workspace archived.');
      navigate('/departments');
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive department.');
    }
  };

  // Access Denied Screen
  if (hasAccess === false) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Department Access Restricted</h2>
        <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
          You are not assigned to this department workspace. Ordinary employees can only view their authorized department.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {assignedDepartmentId ? (
            <Link
              to={`/departments/${assignedDepartmentId}`}
              className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl shadow-xs"
            >
              Go to My Department
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-primary text-xs font-semibold rounded-xl"
            >
              Return to Overview
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Department Header */}
      <DepartmentHeader
        departmentName={department?.name || 'Department Workspace'}
        description={department?.description}
        badge={department?.is_archived ? 'ARCHIVED' : `${activeCapabilities.length} CAPABILITIES`}
        onRefresh={fetchWorkspaceData}
        isRefreshing={loading}
        primaryAction={
          canAdminWorkspace ? {
            label: 'New Task',
            icon: Plus,
            onClick: () => setIsTaskModalOpen(true),
          } : undefined
        }
        secondaryAction={
          canAdminWorkspace ? {
            label: 'Cross-Dept Request',
            icon: ArrowLeftRight,
            onClick: () => setIsCollabModalOpen(true),
          } : undefined
        }
        extraActions={
          department?.parent_department ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-muted">
              <GitFork className="w-3.5 h-3.5 text-accent" />
              <span>Sub-department of <strong className="text-text-primary">{department.parent_department.name}</strong></span>
            </div>
          ) : undefined
        }
      />

      {/* Telemetry Strip */}
      <DepartmentMetricStrip
        metrics={[
          { label: 'Active Tasks', value: tasks.filter(t => t.status !== 'done').length, indicator: `${tasks.filter(t => t.status === 'in_progress').length} In Progress` },
          { label: 'Department Projects', value: projects.length, isOrange: true, indicator: `${projects.filter(p => p.status === 'active').length} Active` },
          { label: 'Team Members', value: members.length, trend: department?.head_user ? `Head: ${department.head_user.full_name}` : 'Unassigned Head' },
        ]}
      />

      {/* Dynamic Workspace Tabs */}
      <DepartmentTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Identity & Strategic Objectives */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Objectives Board */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <Target className="w-4 h-4 text-accent" />
                    <span>Strategic Objectives & Targets</span>
                  </h3>
                  <span className="text-xs text-text-muted">
                    {(department?.objectives || []).length} Objectives Defined
                  </span>
                </div>

                {(department?.objectives || []).length === 0 ? (
                  <p className="text-xs text-text-muted">No strategic objectives defined yet. Authorized managers can add objectives in Settings.</p>
                ) : (
                  <div className="space-y-2">
                    {(department?.objectives || []).map((obj, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-2 border border-border-subtle text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="text-text-primary leading-relaxed">{obj}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Responsibilities & Operational Scope */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-accent" />
                  <span>Key Responsibilities & Operational Scope</span>
                </h3>

                {(department?.responsibilities || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(department?.responsibilities || []).map((resp, i) => (
                      <span key={i} className="px-3 py-1 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary font-medium">
                        {resp}
                      </span>
                    ))}
                  </div>
                )}

                {department?.expected_outcomes && (
                  <div className="text-xs bg-surface-2 p-3 rounded-lg border border-border-subtle space-y-1">
                    <strong className="text-text-primary block font-semibold">Expected Business Outcomes:</strong>
                    <p className="text-text-muted leading-relaxed">{department.expected_outcomes}</p>
                  </div>
                )}

                {department?.operational_requirements && (
                  <div className="text-xs bg-surface-2 p-3 rounded-lg border border-border-subtle space-y-1">
                    <strong className="text-text-primary block font-semibold">Operational Requirements & Governance:</strong>
                    <p className="text-text-muted leading-relaxed">{department.operational_requirements}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Leadership & Quick Navigation */}
            <div className="space-y-6">
              {/* Department Leadership Profile */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>Leadership Oversight</span>
                </h3>

                {department?.head_user ? (
                  <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border-subtle">
                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-sm">
                      {department.head_user.full_name?.charAt(0) || 'H'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-text-primary truncate">{department.head_user.full_name}</div>
                      <div className="text-[11px] text-text-muted truncate">{department.head_user.email}</div>
                      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider bg-accent/15 text-accent mt-1">
                        Department Head
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">No Department Head appointed yet.</p>
                )}

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                  <span>Assigned Managers:</span>
                  <strong className="text-text-primary">
                    {members.filter(m => m.can_manage || m.department_role === 'manager').length}
                  </strong>
                </div>
              </div>

              {/* Centralized Communication Shortcuts (Phase One Non-Negotiable) */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">Organization Communications</h3>
                <p className="text-xs text-text-muted">
                  Official messaging and video meetings are centralized across the organization.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/chat"
                    className="p-3 bg-surface-2 hover:bg-surface-3 rounded-lg border border-border-subtle text-center text-xs font-semibold text-text-primary transition-colors block"
                  >
                    Open Chat
                  </Link>
                  <Link
                    to="/meetings"
                    className="p-3 bg-surface-2 hover:bg-surface-3 rounded-lg border border-border-subtle text-center text-xs font-semibold text-text-primary transition-colors block"
                  >
                    Video Calls
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: WORK & TASKS ── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Department Tasks & Execution Board</h3>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No department tasks"
              description="Create the first task deliverable for this department."
              action={canAdminWorkspace ? { label: 'New Task', onClick: () => setIsTaskModalOpen(true) } : undefined}
            />
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div
                  key={t.id}
                  className="bg-surface-1 border border-border-subtle hover:border-border-strong rounded-xl p-4 flex items-center justify-between shadow-xs transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-surface-2 text-accent mt-0.5">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">{t.title}</h4>
                      {t.description && <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{t.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-text-muted">
                        <span className="uppercase font-semibold px-1.5 py-0.5 rounded bg-surface-2 text-text-primary">
                          {t.priority}
                        </span>
                        {t.assignee && (
                          <span>Assigned to: <strong className="text-text-primary">{t.assignee.full_name}</strong></span>
                        )}
                        {t.due_date && <span>Due: {new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg uppercase tracking-wider ${
                    t.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    t.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-surface-2 text-text-muted'
                  }`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PROJECTS ── */}
      {activeTab === 'projects' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Department Projects & Workflows</h3>
              <p className="text-xs text-text-muted">Specialized initiatives tailored to this department's operational identity.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => navigate('/projects/new')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No department projects"
              description="Start a department-specific project or initiative."
              action={canAdminWorkspace ? { label: 'Create Project', onClick: () => navigate('/projects/new') } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="bg-surface-1 border border-border-subtle hover:border-border-strong rounded-xl p-4 shadow-xs cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-2 text-accent">
                        {p.project_type || 'STANDARD'}
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-surface-2 text-text-muted">
                        {p.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                      {p.title}
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-2">
                      {p.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                    <span>Stage: <strong className="text-text-primary capitalize">{p.workflow_stage?.replace('_', ' ') || 'Planning'}</strong></span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: CAPABILITY-SPECIFIC MODULES ── */}
      {activeTab === 'modules' && (
        selectedModuleId && activeModules.find(m => m.id === selectedModuleId) ? (
          <ModuleDetailView
            module={activeModules.find(m => m.id === selectedModuleId)!}
            deptId={deptId!}
            orgId={orgId!}
            deptName={department?.name || 'Department'}
            members={members}
            canManage={canAdminWorkspace}
            onBack={() => setSelectedModuleId(null)}
          />
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Dynamic Capability Modules</h3>
                <p className="text-xs text-text-muted">
                  These operational modules were dynamically provisioned from the {activeCapabilities.length} configured capabilities. Click any module to open its working operational workspace.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-surface-2 border border-border-subtle text-text-muted">
                {activeModules.length} Active {activeModules.length === 1 ? 'Module' : 'Modules'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeModules.map(mod => (
                <div
                  key={mod.id}
                  onClick={() => setSelectedModuleId(mod.id)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedModuleId(mod.id);
                    }
                  }}
                  className="bg-surface-1 border border-border-subtle hover:border-accent/40 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between group cursor-pointer transition-all hover:shadow-md select-none"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent group-hover:scale-105 transition-transform">
                        <Layers className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-muted">
                        {mod.category}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">
                      {mod.name}
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-2">{mod.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-accent font-semibold group-hover:underline">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Active Workspace</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span>Open Module</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── TAB 5: MEMBERS & LEADERSHIP ── */}
      {activeTab === 'members' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Department Members & Roles</h3>
              <p className="text-xs text-text-muted">Staff assigned to this department with departmental authorities.</p>
            </div>
            {canAdminWorkspace && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Assign Member</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(m => {
              const isHead = m.department_role === 'head' || department?.head_user_id === m.user_id;
              const isManager = isHead || m.can_manage || m.department_role === 'manager';

              return (
                <div
                  key={m.id}
                  className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-xs flex items-center gap-3.5"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-sm">
                    {m.user?.full_name?.charAt(0) || 'M'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-text-primary truncate">{m.user?.full_name || 'Member'}</h4>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isHead ? 'bg-accent/15 text-accent' :
                        isManager ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-surface-2 text-text-muted'
                      }`}>
                        {isHead ? 'Head' : isManager ? 'Manager' : 'Member'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted truncate">{m.user?.email}</div>
                    {m.user?.job_title && (
                      <div className="text-[10px] text-accent mt-0.5 truncate">{m.user.job_title}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 6: CROSS-DEPARTMENT COLLABORATION ── */}
      {activeTab === 'collaboration' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Cross-Department Collaboration & Approvals</h3>
              <p className="text-xs text-text-muted">Controlled inter-department workflows, task requests, and approval sign-offs.</p>
            </div>
            <button
              onClick={() => setIsCollabModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dispatch Request</span>
            </button>
          </div>

          {collabRequests.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No collaboration requests"
              description="Cross-department approval or task requests will be tracked here without exposing entire workspaces."
              action={{ label: 'Dispatch Request', onClick: () => setIsCollabModalOpen(true) }}
            />
          ) : (
            <div className="space-y-3">
              {collabRequests.map(req => {
                const isInbound = req.target_department_id === deptId;
                const isPending = req.status === 'pending';

                return (
                  <div
                    key={req.id}
                    className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          isInbound ? 'bg-indigo-500/10 text-indigo-400' : 'bg-surface-2 text-text-muted'
                        }`}>
                          {isInbound ? 'Inbound Request' : 'Outbound Request'}
                        </span>
                        <span className="text-xs font-bold text-text-primary">{req.title}</span>
                      </div>
                      <p className="text-xs text-text-muted">{req.description || 'No description provided.'}</p>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted pt-1">
                        <span>From: <strong>{req.requesting_department?.name || 'Department'}</strong></span>
                        <span>➔ To: <strong>{req.target_department?.name || 'Department'}</strong></span>
                        <span>• Requester: {req.requester?.full_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg uppercase tracking-wider ${
                        req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        req.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {req.status}
                      </span>

                      {isInbound && isPending && canAdminWorkspace && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            onClick={() => handleResolveCollab(req.id, 'approved')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleResolveCollab(req.id, 'rejected')}
                            className="px-3 py-1 bg-surface-2 hover:bg-rose-500/10 hover:text-rose-400 text-text-muted text-xs font-semibold rounded-lg border border-border-subtle"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Department Activities Audit Log */}
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-3 mt-8">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Department Activity Log</span>
            </h4>
            {activities.length === 0 ? (
              <p className="text-xs text-text-muted">No activity records recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activities.map(act => (
                  <div key={act.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border-subtle/50 last:border-0">
                    <span className="text-text-primary truncate">{act.title}</span>
                    <span className="text-[10px] text-text-muted ml-2 shrink-0">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 7: ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Department Operational Telemetry</h3>
            <p className="text-xs text-text-muted">Performance KPIs, task velocity, and team distribution.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-2">
              <span className="text-xs text-text-muted uppercase tracking-wider block font-semibold">Task Velocity</span>
              <strong className="text-2xl font-bold text-text-primary">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
              </strong>
              <p className="text-[11px] text-emerald-400">Completion rate of assigned deliverables</p>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-2">
              <span className="text-xs text-text-muted uppercase tracking-wider block font-semibold">Active Projects</span>
              <strong className="text-2xl font-bold text-accent">
                {projects.filter(p => p.status === 'active').length}
              </strong>
              <p className="text-[11px] text-text-muted">Ongoing department initiatives</p>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 shadow-xs space-y-2">
              <span className="text-xs text-text-muted uppercase tracking-wider block font-semibold">Collaboration Velocity</span>
              <strong className="text-2xl font-bold text-indigo-400">
                {collabRequests.filter(r => r.status === 'approved').length}
              </strong>
              <p className="text-[11px] text-text-muted">Approved cross-department workflows</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 8: SETTINGS ── */}
      {activeTab === 'settings' && canAdminWorkspace && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl animate-fade-in">
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-semibold text-text-primary">Workspace Configuration</h3>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Department Name *
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                className="w-full px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {DEPT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        editColor === c ? 'scale-125 ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Parent Department (MNC Hierarchy)
                </label>
                <select
                  value={editParentId}
                  onChange={e => setEditParentId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary"
                >
                  <option value="">None (Top-Level)</option>
                  {allOrgDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Strategic Objectives */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Strategic Objectives
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add target objective..."
                  value={newObjInput}
                  onChange={e => setNewObjInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newObjInput.trim() && !editObjectives.includes(newObjInput.trim())) {
                        setEditObjectives([...editObjectives, newObjInput.trim()]);
                        setNewObjInput('');
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newObjInput.trim() && !editObjectives.includes(newObjInput.trim())) {
                      setEditObjectives([...editObjectives, newObjInput.trim()]);
                      setNewObjInput('');
                    }
                  }}
                  className="px-4 py-2 bg-surface-3 hover:bg-surface-2 border border-border-subtle text-xs font-semibold rounded-xl text-text-primary"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1.5">
                {editObjectives.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-2 px-3 py-1.5 rounded-lg border border-border-subtle text-xs">
                    <span className="text-text-primary truncate">• {obj}</span>
                    <button
                      type="button"
                      onClick={() => setEditObjectives(editObjectives.filter((_, idx) => idx !== i))}
                      className="text-text-muted hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Configuration'}
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsArchiveConfirmOpen(true)}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-xl transition-colors"
                >
                  Archive Workspace
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* ── CREATE TASK MODAL ── */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-1 border border-border-strong rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="text-base font-bold text-text-primary">Create Department Task</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-text-muted hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Task summary..."
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details or deliverables..."
                    value={taskDesc}
                    onChange={e => setTaskDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Assignee
                  </label>
                  <select
                    value={taskAssigneeId}
                    onChange={e => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user?.full_name} ({m.department_role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTask}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-xs"
                  >
                    {savingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DISPATCH COLLABORATION MODAL ── */}
      <AnimatePresence>
        {isCollabModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-1 border border-border-strong rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-accent" />
                  <span>Cross-Department Request</span>
                </h3>
                <button onClick={() => setIsCollabModalOpen(false)} className="text-text-muted hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCollabRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Target Department *
                  </label>
                  <select
                    required
                    value={collabTargetDeptId}
                    onChange={e => setCollabTargetDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                  >
                    <option value="">Select Department...</option>
                    {allOrgDepartments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                      Request Type
                    </label>
                    <select
                      value={collabType}
                      onChange={e => setCollabType(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                    >
                      <option value="task_assignment">Task Assignment</option>
                      <option value="approval_request">Approval Request</option>
                      <option value="resource_allocation">Resource Allocation</option>
                      <option value="document_access">Document Access</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                      Priority
                    </label>
                    <select
                      value={collabPriority}
                      onChange={e => setCollabPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Design review for Q4 landing page"
                    value={collabTitle}
                    onChange={e => setCollabTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details of what is requested from the target department..."
                    value={collabDesc}
                    onChange={e => setCollabDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCollabModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCollab}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-xs"
                  >
                    {savingCollab ? 'Dispatching...' : 'Dispatch Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ASSIGN MEMBER MODAL ── */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-1 border border-border-strong rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="text-base font-bold text-text-primary">Assign Member to Department</h3>
                <button onClick={() => setIsAddMemberOpen(false)} className="text-text-muted hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Select Member *
                  </label>
                  <select
                    required
                    value={selectedAddUserId}
                    onChange={e => setSelectedAddUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                  >
                    <option value="">Select an organization user...</option>
                    {availableOrgMembers
                      .filter(u => !members.some(m => m.user_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Department Role
                  </label>
                  <select
                    value={selectedAddRole}
                    onChange={e => setSelectedAddRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-primary"
                  >
                    <option value="member">Department Member</option>
                    <option value="manager">Department Manager</option>
                    <option value="head">Department Head</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="primary_dept_chk"
                    checked={selectedAddIsPrimary}
                    onChange={e => setSelectedAddIsPrimary(e.target.checked)}
                    className="w-4 h-4 rounded text-accent bg-surface-2 border-border-subtle"
                  />
                  <label htmlFor="primary_dept_chk" className="text-xs text-text-muted">
                    Set as member's primary department (updates user profile)
                  </label>
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-xs"
                  >
                    {addingMember ? 'Assigning...' : 'Assign Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Safe Archiving */}
      <ConfirmModal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={handleArchiveDepartment}
        title="Archive Department Workspace"
        message="Are you sure you want to archive this department? All historical projects, tasks, invoices, and documents will remain fully preserved in your organization records."
        confirmText="Archive Department"
        variant="warning"
      />
    </div>
  );
}
