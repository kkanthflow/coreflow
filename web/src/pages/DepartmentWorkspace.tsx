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
  FinanceWorkspace,
  EngineeringWorkspace,
  SalesWorkspace,
  HRWorkspace,
  OperationsWorkspace,
  CustomWorkspace,
} from '../components/departments/workspaces';
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

  // Determine Primary Department Operational Domain
  const departmentDomain = useMemo(() => {
    const nameLower = (department?.name || '').toLowerCase();
    const activeCapsList = activeCapabilities || [];

    // 1. Finance & Accounting
    const isFinanceCaps = activeCapsList.some((c: string) => 
      c.includes('budget') || c.includes('expense') || c.includes('invoice') || c.includes('payroll') || c.includes('financial') || c.includes('tax')
    );
    if (
      isFinanceCaps ||
      nameLower.includes('finance') ||
      nameLower.includes('accounting') ||
      nameLower.includes('treasury') ||
      nameLower.includes('fiscal') ||
      nameLower.includes('billing')
    ) {
      return 'finance';
    }

    // 2. Engineering & Software Development
    const isEngCaps = activeCapsList.some((c: string) => 
      c.includes('sprint') || c.includes('defect') || c.includes('bug') || c.includes('git') || c.includes('code') || c.includes('release') || c.includes('qa')
    );
    if (
      isEngCaps ||
      nameLower.includes('software') ||
      nameLower.includes('engineering') ||
      nameLower.includes('development') ||
      nameLower.includes('tech') ||
      nameLower.includes('dev') ||
      nameLower.includes('qa') ||
      nameLower.includes('testing')
    ) {
      return 'engineering';
    }

    // 3. Sales & Marketing
    const isSalesCaps = activeCapsList.some((c: string) => 
      c.includes('lead') || c.includes('deal') || c.includes('campaign') || c.includes('pipeline') || c.includes('crm')
    );
    if (
      isSalesCaps ||
      nameLower.includes('sales') ||
      nameLower.includes('marketing') ||
      nameLower.includes('growth') ||
      nameLower.includes('acquisition') ||
      nameLower.includes('commercial')
    ) {
      return 'sales';
    }

    // 4. Human Resources & People
    const isHRCaps = activeCapsList.some((c: string) => 
      c.includes('recruitment') || c.includes('ats') || c.includes('leave') || c.includes('attendance') || c.includes('people') || c.includes('talent')
    );
    if (
      isHRCaps ||
      nameLower.includes('hr') ||
      nameLower.includes('human resource') ||
      nameLower.includes('people') ||
      nameLower.includes('talent') ||
      nameLower.includes('recruiting') ||
      nameLower.includes('personnel')
    ) {
      return 'hr';
    }

    // 5. Operations & Logistics
    const isOpsCaps = activeCapsList.some((c: string) => 
      c.includes('sop') || c.includes('procurement') || c.includes('vendor') || c.includes('asset') || c.includes('logistics') || c.includes('facility')
    );
    if (
      isOpsCaps ||
      nameLower.includes('operation') ||
      nameLower.includes('logistics') ||
      nameLower.includes('facility') ||
      nameLower.includes('supply') ||
      nameLower.includes('procurement')
    ) {
      return 'operations';
    }

    // 6. Custom / Hybrid Domain
    return 'custom';
  }, [department, activeCapabilities]);

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
      {/* Department-Specific Dynamic Operational Workspaces */}
      {activeTab !== 'settings' && (
        <>
          {departmentDomain === 'finance' && (
            <FinanceWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              onRefresh={fetchWorkspaceData}
            />
          )}

          {departmentDomain === 'engineering' && (
            <EngineeringWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              onRefresh={fetchWorkspaceData}
            />
          )}

          {departmentDomain === 'sales' && (
            <SalesWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              onRefresh={fetchWorkspaceData}
            />
          )}

          {departmentDomain === 'hr' && (
            <HRWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              onRefresh={fetchWorkspaceData}
            />
          )}

          {departmentDomain === 'operations' && (
            <OperationsWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              onRefresh={fetchWorkspaceData}
            />
          )}

          {departmentDomain === 'custom' && (
            <CustomWorkspace
              department={department}
              deptId={deptId!}
              orgId={orgId!}
              members={members}
              canAdminWorkspace={canAdminWorkspace}
              isOwner={isOwner}
              hasOrgOversight={hasOrgOversight}
              activeCapabilities={activeCapabilities.map((k: string) => ({ key: k, name: k }))}
              onRefresh={fetchWorkspaceData}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}
        </>
      )}

      {/* ── SETTINGS VIEW ── */}
      {activeTab === 'settings' && canAdminWorkspace && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Department Settings & Capabilities</h2>
              <p className="text-xs text-text-muted">Configure identity, objectives, and capability engine</p>
            </div>
            <button
              onClick={() => setActiveTab('overview')}
              className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 text-text-primary rounded-lg border border-border-subtle cursor-pointer"
            >
              Back to Workspace
            </button>
          </div>

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
        </div>
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
