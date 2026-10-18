export interface WorkflowTemplateItem {
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value: any; logicalOperator: 'AND' | 'OR' }>;
  actions: Array<{ id: string; type: string; config: Record<string, any>; order: number }>;
  is_template: boolean;
  template_category: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateItem[] = [
  // ── Category A: Project and Task Automation ──
  {
    name: 'Auto-Assign Urgent Tasks to Lead',
    description: 'Automatically assign high-priority tasks to the technical lead and notify the project team.',
    category: 'project_task',
    status: 'draft',
    trigger_type: 'task_created',
    trigger_config: {},
    conditions: [
      { field: 'priority', operator: 'equals', value: 'urgent', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_assign_urgent',
        type: 'update_task',
        config: { priority: 'urgent' },
        order: 1,
      },
      {
        id: 'act_notify_lead',
        type: 'send_notification',
        config: {
          title: '🚨 Urgent Task Created: {{task.title}}',
          message: 'An urgent task requires immediate triaging and allocation.',
          type: 'urgent_task_alert',
        },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'project_task',
  },
  {
    name: 'Generate Project Kickoff Tasks',
    description: 'When a new project is created, automatically generate standard architectural and onboarding kickoff tasks.',
    category: 'project_task',
    status: 'draft',
    trigger_type: 'project_created',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'act_kickoff_1',
        type: 'create_task',
        config: {
          title: 'Initial Project Architecture & Scoping',
          description: 'Define technical stack, schema, and baseline delivery milestones.',
          priority: 'high',
        },
        order: 1,
      },
      {
        id: 'act_kickoff_2',
        type: 'create_task',
        config: {
          title: 'Stakeholder Kickoff & Requirement Sign-off',
          description: 'Align with client on deliverables and acceptance criteria.',
          priority: 'medium',
        },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'project_task',
  },

  // ── Category B: Deadline and Reminder Automation ──
  {
    name: 'Overdue Task Escalation Notice',
    description: 'Detect overdue tasks, escalate priority to urgent, and send an alert to the responsible owner.',
    category: 'deadline_reminder',
    status: 'draft',
    trigger_type: 'task_overdue',
    trigger_config: {},
    conditions: [
      { field: 'status', operator: 'not_equals', value: 'done', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_escalate',
        type: 'escalate_task',
        config: {},
        order: 1,
      },
      {
        id: 'act_alert_deadline',
        type: 'send_notification',
        config: {
          title: '⚠️ Task Overdue: {{task.title}}',
          message: 'This task has passed its scheduled deadline and has been escalated to urgent.',
          type: 'deadline_escalation',
        },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'deadline_reminder',
  },

  // ── Category C: Team Notifications ──
  {
    name: 'Blocked Task Alert to Project Manager',
    description: 'When a task status is changed to blocked, alert project managers immediately.',
    category: 'team_notifications',
    status: 'draft',
    trigger_type: 'task_updated',
    trigger_config: {},
    conditions: [
      { field: 'status', operator: 'equals', value: 'blocked', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_blocked_notice',
        type: 'send_notification',
        config: {
          title: '🛑 Task Blocked: {{task.title}}',
          message: 'A blocker has been reported. Review task blockers to unblock progress.',
          type: 'task_blocked',
        },
        order: 1,
      },
    ],
    is_template: true,
    template_category: 'team_notifications',
  },

  // ── Category D: Approval Workflows ──
  {
    name: 'Milestone Completion Approval Route',
    description: 'Require manager approval before a project milestone or high-value deliverable is marked finalized.',
    category: 'approval',
    status: 'draft',
    trigger_type: 'task_updated',
    trigger_config: {},
    conditions: [
      { field: 'status', operator: 'equals', value: 'in_review', logicalOperator: 'AND' },
      { field: 'priority', operator: 'equals', value: 'urgent', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_req_approval',
        type: 'create_approval_request',
        config: {
          title: 'Milestone Review Sign-off: {{task.title}}',
          description: 'Review deliverable criteria before finalizing milestone sign-off.',
          approverRole: 'owner',
        },
        order: 1,
      },
      {
        id: 'act_post_approval_complete',
        type: 'update_task',
        config: { status: 'done' },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'approval',
  },

  // ── Category E: Recurring Task Automation ──
  {
    name: 'Weekly Sprint Retrospective Schedule',
    description: 'Schedule a recurring weekly task for sprint review, team velocity measurement, and retro notes.',
    category: 'recurring_task',
    status: 'draft',
    trigger_type: 'schedule_cron',
    trigger_config: {
      cron: '0 10 * * 1', // Every Monday at 10:00 AM
      timezone: 'UTC',
    },
    conditions: [],
    actions: [
      {
        id: 'act_recurring_task',
        type: 'create_task',
        config: {
          title: 'Weekly Sprint Retrospective & Planning',
          description: 'Review milestone progress from previous cycle and assign upcoming sprint deliverables.',
          priority: 'medium',
        },
        order: 1,
      },
    ],
    is_template: true,
    template_category: 'recurring_task',
  },

  // ── Category F: Project Status Automation ──
  {
    name: 'Auto-Complete Project when Deliverables Finished',
    description: 'When project deliverables are verified and status is updated, mark project completed and notify stakeholders.',
    category: 'project_status',
    status: 'draft',
    trigger_type: 'project_status_changed',
    trigger_config: {},
    conditions: [
      { field: 'status', operator: 'equals', value: 'completed', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_notify_completed',
        type: 'send_notification',
        config: {
          title: '🎉 Project Successfully Completed: {{project.title}}',
          message: 'All deliverables have been verified. Final invoices and client sign-off can now be processed.',
          type: 'project_completed',
        },
        order: 1,
      },
    ],
    is_template: true,
    template_category: 'project_status',
  },

  // ── Category G: Client Onboarding ──
  {
    name: 'New Client Onboarding Checklist',
    description: 'Generate standardized client onboarding tasks and documentation requirements.',
    category: 'client_onboarding',
    status: 'draft',
    trigger_type: 'project_created',
    trigger_config: {},
    conditions: [
      { field: 'title', operator: 'contains', value: 'Onboarding', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_client_1',
        type: 'create_task',
        config: {
          title: 'Client Contract & NDA Verification',
          description: 'Confirm signed engagement terms and billing cycle preferences.',
          priority: 'high',
        },
        order: 1,
      },
      {
        id: 'act_client_2',
        type: 'create_task',
        config: {
          title: 'Access Provisioning & Shared Channel Setup',
          description: 'Invite client representatives to dedicated project communication room.',
          priority: 'medium',
        },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'client_onboarding',
  },

  // ── Category H: Form and Request Automation ──
  {
    name: 'Inbound Request to Triaged Task',
    description: 'Convert external client request submissions into categorized tasks and notify the project lead.',
    category: 'form_request',
    status: 'draft',
    trigger_type: 'form_submitted',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'act_form_task',
        type: 'create_task',
        config: {
          title: 'Inbound Request: {{form.subject}}',
          description: 'Client Request Details: {{form.details}}',
          priority: 'medium',
        },
        order: 1,
      },
      {
        id: 'act_form_ack',
        type: 'send_notification',
        config: {
          title: 'New Client Form Request Received',
          message: 'A new client request was submitted and logged to your active tasks.',
          type: 'form_received',
        },
        order: 2,
      },
    ],
    is_template: true,
    template_category: 'form_request',
  },

  // ── Category I: Webhook and Integration Automation ──
  {
    name: 'Outbound Webhook Delivery on Project Update',
    description: 'Securely broadcast project updates to external ERP, CI/CD, or client webhook endpoints with HMAC verification.',
    category: 'webhook',
    status: 'draft',
    trigger_type: 'project_updated',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        id: 'act_outbound_wh',
        type: 'send_webhook',
        config: {
          url: 'https://api.example.com/auvryn-webhook',
        },
        order: 1,
      },
    ],
    is_template: true,
    template_category: 'webhook',
  },

  // ── Category J: Exception and Escalation Automation ──
  {
    name: 'Failed Delivery Escalation Notice',
    description: 'When an automated delivery or task exception occurs, immediately notify organizational administrators.',
    category: 'exception_escalation',
    status: 'draft',
    trigger_type: 'task_updated',
    trigger_config: {},
    conditions: [
      { field: 'status', operator: 'equals', value: 'failed', logicalOperator: 'AND' },
    ],
    actions: [
      {
        id: 'act_esc_admin',
        type: 'send_notification',
        config: {
          title: '🚨 Exception Detected: {{task.title}}',
          message: 'A critical workflow or task execution failure occurred and requires inspection.',
          type: 'execution_exception',
        },
        order: 1,
      },
    ],
    is_template: true,
    template_category: 'exception_escalation',
  },
];
