import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { hasPermission } from '../lib/permissions';
import {
  Building2, Plus, Search, Edit2, X, RefreshCw,
  Archive, CheckCircle2, Users, Target, Code,
  ArrowRight, Sparkles, Layers, Compass, GitFork,
  LayoutGrid, List, Check, DollarSign, Briefcase,
  UserCheck, Shield, ChevronRight, Eye, AlertCircle
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import {
  PageHeader, MetricStrip, EmptyState, SkeletonRow
} from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';
import {
  CAPABILITY_DOMAINS,
  ALL_CAPABILITIES_MAP,
  getActiveModulesForCapabilities,
} from '../lib/capabilityEngine';

interface Department {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  purpose?: string | null;
  color: string | null;
  parent_department_id?: string | null;
  head_user_id: string | null;
  status: string;
  is_archived?: boolean;
  objectives?: string[] | null;
  responsibilities?: string[] | null;
  operational_requirements?: string | null;
  expected_outcomes?: string | null;
  created_at: string;
  head_user?: { id: string; full_name: string; email: string } | null;
  parent_department?: { id: string; name: string } | null;
  member_count?: number;
  capabilities_count?: number;
  active_capabilities?: string[];
}

interface MemberOption {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface AssignedMemberDraft {
  user_id: string;
  role: 'head' | 'manager' | 'member';
  can_manage: boolean;
  is_primary: boolean;
}

const DEPT_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

export default function Departments() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { orgId, isOwner, canManageDepartments, hasOrgOversight, assignedDepartmentId } = useWorkspace();

  // Owners, administrators, leaders with oversight, and authorized managers can manage departments
  const canManage = isOwner ||
    canManageDepartments ||
    hasOrgOversight ||
    role === 'owner' ||
    role === 'administrator' ||
    role === 'admin' ||
    hasPermission(role, 'manage_departments');

  // Ordinary employees without org oversight are guided straight to their authorized department workspace
  useEffect(() => {
    if (orgId && !hasOrgOversight && assignedDepartmentId) {
      navigate(`/departments/${assignedDepartmentId}`, { replace: true });
    }
  }, [orgId, hasOrgOversight, assignedDepartmentId, navigate]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgMembers, setOrgMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [parentFilter, setParentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [archiveDeptId, setArchiveDeptId] = useState<string | null>(null);

  // ── 6-Step Dynamic Creation & Edit Wizard State ──
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Step 1: Department Information
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPT_COLORS[0]);
  const [parentDeptId, setParentDeptId] = useState<string>('');

  // Step 2: Responsibilities & Objectives
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [respInput, setRespInput] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveInput, setObjectiveInput] = useState('');
  const [operationalRequirements, setOperationalRequirements] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');

  // Step 3: Capability Selection
  const [selectedCapabilityKeys, setSelectedCapabilityKeys] = useState<string[]>([]);
  const [capabilitySearch, setCapabilitySearch] = useState('');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');

  // Step 4: Workspace Modules Configuration & Preview
  const [customEnabledModuleIds, setCustomEnabledModuleIds] = useState<string[]>([]);

  // Step 5: Member Assignment
  const [headUserId, setHeadUserId] = useState<string>('');
  const [assignedMembers, setAssignedMembers] = useState<AssignedMemberDraft[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const [saving, setSaving] = useState(false);

  // Fetch departments and member records
  const fetchDepartments = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          head_user:head_user_id(id, full_name, email),
          parent_department:parent_department_id(id, name)
        `)
        .eq('org_id', orgId)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (error) throw error;

      // Member counts
      const { data: deptMembers } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('org_id', orgId);

      const countMap: Record<string, number> = {};
      (deptMembers || []).forEach((dm: any) => {
        countMap[dm.department_id] = (countMap[dm.department_id] || 0) + 1;
      });

      // Capability counts
      const { data: deptCaps } = await supabase
        .from('department_capabilities')
        .select('department_id, capability_key')
        .eq('org_id', orgId)
        .eq('is_active', true);

      const capMap: Record<string, string[]> = {};
      (deptCaps || []).forEach((dc: any) => {
        if (!capMap[dc.department_id]) capMap[dc.department_id] = [];
        capMap[dc.department_id].push(dc.capability_key);
      });

      const processedDepts: Department[] = (data || []).map(d => ({
        ...d,
        member_count: countMap[d.id] || 0,
        capabilities_count: capMap[d.id]?.length || 0,
        active_capabilities: capMap[d.id] || [],
      }));

      setDepartments(processedDepts);

      // Org users for assignment
      const { data: uData } = await supabase
        .from('user_organizations')
        .select('users:user_id(id, full_name, email)')
        .eq('org_id', orgId);

      if (uData) {
        setOrgMembers(uData.map((d: any) => d.users).filter(Boolean));
      }
    } catch (e: any) {
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
    setColor(DEPT_COLORS[Math.floor(Math.random() * DEPT_COLORS.length)]);
    setParentDeptId('');
    setObjectives([]);
    setObjectiveInput('');
    setResponsibilities([]);
    setRespInput('');
    setOperationalRequirements('');
    setExpectedOutcomes('');
    setSelectedCapabilityKeys([]);
    setCustomEnabledModuleIds([]);
    setHeadUserId('');
    setAssignedMembers([]);
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Open Wizard in Edit Mode
  const openEditWizard = async (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setColor(dept.color || DEPT_COLORS[0]);
    setParentDeptId(dept.parent_department_id || '');
    setObjectives(Array.isArray(dept.objectives) ? dept.objectives : []);
    setResponsibilities(Array.isArray(dept.responsibilities) ? dept.responsibilities : []);
    setOperationalRequirements(dept.operational_requirements || '');
    setExpectedOutcomes(dept.expected_outcomes || '');
    setHeadUserId(dept.head_user_id || '');

    // Fetch existing department capabilities
    const { data: caps } = await supabase
      .from('department_capabilities')
      .select('capability_key')
      .eq('department_id', dept.id)
      .eq('is_active', true);

    const keys = (caps || []).map(c => c.capability_key);
    setSelectedCapabilityKeys(keys);

    // Fetch existing department members
    const { data: dms } = await supabase
      .from('department_members')
      .select('user_id, department_role, can_manage, is_primary')
      .eq('department_id', dept.id);

    const drafts: AssignedMemberDraft[] = (dms || []).map(dm => ({
      user_id: dm.user_id,
      role: (dm.department_role as any) || 'member',
      can_manage: dm.can_manage || false,
      is_primary: dm.is_primary || false,
    }));
    setAssignedMembers(drafts);

    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Objective handlers
  const handleAddObjective = () => {
    const trimmed = objectiveInput.trim();
    if (!trimmed) return;
    if (!objectives.includes(trimmed)) {
      setObjectives([...objectives, trimmed]);
    }
    setObjectiveInput('');
  };

  const handleRemoveObjective = (idx: number) => {
    setObjectives(objectives.filter((_, i) => i !== idx));
  };

  // Responsibility handlers
  const handleAddResponsibility = (val?: string) => {
    const trimmed = (val !== undefined ? val : respInput).trim();
    if (!trimmed) return;
    if (!responsibilities.includes(trimmed)) {
      setResponsibilities([...responsibilities, trimmed]);
    }
    if (val === undefined) setRespInput('');
  };

  const handleRemoveResponsibility = (idx: number) => {
    setResponsibilities(responsibilities.filter((_, i) => i !== idx));
  };

  // Smart Responsibility suggestions based on Department Name
  const suggestedResponsibilities = useMemo(() => {
    const n = name.toLowerCase();
    if (n.includes('finance') || n.includes('account') || n.includes('treasury')) {
      return ['Budget Allocation', 'Financial Forecasting', 'Accounts Payable & Receivable', 'Expense Approvals', 'Tax & Audit Compliance'];
    }
    if (n.includes('engineer') || n.includes('software') || n.includes('tech') || n.includes('dev')) {
      return ['Sprint Execution & Velocity', 'System Architecture & RFCs', 'Code Reviews & CI/CD', 'Bug Triage & QA Regression', 'Production Deployments'];
    }
    if (n.includes('sale') || n.includes('market') || n.includes('growth')) {
      return ['Lead Pipeline Management', 'Client Proposal Delivery', 'Multi-channel Advertising', 'Customer Acquisition Metrics', 'Revenue Retention'];
    }
    if (n.includes('hr') || n.includes('human') || n.includes('people') || n.includes('talent')) {
      return ['Talent Acquisition & ATS', 'Employee Onboarding & Contracts', 'Leave & Attendance Approvals', 'Performance Reviews & OKRs', 'Company Culture & Policies'];
    }
    if (n.includes('operat') || n.includes('procure') || n.includes('vendor') || n.includes('logist')) {
      return ['SOP Library & Governance', 'Vendor Agreements & Performance', 'Procurement Approvals', 'Asset & Inventory Tracking', 'Facilities & Equipment'];
    }
    return ['Workflow Coordination', 'Department Documentation', 'Project Milestone Delivery', 'Cross-team Alignment', 'Performance Tracking'];
  }, [name]);

  // Capability toggling
  const handleToggleCapability = (key: string) => {
    setSelectedCapabilityKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Smart Capability Suggestions based on Name & Responsibilities
  const recommendedCapabilities = useMemo(() => {
    const text = (name + ' ' + responsibilities.join(' ')).toLowerCase();
    const suggested: string[] = [];

    if (text.includes('finance') || text.includes('budget') || text.includes('expense') || text.includes('account')) {
      suggested.push('budget_planning', 'expense_management', 'invoice_management', 'payment_management', 'accounts_payable', 'accounts_receivable', 'financial_reporting');
    }
    if (text.includes('software') || text.includes('engineer') || text.includes('dev') || text.includes('sprint') || text.includes('code')) {
      suggested.push('software_development', 'technical_project_management', 'sprint_management', 'bug_tracking', 'quality_assurance', 'release_management');
    }
    if (text.includes('sale') || text.includes('lead') || text.includes('deal') || text.includes('pipeline') || text.includes('market') || text.includes('campaign')) {
      suggested.push('lead_generation', 'sales_pipeline', 'customer_acquisition', 'campaign_management', 'content_planning', 'marketing_analytics');
    }
    if (text.includes('hr') || text.includes('people') || text.includes('talent') || text.includes('recruit') || text.includes('leave')) {
      suggested.push('recruitment', 'employee_management', 'attendance', 'leave_management', 'performance_management', 'training_development');
    }
    if (text.includes('operat') || text.includes('vendor') || text.includes('procure') || text.includes('sop') || text.includes('asset')) {
      suggested.push('daily_operations', 'resource_allocation', 'process_management', 'vendor_management', 'procurement', 'inventory_management');
    }

    return Array.from(new Set(suggested));
  }, [name, responsibilities]);

  const handleApplyRecommendedCapabilities = () => {
    setSelectedCapabilityKeys(prev => Array.from(new Set([...prev, ...recommendedCapabilities])));
    toast.success(`Applied ${recommendedCapabilities.length} suggested capabilities!`);
  };

  // Member management inside wizard
  const handleToggleMember = (userId: string) => {
    setAssignedMembers(prev => {
      const exists = prev.some(m => m.user_id === userId);
      if (exists) {
        if (headUserId === userId) setHeadUserId('');
        return prev.filter(m => m.user_id !== userId);
      } else {
        return [...prev, { user_id: userId, role: 'member', can_manage: false, is_primary: false }];
      }
    });
  };

  const handleUpdateMemberRole = (userId: string, role: 'head' | 'manager' | 'member') => {
    if (role === 'head') {
      setHeadUserId(userId);
    } else if (headUserId === userId) {
      setHeadUserId('');
    }

    setAssignedMembers(prev => prev.map(m => {
      if (m.user_id === userId) {
        return {
          ...m,
          role,
          can_manage: role === 'head' || role === 'manager',
          is_primary: role === 'head' ? true : m.is_primary,
        };
      }
      if (role === 'head' && m.role === 'head') {
        return { ...m, role: 'manager', can_manage: true };
      }
      return m;
    }));
  };

  // Step 4 computed preview modules
  const activePreviewModules = useMemo(() => {
    return getActiveModulesForCapabilities(selectedCapabilityKeys);
  }, [selectedCapabilityKeys]);

  // Determine workspace domain preview for Step 4 & Step 6
  const previewDomain = useMemo(() => {
    const n = name.toLowerCase();
    const caps = selectedCapabilityKeys;
    if (caps.some(c => c.includes('budget') || c.includes('expense') || c.includes('invoice') || c.includes('payable')) || n.includes('finance')) {
      return { type: 'Finance & Treasury', color: 'emerald', desc: 'Fiscal balances, budget allocations, expenses, invoices, accounts payable and audits.' };
    }
    if (caps.some(c => c.includes('sprint') || c.includes('bug') || c.includes('release') || c.includes('software')) || n.includes('engineer') || n.includes('dev')) {
      return { type: 'Engineering & Technology', color: 'cyan', desc: 'Agile sprint boards, bug and defect tracker, development epics, QA checklists and deployments.' };
    }
    if (caps.some(c => c.includes('lead') || c.includes('pipeline') || c.includes('campaign')) || n.includes('sale') || n.includes('market')) {
      return { type: 'Sales & Marketing', color: 'amber', desc: 'Prospect funnels, deal pipeline, advertising campaigns, and revenue acquisition analytics.' };
    }
    if (caps.some(c => c.includes('recruit') || c.includes('leave') || c.includes('attendance')) || n.includes('hr') || n.includes('people')) {
      return { type: 'Human Resources & Talent', color: 'indigo', desc: 'Candidate recruitment ATS, employee directory, leave approvals, and performance appraisals.' };
    }
    if (caps.some(c => c.includes('sop') || c.includes('vendor') || c.includes('procurement')) || n.includes('operat')) {
      return { type: 'Operations & Procurement', color: 'blue', desc: 'Standard operating procedures, vendor contracts, procurement orders, and asset tracking.' };
    }
    return { type: 'Custom Capability Workspace', color: 'accent', desc: 'Dynamically generated operational hub based on your enabled capability modules.' };
  }, [name, selectedCapabilityKeys]);

  // Submit and Activate Department
  const handleSaveDepartment = async () => {
    if (!name.trim() || !orgId) {
      toast.error('Please enter a department name.');
      return;
    }

    setSaving(true);
    try {
      if (editingDept) {
        // Update existing department
        const { error } = await supabase.rpc('update_dynamic_department', {
          p_org_id: orgId,
          p_department_id: editingDept.id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_color: color,
          p_parent_department_id: parentDeptId || null,
          p_head_user_id: headUserId || null,
          p_objectives: objectives,
          p_operational_requirements: operationalRequirements.trim() || null,
          p_expected_outcomes: expectedOutcomes.trim() || null,
          p_capability_keys: selectedCapabilityKeys,
        });

        if (error) throw error;
        toast.success(`Department "${name}" updated successfully.`);
        setIsWizardOpen(false);
        fetchDepartments();
      } else {
        // Create new dynamic department
        const { data, error } = await supabase.rpc('create_dynamic_department', {
          p_org_id: orgId,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_color: color,
          p_parent_department_id: parentDeptId || null,
          p_head_user_id: headUserId || null,
          p_objectives: objectives,
          p_operational_requirements: operationalRequirements.trim() || null,
          p_expected_outcomes: expectedOutcomes.trim() || null,
          p_capability_keys: selectedCapabilityKeys,
          p_member_assignments: assignedMembers,
        });

        if (error) throw error;

        toast.success(`Department "${name}" created with capability-driven workspace!`);
        setIsWizardOpen(false);
        await fetchDepartments();

        if (data?.department_id) {
          navigate(`/departments/${data.department_id}`);
        }
      }
    } catch (e: any) {
      console.error('Failed to configure dynamic department:', e);
      toast.error(e.message || 'Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  // Safe Archive Department
  const handleArchiveDepartment = async () => {
    if (!archiveDeptId || !orgId) return;
    try {
      const { error } = await supabase.rpc('archive_department_safe', {
        p_org_id: orgId,
        p_department_id: archiveDeptId,
      });

      if (error) throw error;
      toast.success('Department archived safely. Historical records preserved.');
      setArchiveDeptId(null);
      fetchDepartments();
    } catch (e: any) {
      console.error('Failed to archive department:', e);
      toast.error(e.message || 'Failed to archive department.');
    }
  };

  // Filtered department list (status, search, parent structure)
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(search.toLowerCase())) ||
        (d.head_user && d.head_user.full_name?.toLowerCase().includes(search.toLowerCase())) ||
        (Array.isArray(d.objectives) && d.objectives.some(o => o.toLowerCase().includes(search.toLowerCase())));

      const isArchived = d.is_archived || d.status === 'archived';
      if (statusFilter === 'active' && isArchived) return false;
      if (statusFilter === 'archived' && !isArchived) return false;

      if (parentFilter === 'top_level' && d.parent_department_id) return false;
      if (parentFilter === 'sub_departments' && !d.parent_department_id) return false;
      if (parentFilter !== 'all' && parentFilter !== 'top_level' && parentFilter !== 'sub_departments' && d.parent_department_id !== parentFilter) {
        return false;
      }

      return matchesSearch;
    });
  }, [departments, search, statusFilter, parentFilter]);

  // Filtered capabilities for wizard step 3
  const filteredCapabilityDomains = useMemo(() => {
    return CAPABILITY_DOMAINS.map(domain => {
      if (selectedDomainFilter !== 'all' && domain.category !== selectedDomainFilter) {
        return null;
      }
      const matchingCaps = domain.capabilities.filter(c => {
        if (!capabilitySearch) return true;
        const q = capabilitySearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      });
      if (matchingCaps.length === 0) return null;
      return { ...domain, capabilities: matchingCaps };
    }).filter(Boolean) as typeof CAPABILITY_DOMAINS;
  }, [capabilitySearch, selectedDomainFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title="Departments"
        description="Configure capability-driven departmental workspaces, leadership oversight, and sub-department hierarchies."
        badge={`${departments.filter(d => !d.is_archived && d.status !== 'archived').length} Active`}
        badgeVariant="success"
        action={
          canManage ? {
            label: '+ Add Department',
            icon: Plus,
            onClick: openCreateWizard,
            variant: 'primary',
          } : undefined
        }
      />

      {/* Metrics Strip */}
      <MetricStrip
        items={[
          { label: 'Active Workspaces', value: departments.filter(d => !d.is_archived && d.status !== 'archived').length, color: 'blue' },
          { label: 'Total Assigned Members', value: departments.reduce((acc, d) => acc + (d.member_count || 0), 0), color: 'emerald' },
          { label: 'Configured Capabilities', value: departments.reduce((acc, d) => acc + (d.capabilities_count || 0), 0), color: 'amber' },
          { label: 'Archived Departments', value: departments.filter(d => d.is_archived || d.status === 'archived').length, color: 'rose' },
        ]}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-surface-1 border border-border-subtle p-3 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search departments, heads, goals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex bg-surface-2 p-1 rounded-lg border border-border-subtle text-xs w-full sm:w-auto">
            {(['active', 'archived', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors flex-1 sm:flex-initial ${
                  statusFilter === tab
                    ? 'bg-surface-1 text-text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Hierarchy Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={parentFilter}
              onChange={e => setParentFilter(e.target.value)}
              className="w-full sm:w-auto bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Structures</option>
              <option value="top_level">Top-Level Departments Only</option>
              <option value="sub_departments">Sub-Departments Only</option>
              {departments.filter(d => !d.parent_department_id).map(p => (
                <option key={p.id} value={p.id}>Child of: {p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggle & Refresh */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <div className="flex bg-surface-2 p-1 rounded-lg border border-border-subtle text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-surface-1 text-text-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-surface-1 text-text-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => fetchDepartments()}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors border border-border-subtle"
            title="Refresh departments"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Departments View */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow count={4} />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? 'No matching departments' : 'No departments configured'}
          description={
            search
              ? 'Try adjusting your search criteria or clear your filters.'
              : 'Create your organization\'s first department using the 6-step capability wizard.'
          }
          action={
            canManage && !search ? {
              label: '+ Add Department',
              onClick: openCreateWizard,
            } : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        /* ── GRID CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDepartments.map(dept => {
            const isArchived = dept.is_archived || dept.status === 'archived';

            return (
              <motion.div
                key={dept.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-surface-1 border ${
                  isArchived ? 'border-border-subtle opacity-75' : 'border-border-subtle hover:border-border-strong'
                } rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between group relative overflow-hidden`}
              >
                {/* Accent Top Border */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: dept.color || '#FF6B4A' }}
                />

                <div className="space-y-3">
                  {/* Top Bar: Title, Parent Department & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dept.color || '#FF6B4A' }}
                        />
                        <h3 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                          {dept.name}
                        </h3>
                      </div>
                      {dept.parent_department && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                          <GitFork className="w-3 h-3 text-text-muted" />
                          <span>Sub-department of <strong className="text-text-primary">{dept.parent_department.name}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isArchived ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Archived
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-muted line-clamp-2 min-h-[32px]">
                    {dept.description || 'Custom capability-driven department workspace.'}
                  </p>

                  {/* Objectives Preview */}
                  {Array.isArray(dept.objectives) && dept.objectives.length > 0 && (
                    <div className="bg-surface-2 p-2.5 rounded-lg border border-border-subtle space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider">
                        <Target className="w-3 h-3 text-accent" />
                        <span>Core Objectives ({dept.objectives.length})</span>
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        • {dept.objectives[0]}
                      </div>
                    </div>
                  )}

                  {/* Active Capabilities Badge Strip */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-text-muted">
                      {dept.capabilities_count || 0} Capabilities:
                    </span>
                    {(dept.active_capabilities || []).slice(0, 3).map(capKey => {
                      const cap = ALL_CAPABILITIES_MAP.get(capKey);
                      return cap ? (
                        <span
                          key={capKey}
                          className="px-2 py-0.5 text-[10px] bg-surface-2 text-text-primary rounded border border-border-subtle truncate max-w-[120px]"
                        >
                          {cap.name}
                        </span>
                      ) : null;
                    })}
                    {(dept.active_capabilities || []).length > 3 && (
                      <span className="text-[10px] text-text-muted font-medium">
                        +{(dept.active_capabilities || []).length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Details & Navigation */}
                <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Users className="w-3.5 h-3.5" />
                    <span>{dept.member_count || 0} members</span>
                    {dept.head_user && (
                      <span className="truncate max-w-[120px] text-text-primary" title={dept.head_user.full_name}>
                        • Head: {dept.head_user.full_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEditWizard(dept)}
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
                          title="Edit Department"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isArchived && (
                          <button
                            onClick={() => setArchiveDeptId(dept.id)}
                            className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                            title="Archive Department"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}

                    <Link
                      to={`/departments/${dept.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent font-medium text-xs rounded-lg transition-colors ml-1"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* ── PROFESSIONAL TABLE LIST VIEW ── */
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-text-muted uppercase tracking-wider font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Structure</th>
                  <th className="py-3 px-4">Department Head</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Capabilities</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredDepartments.map(dept => {
                  const isArchived = dept.is_archived || dept.status === 'archived';
                  return (
                    <tr key={dept.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color || '#FF6B4A' }} />
                          <div>
                            <div className="font-semibold text-text-primary text-sm">{dept.name}</div>
                            <div className="text-[11px] text-text-muted line-clamp-1">{dept.description || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        {dept.parent_department ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-surface-2 text-text-primary border border-border-subtle">
                            <GitFork className="w-3 h-3" /> {dept.parent_department.name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-muted">Top-Level</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {dept.head_user ? (
                          <div className="font-medium text-text-primary">{dept.head_user.full_name}</div>
                        ) : (
                          <span className="text-text-muted italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-text-primary">
                        {dept.member_count || 0}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          <span className="font-bold text-accent font-mono text-[11px]">{dept.capabilities_count || 0} active</span>
                          {(dept.active_capabilities || []).slice(0, 2).map(ck => {
                            const c = ALL_CAPABILITIES_MAP.get(ck);
                            return c ? (
                              <span key={ck} className="px-1.5 py-0.5 text-[10px] rounded bg-surface-2 text-text-muted border border-border-subtle">
                                {c.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isArchived ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Archived
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEditWizard(dept)}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
                                title="Edit Department"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isArchived && (
                                <button
                                  onClick={() => setArchiveDeptId(dept.id)}
                                  className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                  title="Archive Department"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                          <Link
                            to={`/departments/${dept.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent font-medium rounded-lg transition-colors text-xs ml-1"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6-STEP CREATION & CONFIGURATION WIZARD MODAL ── */}
      <AnimatePresence>
        {isWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-1 border border-border-strong rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Wizard Modal Header */}
              <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-2">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <span>{editingDept ? `Edit Department: ${editingDept.name}` : 'Add New Department'}</span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Step {wizardStep} of 6 — {
                      wizardStep === 1 ? 'Department Details' :
                      wizardStep === 2 ? 'Responsibilities & Expected Outcomes' :
                      wizardStep === 3 ? 'Functional Capability Selection' :
                      wizardStep === 4 ? 'Workspace Modules Preview' :
                      wizardStep === 5 ? 'Member & Role Assignments' :
                      'Confirmation & Activation'
                    }
                  </p>
                </div>

                <button
                  onClick={() => setIsWizardOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-3 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wizard Steps Progress Indicator */}
              <div className="grid grid-cols-6 border-b border-border-subtle bg-surface-1 text-center text-xs">
                {[
                  { step: 1, label: 'Identity' },
                  { step: 2, label: 'Responsibilities' },
                  { step: 3, label: 'Capabilities' },
                  { step: 4, label: 'Preview' },
                  { step: 5, label: 'Members' },
                  { step: 6, label: 'Review' },
                ].map(item => (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step < wizardStep) setWizardStep(item.step as any);
                    }}
                    disabled={item.step > wizardStep}
                    className={`py-2.5 font-medium border-b-2 transition-colors ${
                      wizardStep === item.step
                        ? 'border-accent text-accent bg-accent/5'
                        : wizardStep > item.step
                        ? 'border-emerald-500 text-emerald-400 cursor-pointer hover:bg-surface-2'
                        : 'border-transparent text-text-muted opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span className="hidden sm:inline">{item.step}. </span>{item.label}
                  </button>
                ))}
              </div>

              {/* Wizard Body (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* STEP 1: Department Information */}
                {wizardStep === 1 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                        Department Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Finance & Treasury, Software Development, Growth & Marketing, Operations"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        autoFocus
                      />
                      <p className="text-[11px] text-text-muted mt-1">
                        Isolated to your organization. Multiple organizations can safely create identical department names.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                        Description & Mission
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brief overview of what this department accomplishes and its core mission..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    {/* Color Picker & MNC Parent Department */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                          Accent Color
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {DEPT_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setColor(c)}
                              className={`w-7 h-7 rounded-full transition-transform ${
                                color === c ? 'scale-125 ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                          Optional Parent Department (Sub-Departments)
                        </label>
                        <select
                          value={parentDeptId}
                          onChange={e => setParentDeptId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                          <option value="">None (Top-Level Department)</option>
                          {departments
                            .filter(d => !editingDept || d.id !== editingDept.id)
                            .map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Responsibilities & Operational Scope */}
                {wizardStep === 2 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Key Responsibilities
                        </label>
                        <span className="text-[11px] text-text-muted">Select or add custom tags</span>
                      </div>

                      {/* Smart Suggestions */}
                      {suggestedResponsibilities.length > 0 && (
                        <div className="mb-2.5 p-2.5 bg-surface-2 rounded-xl border border-border-subtle">
                          <span className="text-[10px] uppercase font-bold text-accent tracking-wider block mb-1.5">
                            Suggested for {name || 'Department'}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {suggestedResponsibilities.map((sug, i) => {
                              const alreadyAdded = responsibilities.includes(sug);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleAddResponsibility(sug)}
                                  disabled={alreadyAdded}
                                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                                    alreadyAdded
                                      ? 'bg-surface-3 text-text-muted border-border-subtle cursor-default opacity-60'
                                      : 'bg-surface-1 hover:bg-accent/10 border-border-subtle hover:border-accent text-text-primary'
                                  }`}
                                >
                                  <span>{alreadyAdded ? '✓' : '+'}</span>
                                  <span>{sug}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Code reviews, Sprint velocity planning, Release deployments"
                          value={respInput}
                          onChange={e => setRespInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddResponsibility(); }}}
                          className="flex-1 px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddResponsibility()}
                          className="px-4 py-2 bg-surface-3 hover:bg-surface-2 border border-border-subtle text-text-primary text-xs font-semibold rounded-xl"
                        >
                          Add Tag
                        </button>
                      </div>

                      {responsibilities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {responsibilities.map((resp, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary"
                            >
                              <span>{resp}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveResponsibility(i)}
                                className="text-text-muted hover:text-rose-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Department Strategic Objectives */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Strategic Objectives & Targets
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Deliver Q4 enterprise security certification"
                          value={objectiveInput}
                          onChange={e => setObjectiveInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddObjective(); }}}
                          className="flex-1 px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <button
                          type="button"
                          onClick={handleAddObjective}
                          className="px-4 py-2 bg-surface-3 hover:bg-surface-2 border border-border-subtle text-text-primary text-xs font-semibold rounded-xl"
                        >
                          Add Goal
                        </button>
                      </div>

                      {objectives.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {objectives.map((obj, i) => (
                            <div key={i} className="flex items-center justify-between bg-surface-2 px-3 py-1.5 rounded-lg border border-border-subtle text-xs">
                              <span className="text-text-primary truncate">• {obj}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveObjective(i)}
                                className="text-text-muted hover:text-rose-400 ml-2"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                        Expected Business Outcomes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="What specific measurable results or milestones should this department deliver?"
                        value={expectedOutcomes}
                        onChange={e => setExpectedOutcomes(e.target.value)}
                        className="w-full px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                        Operational Requirements & Dependencies
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Specific access controls, tool licenses, compliance certifications or approvals needed..."
                        value={operationalRequirements}
                        onChange={e => setOperationalRequirements(e.target.value)}
                        className="w-full px-4 py-2 bg-surface-2 border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: Functional Capability Selection */}
                {wizardStep === 3 && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Recommendation Banner */}
                    {recommendedCapabilities.length > 0 && (
                      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                          <div className="text-xs text-text-primary">
                            <strong>{recommendedCapabilities.length} capabilities</strong> recommended based on your department scope.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyRecommendedCapabilities}
                          className="px-3 py-1 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors whitespace-nowrap shadow-xs"
                        >
                          Select Recommended
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type="text"
                          placeholder="Search capabilities..."
                          value={capabilitySearch}
                          onChange={e => setCapabilitySearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">Domain:</span>
                        <select
                          value={selectedDomainFilter}
                          onChange={e => setSelectedDomainFilter(e.target.value)}
                          className="bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary"
                        >
                          <option value="all">All 13 Domains</option>
                          {CAPABILITY_DOMAINS.map(d => (
                            <option key={d.category} value={d.category}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-xs text-text-muted">
                      Selected: <strong className="text-accent">{selectedCapabilityKeys.length} capabilities</strong> across domains.
                      Capabilities dynamically determine which operational modules and workflows are activated.
                    </div>

                    {/* Domain Capability Cards */}
                    <div className="space-y-5 max-h-[440px] overflow-y-auto pr-1">
                      {filteredCapabilityDomains.map(domain => (
                        <div key={domain.category} className="bg-surface-2/40 border border-border-subtle rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <span>{domain.label}</span>
                              </h4>
                              <p className="text-[11px] text-text-muted mt-0.5">{domain.description}</p>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-surface-3 text-text-muted">
                              {domain.category}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {domain.capabilities.map(cap => {
                              const isSelected = selectedCapabilityKeys.includes(cap.key);
                              return (
                                <button
                                  key={cap.key}
                                  type="button"
                                  onClick={() => handleToggleCapability(cap.key)}
                                  className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                                    isSelected
                                      ? 'bg-accent/10 border-accent text-text-primary shadow-xs ring-1 ring-accent'
                                      : 'bg-surface-1 border-border-subtle hover:border-border-strong text-text-muted hover:text-text-primary'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-text-primary">{cap.name}</span>
                                      {isSelected && <CheckCircle2 className="w-4 h-4 text-accent" />}
                                    </div>
                                    <p className="text-[11px] text-text-muted line-clamp-2">{cap.description}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 4: Workspace Modules Configuration & Live Preview */}
                {wizardStep === 4 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Compass className="w-5 h-5 text-accent" />
                          <h4 className="text-sm font-semibold text-text-primary">Workspace Architecture Preview</h4>
                        </div>
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/20">
                          {previewDomain.type}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1.5">
                        {previewDomain.desc}
                      </p>
                    </div>

                    {/* Simulated Workspace Header Preview */}
                    <div className="p-4 bg-surface-1 border border-border-subtle rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-base font-bold text-text-primary">{name || 'Department'}</span>
                          <span className="text-[11px] text-text-muted">· {selectedCapabilityKeys.length} Capabilities</span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          Live Preview
                        </span>
                      </div>

                      {/* Simulated Navigation Bar */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-border-subtle">
                        <span className="px-3 py-1.5 rounded-lg bg-surface-2 text-text-primary font-semibold border-b-2 border-accent">
                          Overview
                        </span>
                        {previewDomain.type.includes('Finance') && (
                          <>
                            <span className="px-3 py-1.5 text-text-muted">Budgets</span>
                            <span className="px-3 py-1.5 text-text-muted">Expenses</span>
                            <span className="px-3 py-1.5 text-text-muted">Invoices</span>
                            <span className="px-3 py-1.5 text-text-muted">Payables</span>
                          </>
                        )}
                        {previewDomain.type.includes('Engineering') && (
                          <>
                            <span className="px-3 py-1.5 text-text-muted">Sprints</span>
                            <span className="px-3 py-1.5 text-text-muted">Bug Tracker</span>
                            <span className="px-3 py-1.5 text-text-muted">Epics & Projects</span>
                            <span className="px-3 py-1.5 text-text-muted">QA & Releases</span>
                          </>
                        )}
                        {previewDomain.type.includes('Sales') && (
                          <>
                            <span className="px-3 py-1.5 text-text-muted">Deal Pipeline</span>
                            <span className="px-3 py-1.5 text-text-muted">Leads</span>
                            <span className="px-3 py-1.5 text-text-muted">Campaigns</span>
                          </>
                        )}
                        {previewDomain.type.includes('Human Resources') && (
                          <>
                            <span className="px-3 py-1.5 text-text-muted">Recruitment ATS</span>
                            <span className="px-3 py-1.5 text-text-muted">Leave Approvals</span>
                            <span className="px-3 py-1.5 text-text-muted">Performance</span>
                          </>
                        )}
                        {previewDomain.type.includes('Operations') && (
                          <>
                            <span className="px-3 py-1.5 text-text-muted">SOPs & Runbooks</span>
                            <span className="px-3 py-1.5 text-text-muted">Vendors</span>
                            <span className="px-3 py-1.5 text-text-muted">Procurement</span>
                            <span className="px-3 py-1.5 text-text-muted">Assets</span>
                          </>
                        )}
                        <span className="px-3 py-1.5 text-text-muted">Members</span>
                        <span className="px-3 py-1.5 text-text-muted">Settings</span>
                      </div>
                    </div>

                    {/* Operational Modules Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Provisioned Operational Tools ({activePreviewModules.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                          <span>Adjust Capabilities</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {activePreviewModules.length === 0 ? (
                        <div className="p-8 text-center text-text-muted text-xs border border-dashed border-border-subtle rounded-xl">
                          No capabilities selected. Return to Step 3 to enable functional tools.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                          {activePreviewModules.map(mod => (
                            <div
                              key={mod.id}
                              className="bg-surface-2 border border-border-subtle rounded-xl p-3.5 flex items-start gap-3"
                            >
                              <div className="p-2 rounded-lg bg-surface-3 text-accent flex-shrink-0">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs font-semibold text-text-primary">{mod.name}</h5>
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-1 text-text-muted">
                                    {mod.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-text-muted mt-0.5">{mod.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: Member Assignment */}
                {wizardStep === 5 && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-text-primary">Assign Organization Members</h4>
                        <p className="text-xs text-text-muted">Designate Department Head, Managers, and assigned Team Members.</p>
                      </div>

                      <div className="w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          className="w-full px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-xs text-text-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {orgMembers
                        .filter(m => !memberSearch || m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase()))
                        .map(mem => {
                          const assignment = assignedMembers.find(a => a.user_id === mem.id);
                          const isAssigned = !!assignment;

                          return (
                            <div
                              key={mem.id}
                              className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                                isAssigned
                                  ? 'bg-surface-2 border-accent/40'
                                  : 'bg-surface-1 border-border-subtle hover:border-border-strong'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => handleToggleMember(mem.id)}
                                  className="w-4 h-4 rounded text-accent bg-surface-3 border-border-subtle focus:ring-accent"
                                />
                                <div>
                                  <div className="text-xs font-semibold text-text-primary">{mem.full_name || 'Member'}</div>
                                  <div className="text-[11px] text-text-muted">{mem.email}</div>
                                </div>
                              </div>

                              {isAssigned && (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={assignment.role}
                                    onChange={e => handleUpdateMemberRole(mem.id, e.target.value as any)}
                                    className="bg-surface-3 border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary"
                                  >
                                    <option value="member">Department Member</option>
                                    <option value="manager">Department Manager</option>
                                    <option value="head">Department Head</option>
                                  </select>

                                  {assignment.role === 'head' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent">
                                      Head
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* STEP 6: Confirmation & Activation */}
                {wizardStep === 6 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
                          <h4 className="text-base font-bold text-text-primary">{name || 'Unnamed Department'}</h4>
                        </div>
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Ready for Activation
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{description || 'No description provided.'}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
                        <span className="text-[11px] text-text-muted uppercase tracking-wider block">Workspace Type</span>
                        <strong className="text-xs font-bold text-accent">{previewDomain.type}</strong>
                      </div>
                      <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
                        <span className="text-[11px] text-text-muted uppercase tracking-wider block">Objectives</span>
                        <strong className="text-sm text-text-primary">{objectives.length} targets</strong>
                      </div>
                      <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
                        <span className="text-[11px] text-text-muted uppercase tracking-wider block">Capabilities</span>
                        <strong className="text-sm text-text-primary">{selectedCapabilityKeys.length} enabled</strong>
                      </div>
                      <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
                        <span className="text-[11px] text-text-muted uppercase tracking-wider block">Assigned Team</span>
                        <strong className="text-sm text-text-primary">{assignedMembers.length} members</strong>
                      </div>
                    </div>

                    {/* Scope Review */}
                    {responsibilities.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Responsibilities</span>
                        <div className="flex flex-wrap gap-1.5">
                          {responsibilities.map((r, i) => (
                            <span key={i} className="px-2.5 py-1 text-xs bg-surface-2 text-text-primary rounded-lg border border-border-subtle">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Capabilities List Summary */}
                    {selectedCapabilityKeys.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Configured Capabilities ({selectedCapabilityKeys.length})
                        </h5>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-surface-2 rounded-lg border border-border-subtle">
                          {selectedCapabilityKeys.map(key => {
                            const cap = ALL_CAPABILITIES_MAP.get(key);
                            return cap ? (
                              <span
                                key={key}
                                className="px-2.5 py-1 text-xs bg-surface-1 text-text-primary rounded-md border border-border-subtle"
                              >
                                {cap.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wizard Modal Footer (Navigation Controls) */}
              <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between bg-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1) setIsWizardOpen(false);
                    else setWizardStep((wizardStep - 1) as any);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-surface-3 rounded-xl transition-colors"
                >
                  {wizardStep === 1 ? 'Cancel' : 'Back'}
                </button>

                <div className="flex items-center gap-2">
                  {wizardStep < 6 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (wizardStep === 1 && !name.trim()) {
                          toast.error('Please enter a department name.');
                          return;
                        }
                        setWizardStep((wizardStep + 1) as any);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveDepartment}
                      className="inline-flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Activating Workspace...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{editingDept ? 'Save Changes' : 'Activate Workspace'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Safe Archiving */}
      <ConfirmModal
        isOpen={!!archiveDeptId}
        onCancel={() => setArchiveDeptId(null)}
        onConfirm={handleArchiveDepartment}
        title="Archive Department Workspace"
        message="Are you sure you want to archive this department? All historical projects, tasks, invoices, and documents will remain fully preserved in your organization records."
        confirmText="Archive Department"
        isDestructive={false}
      />
    </div>
  );
}
