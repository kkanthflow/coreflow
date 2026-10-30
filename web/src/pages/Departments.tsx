import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Building2, Plus, Search, Edit2, X, RefreshCw, ChevronRight,
  Archive, CheckCircle2, Users, Briefcase, Target, Code,
  CreditCard, ArrowRight, ArrowLeft, Check, Sparkles, Sliders,
  HelpCircle, FolderPlus, Tag, Shield, Clock, Zap
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow, type MetricItem
} from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';
import {
  generateQuestionsForDepartment,
  generateRecommendedModules,
  type DynamicQuestion,
  type OperationalModule,
  CORE_MODULES
} from '../lib/departmentEngine';

interface Department {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  responsibilities: string[] | null;
  enabled_modules: any[] | null;
  module_configurations: Record<string, any> | null;
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

  // ── Multi-Step Creation Wizard State ──
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Step 1: Definition
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [respInput, setRespInput] = useState('');
  const [headUserId, setHeadUserId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [color, setColor] = useState(DEPT_COLORS[0]);
  const [deptStatus, setDeptStatus] = useState('active');

  // Step 2: Dynamic Questions
  const [questions, setQuestions] = useState<DynamicQuestion[]>([]);
  const [customQuestionText, setCustomQuestionText] = useState('');

  // Step 3: Operational Modules
  const [modules, setModules] = useState<OperationalModule[]>([]);
  const [showAddCustomModule, setShowAddCustomModule] = useState(false);
  const [customModuleName, setCustomModuleName] = useState('');
  const [customModuleDesc, setCustomModuleDesc] = useState('');

  const [saving, setSaving] = useState(false);

  // Fetch departments
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

      // Fetch member counts
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

      // Fetch org users
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

  // Open Wizard for new Department
  const openCreateWizard = () => {
    setEditingDept(null);
    setName('');
    setDescription('');
    setPurpose('');
    setResponsibilities([]);
    setRespInput('');
    setHeadUserId('');
    setSelectedMemberIds([]);
    setColor(DEPT_COLORS[Math.floor(Math.random() * DEPT_COLORS.length)]);
    setDeptStatus('active');
    setQuestions([]);
    setModules([]);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Open Edit Mode
  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setPurpose(dept.purpose || '');
    setResponsibilities(Array.isArray(dept.responsibilities) ? dept.responsibilities : []);
    setRespInput('');
    setHeadUserId(dept.head_user_id || '');
    setColor(dept.color || DEPT_COLORS[0]);
    setDeptStatus(dept.status || 'active');
    setQuestions([]);
    // Parse existing enabled modules
    const rawModules = Array.isArray(dept.enabled_modules) ? dept.enabled_modules : [];
    const parsedModules: OperationalModule[] = rawModules.map((m: any) => {
      if (typeof m === 'string') {
        const found = CORE_MODULES.find(c => c.key === m);
        return found || {
          key: m,
          name: m.replace(/_/g, ' ').toUpperCase(),
          description: 'Department operational module',
          icon: 'FolderCheck',
          category: 'Operational',
          permission: 'all_members',
          workflowStages: ['New', 'In Progress', 'Completed']
        };
      }
      return m;
    });
    setModules(parsedModules);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Responsibilities tag handler
  const handleAddResponsibility = () => {
    const trimmed = respInput.trim();
    if (!trimmed) return;
    if (!responsibilities.includes(trimmed)) {
      setResponsibilities([...responsibilities, trimmed]);
    }
    setRespInput('');
  };

  const handleRemoveResponsibility = (idx: number) => {
    setResponsibilities(responsibilities.filter((_, i) => i !== idx));
  };

  // Step 1 -> Step 2: Generate dynamic questions
  const goToQuestionsStep = () => {
    if (!name.trim()) {
      toast.error('Please enter a department name.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter a description for the department.');
      return;
    }
    const generated = generateQuestionsForDepartment(name, description, purpose, responsibilities);
    setQuestions(generated);
    setWizardStep(2);
  };

  // Step 2: Toggle Question
  const handleToggleQuestion = (id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, enabled: !q.enabled } : q));
  };

  // Step 2: Add Custom Question
  const handleAddCustomQuestion = () => {
    if (!customQuestionText.trim()) return;
    const newQ: DynamicQuestion = {
      id: `q_custom_${Date.now()}`,
      text: customQuestionText.trim(),
      category: 'Custom Question',
      enabled: true,
      suggestedModule: `mod_custom_${Date.now().toString().slice(-4)}`,
      isCustom: true,
    };
    setQuestions(prev => [...prev, newQ]);
    setCustomQuestionText('');
  };

  // Step 2 -> Step 3: Generate recommended modules
  const goToModulesStep = () => {
    const recommended = generateRecommendedModules(name, responsibilities, questions);
    setModules(recommended);
    setWizardStep(3);
  };

  // Step 3: Toggle Module
  const handleToggleModule = (key: string) => {
    setModules(prev => {
      const exists = prev.some(m => m.key === key);
      if (exists) {
        return prev.filter(m => m.key !== key);
      } else {
        return [...prev];
      }
    });
  };

  // Step 3: Add Custom Module
  const handleCreateCustomModule = () => {
    if (!customModuleName.trim()) return;
    const cleanKey = customModuleName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const newMod: OperationalModule = {
      key: cleanKey,
      name: customModuleName.trim(),
      description: customModuleDesc.trim() || `Operational tracking and records for ${customModuleName.trim()}`,
      icon: 'FolderCheck',
      category: 'Custom',
      isCustom: true,
      permission: 'all_members',
      workflowStages: ['New', 'In Progress', 'Under Review', 'Completed'],
    };
    setModules(prev => [...prev, newMod]);
    setCustomModuleName('');
    setCustomModuleDesc('');
    setShowAddCustomModule(false);
    toast.success(`Custom module "${newMod.name}" added`);
  };

  // Step 4: Final Submit & Creation
  const handleApproveAndGenerateWorkspace = async () => {
    if (!name.trim() || !orgId) return;
    setSaving(true);
    try {
      if (editingDept) {
        // Update existing department configuration
        const { error } = await supabase.rpc('update_department_configuration', {
          p_org_id: orgId,
          p_department_id: editingDept.id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_purpose: purpose.trim() || null,
          p_responsibilities: responsibilities,
          p_enabled_modules: modules,
          p_module_configurations: {},
          p_color: color,
          p_head_user_id: headUserId || null,
          p_status: deptStatus,
        });

        if (error) throw error;
        toast.success('Department configuration updated successfully');
        setIsWizardOpen(false);
        fetchDepartments();
      } else {
        // Create user-defined department via atomic RPC
        const { data, error } = await supabase.rpc('create_user_defined_department', {
          p_org_id: orgId,
          p_name: name.trim(),
          p_description: description.trim(),
          p_purpose: purpose.trim() || null,
          p_responsibilities: responsibilities,
          p_enabled_modules: modules,
          p_module_configurations: {},
          p_color: color,
          p_head_user_id: headUserId || null,
          p_initial_member_ids: selectedMemberIds,
          p_dynamic_questions: questions,
        });

        if (error) throw error;

        toast.success(`Department "${name}" created with customized workspace!`);
        setIsWizardOpen(false);
        await fetchDepartments();

        if (data?.department_id) {
          navigate(`/departments/${data.department_id}`);
        }
      }
    } catch (e: any) {
      console.error('Failed to configure department:', e);
      toast.error(e.message || 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  // Confirm Archive
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
      d.description?.toLowerCase().includes(search.toLowerCase()) ||
      d.purpose?.toLowerCase().includes(search.toLowerCase());
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
    { label: 'STRUCTURE', value: 'User-Defined' },
  ], [departments, assignedLeadsCount, members]);

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      {/* ── Page Header Standard ── */}
      <PageHeader
        title="Departments & Workspaces"
        description="User-defined organizational divisions, customized responsibilities, and dedicated workspaces."
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
                onClick={openCreateWizard}
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
            placeholder="Search custom departments or purpose..."
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
          icon={Building2}
          title="No departments found"
          description={search ? "No departments match this query." : "Establish your organization's unique departments without rigid constraints."}
          action={canManage ? { label: "Create First Department", onClick: openCreateWizard } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dept, idx) => {
            const deptColor = dept.color || '#60A5FA';
            const moduleCount = Array.isArray(dept.enabled_modules) ? dept.enabled_modules.length : 5;
            const respList = Array.isArray(dept.responsibilities) ? dept.responsibilities : [];

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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-muted flex items-center gap-1">
                            <Users size={11} />
                            <span>{dept.member_count || 0} members</span>
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-divider text-accent font-semibold">
                            {moduleCount} modules
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(dept)}
                          className="p-1 rounded text-muted hover:text-main hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Configure Department"
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

                  {dept.purpose && (
                    <p className="text-[11px] font-medium text-main/90 italic">
                      "{dept.purpose}"
                    </p>
                  )}

                  {dept.description && (
                    <p className="text-xs text-muted/80 line-clamp-2">{dept.description}</p>
                  )}

                  {respList.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {respList.slice(0, 3).map((r, rIdx) => (
                        <span key={rIdx} className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-muted">
                          {r}
                        </span>
                      ))}
                      {respList.length > 3 && (
                        <span className="text-[9px] font-mono text-muted">+{respList.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-divider flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {dept.head_user ? (
                      <div className="text-[11px] truncate">
                        <span className="text-muted">Lead: </span>
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

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* 4-STEP USER-DEFINED DEPARTMENT CREATION WIZARD                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-card-bg border border-divider rounded-2xl shadow-2xl flex flex-col my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-divider flex items-center justify-between shrink-0 bg-surface">
              <div>
                <h2 className="text-sm font-bold text-main flex items-center gap-2">
                  <Sparkles size={16} className="text-accent" />
                  <span>{editingDept ? 'Configure Department' : 'Create User-Defined Department'}</span>
                </h2>
                <p className="text-[11px] text-muted mt-0.5">
                  Step {wizardStep} of 4: {
                    wizardStep === 1 ? 'Department Definition & Responsibilities' :
                    wizardStep === 2 ? 'Dynamic Operational Configuration' :
                    wizardStep === 3 ? 'Operational Modules & Tooling' :
                    'Review & Approve Workspace'
                  }
                </p>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="text-muted hover:text-main p-1 cursor-pointer">
                <X size={15} />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-4 border-b border-divider bg-surface-2/40 text-center text-[10px] font-mono font-semibold">
              {[
                { step: 1, label: '1. Definition' },
                { step: 2, label: '2. Questions' },
                { step: 3, label: '3. Modules' },
                { step: 4, label: '4. Approval' },
              ].map(s => (
                <div
                  key={s.step}
                  className={`py-2 border-r last:border-r-0 border-divider transition-colors ${
                    wizardStep === s.step
                      ? 'bg-accent/15 text-accent border-b-2 border-b-accent'
                      : wizardStep > s.step
                      ? 'text-main'
                      : 'text-muted/50'
                  }`}
                >
                  {s.label}
                </div>
              ))}
            </div>

            {/* Wizard Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* ──────────────── STEP 1: DEFINITION ──────────────── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Department Name <span className="text-accent">*</span> (Free-Text, No Rigid Predefined Lists)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Growth and Strategy, Accounts, Product Engineering, Security Operations"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Department Purpose <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lead generation, market expansion and high-value strategic partnerships"
                      value={purpose}
                      onChange={e => setPurpose(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Department Description <span className="text-accent">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detailed operational mandate, scope, and cross-functional expectations..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none resize-none"
                    />
                  </div>

                  {/* Operational Responsibilities Tag Builder */}
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Operational Responsibilities (Define what this department actually executes)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="e.g. Inbound Lead Gen, Sprint Planning, Budget Approvals, Bug Triage..."
                        value={respInput}
                        onChange={e => setRespInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddResponsibility(); } }}
                        className="flex-1 px-3 py-1.5 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddResponsibility}
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-hover border border-divider text-xs font-semibold text-main cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-surface-2/40 border border-divider rounded-lg">
                      {responsibilities.length === 0 ? (
                        <span className="text-[11px] text-muted italic">No responsibilities added yet. Add key duties to generate tailored tooling.</span>
                      ) : (
                        responsibilities.map((resp, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/25 text-accent text-xs font-medium"
                          >
                            <span>{resp}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveResponsibility(idx)}
                              className="hover:text-red-400 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Leadership and Members */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                        Department Head / Lead (Optional)
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
                      <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                        Theme Color
                      </label>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {DEPT_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                              color === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Initial Member Enrollment */}
                  {!editingDept && (
                    <div>
                      <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                        Enroll Initial Department Members ({selectedMemberIds.length} selected)
                      </label>
                      <div className="max-h-28 overflow-y-auto p-2 bg-surface-2/40 border border-divider rounded-lg divide-y divide-divider">
                        {members.length === 0 ? (
                          <p className="text-[11px] text-muted">No organization members found.</p>
                        ) : (
                          members.map(m => {
                            const isChecked = selectedMemberIds.includes(m.id);
                            return (
                              <label key={m.id} className="flex items-center justify-between py-1.5 px-1 hover:bg-hover/40 rounded cursor-pointer text-xs">
                                <span className="text-main font-medium">{m.full_name} <span className="text-muted font-normal">({m.email})</span></span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id));
                                    } else {
                                      setSelectedMemberIds([...selectedMemberIds, m.id]);
                                    }
                                  }}
                                  className="accent-accent"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────── STEP 2: DYNAMIC QUESTIONS ──────────────── */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl flex items-start gap-3">
                    <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-main">
                      AUVRYN analyzed <strong>"{name}"</strong> and its declared responsibilities. Select which operational areas apply to configure your workspace tooling:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {questions.map(q => (
                      <div
                        key={q.id}
                        onClick={() => handleToggleQuestion(q.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          q.enabled
                            ? 'bg-surface border-accent/40 shadow-xs'
                            : 'bg-surface-2/30 border-divider text-muted opacity-60'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-surface-2 border border-divider text-accent">
                            {q.category}
                          </span>
                          <p className="text-xs font-semibold text-main">{q.text}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={q.enabled}
                          onChange={() => handleToggleQuestion(q.id)}
                          className="accent-accent w-4 h-4"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Question */}
                  <div className="pt-2 border-t border-divider">
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">
                      Add Custom Focus Question
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Does this department require weekly client risk auditing?"
                        value={customQuestionText}
                        onChange={e => setCustomQuestionText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomQuestion(); } }}
                        className="flex-1 px-3 py-1.5 bg-surface-2 border border-divider focus:border-accent rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomQuestion}
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-hover border border-divider text-xs font-semibold text-main cursor-pointer"
                      >
                        Add Question
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────── STEP 3: OPERATIONAL MODULES ──────────────── */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-main">Recommended Operational Modules</h3>
                      <p className="text-[11px] text-muted">Enable or customize tools tailored for this department's workflows.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomModule(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-hover border border-divider text-xs font-semibold text-main cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Custom Module</span>
                    </button>
                  </div>

                  {/* Custom Module Form */}
                  {showAddCustomModule && (
                    <div className="p-4 bg-surface border border-accent/30 rounded-xl space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-accent">Define Custom Operational Module</span>
                        <button onClick={() => setShowAddCustomModule(false)} className="text-muted hover:text-main">
                          <X size={13} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Module Name (e.g. Satellite Tracking, Grant Oversight, Code Audit)"
                        value={customModuleName}
                        onChange={e => setCustomModuleName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-2 border border-divider rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Description of workflow records..."
                        value={customModuleDesc}
                        onChange={e => setCustomModuleDesc(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-2 border border-divider rounded-lg text-xs text-main placeholder-muted focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddCustomModule(false)}
                          className="px-3 py-1 text-xs text-muted hover:text-main"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCustomModule}
                          className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-semibold"
                        >
                          Add Module
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modules Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modules.map(mod => {
                      return (
                        <div
                          key={mod.key}
                          className="p-3.5 bg-surface border border-divider rounded-xl space-y-2 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-main flex items-center gap-2">
                                <Zap size={14} className="text-accent" />
                                <span>{mod.name}</span>
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-divider text-muted uppercase">
                                {mod.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted line-clamp-2">{mod.description}</p>
                          </div>

                          <div className="pt-2 border-t border-divider/60 flex items-center justify-between text-[10px] font-mono text-muted">
                            <span>{mod.workflowStages.length} stages</span>
                            <span className="text-accent font-semibold">Enabled</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ──────────────── STEP 4: REVIEW & APPROVAL ──────────────── */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-main">Configuration Ready for Human Approval</h4>
                      <p className="text-[11px] text-muted mt-0.5">
                        In accordance with AUVRYN governance rules, you are authorizing the generation of a dedicated department workspace with the tailored architecture below:
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-surface border border-divider rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-divider pb-2">
                      <span className="font-mono text-muted uppercase text-[10px]">Department Name</span>
                      <span className="font-bold text-main">{name}</span>
                    </div>

                    {purpose && (
                      <div className="flex items-center justify-between border-b border-divider pb-2">
                        <span className="font-mono text-muted uppercase text-[10px]">Purpose</span>
                        <span className="font-medium text-main text-right max-w-sm">{purpose}</span>
                      </div>
                    )}

                    <div className="border-b border-divider pb-2 space-y-1">
                      <span className="font-mono text-muted uppercase text-[10px] block">Approved Responsibilities ({responsibilities.length})</span>
                      <div className="flex flex-wrap gap-1">
                        {responsibilities.length === 0 ? (
                          <span className="text-muted italic text-[11px]">General operational domain</span>
                        ) : (
                          responsibilities.map((r, i) => (
                            <span key={i} className="px-2 py-0.5 bg-surface-2 border border-divider rounded text-[10px] text-main">
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border-b border-divider pb-2 space-y-1">
                      <span className="font-mono text-muted uppercase text-[10px] block">Active Operational Modules ({modules.length})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {modules.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[10px] text-accent font-semibold">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted uppercase text-[10px]">Assigned Head</span>
                      <span className="font-semibold text-main">
                        {members.find(m => m.id === headUserId)?.full_name || 'No Lead Assigned'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-surface border-t border-divider flex items-center justify-between shrink-0">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((wizardStep - 1) as any)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-divider text-xs font-semibold text-main hover:bg-hover cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-main cursor-pointer"
                >
                  Cancel
                </button>

                {wizardStep === 1 && (
                  <button
                    type="button"
                    onClick={goToQuestionsStep}
                    disabled={!name.trim() || !description.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <span>Next: Operational Questions</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {wizardStep === 2 && (
                  <button
                    type="button"
                    onClick={goToModulesStep}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <span>Next: Operational Modules</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {wizardStep === 3 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <span>Next: Review & Approval</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {wizardStep === 4 && (
                  <button
                    type="button"
                    onClick={handleApproveAndGenerateWorkspace}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-md shadow-accent/20"
                  >
                    <CheckCircle2 size={14} />
                    <span>{saving ? 'Generating...' : editingDept ? 'Approve & Update Configuration' : 'Approve & Generate Workspace'}</span>
                  </button>
                )}
              </div>
            </div>
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
