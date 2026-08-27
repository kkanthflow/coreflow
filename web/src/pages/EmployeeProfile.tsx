import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  ArrowLeft, Mail, Phone, Building2,
  CheckSquare, Save
} from 'lucide-react';
import {
  PageHeader, MetricStrip, StatusSignal, type MetricItem
} from '../components/ui/ObsidianPrimitives';

const ALL_ROLES = [
  'owner', 'administrator', 'director', 'senior_manager',
  'manager', 'team_lead', 'senior_employee', 'employee', 'intern', 'freelancer'
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role: currentRole } = useAuth();
  const { orgId } = useWorkspace();
  const canManageRoles = hasPermission(currentRole, 'manage_roles');

  const [profile, setProfile] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: uData, error: uErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (uErr) throw uErr;
      setProfile(uData);
      setSelectedRole(uData.role || 'employee');

      const { data: tData } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('assignee_id', id)
        .order('created_at', { ascending: false });
      setTasks(tData || []);
    } catch (e) {
      console.error('Error fetching employee profile:', e);
    } finally {
      setLoading(false);
    }
  }, [id, orgId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleUpdateRole = async () => {
    if (!canManageRoles || !id) return;
    setSaving(true);
    try {
      await supabase.from('users').update({ role: selectedRole }).eq('id', id);

      if (orgId) {
        await supabase
          .from('user_organizations')
          .update({ role: selectedRole })
          .eq('org_id', orgId)
          .eq('user_id', id);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error('Failed to update role:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 font-sans select-none">
        <p className="text-zinc-500 text-xs">Team member profile not found.</p>
        <button onClick={() => navigate('/employees')} className="mt-4 px-3.5 py-1.5 bg-[#FF6B4A] text-white rounded text-xs font-semibold">
          Return to Directory
        </button>
      </div>
    );
  }

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const activeCount = tasks.filter(t => t.status !== 'done').length;

  const metrics: MetricItem[] = [
    { label: 'ROLE', value: profile.role?.toUpperCase() || 'MEMBER', isOrange: true },
    { label: 'ACTIVE TASKS', value: activeCount < 10 ? `0${activeCount}` : activeCount },
    { label: 'COMPLETED', value: doneCount < 10 ? `0${doneCount}` : doneCount },
    { label: 'DEPARTMENT', value: profile.department || 'General Org' },
    { label: 'PRESENCE', value: profile.is_online ? 'Active' : 'Offline', indicator: profile.is_online ? 'Online' : undefined },
    { label: 'STATUS', value: 'Verified' },
  ];

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-zinc-300">
      
      {/* ── Page Header ── */}
      <PageHeader
        title={profile.full_name || 'Team Member'}
        breadcrumbs={[
          { label: 'Employees', href: '/employees' },
          { label: profile.full_name || 'Member' }
        ]}
        description="Organizational intelligence, assigned deliverables, and RBAC governance."
        actions={
          <button
            onClick={() => navigate('/employees')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] text-xs transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Directory</span>
          </button>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── 2-Column Profile Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Identity & Access */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-5 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-md bg-[#13151D] border border-white/[0.08] text-white flex items-center justify-center font-bold text-xl mb-3">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-16 h-16 rounded-md object-cover" />
              ) : (
                (profile.full_name || profile.email || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <h2 className="text-sm font-bold text-white">{profile.full_name || 'Member'}</h2>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{profile.email}</p>

            <div className="w-full space-y-2 mt-4 pt-4 border-t border-white/[0.04] text-left text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-zinc-500" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-zinc-500" />
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile.department && (
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-zinc-500" />
                  <span>{profile.department}</span>
                </div>
              )}
            </div>
          </div>

          {/* Role Manager */}
          {canManageRoles && (
            <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4 space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                Access & RBAC Role
              </span>
              <div>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full bg-[#07080B] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-white capitalize focus:outline-none"
                >
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleUpdateRole}
                disabled={saving || selectedRole === profile.role}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-white font-semibold text-xs rounded transition-colors shadow-sm"
              >
                <Save size={12} />
                <span>{saving ? 'Updating...' : savedSuccess ? 'Role Saved' : 'Update Role'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Assigned Deliverables */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#0C0D12] border border-white/[0.06] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <CheckSquare size={14} className="text-[#FF6B4A]" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Assigned Deliverables ({tasks.length})</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{doneCount} completed</span>
            </div>

            <div className="divide-y divide-white/[0.03]">
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 italic">No tasks currently assigned.</div>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      <span className={`truncate ${t.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <StatusSignal status={t.status} />
                      {t.due_date && (
                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
