import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Building2, Plus, Search, Edit2,
  Trash2, X, RefreshCw, Layers
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';

interface Department {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string | null;
  head_user_id: string | null;
  created_at: string;
  head_user?: { id: string; full_name: string; email: string } | null;
}

const DEPT_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

export default function Departments() {
  const { role } = useAuth();
  const { orgId } = useWorkspace();
  const canManage = hasPermission(role, 'manage_departments');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPT_COLORS[0]);
  const [headUserId, setHeadUserId] = useState('');
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepartments(data || []);

      const { data: uData } = await supabase
        .from('user_organizations')
        .select('users:user_id(id, full_name, email)')
        .eq('org_id', orgId);
      if (uData) {
        setMembers(uData.map((d: any) => d.users).filter(Boolean));
      }
    } catch (e) {
      console.error('Failed to load departments:', e);
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
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setColor(dept.color || DEPT_COLORS[0]);
    setHeadUserId(dept.head_user_id || '');
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
          })
          .eq('id', editingDept.id)
          .select(`*, head_user:head_user_id(id, full_name, email)`)
          .single();

        if (error) throw error;
        setDepartments(prev => prev.map(d => (d.id === editingDept.id ? data : d)));
      } else {
        const { data, error } = await supabase
          .from('departments')
          .insert({
            org_id: orgId,
            name: name.trim(),
            description: description.trim() || null,
            color,
            head_user_id: headUserId || null,
          })
          .select(`*, head_user:head_user_id(id, full_name, email)`)
          .single();

        if (error) throw error;
        setDepartments(prev => [data, ...prev]);
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save department:', e);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!deleteDeptId) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', deleteDeptId);
      if (error) throw error;
      setDepartments(prev => prev.filter(d => d.id !== deleteDeptId));
    } catch (e) {
      console.error('Failed to delete department:', e);
    } finally {
      setDeleteDeptId(null);
    }
  };

  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase())
  );

  const assignedLeadsCount = departments.filter(d => d.head_user_id).length;

  const metrics: MetricItem[] = useMemo(() => [
    { label: 'DEPARTMENTS', value: departments.length < 10 ? `0${departments.length}` : departments.length },
    { label: 'ASSIGNED LEADS', value: assignedLeadsCount < 10 ? `0${assignedLeadsCount}` : assignedLeadsCount, isOrange: assignedLeadsCount > 0 },
    { label: 'ORG MEMBERS', value: members.length < 10 ? `0${members.length}` : members.length },
    { label: 'GOVERNANCE', value: 'Active' },
  ], [departments, assignedLeadsCount, members]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Departments & Structure"
        description="Organizational divisions, governance heads, and team domain ownership."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDepartments}
              className="p-2 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider transition-colors"
              title="Sync departments"
            >
              <RefreshCw size={13} />
            </button>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>Add Department</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Metric Strip ── */}
      <MetricStrip metrics={metrics} />

      {/* ── Search & Filter ── */}
      <div className="flex items-center justify-between gap-3 bg-card-bg border border-divider rounded-lg p-2.5 max-w-md">
        <div className="relative w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search departments or domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-app border border-divider focus:border-[#FF6B4A]/40 rounded text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Department List ── */}
      {loading ? (
        <SkeletonRow count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments found"
          description={search ? "No departments match this query." : "Establish your first organizational department to group team members."}
          action={canManage && !search ? { label: "Add First Department", onClick: openCreateModal } : undefined}
        />
      ) : (
        <div className="bg-card-bg border border-divider rounded-lg divide-y divide-white/[0.03] overflow-hidden">
          {filtered.map((dept, idx) => {
            const deptColor = dept.color || '#FF6B4A';
            return (
              <motion.div
                initial={{ opacity: 0, scaleY: 0.98, y: 8 }}
                animate={{ opacity: 1, scaleY: 1, y: 0 }}
                transition={{ duration: 0.28, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                key={dept.id}
                className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded border flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: `${deptColor}15`, color: deptColor, borderColor: `${deptColor}30` }}
                  >
                    <Layers size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-main text-xs">{dept.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor }} />
                    </div>
                    {dept.description && (
                      <p className="text-[11px] text-muted truncate max-w-lg">{dept.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {dept.head_user ? (
                    <div className="text-right hidden sm:block">
                      <div className="text-[11px] font-semibold text-main">{dept.head_user.full_name}</div>
                      <div className="text-[10px] font-mono text-muted">Department Lead</div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-zinc-600 hidden sm:block">No Lead Assigned</div>
                  )}

                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="p-1 rounded hover:bg-white/[0.05] text-muted hover:text-main transition-colors"
                        title="Edit Department"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteDeptId(dept.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                        title="Delete Department"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card-bg border border-divider rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider font-mono flex items-center gap-2">
                <Building2 size={15} className="text-[#FF6B4A]" />
                <span>{editingDept ? 'Edit Department' : 'New Department'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-main">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Department Name <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Product Architecture"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Description & Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities, domain ownership..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Department Lead
                </label>
                <select
                  value={headUserId}
                  onChange={e => setHeadUserId(e.target.value)}
                  className="w-full bg-app border border-divider rounded px-2.5 py-1.5 text-xs text-main focus:outline-none"
                >
                  <option value="">None / Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Accent Color
                </label>
                <div className="flex gap-2 flex-wrap pt-1">
                  {DEPT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-[2px] transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D12]' : 'opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-divider">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-hover hover:bg-hover text-muted text-xs rounded border border-divider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-4 py-1.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors"
                >
                  {saving ? 'Saving...' : editingDept ? 'Update' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteDeptId}
        title="Delete Department"
        message="Are you sure you want to delete this department? Any projects or teams associated with it will need reclassification."
        confirmText="Delete Department"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteDepartment}
        onCancel={() => setDeleteDeptId(null)}
      />

    </div>
  );
}
