import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  Sliders,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';

interface ConditionItem {
  field: string;
  operator: string;
  value: any;
  logicalOperator: 'AND' | 'OR';
}

interface ActionItem {
  id: string;
  type: string;
  config: Record<string, any>;
  order: number;
}

const TRIGGER_OPTIONS = [
  { value: 'task_created', label: 'Task Created', desc: 'Runs whenever a new task is created' },
  { value: 'task_updated', label: 'Task Updated', desc: 'Runs whenever task status, priority or fields change' },
  { value: 'task_assigned', label: 'Task Assigned', desc: 'Runs when a task is assigned to a team member' },
  { value: 'task_completed', label: 'Task Completed', desc: 'Runs when a task is marked done or completed' },
  { value: 'task_overdue', label: 'Task Overdue', desc: 'Runs when a task passes its due date without completion' },
  { value: 'project_created', label: 'Project Created', desc: 'Runs when a new project is created' },
  { value: 'project_status_changed', label: 'Project Status Changed', desc: 'Runs when a project status changes' },
  { value: 'form_submitted', label: 'Form Submitted', desc: 'Runs when an intake request form is received' },
  { value: 'approval_completed', label: 'Approval Completed', desc: 'Runs when an approval request is approved' },
  { value: 'schedule_cron', label: 'Scheduled Time Reached', desc: 'Runs on a configured recurring time schedule' },
  { value: 'webhook_inbound', label: 'Authenticated Webhook', desc: 'Runs when an external authenticated webhook POSTs' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const ACTION_OPTIONS = [
  { value: 'create_task', label: 'Create Task', desc: 'Automatically generate a new task' },
  { value: 'update_task', label: 'Update Task', desc: 'Update status, priority or attributes' },
  { value: 'assign_task', label: 'Assign Task', desc: 'Route task to a designated team member' },
  { value: 'create_subtasks', label: 'Create Subtasks', desc: 'Generate multiple subtasks from checklist' },
  { value: 'create_project', label: 'Create Project', desc: 'Provision a new project from template' },
  { value: 'update_project_status', label: 'Update Project Status', desc: 'Advance or update project milestone status' },
  { value: 'send_notification', label: 'Send Notification', desc: 'Dispatch in-app and push notification' },
  { value: 'send_email', label: 'Send Email', desc: 'Dispatch notification email to recipient' },
  { value: 'create_approval_request', label: 'Request Approval', desc: 'Pause pipeline until manager signs off' },
  { value: 'send_webhook', label: 'Send Outbound Webhook', desc: 'Securely post JSON payload to external endpoint' },
  { value: 'escalate_task', label: 'Escalate Task', desc: 'Escalate task priority to urgent and alert owner' },
];

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const { orgId } = useWorkspace();

  const isEditing = Boolean(id);
  const templatePreset = (location.state as any)?.template;

  // Workflow Core State
  const [name, setName] = useState(templatePreset?.name || '');
  const [description, setDescription] = useState(templatePreset?.description || '');
  const [category, setCategory] = useState(templatePreset?.category || 'project_task');
  const [status, setStatus] = useState<'draft' | 'active' | 'paused'>(templatePreset?.status || 'active');

  // Step 1: Trigger
  const [triggerType, setTriggerType] = useState(templatePreset?.trigger_type || 'task_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(templatePreset?.trigger_config || {});

  // Step 2: Conditions
  const [conditions, setConditions] = useState<ConditionItem[]>(templatePreset?.conditions || []);

  // Step 3: Actions
  const [actions, setActions] = useState<ActionItem[]>(() => {
    if (templatePreset?.actions) {
      return templatePreset.actions.map((a: any, idx: number) => ({
        ...a,
        id: a.id || `act_${Date.now()}_${idx}`,
        order: a.order || idx + 1,
      }));
    }
    return [
      {
        id: `act_${Date.now()}_1`,
        type: 'send_notification',
        config: { title: 'Workflow Executed: {{task.title}}', message: 'Action successfully processed.' },
        order: 1,
      },
    ];
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<'trigger' | 'conditions' | 'actions' | 'preview'>('trigger');

  const apiUrl = '/api';

  // Load existing workflow if editing
  useEffect(() => {
    if (!id) return;
    const loadExisting = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;

        const res = await fetch(`${apiUrl}/workflows/${id}${orgId ? `?orgId=${orgId}` : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(orgId ? { 'x-organization-id': orgId } : {}),
          },
        });

        if (!res.ok) throw new Error('Failed to load workflow.');
        const json = await res.json();
        const wf = json.workflow;

        setName(wf.name);
        setDescription(wf.description || '');
        setCategory(wf.category || 'project_task');
        setStatus(wf.status || 'draft');
        setTriggerType(wf.trigger_type);
        setTriggerConfig(wf.trigger_config || {});
        setConditions(wf.conditions || []);
        setActions(wf.actions || []);
      } catch (err: any) {
        setErrors([err.message || 'Error loading workflow.']);
      } finally {
        setLoading(false);
      }
    };

    loadExisting();
  }, [id, apiUrl, orgId]);

  // Add condition
  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: 'priority', operator: 'equals', value: 'urgent', logicalOperator: 'AND' },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  // Add action
  const handleAddAction = () => {
    const nextOrder = actions.length + 1;
    setActions((prev) => [
      ...prev,
      {
        id: `act_${Date.now()}_${nextOrder}`,
        type: 'create_task',
        config: { title: 'New Automated Task', priority: 'medium' },
        order: nextOrder,
      },
    ]);
  };

  const handleRemoveAction = (actionId: string) => {
    setActions((prev) => prev.filter((a) => a.id !== actionId));
  };

  // Live client-side validation
  const validatePipeline = (): string[] => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Workflow Name is required.');
    if (!triggerType) errs.push('A trigger event must be selected.');
    if (actions.length === 0) errs.push('At least one action is required.');

    actions.forEach((a, idx) => {
      if (a.type === 'create_task' && !a.config.title) {
        errs.push(`Action #${idx + 1} (Create Task): Task title is required.`);
      }
      if (a.type === 'send_webhook' && !a.config.url) {
        errs.push(`Action #${idx + 1} (Send Webhook): Destination URL is required.`);
      }
    });

    return errs;
  };

  // Save workflow
  const handleSave = async (targetStatus?: 'draft' | 'active' | 'paused') => {
    const validationErrs = validatePipeline();
    if (validationErrs.length > 0) {
      setErrors(validationErrs);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        status: targetStatus || status,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions,
        actions: actions.map((a, idx) => ({ ...a, order: idx + 1 })),
        orgId: orgId || null,
      };

      const endpoint = isEditing ? `${apiUrl}/workflows/${id}` : `${apiUrl}/workflows`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(`${endpoint}${orgId ? `?orgId=${orgId}` : ''}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        if (resJson.errorCode === 'QUOTA_EXCEEDED_WORKFLOWS') {
          throw new Error(resJson.error);
        }
        if (resJson.errors && Array.isArray(resJson.errors)) {
          throw new Error(resJson.errors.map((e: any) => e.message).join(' | '));
        }
        throw new Error(resJson.error || 'Failed to save workflow.');
      }

      navigate('/workflows');
    } catch (err: any) {
      setErrors([err.message]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-muted">LOADING WORKFLOW DEFINITION...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-divider pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/workflows"
            className="p-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-main tracking-tight">
              {isEditing ? 'Edit Workflow Pipeline' : 'Visual Workflow Builder'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Configure deterministic triggers, filtering conditions, and automated actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-card-bg hover:bg-hover border border-divider text-xs font-semibold text-main transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave('active')}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,107,74,0.3)] flex items-center gap-2"
          >
            <Check size={14} />
            <span>{saving ? 'Saving...' : 'Save & Activate'}</span>
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {errors.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={15} />
            <span>Validation Checks Failed:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Workflow Metadata ── */}
      <div className="p-5 rounded-2xl bg-card-bg border border-divider space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-main">Workflow Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-Assign Urgent Tasks & Notify Owner"
              className="w-full bg-hover/50 border border-divider rounded-xl px-3.5 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-main">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-hover/50 border border-divider rounded-xl px-3.5 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]/50"
            >
              <option value="project_task">Project & Tasks</option>
              <option value="deadline_reminder">Deadlines & Escalations</option>
              <option value="team_notifications">Team Notifications</option>
              <option value="approval">Approval Workflows</option>
              <option value="recurring_task">Recurring Tasks</option>
              <option value="project_status">Project Status</option>
              <option value="client_onboarding">Client Onboarding</option>
              <option value="form_request">Form Requests</option>
              <option value="webhook">Webhook & Integration</option>
              <option value="exception_escalation">Exceptions & Escalations</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-main">Description (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this automation accomplishes..."
            className="w-full bg-hover/50 border border-divider rounded-xl px-3.5 py-2 text-xs text-main placeholder-muted focus:outline-none focus:border-[#FF6B4A]/50"
          />
        </div>
      </div>

      {/* ── Visual Pipeline Step Tabs ── */}
      <div className="flex items-center justify-between border-b border-divider pb-2">
        <div className="flex items-center gap-2">
          {(['trigger', 'conditions', 'actions', 'preview'] as const).map((stepKey, idx) => (
            <button
              key={stepKey}
              onClick={() => setActiveStep(stepKey)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 ${
                activeStep === stepKey
                  ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/30'
                  : 'text-muted hover:text-main hover:bg-hover'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-card-bg border border-divider flex items-center justify-center text-[10px] font-mono">
                {idx + 1}
              </span>
              <span>{stepKey}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── STEP 1: TRIGGER ── */}
      {activeStep === 'trigger' && (
        <div className="p-6 rounded-2xl bg-card-bg border border-divider space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-main">Step 1: Choose Trigger Event</h3>
            <p className="text-xs text-muted">What application event starts this automation?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {TRIGGER_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                onClick={() => setTriggerType(opt.value)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  triggerType === opt.value
                    ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] shadow-[0_0_15px_rgba(255,107,74,0.15)] ring-1 ring-[#FF6B4A]'
                    : 'bg-hover/40 border-divider hover:border-divider-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-main">{opt.label}</h4>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      triggerType === opt.value
                        ? 'border-[#FF6B4A] bg-[#FF6B4A] text-white'
                        : 'border-divider'
                    }`}
                  >
                    {triggerType === opt.value && <Check size={10} />}
                  </div>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">{opt.desc}</p>
              </div>
            ))}
          </div>

          {triggerType === 'schedule_cron' && (
            <div className="p-4 rounded-xl bg-hover/40 border border-divider space-y-2 mt-4">
              <label className="text-xs font-semibold text-main">Schedule Expression (Cron)</label>
              <input
                type="text"
                value={triggerConfig.cron || '0 9 * * 1'}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, cron: e.target.value })}
                placeholder="0 9 * * 1 (Every Monday at 9am)"
                className="w-full bg-card-bg border border-divider rounded-xl px-3 py-2 text-xs font-mono text-main"
              />
              <span className="text-[11px] text-muted">Format: minute hour day-of-month month day-of-week</span>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setActiveStep('conditions')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main hover:bg-hover/80 flex items-center gap-1.5"
            >
              <span>Next: Set Conditions</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: CONDITIONS ── */}
      {activeStep === 'conditions' && (
        <div className="p-6 rounded-2xl bg-card-bg border border-divider space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-main">Step 2: Filtering Conditions</h3>
              <p className="text-xs text-muted">Only run actions if these deterministic criteria match.</p>
            </div>
            <button
              onClick={handleAddCondition}
              className="px-3 py-1.5 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/30 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Add Condition</span>
            </button>
          </div>

          {conditions.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-hover/20 border border-dashed border-divider space-y-2">
              <Sliders size={20} className="text-muted mx-auto" />
              <p className="text-xs text-muted">No conditions set. This workflow will run for every trigger event.</p>
              <button
                onClick={handleAddCondition}
                className="text-xs text-[#FF6B4A] hover:underline font-semibold"
              >
                + Add a filter condition
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {conditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl bg-hover/40 border border-divider"
                >
                  <span className="w-6 h-6 rounded-full bg-card-bg border border-divider flex items-center justify-center text-[10px] font-mono text-muted shrink-0">
                    {idx + 1}
                  </span>

                  <input
                    type="text"
                    value={cond.field}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].field = e.target.value;
                      setConditions(updated);
                    }}
                    placeholder="field (e.g. priority, status, title)"
                    className="flex-1 bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                  />

                  <select
                    value={cond.operator}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].operator = e.target.value;
                      setConditions(updated);
                    }}
                    className="bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].value = e.target.value;
                      setConditions(updated);
                    }}
                    placeholder="target value (e.g. urgent, done)"
                    className="flex-1 bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                  />

                  <button
                    onClick={() => handleRemoveCondition(idx)}
                    className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-divider">
            <button
              onClick={() => setActiveStep('trigger')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main"
            >
              Back
            </button>
            <button
              onClick={() => setActiveStep('actions')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main flex items-center gap-1.5"
            >
              <span>Next: Configure Actions</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: ACTIONS ── */}
      {activeStep === 'actions' && (
        <div className="p-6 rounded-2xl bg-card-bg border border-divider space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-main">Step 3: Sequential Actions</h3>
              <p className="text-xs text-muted">Actions execute sequentially when trigger & conditions match.</p>
            </div>
            <button
              onClick={handleAddAction}
              className="px-3 py-1.5 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/30 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Add Action Step</span>
            </button>
          </div>

          <div className="space-y-3">
            {actions.map((act, idx) => (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-hover/40 border border-divider space-y-3"
              >
                <div className="flex items-center justify-between border-b border-divider/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-main">Action Step #{idx + 1}</span>
                  </div>
                  {actions.length > 1 && (
                    <button
                      onClick={() => handleRemoveAction(act.id)}
                      className="text-muted hover:text-red-400 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted">Action Type</label>
                    <select
                      value={act.type}
                      onChange={(e) => {
                        const updated = [...actions];
                        updated[idx].type = e.target.value;
                        setActions(updated);
                      }}
                      className="w-full bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                    >
                      {ACTION_OPTIONS.map((ao) => (
                        <option key={ao.value} value={ao.value}>
                          {ao.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Config based on action type */}
                  {act.type === 'create_task' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted">Task Title Template</label>
                      <input
                        type="text"
                        value={act.config.title || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].config.title = e.target.value;
                          setActions(updated);
                        }}
                        placeholder="e.g. Follow up on {{project.title}}"
                        className="w-full bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                      />
                    </div>
                  )}

                  {act.type === 'send_notification' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted">Notification Message</label>
                      <input
                        type="text"
                        value={act.config.message || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].config.message = e.target.value;
                          setActions(updated);
                        }}
                        placeholder="Notification body with {{task.title}} interpolation..."
                        className="w-full bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                      />
                    </div>
                  )}

                  {act.type === 'send_webhook' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted">Destination Webhook URL (SSRF Protected)</label>
                      <input
                        type="url"
                        value={act.config.url || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].config.url = e.target.value;
                          setActions(updated);
                        }}
                        placeholder="https://api.yourdomain.com/webhook"
                        className="w-full bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                      />
                    </div>
                  )}

                  {act.type === 'create_approval_request' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted">Approval Request Title</label>
                      <input
                        type="text"
                        value={act.config.title || ''}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].config.title = e.target.value;
                          setActions(updated);
                        }}
                        placeholder="e.g. Sign-off Required for Deliverables"
                        className="w-full bg-card-bg border border-divider rounded-lg px-2.5 py-1.5 text-xs text-main"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-divider">
            <button
              onClick={() => setActiveStep('conditions')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main"
            >
              Back
            </button>
            <button
              onClick={() => setActiveStep('preview')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main flex items-center gap-1.5"
            >
              <span>Next: Pipeline Preview</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: PREVIEW ── */}
      {activeStep === 'preview' && (
        <div className="p-6 rounded-2xl bg-card-bg border border-divider space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-main">Step 4: Pipeline Execution Preview</h3>
            <p className="text-xs text-muted">Review the end-to-end deterministic automation flow.</p>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-divider">
            {/* Stage 1: Trigger */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#FF6B4A] text-white flex items-center justify-center text-[10px] font-bold">
                1
              </div>
              <div className="p-4 rounded-xl bg-hover/40 border border-divider">
                <span className="text-[10px] font-mono font-bold text-[#FF6B4A] uppercase">Trigger</span>
                <h4 className="text-xs font-bold text-main mt-0.5">{triggerType.replace('_', ' ')}</h4>
              </div>
            </div>

            {/* Stage 2: Conditions */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                2
              </div>
              <div className="p-4 rounded-xl bg-hover/40 border border-divider">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Conditions</span>
                <p className="text-xs text-main mt-0.5">
                  {conditions.length === 0
                    ? 'Always execute (no filter restrictions)'
                    : `${conditions.length} condition criteria must match`}
                </p>
              </div>
            </div>

            {/* Stage 3: Actions */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                3
              </div>
              <div className="p-4 rounded-xl bg-hover/40 border border-divider space-y-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Actions Chain</span>
                <div className="space-y-1.5">
                  {actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-main font-mono">
                      <span className="text-muted">#{i + 1}</span>
                      <span>{a.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-divider">
            <button
              onClick={() => setActiveStep('actions')}
              className="px-4 py-2 rounded-xl bg-hover border border-divider text-xs font-semibold text-main"
            >
              Back
            </button>
            <button
              onClick={() => handleSave('active')}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-bold shadow-[0_0_20px_rgba(255,107,74,0.3)] transition-all flex items-center gap-2"
            >
              <Check size={14} />
              <span>{saving ? 'Activating...' : 'Confirm & Save Workflow'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
