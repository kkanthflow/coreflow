import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  Award, Shield, Users, Building2, Briefcase, CheckSquare,
  Clock, Plus, Search, Edit2, Trash2, X, RefreshCw,
  Crown, UserCheck, AlertTriangle, ArrowRight, Eye, ShieldAlert,
  ChevronRight, Calendar
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface LeadershipMember {
  id: string;
  org_id: string;
  user_id: string;
  designation: string;
  department_id: string | null;
  reporting_to_user_id: string | null;
  visibility_level: string;
  can_manage_departments: boolean;
  can_manage_leadership: boolean;
  can_manage_announcements: boolean;
  is_active: boolean;
  appointed_by: string | null;
  appointed_at: string;
  notes: string | null;
  user?: { id: string; full_name: string; email: string; avatar_url?: string };
  department?: { id: string; name: string; color: string };
  reporting_to?: { id: string; full_name: string };
}

interface OrgOwner {
  id: string;
  org_id: string;
  user_id: string;
  appointed_by: string | null;
  appointed_at: string;
  status: string;
  notes: string | null;
  user?: { id: string; full_name: string; email: string; avatar_url?: string };
  appointer?: { full_name: string; email: string };
}

interface OrgMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface OrgTelemetry {
  departmentsCount: number;
  employeesCount: number;
  projectsCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  upcomingMeetingsCount: number;
  deptWorkload: { id: string; name: string; membersCount: number; tasksCount: number }[];
}

const COMMON_DESIGNATIONS = [
  'Founder',
  'Co-founder',
  'Chairman',
  'Founder & CEO',
  'Founder & Managing Director',
  'Co-founder & CTO',
  'Co-founder & COO',
  'Chief Executive Officer (CEO)',
  'Managing Director (MD)',
  'Chief Operating Officer (COO)',
  'Chief Technology Officer (CTO)',
  'Chief Financial Officer (CFO)',
  'Department Head',
  'Engineering Director',
  'Product Director',
  'Operations Director',
  'General Manager',
  'Team Lead',
];

export default function LeadershipTeam() {
  const { user } = useAuth();
  const { orgId, isOwner, canManageLeadership } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'directory' | 'ownership'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [leadership, setLeadership] = useState<LeadershipMember[]>([]);
  const [owners, setOwners] = useState<OrgOwner[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [telemetry, setTelemetry] = useState<OrgTelemetry>({
    departmentsCount: 0,
    employeesCount: 0,
    projectsCount: 0,
    pendingTasksCount: 0,
    overdueTasksCount: 0,
    upcomingMeetingsCount: 0,
    deptWorkload: [],
  });

  const [search, setSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');

  // Leadership Modal State
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<LeadershipMember | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [designation, setDesignation] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [reportingToId, setReportingToId] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState('full_organization');
  const [canManageDepts, setCanManageDepts] = useState(false);
  const [canManageLeaders, setCanManageLeaders] = useState(false);
  const [canManageAnnounce, setCanManageAnnounce] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingLeader, setSavingLeader] = useState(false);

  // Owner Appointment Modal State
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerTargetUserId, setOwnerTargetUserId] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');
  const [savingOwner, setSavingOwner] = useState(false);

  // Demote/Remove Owner Modal
  const [demotingOwner, setDemotingOwner] = useState<OrgOwner | null>(null);
  const [newRoleForDemoted, setNewRoleForDemoted] = useState('administrator');
  const [removingOwner, setRemovingOwner] = useState(false);

  // Remove leadership confirmation
  const [deleteLeaderId, setDeleteLeaderId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Fetch Leadership members
      const { data: leadData } = await supabase
        .from('leadership_members')
        .select(`
          *,
          user:user_id(id, full_name, email, avatar_url),
          department:department_id(id, name, color),
          reporting_to:reporting_to_user_id(id, full_name)
        `)
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('appointed_at', { ascending: false });

      setLeadership(leadData || []);

      // 2. Fetch Organization Owners
      const { data: ownerData } = await supabase
        .from('organization_owners')
        .select(`
          *,
          user:user_id(id, full_name, email, avatar_url),
          appointer:appointed_by(full_name, email)
        `)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('appointed_at', { ascending: true });

      setOwners(ownerData || []);

      // 3. Fetch Organization Members
      const { data: uoData } = await supabase
        .from('user_organizations')
        .select('user_id, role, users:user_id(id, full_name, email)')
        .eq('org_id', orgId);

      const memList = (uoData || []).map((uo: any) => ({
        id: uo.user_id,
        full_name: uo.users?.full_name || 'Member',
        email: uo.users?.email || '',
        role: uo.role,
      }));
      setMembers(memList);

      // 4. Fetch Departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name, color')
        .eq('org_id', orgId)
        .eq('is_deleted', false)
        .eq('status', 'active')
        .order('name');

      setDepartments(deptData || []);

      // 5. Fetch telemetry for dashboard
      const [projRes, taskRes, meetRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null),
        supabase.from('tasks').select('id, status, due_date').eq('org_id', orgId),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('workspace_id', orgId).gte('start_time', new Date().toISOString()),
      ]);

      const allTasks = taskRes.data || [];
      const pendingTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'completed').length;
      const todayIso = new Date().toISOString().split('T')[0];
      const overdueTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < todayIso).length;

      // Department workload distribution
      const { data: deptMembers } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('org_id', orgId);

      const deptWorkload = (deptData || []).map(d => {
        const mCount = (deptMembers || []).filter(dm => dm.department_id === d.id).length;
        const tCount = allTasks.filter((t: any) => t.department_id === d.id).length;
        return {
          id: d.id,
          name: d.name,
          membersCount: mCount,
          tasksCount: tCount,
        };
      });

      setTelemetry({
        departmentsCount: (deptData || []).length,
        employeesCount: memList.length,
        projectsCount: projRes.count || 0,
        pendingTasksCount: pendingTasks,
        overdueTasksCount: overdueTasks,
        upcomingMeetingsCount: meetRes.count || 0,
        deptWorkload,
      });

    } catch (e) {
      console.error('Failed to load leadership team data:', e);
      toast.error('Failed to load leadership management data.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered leadership directory
  const filteredLeadership = useMemo(() => {
    return leadership.filter(l => {
      const name = l.user?.full_name?.toLowerCase() || '';
      const email = l.user?.email?.toLowerCase() || '';
      const des = l.designation.toLowerCase();
      const query = search.toLowerCase();
      const matchesSearch = !query || name.includes(query) || email.includes(query) || des.includes(query);

      if (!matchesSearch) return false;

      if (designationFilter === 'FOUNDERS') {
        return des.includes('founder') || des.includes('chairman');
      }
      if (designationFilter === 'EXECUTIVE') {
        return des.includes('chief') || des.includes('ceo') || des.includes('cto') || des.includes('cfo') || des.includes('coo') || des.includes('managing director');
      }
      if (designationFilter === 'HEADS') {
        return des.includes('head') || des.includes('director') || des.includes('manager');
      }
      return true;
    });
  }, [leadership, search, designationFilter]);

  // Open modal for new leadership appointment
  const handleOpenNewLeader = () => {
    setEditingLeader(null);
    setSelectedUserId(members[0]?.id || '');
    setDesignation('Founder & CEO');
    setCustomDesignation('');
    setSelectedDeptId('');
    setReportingToId('');
    setVisibilityLevel('full_organization');
    setCanManageDepts(true);
    setCanManageLeaders(false);
    setCanManageAnnounce(true);
    setNotes('');
    setIsLeaderModalOpen(true);
  };

  // Open modal to edit leadership appointment
  const handleOpenEditLeader = (item: LeadershipMember) => {
    setEditingLeader(item);
    setSelectedUserId(item.user_id);
    if (COMMON_DESIGNATIONS.includes(item.designation)) {
      setDesignation(item.designation);
      setCustomDesignation('');
    } else {
      setDesignation('Custom');
      setCustomDesignation(item.designation);
    }
    setSelectedDeptId(item.department_id || '');
    setReportingToId(item.reporting_to_user_id || '');
    setVisibilityLevel(item.visibility_level || 'department');
    setCanManageDepts(item.can_manage_departments);
    setCanManageLeaders(item.can_manage_leadership);
    setCanManageAnnounce(item.can_manage_announcements);
    setNotes(item.notes || '');
    setIsLeaderModalOpen(true);
  };

  // Save Leadership appointment via backend RPC
  const handleSaveLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedUserId) return;

    const finalDesignation = designation === 'Custom' ? customDesignation.trim() : designation;
    if (!finalDesignation) {
      toast.error('Please enter or select a leadership designation');
      return;
    }

    setSavingLeader(true);
    try {
      const { data, error } = await supabase.rpc('upsert_leadership_member', {
        p_org_id: orgId,
        p_target_user_id: selectedUserId,
        p_designation: finalDesignation,
        p_department_id: selectedDeptId || null,
        p_reporting_to_user_id: reportingToId || null,
        p_visibility_level: visibilityLevel,
        p_can_manage_depts: canManageDepts,
        p_can_manage_leadership: canManageLeaders,
        p_can_manage_announcements: canManageAnnounce,
        p_notes: notes || null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to save leadership member');

      toast.success(data?.message || 'Leadership profile saved successfully');
      setIsLeaderModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update leadership team member');
    } finally {
      setSavingLeader(false);
    }
  };

  // Appoint Co-Owner via atomic backend RPC
  const handleAppointOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !ownerTargetUserId) return;

    setSavingOwner(true);
    try {
      const { data, error } = await supabase.rpc('appoint_organization_owner', {
        p_org_id: orgId,
        p_target_user_id: ownerTargetUserId,
        p_notes: ownerNotes || null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to appoint owner');

      toast.success(data?.message || 'Organization Owner appointed successfully');
      setIsOwnerModalOpen(false);
      setOwnerTargetUserId('');
      setOwnerNotes('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to appoint co-owner');
    } finally {
      setSavingOwner(false);
    }
  };

  // Remove Owner via atomic backend RPC (protected by last-owner check)
  const handleConfirmRemoveOwner = async () => {
    if (!orgId || !demotingOwner) return;

    setRemovingOwner(true);
    try {
      const { data, error } = await supabase.rpc('remove_organization_owner', {
        p_org_id: orgId,
        p_target_user_id: demotingOwner.user_id,
        p_new_role: newRoleForDemoted,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to adjust ownership');

      toast.success(data?.message || 'Ownership status adjusted');
      setDemotingOwner(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to modify ownership status');
    } finally {
      setRemovingOwner(false);
    }
  };

  // Delete leadership assignment
  const handleConfirmDeleteLeader = async () => {
    if (!deleteLeaderId || !orgId) return;
    try {
      const { error } = await supabase
        .from('leadership_members')
        .delete()
        .eq('id', deleteLeaderId);

      if (error) throw error;
      toast.success('Removed from leadership team');
      setDeleteLeaderId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member from leadership');
    }
  };

  // Metric strip cards
  const metricItems: MetricItem[] = [
    { label: 'CO-OWNERS & FOUNDERS', value: owners.length, isOrange: true },
    { label: 'LEADERSHIP EXECUTIVES', value: leadership.length },
    { label: 'ACTIVE DEPARTMENTS', value: telemetry.departmentsCount },
    { label: 'TOTAL EMPLOYEES', value: telemetry.employeesCount },
    { label: 'OPEN INITIATIVES', value: telemetry.projectsCount },
    { label: 'PENDING / OVERDUE', value: `${telemetry.pendingTasksCount} / ${telemetry.overdueTasksCount}` },
  ];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      {/* ── Page Header ── */}
      <PageHeader
        title="Leadership & Ownership Governance"
        description="Multi-Founder architecture, equal-authority Co-Owners, executive designations, and department visibility controls."
        badge={isOwner ? 'ORGANIZATION OWNER' : 'LEADERSHIP SUITE'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-divider hover:border-white/20 hover:text-main text-muted transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {isOwner && (
              <button
                onClick={() => setIsOwnerModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Crown size={13} />
                <span>Appoint Co-Owner</span>
              </button>
            )}

            {(isOwner || canManageLeadership) && (
              <button
                onClick={handleOpenNewLeader}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Appoint Leadership Member</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Continuous Metric Strip ── */}
      <MetricStrip metrics={metricItems} />

      {/* ── Tab Switcher ── */}
      <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-divider gap-1 w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Award size={13} />
          <span>Leadership Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Users size={13} />
          <span>Executive Directory ({leadership.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ownership')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'ownership'
              ? 'bg-surface text-main shadow-xs border border-divider'
              : 'text-muted hover:text-main'
          }`}
        >
          <Crown size={13} className="text-amber-400" />
          <span>Multi-Owner Governance ({owners.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LEADERSHIP DASHBOARD                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Active Founders & Owners Showcase */}
          <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-divider pb-3">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-amber-400" />
                <h2 className="text-sm font-bold text-main">Organization Ownership & Founding Board</h2>
              </div>
              <span className="text-[11px] font-mono text-muted">
                Equal Executive Authority Across All Workspaces
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {owners.map(owner => (
                <div
                  key={owner.id}
                  className="bg-surface-2/60 border border-divider rounded-xl p-3.5 flex items-start gap-3 hover:border-amber-500/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {owner.user?.full_name?.charAt(0).toUpperCase() || 'O'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-main truncate">
                        {owner.user?.full_name || 'Owner'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        OWNER
                      </span>
                    </div>
                    <p className="text-[11px] text-muted font-mono truncate">{owner.user?.email}</p>
                    <p className="text-[10px] text-muted/70 mt-1">
                      Appointed {new Date(owner.appointed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Workload & Performance */}
          <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-divider pb-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-accent" />
                <h2 className="text-sm font-bold text-main">Department Workload & Operational Capacity</h2>
              </div>
              <span className="text-[11px] font-mono text-muted">Real-time cross-department telemetry</span>
            </div>

            {telemetry.deptWorkload.length === 0 ? (
              <p className="text-xs text-muted py-4">No active departments configured yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {telemetry.deptWorkload.map(dw => (
                  <div key={dw.id} className="bg-surface-2/40 border border-divider rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-main truncate">{dw.name}</span>
                      <span className="text-[10px] font-mono text-muted">{dw.membersCount} members</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>Assigned Tasks</span>
                      <span className="font-mono font-bold text-main">{dw.tasksCount}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden border border-divider">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(100, Math.max(10, dw.tasksCount * 12))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: LEADERSHIP DIRECTORY                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Controls: Search & Category filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card-bg border border-divider p-3 rounded-xl">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leaders by name, email, designation..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-2 border border-divider text-xs text-main placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'ALL', label: 'All Ranks' },
                { id: 'FOUNDERS', label: 'Founders & Chair' },
                { id: 'EXECUTIVE', label: 'C-Suite & MD' },
                { id: 'HEADS', label: 'Directors & Heads' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDesignationFilter(f.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    designationFilter === f.id
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-muted hover:text-main hover:bg-surface-2'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leaders Directory Grid */}
          {loading ? (
            <div className="space-y-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : filteredLeadership.length === 0 ? (
            <EmptyState
              icon={<Award size={32} className="text-muted/60" />}
              title="No leadership appointments found"
              description="Appoint organizational leaders, Founders, CEOs, MDs, or Department Heads with designated workspace privileges."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeadership.map(leader => {
                const isAlsoOwner = owners.some(o => o.user_id === leader.user_id);
                return (
                  <div
                    key={leader.id}
                    className="bg-card-bg border border-divider rounded-xl p-4 space-y-3.5 hover:border-white/20 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                          {leader.user?.full_name?.charAt(0).toUpperCase() || 'L'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-main truncate">
                              {leader.user?.full_name || 'Executive'}
                            </span>
                            {isAlsoOwner && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                OWNER
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted font-mono truncate">{leader.user?.email}</p>
                        </div>
                      </div>

                      {(isOwner || canManageLeadership) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditLeader(leader)}
                            className="p-1 rounded text-muted hover:text-main hover:bg-surface-2 transition-colors cursor-pointer"
                            title="Edit Leadership Profile"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteLeaderId(leader.id)}
                            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Remove Leadership Appointment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Designation Badge */}
                    <div className="pt-2 border-t border-divider">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                          Designation
                        </span>
                        <span className="text-xs font-bold text-accent">
                          {leader.designation}
                        </span>
                      </div>

                      {leader.department && (
                        <div className="flex items-center justify-between mt-1.5 text-[11px]">
                          <span className="text-muted">Assigned Department</span>
                          <span className="text-main font-medium">{leader.department.name}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="text-muted">Workspace Visibility</span>
                        <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">
                          {leader.visibility_level.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Capabilities Tags */}
                    <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-divider">
                      {leader.can_manage_departments && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Dept Management
                        </span>
                      )}
                      {leader.can_manage_leadership && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Leadership Admin
                        </span>
                      )}
                      {leader.can_manage_announcements && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-surface-2 text-muted border border-divider">
                          Announcements
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: MULTI-OWNER GOVERNANCE                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ownership' && (
        <div className="space-y-6">
          <div className="bg-card-bg border border-divider rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-divider pb-4">
              <div>
                <h2 className="text-sm font-bold text-main flex items-center gap-2">
                  <Crown size={16} className="text-amber-400" />
                  <span>Equal-Authority Organization Owners</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Every active owner holds full organizational authority, organization-wide workspace visibility, and department oversight.
                </p>
              </div>

              {isOwner && (
                <button
                  onClick={() => setIsOwnerModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
                >
                  <Plus size={13} />
                  <span>Appoint Co-Owner</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-divider">
              {owners.map(owner => {
                const isSelf = owner.user_id === user?.id;
                const canRemove = isOwner && owners.length > 1;

                return (
                  <div key={owner.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {owner.user?.full_name?.charAt(0).toUpperCase() || 'O'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-main">{owner.user?.full_name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                              YOU
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE OWNER
                          </span>
                        </div>
                        <div className="text-[11px] text-muted font-mono mt-0.5">
                          {owner.user?.email} · Appointed {new Date(owner.appointed_at).toLocaleDateString()}
                          {owner.appointer && ` by ${owner.appointer.full_name}`}
                        </div>
                        {owner.notes && (
                          <p className="text-[11px] text-muted/70 mt-1 italic">"{owner.notes}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {canRemove && !isSelf && (
                        <button
                          onClick={() => setDemotingOwner(owner)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-md transition-colors cursor-pointer"
                        >
                          <ShieldAlert size={12} />
                          <span>Demote Owner</span>
                        </button>
                      )}
                      {owners.length <= 1 && (
                        <span className="text-[10px] font-mono text-muted/60 bg-surface-2 px-2 py-0.5 rounded border border-divider">
                          SOLE OWNER (PROTECTED)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: APPOINT / EDIT LEADERSHIP MEMBER                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isLeaderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-divider rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
                <h3 className="text-sm font-bold text-main flex items-center gap-2">
                  <Award size={16} className="text-accent" />
                  <span>{editingLeader ? 'Edit Leadership Appointment' : 'Appoint Leadership Member'}</span>
                </h3>
                <button
                  onClick={() => setIsLeaderModalOpen(false)}
                  className="text-muted hover:text-main p-1 rounded-md"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveLeader} className="p-5 space-y-4">
                {/* Member selection */}
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Select Organization Member
                  </label>
                  <select
                    disabled={!!editingLeader}
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent disabled:opacity-60"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designation selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Designation
                    </label>
                    <select
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                    >
                      {COMMON_DESIGNATIONS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value="Custom">Custom Designation...</option>
                    </select>
                  </div>

                  {designation === 'Custom' && (
                    <div>
                      <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                        Custom Title
                      </label>
                      <input
                        type="text"
                        value={customDesignation}
                        onChange={e => setCustomDesignation(e.target.value)}
                        placeholder="e.g. Founder & Chief Architect"
                        className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Department (Optional)
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={e => setSelectedDeptId(e.target.value)}
                      className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                    >
                      <option value="">None (Organization-wide)</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Visibility level */}
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Workspace Visibility Level
                  </label>
                  <select
                    value={visibilityLevel}
                    onChange={e => setVisibilityLevel(e.target.value)}
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  >
                    <option value="full_organization">Complete Organization Oversight</option>
                    <option value="all_departments">All Department Workspaces</option>
                    <option value="selected_departments">Selected Department Workspace Only</option>
                    <option value="department">Assigned Department Only</option>
                    <option value="project_specific">Project-Specific Only</option>
                    <option value="read_only">Read-Only Oversight</option>
                  </select>
                </div>

                {/* Privileges */}
                <div className="space-y-2 pt-2 border-t border-divider">
                  <span className="block text-[11px] font-mono text-muted uppercase tracking-wider">
                    Executive Privileges
                  </span>
                  <label className="flex items-center gap-2 text-xs text-main cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canManageDepts}
                      onChange={e => setCanManageDepts(e.target.checked)}
                      className="rounded border-divider text-accent focus:ring-0"
                    />
                    <span>Can create and manage departments & transfers</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-main cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canManageLeaders}
                      onChange={e => setCanManageLeaders(e.target.checked)}
                      className="rounded border-divider text-accent focus:ring-0"
                    />
                    <span>Can manage leadership appointments (Leadership Admin)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-main cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canManageAnnounce}
                      onChange={e => setCanManageAnnounce(e.target.checked)}
                      className="rounded border-divider text-accent focus:ring-0"
                    />
                    <span>Can publish department-wide and org announcements</span>
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Appointment Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Appointed as executive director"
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsLeaderModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingLeader}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {savingLeader ? 'Saving...' : 'Save Appointment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: APPOINT CO-OWNER                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isOwnerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-amber-500/5">
                <h3 className="text-sm font-bold text-main flex items-center gap-2">
                  <Crown size={16} className="text-amber-400" />
                  <span>Appoint Organization Co-Owner</span>
                </h3>
                <button
                  onClick={() => setIsOwnerModalOpen(false)}
                  className="text-muted hover:text-main p-1 rounded-md"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAppointOwner} className="p-5 space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    <span>Equal Organizational Authority</span>
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    All Owners possess identical root management permissions: full department workspace access, employee governance, billing authority, and leadership appointment rights.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Select Member to Appoint as Owner
                  </label>
                  <select
                    value={ownerTargetUserId}
                    onChange={e => setOwnerTargetUserId(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  >
                    <option value="">Choose an existing member...</option>
                    {members
                      .filter(m => !owners.some(o => o.user_id === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Appointment Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={ownerNotes}
                    onChange={e => setOwnerNotes(e.target.value)}
                    placeholder="e.g. Co-founder appointment"
                    className="w-full bg-surface-2 border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsOwnerModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOwner || !ownerTargetUserId}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold cursor-pointer shadow-xs"
                  >
                    {savingOwner ? 'Appointing...' : 'Confirm Co-Owner Appointment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: DEMOTE / ADJUST OWNER                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {demotingOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-red-500/5">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                  <ShieldAlert size={16} />
                  <span>Demote Organization Owner</span>
                </h3>
                <button
                  onClick={() => setDemotingOwner(null)}
                  className="text-muted hover:text-main p-1 rounded-md"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-main">
                  Are you sure you want to remove <strong>{demotingOwner.user?.full_name}</strong> from active Organization Owner status?
                </p>

                <div className="bg-surface-2 p-3 rounded-lg border border-divider">
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Assign Replacement RBAC Role
                  </label>
                  <select
                    value={newRoleForDemoted}
                    onChange={e => setNewRoleForDemoted(e.target.value)}
                    className="w-full bg-surface border border-divider rounded px-2.5 py-1.5 text-xs text-main"
                  >
                    <option value="administrator">Administrator</option>
                    <option value="manager">Manager</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="team_member">Team Member</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-divider">
                  <button
                    onClick={() => setDemotingOwner(null)}
                    className="px-3 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRemoveOwner}
                    disabled={removingOwner}
                    className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {removingOwner ? 'Demoting...' : 'Confirm Demotion'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Confirm Delete Leadership Member ── */}
      <ConfirmModal
        isOpen={!!deleteLeaderId}
        onClose={() => setDeleteLeaderId(null)}
        onConfirm={handleConfirmDeleteLeader}
        title="Remove Leadership Appointment"
        message="Are you sure you want to remove this member from the leadership team? Their general employee account and RBAC role will remain intact."
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
}

