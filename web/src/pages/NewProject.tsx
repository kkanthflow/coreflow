import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Save, Sparkles, Building2, Layers, Clock } from 'lucide-react';
import { PageHeader } from '../components/ui/ObsidianPrimitives';
import { toast } from '../components/ui/Toast';

const COVER_COLORS = [
  '#FF6B4A', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#22D3EE', '#FB923C'
];

interface DeptProjectConfig {
  project_types?: Array<{
    key: string;
    label: string;
    description?: string;
    default_stage?: string;
  }>;
  workflow_stages?: Array<{
    key: string;
    label: string;
    order?: number;
    color?: string;
  }>;
  custom_fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'date';
    required?: boolean;
    placeholder?: string;
  }>;
}

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, hasOrgOversight, assignedDepartmentId } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);
  const [dueDate, setDueDate] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);

  // Department-specific project configuration state
  const [projectType, setProjectType] = useState<string>('standard');
  const [workflowStage, setWorkflowStage] = useState<string>('planning');
  const [customMetadata, setCustomMetadata] = useState<Record<string, any>>({});

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<{
    message: string;
    upgradeUrl: string;
  } | null>(null);

  useEffect(() => {
    async function loadDepts() {
      if (!orgId) return;
      const { data } = await supabase
        .from('departments')
        .select('id, name, color, module_configurations')
        .eq('org_id', orgId);
      setDepartments(data || []);

      // If user has an assigned department and is not leadership, lock to their department
      if (!hasOrgOversight && assignedDepartmentId) {
        setDepartmentId(assignedDepartmentId);
      } else if (data && data.length > 0 && !departmentId) {
        setDepartmentId(data[0].id);
      }
    }
    loadDepts();
  }, [orgId, hasOrgOversight, assignedDepartmentId]);

  // Selected department & its specific project configuration
  const selectedDept = useMemo(() => {
    return departments.find(d => d.id === departmentId) || null;
  }, [departments, departmentId]);

  const deptConfig: DeptProjectConfig | null = useMemo(() => {
    return selectedDept?.module_configurations?.project_configuration || null;
  }, [selectedDept]);

  // Auto-update project types and workflow stages when selected department changes
  useEffect(() => {
    if (deptConfig?.project_types && deptConfig.project_types.length > 0) {
      const firstType = deptConfig.project_types[0];
      setProjectType(firstType.key);
      setWorkflowStage(firstType.default_stage || deptConfig.workflow_stages?.[0]?.key || 'planning');
    } else {
      setProjectType('standard');
      setWorkflowStage('planning');
    }
    setCustomMetadata({});
  }, [deptConfig]);

  const handleMetadataChange = (key: string, val: any) => {
    setCustomMetadata(prev => ({ ...prev, [key]: val }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);
    setErrorMsg(null);
    setQuotaError(null);
    try {
      // Use the atomic department project creator RPC
      const { data, error } = await supabase.rpc('create_department_project', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_priority: priority,
        p_cover_color: coverColor,
        p_status: 'active',
        p_due_date: dueDate ? new Date(dueDate).toISOString() : null,
        p_department_id: departmentId || null,
        p_org_id: orgId || null,
        p_project_type: projectType,
        p_workflow_stage: workflowStage,
        p_department_metadata: customMetadata,
      });

      if (error) throw error;

      const createdProj = data;
      if (createdProj?.id) {
        toast.success('Department project initialized successfully');
        navigate(`/projects/${createdProj.id}`);
      }
    } catch (e: any) {
      console.error('Failed to create project:', e);
      const msg = e.message || 'Failed to create project.';
      if (msg.includes('quota_exceeded')) {
        setQuotaError({
          message: msg.replace(/.*quota_exceeded:[^:]*:\s*/, ''),
          upgradeUrl: '/pricing',
        });
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      <PageHeader
        title={
          selectedDept
            ? `Initialize ${selectedDept.name} Workstream`
            : "Initialize New Project"
        }
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: 'New Workstream' }
        ]}
        description={
          selectedDept
            ? `Establish delivery goals, department-specific workflows, and team ownership for ${selectedDept.name}.`
            : "Establish goals, deliverable milestones, and team ownership."
        }
        actions={
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Cancel</span>
          </button>
        }
      />

      {quotaError && (
        <div className="max-w-2xl p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300">
          <div className="space-y-1">
            <div className="font-bold text-amber-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Active Project Quota Reached</span>
            </div>
            <p className="text-zinc-300">{quotaError.message}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/pricing')}
              className="px-3 py-1.5 rounded bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold transition-colors shadow-md"
            >
              Upgrade at /pricing →
            </button>
            <button
              onClick={() => setQuotaError(null)}
              className="px-2 py-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleCreate} className="max-w-2xl bg-card-bg border border-divider rounded-lg p-5 sm:p-6 space-y-5">
        {/* Department Selection (Locked for employees, selectable for leadership) */}
        {orgId && departments.length > 0 && (
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5 flex items-center gap-1.5">
              <Building2 size={12} className="text-muted" />
              <span>Assigned Department</span>
              {!hasOrgOversight && assignedDepartmentId && (
                <span className="text-[9px] text-accent normal-case font-normal">(Locked to your assigned workspace)</span>
              )}
            </label>
            {(!hasOrgOversight && assignedDepartmentId) ? (
              <div className="w-full bg-surface border border-divider rounded px-3.5 py-2 text-xs text-main flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: selectedDept?.color || '#FF6B4A' }} 
                />
                <span className="font-semibold">{selectedDept?.name || 'Department'}</span>
              </div>
            ) : (
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Project Title */}
        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Workstream Title <span className="text-[#FF6B4A]">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={
              selectedDept?.name?.toLowerCase().includes('software')
                ? "e.g. Next-Gen Mobile App Architecture Overhaul"
                : selectedDept?.name?.toLowerCase().includes('marketing')
                ? "e.g. Q4 Global Brand Awareness & Lead Generation Campaign"
                : selectedDept?.name?.toLowerCase().includes('finance')
                ? "e.g. Annual Fiscal Audit & Budget Allocation FY27"
                : "e.g. Strategic Operational Initiative"
            }
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Department-Specific Project Type */}
        {deptConfig?.project_types && deptConfig.project_types.length > 0 && (
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5 flex items-center gap-1.5">
              <Layers size={12} className="text-muted" />
              <span>Department Project Type</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {deptConfig.project_types.map(pt => (
                <div
                  key={pt.key}
                  onClick={() => {
                    setProjectType(pt.key);
                    if (pt.default_stage) setWorkflowStage(pt.default_stage);
                  }}
                  className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                    projectType === pt.key
                      ? 'border-accent bg-accent/10 text-main'
                      : 'border-divider bg-surface hover:border-divider/80 text-muted'
                  }`}
                >
                  <div className="font-semibold text-main">{pt.label}</div>
                  {pt.description && (
                    <div className="text-[10px] text-muted mt-0.5 line-clamp-1">{pt.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Department-Specific Workflow Stage */}
        {deptConfig?.workflow_stages && deptConfig.workflow_stages.length > 0 && (
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5 flex items-center gap-1.5">
              <Clock size={12} className="text-muted" />
              <span>Initial Workflow Stage</span>
            </label>
            <select
              value={workflowStage}
              onChange={e => setWorkflowStage(e.target.value)}
              className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors capitalize"
            >
              {deptConfig.workflow_stages.map(st => (
                <option key={st.key} value={st.key}>{st.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Department-Specific Custom Fields */}
        {deptConfig?.custom_fields && deptConfig.custom_fields.length > 0 && (
          <div className="p-3.5 rounded-lg border border-divider bg-surface/50 space-y-3">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent" />
              <span>{selectedDept?.name} Operational Attributes</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {deptConfig.custom_fields.map(cf => (
                <div key={cf.key}>
                  <label className="text-[10px] font-mono uppercase text-muted block mb-1">
                    {cf.label} {cf.required && <span className="text-[#FF6B4A]">*</span>}
                  </label>
                  <input
                    type={cf.type || 'text'}
                    required={cf.required}
                    placeholder={cf.placeholder || `Enter ${cf.label.toLowerCase()}`}
                    value={customMetadata[cf.key] || ''}
                    onChange={e => handleMetadataChange(cf.key, e.target.value)}
                    className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-1.5 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scope & Specifications */}
        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Scope & Specifications
          </label>
          <textarea
            rows={3}
            placeholder="Technical goals, target deliverables, architecture requirements..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3.5 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
              Target Deadline
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
            Accent Trajectory Color
          </label>
          <div className="flex gap-2 flex-wrap pt-1">
            {COVER_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                className={`w-6 h-6 rounded-[2px] transition-all ${coverColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D12]' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-divider">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-hover hover:bg-hover text-muted text-xs font-medium rounded border border-divider transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm cursor-pointer"
          >
            <Save size={13} />
            <span>{saving ? 'Creating...' : 'Initialize Project'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
