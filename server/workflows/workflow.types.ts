export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export type WorkflowCategory =
  | 'project_task'
  | 'deadline_reminder'
  | 'team_notifications'
  | 'approval'
  | 'recurring_task'
  | 'project_status'
  | 'client_onboarding'
  | 'form_request'
  | 'webhook'
  | 'exception_escalation';

export type WorkflowTriggerType =
  | 'project_created'
  | 'project_updated'
  | 'project_status_changed'
  | 'task_created'
  | 'task_updated'
  | 'task_assigned'
  | 'task_completed'
  | 'task_overdue'
  | 'form_submitted'
  | 'approval_completed'
  | 'schedule_cron'
  | 'webhook_inbound';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty';

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export type WorkflowActionType =
  | 'create_task'
  | 'update_task'
  | 'assign_task'
  | 'create_subtasks'
  | 'create_project'
  | 'update_project_status'
  | 'send_notification'
  | 'send_email'
  | 'create_approval_request'
  | 'send_webhook'
  | 'escalate_task';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: Record<string, any>;
  order: number;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  account_id: string;
  account_type: 'freelancer' | 'organization';
  created_by?: string;
  status: WorkflowStatus;
  category: WorkflowCategory;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, any>;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  webhook_secret?: string;
  is_template?: boolean;
  template_category?: string;
  version?: number;
  last_executed_at?: string | null;
  execution_count?: number;
  failure_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export interface ActionAttemptResult {
  actionId: string;
  type: WorkflowActionType;
  status: 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  output?: Record<string, any>;
  error?: string;
}

export interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  account_id: string;
  account_type: 'freelancer' | 'organization';
  triggered_by_user_id?: string | null;
  trigger_type: WorkflowTriggerType;
  event_reference: Record<string, any>;
  status: ExecutionStatus;
  actions_attempted: ActionAttemptResult[];
  error_message?: string | null;
  error_code?: string | null;
  retry_count: number;
  max_retries: number;
  idempotency_key?: string;
  execution_depth: number;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface WorkflowApprovalRecord {
  id: string;
  workflow_id: string;
  execution_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by?: string;
  assigned_approver_id?: string;
  approver_role?: string;
  decision_by?: string;
  decision_notes?: string;
  decided_at?: string;
  resume_action_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEvent {
  triggerType: WorkflowTriggerType;
  accountId: string;
  accountType: 'freelancer' | 'organization';
  userId?: string;
  data: Record<string, any>;
  idempotencyKey?: string;
  executionDepth?: number;
}
