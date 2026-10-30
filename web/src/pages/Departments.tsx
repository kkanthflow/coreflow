import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Building2, Plus, Search, Edit2,
  Trash2, X, RefreshCw, Layers, ChevronRight,
  Archive, CheckCircle2, Users, Briefcase
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';

interface Department {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: string;
  head_user_id: string | null;
  created_at: string;
  head_user?: { id: string; full_name: string; email: string } | null;
  member_count?: number;
}

const DEPT_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

export default function Departments() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { orgId, isOwner, canManageDepartments } = useWorkspace();
  const canManage = isOwner || canManageDepartments || hasPermission(role, 'manage_departments');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPT_COLORS[0]);
  const [headUserId, setHeadUserId] = useState('');
  const [deptStatus, setDeptStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          head_user:head_user_id(id, full_name, email)
        `)
        .eq('org_id', orgId)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (error) throw error;

      // Fetch member counts per department
      const { data: deptMembers } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('org_id', orgId);

      const countMap: Record<string, number> = {};
      (deptMembers || []).forEach((dm: any) => {
        countMap[dm.department_id] = (countMap[dm.department_id] || 0) + 1;
      });

      const deptsWithCounts = (data || []).map(d => ({
        ...d,
        member_count: countMap[d.id] || 0,
      }));

      setDepartments(deptsWithCounts);

      const { data: uData } = await supabase
        .from('user_organizations')
        .select('users:user_id(id, full_name, email)')
        .eq('org_id', orgId);
      if (uData) {
        setMembers(uData.map((d: any) => d.users).filter(Boolean));
      }
    } catch (e) {
      console.error('Failed to load departments:', e);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setDescription('');
    setColor(DEPT_COLORS[0]);
    setHeadUserId('');
    setDeptStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setColor(dept.color || DEPT_COLORS[0]);
    setHeadUserId(dept.head_user_id || '');
    setDeptStatus(dept.status || 'active');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !orgId) return;
    setSaving(true);
    try {
      if (editingDept) {
        const { data, error } = await supabase
          .from('departments')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            color,
            head_user_id: headUserId || null,
            status: deptStatus,
          })
          .eq('id', editingDept.id)
          .select(`*, head_user:head_user_id(id, full_name, email)`)
          .single();

        if (error) throw error;
        toast.success('Department updated successfully');
        setDepartments(prev => prev.map(d => (d.id === editingDept.id ? { ...data, member_count: d.member_count } : d)));
      } else {
        const { data, error } = await supabase
          .from('departments')
          .insert({
            org_id: orgId,
            name: name.trim(),
            description: description.trim() || null,
            color,
            head_user_id: headUserId || null,
            status: 'active',
          })
          .select(`*, head_user:head_user_id(id, full_name, email)`)
          .single();

        if (error) throw error;

        // Auto-provision department chat channel
        await supabase
          .from('chat_channels')
          .insert({
            org_id: orgId,
            department_id: data.id,
            name: `${data.name} Chat`,
            description: `Official channel for ${data.name}`,
            type: 'department',
            is_private: false,
            created_by: headUserId || null,
          });

        toast.success('Department created with dedicated workspace');
        setDepartments(prev => [{ ...data, member_count: 0 }, ...prev]);
      }
      setIsModalOpen(false);
    } catch (e: any) {
      console.error('Failed to save department:', e);
      toast.error(e.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!deleteDeptId) return;
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_deleted: true, status: 'archived', deleted_at: new Date().toISOString() })
        .eq('id', deleteDeptId);

      if (error) throw error;
      toast.success('Department archived successfully');
      setDepartments(prev => prev.filter(d => d.id !== deleteDeptId));
    } catch (e: any) {
      console.error('Failed to delete department:', e);
      toast.error(e.message || 'Failed to archive department');
    } finally {
      setDeleteDeptId(null);
    }
  };

  const filtered = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return d.status !== 'archived';
    if (statusFilter === 'archived') return d.status === 'archived';
    return true;
  });

  const assignedLeadsCount = departments.filter(d => d.head_user_id).length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'DEPARTMENTS', value: departments.length },
    { label: 'ASSIGNED LEADS', value: assignedLeadsCount, isOrange: assignedLeadsCount > 0 },
    { label: 'ORG MEMBERS', value: members.length },
    { label: 'GOVERNANCE', value: 'Active' },
  ], [departments, assignedLeadsCount, members]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Departments & Workspaces"
        description="Organizational divisions, governance heads, and dedicated department workspaces."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDepartments}
              className="p-2 rounded-lg bg-surface-2 hover:bg-hover text-muted hover:text-main border border-divider transition-colors cursor-pointer"
              title="Sync departments"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Create Department</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card-bg border border-divider rounded-xl p-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search departments or domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: 'active', label: 'Active' },
            { id: 'archived', label: 'Archived' },
            { id: 'all', label: 'All' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-main hover:bg-surface-2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Department List ── */}
      {loading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} className="text-muted/60" />}
          title="No departments found"
          description={search ? "No departments match this query." : "Establish your first organizational department to group team members and launch dedicated workspaces."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dept, idx) => {
            const deptColor = dept.color || '#60A5FA';
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.03 }}
                key={dept.id}
                className="bg-card-bg border border-divider hover:border-white/20 rounded-xl p-4.5 space-y-4 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ backgroundColor: `${deptColor}15`, color: deptColor, borderColor: `${deptColor}30` }}
                      >
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-main text-xs truncate block">{dept.name}</span>
                        <span className="text-[10px] font-mono text-muted flex items-center gap-1 mt-0.5">
                          <Users size={11} />
                          <span>{dept.member_count || 0} members</span>
                        </span>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(dept)}
                          className="p-1 rounded text-muted hover:text-main hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Edit Department"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteDeptId(dept.id)}
                          className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Archive Department"
                        >
                          <Archive size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {dept.description && (
                    <p className="text-xs text-muted/90 line-clamp-2">{dept.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-divider flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {dept.head_user ? (
                      <div className="text-[11px] truncate">
                        <span className="text-muted">Head: </span>
                        <span className="font-semibold text-main">{dept.head_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-muted/60">No Lead Assigned</span>
                    )}
                  </div>

                  <Link
                    to={`/departments/${dept.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover text-main text-xs font-semibold border border-divider transition-all shrink-0 cursor-pointer shadow-xs"
                  >
                    <span>Open Workspace</span>
                    <ChevronRight size={13} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Create / Edit Department ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-sm font-bold text-main flex items-center gap-2">
                <Building2 size={16} className="text-accent" />
                <span>{editingDept ? 'Edit Department' : 'Create Department'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-main p-1">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering, Marketing, Operations"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Responsibilities and functional domain of this department..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                  Department Head / Lead
                </label>
                <select
                  value={headUserId}
                  onChange={e => setHeadUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none"
                >
                  <option value="">No Lead Assigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-2">
                  Theme Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEPT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {editingDept && (
                <div>
                  <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={deptStatus}
                    onChange={e => setDeptStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-divider text-xs text-muted hover:text-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      <ConfirmModal
        isOpen={!!deleteDeptId}
        onClose={() => setDeleteDeptId(null)}
        onConfirm={confirmDeleteDepartment}
        title="Archive Department"
        message="Are you sure you want to archive this department? Historical tasks, projects, and channel records will be preserved."
        confirmText="Archive Department"
        variant="danger"
      />
    </div>
  );
}
