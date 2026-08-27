import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Users,
  Search,
  X,
  Plus,
  Shield,
  Briefcase,
  Video,
  MessageSquare,
  ExternalLink
} from 'lucide-react';

const ROLE_RANK: Record<string, number> = {
  owner: 1,
  ceo: 2,
  managing_director: 3,
  administrator: 4,
  director: 5,
  senior_manager: 6,
  manager: 7,
  team_lead: 8,
  senior_employee: 9,
  employee: 10,
  intern: 11,
  freelancer: 12
};

const LEADERSHIP_ROLES = ['owner', 'ceo', 'managing_director', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead'];

export default function Employees() {
  `  `
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { orgId, orgName } = useWorkspace();
  const canView = hasPermission(role, 'view_team_directory');
  const canInvite = hasPermission(role, 'invite_users') || ['owner', 'administrator', 'ceo'].includes(role || '');

  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberWorkContext, setMemberWorkContext] = useState<{ tasks: any[]; projects: any[] }>({ tasks: [], projects: [] });

  const fetchMembers = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // 1. Get current user's org IDs
      const { data: myOrgs, error: orgsErr } = await supabase
        .from('user_organizations').select('org_id, role').eq('user_id', user.id);
      if (orgsErr) throw orgsErr;

      const currentOrgId = orgId || myOrgs?.[0]?.org_id;

      let profiles: any[] = [];
      if (!currentOrgId) {
        const { data } = await supabase.from('users')
          .select('id, full_name, email, role, avatar_url, department, is_online, last_seen_at');
        profiles = data || [];
      } else {
        const { data: orgUsers } = await supabase.from('user_organizations')
          .select('user_id, role, users:user_id(id, full_name, email, avatar_url, department, is_online, last_seen_at)')
          .eq('org_id', currentOrgId);

        profiles = (orgUsers || []).map((ou: any) => ({
          ...ou.users,
          role: ou.role || ou.users?.role || 'employee',
        })).filter(Boolean);
      }

      // Enhance with operational task and project counts
      const enriched = await Promise.all(
        profiles.map(async (p: any) => {
          const { count: taskCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assignee_id', p.id)
            .neq('status', 'done');

          return {
            ...p,
            activeTasksCount: taskCount || 0,
            isLeadership: LEADERSHIP_ROLES.includes(p.role?.toLowerCase()),
          };
        })
      );

      // Fetch org departments
      if (currentOrgId) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('id, name')
          .eq('org_id', currentOrgId);
        setDepartments(deptData || []);
      }

      setMembers([...enriched].sort((a, b) => (ROLE_RANK[a.role] || 99) - (ROLE_RANK[b.role] || 99)));
    } catch (e: any) {
      setError(e.message || 'Failed to load organizational directory');
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Fetch contextual deliverables when an employee is selected in the inspector
  const handleSelectMember = async (m: any) => {
    setSelectedMember(m);
    try {
      const [tasksRes, projsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, projects(title)')
          .eq('assignee_id', m.id)
          .neq('status', 'done')
          .limit(4),
        supabase
          .from('projects')
          .select('id, title, status, cover_color')
          .limit(2)
      ]);
      setMemberWorkContext({
        tasks: tasksRes.data || [],
        projects: projsRes.data || []
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Telemetry Metrics
  const telemetry = useMemo(() => {
    const total = members.length;
    const leadership = members.filter(m => m.isLeadership).length;
    const freelancers = members.filter(m => m.role === 'freelancer').length;
    const active = members.filter(m => m.is_online).length || total;
    const depts = new Set(members.map(m => m.department).filter(Boolean)).size || (departments.length || 1);

    return [
      { label: 'TOTAL MEMBERS', value: total < 10 ? `0${total}` : total },
      { label: 'DEPARTMENTS', value: depts < 10 ? `0${depts}` : depts },
      { label: 'LEADERSHIP', value: leadership < 10 ? `0${leadership}` : leadership },
      { label: 'FREELANCERS', value: freelancers < 10 ? `0${freelancers}` : freelancers },
      { label: 'ACTIVE TODAY', value: active < 10 ? `0${active}` : active, isOrange: true },
    ];
  }, [members, departments]);

  // Roles available in the current organization
  const availableRoles = useMemo(() => {
    return Array.from(new Set(members.map(m => m.role))).filter(Boolean);
  }, [members]);

  // Filtered members list
  const filtered = useMemo(() => {
    return members.filter(m => {
      const q = search.toLowerCase();
      const matchQuery = !search ||
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q);

      const matchRole = roleFilter === 'ALL' || m.role === roleFilter;
      const matchDept = deptFilter === 'ALL' || (m.department || 'Unassigned') === deptFilter;

      return matchQuery && matchRole && matchDept;
    });
  }, [members, search, roleFilter, deptFilter]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20 bg-[#08090C] text-zinc-300">
        <div className="w-12 h-12 rounded-lg bg-[#11131B] border border-white/[0.08] flex items-center justify-center text-[#FF6B4A] mb-3">
          <Shield size={22} />
        </div>
        <h2 className="text-sm font-bold text-white mb-1">Access Restricted</h2>
        <p className="text-xs text-zinc-500">You don't have permission to view the organizational team directory.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-1 -m-4 sm:-m-6 lg:-m-7 bg-[#08090C] text-zinc-300 select-none overflow-hidden font-sans">

      {/* ── Main Directory Section ── */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 space-y-6">

        {/* ── 1. Page Header & Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.05] pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                {orgName || 'Workspace'} Organizational Directory
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-600" />
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                RBAC Scoped
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Team Directory
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-normal">
              {loading ? 'Synchronizing organizational roster...' : `${members.length} members · ${departments.length || 1} active departments`}
            </p>
          </div>

          {canInvite && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/employees/invite')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-[11px] font-semibold transition-colors shadow-sm"
              >
                <Plus size={13} />
                <span>Invite Member</span>
              </button>
            </div>
          )}
        </div>

        {/* ── 2. Organization Overview Telemetry Strip (Continuous Strip) ── */}
        <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-white/[0.05] shrink-0">
          {telemetry.map((t, idx) => (
            <div key={idx} className="p-3.5 flex flex-col justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-wider text-zinc-500">{t.label}</span>
              <div className="mt-1">
                <div className={`text-xl font-black tracking-tight tabular-nums ${t.isOrange ? 'text-[#FF6B4A]' : 'text-white'}`}>
                  {t.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3. Search & Command Filter Bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">

          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search people by name, email, role, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#07080A] border border-white/[0.06] focus:border-[#FF6B4A]/50 rounded-md text-[11px] text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0A0B10] border border-white/[0.06] rounded text-[11px]">
              <span className="text-zinc-500 font-mono text-[10px]">ROLE:</span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL" className="bg-[#0A0B10] text-white">All Roles</option>
                {availableRoles.map(r => (
                  <option key={r} value={r} className="bg-[#0A0B10] text-white capitalize">
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0A0B10] border border-white/[0.06] rounded text-[11px]">
              <span className="text-zinc-500 font-mono text-[10px]">DEPT:</span>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL" className="bg-[#0A0B10] text-white">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name} className="bg-[#0A0B10] text-white">{d.name}</option>
                ))}
                <option value="Unassigned" className="bg-[#0A0B10] text-zinc-400">Unassigned</option>
              </select>
            </div>

            {(roleFilter !== 'ALL' || deptFilter !== 'ALL' || search) && (
              <button
                onClick={() => { setRoleFilter('ALL'); setDeptFilter('ALL'); setSearch(''); }}
                className="text-[11px] font-mono text-zinc-500 hover:text-[#FF6B4A] px-2 py-1 transition-colors"
              >
                Reset
              </button>
            )}

          </div>
        </div>

        {/* ── 4. Structured Team Directory Table ── */}
        <div className="bg-[#0A0B10] border border-white/[0.06] rounded-lg overflow-hidden flex flex-col flex-1">

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-white/[0.05] bg-[#07080A] text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 sticky top-0 z-10">
            <div className="col-span-4 sm:col-span-4">Person</div>
            <div className="col-span-3 sm:col-span-3">Department</div>
            <div className="col-span-3 sm:col-span-2">Role</div>
            <div className="col-span-2 sm:col-span-2 hidden md:block">Active Work</div>
            <div className="col-span-2 sm:col-span-1 text-right">Status</div>
          </div>

          {/* Directory Rows */}
          <div className="divide-y divide-white/[0.04] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 bg-white/[0.02] rounded animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-12 text-center text-xs text-red-400">
                <span>{error}</span>
                <button onClick={fetchMembers} className="block mx-auto mt-2 text-[#FF6B4A] font-semibold">Retry →</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
                <Users size={24} className="text-zinc-600 mx-auto mb-2" />
                <p className="text-white font-medium">No team members match this criteria.</p>
                <p className="text-zinc-500 text-[11px]">Try adjusting your search query or role filter.</p>
              </div>
            ) : (
              filtered.map((m, idx) => {
                const isSelected = selectedMember?.id === m.id;
                const initials = (m.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    key={m.id}
                    onClick={() => handleSelectMember(m)}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-white/[0.025] cursor-pointer transition-colors group ${isSelected ? 'bg-white/[0.04] border-l-2 border-[#FF6B4A]' : ''
                      }`}
                  >
                    {/* Person Column */}
                    <div className="col-span-4 sm:col-span-4 flex items-center gap-3 min-w-0">
                      <motion.div layoutId={`avatar-${m.id}`} className="w-7 h-7 rounded-md bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={initials} className="w-7 h-7 rounded-md object-cover" />
                        ) : (
                          initials
                        )}
                      </motion.div>
                      <div className="min-w-0">
                        <motion.div layoutId={`name-${m.id}`} className="text-xs font-semibold text-white group-hover:text-[#FF6B4A] transition-colors truncate">
                          {m.full_name || 'Anonymous User'}
                        </motion.div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">
                          {m.email}
                        </div>
                      </div>
                    </div>

                    {/* Department Column */}
                    <div className="col-span-3 sm:col-span-3 text-xs text-zinc-400 truncate">
                      {m.department ? (
                        <span className="text-zinc-300">{m.department}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono text-[10px]">Unassigned</span>
                      )}
                    </div>

                    {/* Role Column */}
                    <div className="col-span-3 sm:col-span-2">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border inline-block ${m.isLeadership
                        ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] border-[#FF6B4A]/25 font-bold'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.06]'
                        }`}>
                        {m.role?.replace(/_/g, ' ') || 'Member'}
                      </span>
                    </div>

                    {/* Active Work Column */}
                    <div className="col-span-2 sm:col-span-2 hidden md:block text-[11px] font-mono text-zinc-400">
                      <span>{m.activeTasksCount} Active Deliverable{m.activeTasksCount !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Status Column */}
                    <div className="col-span-2 sm:col-span-1 text-right flex items-center justify-end gap-1.5 text-[10px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="hidden sm:inline">Active</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* ── 5. Employee Context Inspector (380px - 420px Slide-in) ── */}
      {selectedMember && (
        <div className="w-96 border-l border-white/[0.05] bg-[#0A0B10] flex flex-col h-full shrink-0 overflow-y-auto font-sans">

          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.05]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">Employee Profile</span>
            <button onClick={() => setSelectedMember(null)} className="text-zinc-500 hover:text-white p-1">
              <X size={13} />
            </button>
          </div>

          <div className="p-4 space-y-6">

            {/* Identity Card */}
            <div className="text-center pb-4 border-b border-white/[0.05]">
              <div className="w-14 h-14 rounded-lg bg-[#13151D] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-white mx-auto mb-2 relative">
                {(selectedMember.full_name || 'U').charAt(0).toUpperCase()}
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0A0B10]" />
              </div>
              <h3 className="text-xs font-bold text-white">{selectedMember.full_name}</h3>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                {selectedMember.role?.replace(/_/g, ' ').toUpperCase()} · {selectedMember.department || 'General'}
              </p>
              <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{selectedMember.email}</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center justify-center gap-1.5 py-1.5 bg-[#13151D] hover:bg-[#181B26] border border-white/[0.06] text-white text-[11px] font-semibold rounded transition-colors"
              >
                <MessageSquare size={12} className="text-[#FF6B4A]" />
                <span>Message</span>
              </button>
              <button
                onClick={() => navigate('/meetings/new')}
                className="flex items-center justify-center gap-1.5 py-1.5 bg-[#13151D] hover:bg-[#181B26] border border-white/[0.06] text-white text-[11px] font-semibold rounded transition-colors"
              >
                <Video size={12} className="text-[#FF6B4A]" />
                <span>Schedule</span>
              </button>
            </div>

            {/* Operational Workload Overview */}
            <div className="space-y-2">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Briefcase size={11} className="text-[#FF6B4A]" />
                <span>Operational Workload</span>
              </div>

              <div className="p-3 rounded bg-[#07080A] border border-white/[0.04] divide-y divide-white/[0.04] text-[11px]">
                <div className="py-1.5 flex justify-between text-zinc-400">
                  <span>Assigned Deliverables</span>
                  <span className="font-mono text-white">{selectedMember.activeTasksCount}</span>
                </div>
                <div className="py-1.5 flex justify-between text-zinc-400">
                  <span>Leadership Rank</span>
                  <span className="font-mono text-white">{selectedMember.isLeadership ? 'Lead' : 'Specialist'}</span>
                </div>
                <div className="py-1.5 flex justify-between text-zinc-400">
                  <span>Security Protocol</span>
                  <span className="font-mono text-emerald-400">E2EE Ratchet Sync</span>
                </div>
              </div>
            </div>

            {/* Active Deliverables Queue */}
            {memberWorkContext.tasks.length > 0 && (
              <div className="space-y-2">
                <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  Active Deliverables
                </div>

                <div className="space-y-1.5">
                  {memberWorkContext.tasks.map(t => (
                    <div key={t.id} className="p-2 rounded bg-[#07080A] border border-white/[0.04] text-[11px]">
                      <div className="text-zinc-200 font-medium truncate">{t.title}</div>
                      <div className="text-[9px] font-mono text-zinc-500 flex justify-between mt-0.5">
                        <span>{t.projects?.title || 'Core Project'}</span>
                        <span className="uppercase text-[#FF6B4A]">{t.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Profile Link */}
            <div className="pt-2 border-t border-white/[0.05]">
              <Link
                to={`/employees/${selectedMember.id}`}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white text-xs font-semibold rounded transition-colors"
              >
                <span>View Full Profile</span>
                <ExternalLink size={12} />
              </Link>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
