import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  Users,
  Search,
  Lock,
  Check,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { toast } from '../components/ui/Toast';
import {
  ACCESS_ROLES,
  ASSIGNABLE_ACCESS_ROLES,
  formatAccessRole,
  type AccessRoleOption
} from '../lib/jobTitles';
import { JobTitleSelect } from '../components/ui/JobTitleSelect';
import { hasPermission, type AppPermission } from '../lib/permissions';

interface MemberRecord {
  id: string;
  userId: string;
  role: string;
  jobTitle?: string;
  careerLevel?: string;
  createdAt: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

// Role Authority Levels & Metadata
const ROLE_METADATA: Record<string, { level: number; color: string; badgeBg: string; border: string; desc: string }> = {
  owner: {
    level: 10,
    color: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    desc: 'Full system sovereignty, billing governance, and root organization ownership.',
  },
  administrator: {
    level: 9,
    color: '#8B5CF6',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.3)',
    desc: 'Comprehensive workforce management, workspace administration, and security oversight.',
  },
  manager: {
    level: 7,
    color: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    desc: 'Operational delivery, client management, workflow execution, and invoice settlement verification.',
  },
  team_lead: {
    level: 6,
    color: '#3B82F6',
    badgeBg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    desc: 'Technical leadership, deliverable coordination, and team task assignment.',
  },
  team_member: {
    level: 5,
    color: '#06B6D4',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.3)',
    desc: 'Hands-on project execution, deliverables, shared files, chat channels, and meetings.',
  },
  guest: {
    level: 2,
    color: '#64748B',
    badgeBg: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.3)',
    desc: 'Restricted external collaborator access limited strictly to assigned tasks and discussions.',
  },
  client: {
    level: 1,
    color: '#EC4899',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)',
    desc: 'Client portal guest to inspect project progress, approve deliverables, and settle invoices.',
  },
};

// Key Permissions Matrix Categories
const MATRIX_GROUPS = [
  {
    group: 'Organization & Workforce',
    permissions: [
      { key: 'organization.view', label: 'View Workspace Overview' },
      { key: 'organization.update', label: 'Edit Organization Profile & Settings' },
      { key: 'members.invite', label: 'Invite & Onboard Team Members' },
      { key: 'members.assign_roles', label: 'Assign & Manage RBAC Roles' },
      { key: 'audit_logs.view', label: 'Inspect Governance Audit Logs' },
    ],
  },
  {
    group: 'Projects & Deliverables',
    permissions: [
      { key: 'projects.view', label: 'View Accessible Projects' },
      { key: 'projects.create', label: 'Create New Projects' },
      { key: 'projects.update', label: 'Manage & Configure Projects' },
      { key: 'tasks.create', label: 'Create & Assign Deliverables' },
      { key: 'tasks.delete', label: 'Delete Deliverable Tasks' },
    ],
  },
  {
    group: 'Finance, Invoicing & Settlements',
    permissions: [
      { key: 'invoices.view', label: 'View Workspace Invoices' },
      { key: 'invoices.create', label: 'Generate Client Invoices' },
      { key: 'invoices.update', label: 'Edit Draft & Sent Invoices' },
      { key: 'record_payments', label: 'Record & Settle Client Payments' },
      { key: 'invoices.approve', label: 'Approve Invoices for Dispatch' },
      { key: 'billing.manage', label: 'Manage Organization Subscription & Plans' },
    ],
  },
  {
    group: 'Automations & Communication',
    permissions: [
      { key: 'workflows.view', label: 'View Causality Workflows' },
      { key: 'workflows.create', label: 'Build & Edit Automated Workflows' },
      { key: 'workflows.execute', label: 'Trigger Workflow Executions' },
      { key: 'chat.send', label: 'Team & Client Direct Messaging' },
      { key: 'meetings.create', label: 'Schedule & Host Video Meetings' },
    ],
  },
];

export default function RolesPermissions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role: currentAuthRole } = useAuth();
  const { orgId } = useWorkspace();

  const activeTab = searchParams.get('tab') || 'assignments';
  const preselectedMemberId = searchParams.get('member') || null;

  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [editingJobTitle, setEditingJobTitle] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Authority check: can current user manage roles?
  const canManageRoles = useMemo(() => {
    if (!currentAuthRole) return false;
    const norm = currentAuthRole.toLowerCase();
    return norm === 'owner' || norm === 'administrator' || hasPermission(norm, 'manage_roles') || hasPermission(norm, 'members.assign_roles');
  }, [currentAuthRole]);

  // Fetch organization members
  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          id,
          user_id,
          role,
          job_title,
          career_level,
          created_at,
          users:user_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('org_id', orgId);

      if (error) throw error;

      const formatted: MemberRecord[] = (data || []).map((row: any) => {
        const u = Array.isArray(row.users) ? row.users[0] : row.users;
        return {
          id: row.id,
          userId: row.user_id,
          role: row.role || 'team_member',
          jobTitle: row.job_title || 'Team Member',
          careerLevel: row.career_level || 'L3',
          createdAt: row.created_at || new Date().toISOString(),
          fullName: u?.full_name || 'Team Member',
          email: u?.email || 'member@workspace.com',
          avatarUrl: u?.avatar_url || '',
        };
      });

      // Sort by authority level descending, then name
      formatted.sort((a, b) => {
        const lvlA = ROLE_METADATA[a.role]?.level || 0;
        const lvlB = ROLE_METADATA[b.role]?.level || 0;
        if (lvlB !== lvlA) return lvlB - lvlA;
        return a.fullName.localeCompare(b.fullName);
      });

      setMembers(formatted);

      // Select target member if specified in URL or default to first
      setSelectedMember(prev => {
        if (preselectedMemberId) {
          const found = formatted.find(m => m.userId === preselectedMemberId);
          if (found) {
            setEditingRole(found.role);
            setEditingJobTitle(found.jobTitle || '');
            return found;
          }
        }
        if (formatted.length > 0 && !prev) {
          setEditingRole(formatted[0].role);
          setEditingJobTitle(formatted[0].jobTitle || '');
          return formatted[0];
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Error fetching organization members for RBAC:', err);
      toast.error('Failed to load organization members');
    } finally {
      setLoading(false);
    }
  }, [orgId, preselectedMemberId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // When selectedMember changes, synchronize local edit states
  const handleSelectMember = (member: MemberRecord) => {
    setSelectedMember(member);
    setEditingRole(member.role);
    setEditingJobTitle(member.jobTitle || '');
    setSavedSuccess(false);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'assignments');
      next.set('member', member.userId);
      return next;
    });
  };

  const handleTabChange = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // Save Role and Job Title changes
  const handleSaveMemberAccess = async () => {
    if (!selectedMember || !orgId) return;

    if (!canManageRoles) {
      toast.error('You do not have permission to modify access roles in this workspace.');
      return;
    }

    if (selectedMember.role === 'owner' && editingRole !== 'owner') {
      toast.error('The Primary Workspace Owner role is protected and cannot be changed here.');
      return;
    }

    if (selectedMember.userId === user?.id && editingRole !== selectedMember.role) {
      toast.error('For security reasons, you cannot change your own access role.');
      return;
    }

    setSaving(true);
    try {
      // 1. Update RBAC Role if changed
      if (editingRole !== selectedMember.role) {
        const { data, error } = await supabase.rpc('update_organization_member_role', {
          p_org_id: orgId,
          p_target_user_id: selectedMember.userId,
          p_new_role: editingRole,
        });

        if (error) throw error;
        if (data && data.success === false) throw new Error(data.message || 'Failed to update access role');
      }

      // 2. Update Job Title if changed
      if (editingJobTitle !== (selectedMember.jobTitle || '')) {
        const { data, error } = await supabase.rpc('update_organization_member_job_title', {
          p_org_id: orgId,
          p_target_user_id: selectedMember.userId,
          p_job_title: editingJobTitle,
        });

        if (error) throw error;
        if (data && data.success === false) throw new Error(data.message || 'Failed to update job title');
      }

      // Update local state
      setMembers(prev =>
        prev.map(m =>
          m.userId === selectedMember.userId
            ? { ...m, role: editingRole, jobTitle: editingJobTitle }
            : m
        )
      );

      setSelectedMember(prev => prev ? { ...prev, role: editingRole, jobTitle: editingJobTitle } : null);
      setSavedSuccess(true);
      toast.success(`Access role & profile updated for ${selectedMember.fullName}`);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving member access role:', err);
      toast.error(err.message || 'Failed to update member access role');
    } finally {
      setSaving(false);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      m =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.jobTitle && m.jobTitle.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  // Counts by role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      counts[m.role] = (counts[m.role] || 0) + 1;
    }
    return counts;
  }, [members]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 font-sans">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent shadow-xs">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight flex items-center gap-2">
                Roles & RBAC Governance
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Workspace access roles, authority levels, and fine-grained system permission policies.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-line gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('assignments')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'assignments'
                ? 'bg-surface text-text shadow-xs border border-line'
                : 'text-muted hover:text-text'
            }`}
          >
            <Users size={14} />
            <span>Member Assignments</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('matrix')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'matrix'
                ? 'bg-surface text-text shadow-xs border border-line'
                : 'text-muted hover:text-text'
            }`}
          >
            <Layers size={14} />
            <span>Permissions Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('roles')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'roles'
                ? 'bg-surface text-text shadow-xs border border-line'
                : 'text-muted hover:text-text'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Role Directory</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: Member Assignments ── */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Member Directory List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search member by name, email, or role..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-2 border border-line text-text placeholder:text-muted/60 focus:outline-none focus:border-accent"
              />
            </div>

            <div className="bg-surface border border-line rounded-2xl overflow-hidden divide-y divide-line/70">
              <div className="p-3 bg-surface-2/40 flex items-center justify-between text-[11px] font-mono text-muted uppercase tracking-wider">
                <span>Team Members ({filteredMembers.length})</span>
                <span>Active Role</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-muted flex flex-col items-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-accent" />
                  <span>Loading workspace members...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No members match your search criteria.
                </div>
              ) : (
                <div className="max-h-[580px] overflow-y-auto divide-y divide-line/50">
                  {filteredMembers.map(m => {
                    const isSelected = selectedMember?.userId === m.userId;
                    const meta = ROLE_METADATA[m.role] || ROLE_METADATA.team_member;
                    const isSelf = m.userId === user?.id;

                    return (
                      <div
                        key={m.userId}
                        onClick={() => handleSelectMember(m)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-accent/10 border-l-4 border-l-accent'
                            : 'hover:bg-surface-2/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.fullName}
                              className="w-9 h-9 rounded-xl object-cover shrink-0 border border-line"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-surface-2 border border-line flex items-center justify-center font-bold text-xs text-text shrink-0">
                              {m.fullName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-text truncate">
                                {m.fullName}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-accent/20 text-accent uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted truncate">
                              {m.jobTitle || 'Team Member'}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                            style={{
                              backgroundColor: meta.badgeBg,
                              color: meta.color,
                              borderColor: meta.border,
                            }}
                          >
                            {formatAccessRole(m.role)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Member Access Role Inspector & Editor */}
          <div className="lg:col-span-7">
            {selectedMember ? (
              <div className="bg-surface border border-line rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                {/* Header card for the user */}
                <div className="flex items-start justify-between pb-5 border-b border-line gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {selectedMember.avatarUrl ? (
                      <img
                        src={selectedMember.avatarUrl}
                        alt={selectedMember.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border border-line shadow-xs"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-xl font-bold text-text shadow-xs">
                        {selectedMember.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-text truncate">
                          {selectedMember.fullName}
                        </h2>
                        {selectedMember.userId === user?.id && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-accent/20 text-accent uppercase">
                            Your Profile
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{selectedMember.email}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 border border-line text-muted">
                          Seniority: {selectedMember.careerLevel || 'L3'}
                        </span>
                        <span className="text-[11px] text-muted">
                          Joined {new Date(selectedMember.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/employees/${selectedMember.userId}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-line text-xs font-medium text-text transition-all shrink-0 cursor-pointer"
                  >
                    <span>Full Profile</span>
                    <ExternalLink size={12} className="text-muted" />
                  </button>
                </div>

                {/* Self-modification security notice */}
                {selectedMember.userId === user?.id && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300">Self-Protection Safeguard: </span>
                      You cannot alter your own workspace access role to prevent accidental lockout from administrative capabilities.
                    </div>
                  </div>
                )}

                {/* Owner protection notice */}
                {selectedMember.role === 'owner' && (
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5 text-xs text-blue-200">
                    <Lock size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-blue-300">Primary Organization Owner: </span>
                      Root workspace sovereignty resides with the organization creator and cannot be downgraded here.
                    </div>
                  </div>
                )}

                {/* Role Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-muted font-bold block mb-1.5">
                      Assign Application Access Role (RBAC)
                    </label>
                    <p className="text-xs text-muted mb-3">
                      Determines system execution powers, financial actions, team visibility, and security boundaries.
                    </p>

                    <div className="grid grid-cols-1 gap-2.5">
                      {ASSIGNABLE_ACCESS_ROLES.map((r: AccessRoleOption) => {
                        const isCurrent = editingRole === r.value;
                        const meta = ROLE_METADATA[r.value] || ROLE_METADATA.team_member;
                        const isOwner = selectedMember.role === 'owner';
                        const isSelf = selectedMember.userId === user?.id;
                        const disabled = !canManageRoles || isOwner || isSelf;

                        return (
                          <div
                            key={r.value}
                            onClick={() => {
                              if (!disabled) setEditingRole(r.value);
                            }}
                            className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              disabled
                                ? 'opacity-60 cursor-not-allowed bg-surface-2/20 border-line'
                                : isCurrent
                                ? 'bg-surface-2 border-accent shadow-xs cursor-pointer'
                                : 'bg-surface hover:bg-surface-2/50 border-line cursor-pointer'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-text">{r.label}</span>
                                <span
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold"
                                  style={{
                                    backgroundColor: meta.badgeBg,
                                    color: meta.color,
                                  }}
                                >
                                  Level {meta.level}
                                </span>
                              </div>
                              <p className="text-xs text-muted leading-relaxed">{r.description}</p>
                            </div>

                            <div className="shrink-0 pt-0.5">
                              {isCurrent ? (
                                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white shadow-xs">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-line bg-surface-2" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Professional Job Title Assignment */}
                  <div className="pt-4 border-t border-line space-y-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-muted font-bold block">
                      Professional Job Title (Catalogue)
                    </label>
                    <p className="text-xs text-muted mb-2">
                      Reflects occupational role and seniority across teams without restricting system capabilities.
                    </p>
                    <JobTitleSelect
                      value={editingJobTitle}
                      onChange={setEditingJobTitle}
                      disabled={!canManageRoles || selectedMember.userId === user?.id}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-line flex items-center justify-between">
                  <div className="text-xs text-muted">
                    {savedSuccess ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Changes saved successfully!
                      </span>
                    ) : (
                      <span>Review role modifications before confirming.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveMemberAccess}
                    disabled={
                      saving ||
                      !canManageRoles ||
                      selectedMember.role === 'owner' ||
                      selectedMember.userId === user?.id ||
                      (editingRole === selectedMember.role && editingJobTitle === (selectedMember.jobTitle || ''))
                    }
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Save size={14} />
                    <span>{saving ? 'Updating Member Access...' : 'Save Member Access'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-line rounded-2xl p-12 text-center text-muted text-xs">
                Select a team member from the directory to review their permissions and assign access roles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Permissions Matrix ── */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface border border-line rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-text">Enterprise Policy-Based Access Control (PBAC)</h3>
              <p className="text-xs text-muted mt-0.5">
                Comprehensive matrix comparing operational permissions across built-in workspace roles.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">✓</span>
                Permitted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-surface-2 text-muted/60 flex items-center justify-center font-bold text-[10px]">—</span>
                Denied
              </span>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-2/80 border-b border-line">
                    <th className="py-3 px-4 font-mono font-bold text-muted uppercase tracking-wider text-[11px] w-[300px]">
                      Operational Capability
                    </th>
                    <th className="py-3 px-3 font-bold text-amber-400 text-center">Owner (L10)</th>
                    <th className="py-3 px-3 font-bold text-purple-400 text-center">Admin (L9)</th>
                    <th className="py-3 px-3 font-bold text-emerald-400 text-center">Manager (L7)</th>
                    <th className="py-3 px-3 font-bold text-blue-400 text-center">Team Lead (L6)</th>
                    <th className="py-3 px-3 font-bold text-cyan-400 text-center">Member (L5)</th>
                    <th className="py-3 px-3 font-bold text-slate-400 text-center">Guest (L2)</th>
                    <th className="py-3 px-3 font-bold text-pink-400 text-center">Client (L1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {MATRIX_GROUPS.map(cat => (
                    <tr key={cat.group} className="contents">
                      <tr className="bg-surface-2/30">
                        <td colSpan={8} className="py-2.5 px-4 font-mono font-bold text-[11px] text-accent uppercase tracking-wider">
                          {cat.group}
                        </td>
                      </tr>
                      {cat.permissions.map(perm => (
                        <tr key={perm.key} className="hover:bg-surface-2/40 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-text flex items-center gap-2">
                            <span>{perm.label}</span>
                          </td>
                          {['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client'].map(rKey => {
                            const allowed = hasPermission(rKey, perm.key as AppPermission);
                            return (
                              <td key={rKey} className="py-2.5 px-3 text-center">
                                {allowed ? (
                                  <span className="inline-flex w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-400 items-center justify-center font-bold text-xs">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="inline-flex w-5 h-5 rounded-md text-muted/30 items-center justify-center font-bold text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Role Directory ── */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ACCESS_ROLES.map(r => {
              const meta = ROLE_METADATA[r.value] || ROLE_METADATA.team_member;
              const count = roleCounts[r.value] || 0;

              return (
                <div
                  key={r.value}
                  className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                        style={{
                          backgroundColor: meta.badgeBg,
                          color: meta.color,
                          borderColor: meta.border,
                        }}
                      >
                        {r.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-md border border-line">
                        Level {meta.level}
                      </span>
                    </div>

                    <p className="text-xs text-muted leading-relaxed min-h-[44px]">
                      {meta.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                    <span className="text-muted">Active in Workspace:</span>
                    <span className="font-bold text-text bg-surface-2 px-2 py-0.5 rounded-md border border-line">
                      {count} {count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Architecture Explanation Card */}
          <div className="bg-surface border border-line rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles size={16} />
              <h3 className="text-sm font-bold text-text">Decoupled Architecture: Job Titles vs RBAC Roles</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Auvryn adheres to enterprise security standards by completely separating <strong>Professional Job Titles</strong> (Founder, CEO, CTO, Software Engineer) from <strong>Application Access Roles</strong> (Owner, Administrator, Manager, Team Member). Job titles describe occupational standing across organization directories and client invoices, while RBAC roles enforce cryptographically secure Row-Level Security policies in PostgreSQL.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
