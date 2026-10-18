import {
  WorkflowDefinition,
  WorkflowTriggerType,
  WorkflowActionType,
  ConditionOperator,
  WorkflowCategory,
} from './workflow.types.js';

export const ALLOWED_CATEGORIES: WorkflowCategory[] = [
  'project_task',
  'deadline_reminder',
  'team_notifications',
  'approval',
  'recurring_task',
  'project_status',
  'client_onboarding',
  'form_request',
  'webhook',
  'exception_escalation',
];

export const ALLOWED_TRIGGERS: WorkflowTriggerType[] = [
  'project_created',
  'project_updated',
  'project_status_changed',
  'task_created',
  'task_updated',
  'task_assigned',
  'task_completed',
  'task_overdue',
  'form_submitted',
  'approval_completed',
  'schedule_cron',
  'webhook_inbound',
];

export const ALLOWED_OPERATORS: ConditionOperator[] = [
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
];

export const ALLOWED_ACTIONS: WorkflowActionType[] = [
  'create_task',
  'update_task',
  'assign_task',
  'create_subtasks',
  'create_project',
  'update_project_status',
  'send_notification',
  'send_email',
  'create_approval_request',
  'send_webhook',
  'escalate_task',
];

export interface ValidationError {
  field: string;
  message: string;
}

export class WorkflowValidator {
  /**
   * SSRF Protection: checks whether a destination URL is safe to call.
   * Prohibits localhost, loopbacks, link-local, cloud metadata IP, and internal private IPs.
   */
  public static isSafeOutboundUrl(urlStr: string): { safe: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
      }

      const hostname = parsed.hostname.toLowerCase();
      // Block localhost, loopbacks, internal hostnames
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        return { safe: false, reason: 'Outbound webhooks to local/internal domains are prohibited.' };
      }

      // Check IPv4 addresses for private subnets
      // 127.0.0.0/8 (loopback)
      // 10.0.0.0/8 (private)
      // 172.16.0.0/12 (private)
      // 192.168.0.0/16 (private)
      // 169.254.0.0/16 (link-local, cloud metadata like 169.254.169.254)
      const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipMatch) {
        const oct1 = parseInt(ipMatch[1], 10);
        const oct2 = parseInt(ipMatch[2], 10);

        if (oct1 === 127) {
          return { safe: false, reason: 'Loopback IP addresses (127.0.0.0/8) are blocked.' };
        }
        if (oct1 === 10) {
          return { safe: false, reason: 'Private subnet (10.0.0.0/8) is blocked.' };
        }
        if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
          return { safe: false, reason: 'Private subnet (172.16.0.0/12) is blocked.' };
        }
        if (oct1 === 192 && oct2 === 168) {
          return { safe: false, reason: 'Private subnet (192.168.0.0/16) is blocked.' };
        }
        if (oct1 === 169 && oct2 === 254) {
          return { safe: false, reason: 'Link-local/Cloud metadata service (169.254.0.0/16) is strictly prohibited.' };
        }
        if (oct1 === 0) {
          return { safe: false, reason: 'Non-routable zero address is blocked.' };
        }
      }

      // Block IPv6 loopback
      if (hostname === '::1' || hostname === '[::1]') {
        return { safe: false, reason: 'IPv6 loopback is blocked.' };
      }

      return { safe: true };
    } catch {
      return { safe: false, reason: 'Invalid destination URL.' };
    }
  }

  /**
   * Validates a complete workflow definition prior to creation, update, or activation.
   */
  public static validate(def: Partial<WorkflowDefinition>): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // 1. Name validation
    if (!def.name || typeof def.name !== 'string' || !def.name.trim()) {
      errors.push({ field: 'name', message: 'Workflow name is required and cannot be empty.' });
    } else if (def.name.length > 255) {
      errors.push({ field: 'name', message: 'Workflow name cannot exceed 255 characters.' });
    }

    // 2. Account isolation validation
    if (!def.account_id) {
      errors.push({ field: 'account_id', message: 'Account ID is required to isolate workflow boundaries.' });
    }
    if (!def.account_type || !['freelancer', 'organization'].includes(def.account_type)) {
      errors.push({ field: 'account_type', message: 'Account type must be either "freelancer" or "organization".' });
    }

    // 3. Category validation
    if (def.category && !ALLOWED_CATEGORIES.includes(def.category)) {
      errors.push({ field: 'category', message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
    }

    // 4. Trigger validation
    if (!def.trigger_type || !ALLOWED_TRIGGERS.includes(def.trigger_type)) {
      errors.push({ field: 'trigger_type', message: `Invalid or missing trigger. Allowed: ${ALLOWED_TRIGGERS.join(', ')}` });
    }

    // Trigger config specific validation
    if (def.trigger_type === 'schedule_cron') {
      const cron = def.trigger_config?.cron || def.trigger_config?.schedule;
      if (!cron || typeof cron !== 'string') {
        errors.push({ field: 'trigger_config', message: 'Scheduled workflows require a valid cron expression or schedule definition.' });
      }
    }

    // 5. Conditions validation
    if (def.conditions && Array.isArray(def.conditions)) {
      def.conditions.forEach((cond, idx) => {
        if (!cond.field || typeof cond.field !== 'string') {
          errors.push({ field: `conditions[${idx}].field`, message: 'Condition must specify a valid target field.' });
        }
        if (!cond.operator || !ALLOWED_OPERATORS.includes(cond.operator)) {
          errors.push({ field: `conditions[${idx}].operator`, message: `Invalid operator. Allowed: ${ALLOWED_OPERATORS.join(', ')}` });
        }
        if (cond.logicalOperator && !['AND', 'OR'].includes(cond.logicalOperator)) {
          errors.push({ field: `conditions[${idx}].logicalOperator`, message: 'Logical operator must be "AND" or "OR".' });
        }
      });
    }

    // 6. Actions validation
    if (!def.actions || !Array.isArray(def.actions) || def.actions.length === 0) {
      errors.push({ field: 'actions', message: 'A workflow must contain at least one configured action.' });
    } else {
      def.actions.forEach((act, idx) => {
        if (!act.id) {
          errors.push({ field: `actions[${idx}].id`, message: 'Action requires a unique ID.' });
        }
        if (!act.type || !ALLOWED_ACTIONS.includes(act.type)) {
          errors.push({ field: `actions[${idx}].type`, message: `Invalid action type. Allowed: ${ALLOWED_ACTIONS.join(', ')}` });
        }

        // Action-specific validations
        const cfg = act.config || {};
        if (act.type === 'create_task') {
          if (!cfg.title && !cfg.titleTemplate) {
            errors.push({ field: `actions[${idx}].config.title`, message: 'Create task action requires a title or title template.' });
          }
        } else if (act.type === 'send_webhook') {
          if (!cfg.url) {
            errors.push({ field: `actions[${idx}].config.url`, message: 'Send webhook action requires a destination URL.' });
          } else {
            const ssrfCheck = this.isSafeOutboundUrl(cfg.url);
            if (!ssrfCheck.safe) {
              errors.push({ field: `actions[${idx}].config.url`, message: `Security violation: ${ssrfCheck.reason}` });
            }
          }
        } else if (act.type === 'create_approval_request') {
          if (!cfg.title) {
            errors.push({ field: `actions[${idx}].config.title`, message: 'Approval request requires a title.' });
          }
        }
      });
    }

    // 7. Cycle & Loop detection:
    // If trigger is task_updated and an action updates task without condition safeguards, flag warning or require guard
    if (def.trigger_type === 'task_updated' && def.actions?.some(a => a.type === 'update_task')) {
      if (!def.conditions || def.conditions.length === 0) {
        errors.push({
          field: 'actions',
          message: 'Potential infinite loop detected: "task_updated" triggers "update_task" without filtering conditions. Please add at least one condition to prevent cyclic execution.',
        });
      }
    }

    if (def.trigger_type === 'project_status_changed' && def.actions?.some(a => a.type === 'update_project_status')) {
      if (!def.conditions || def.conditions.length === 0) {
        errors.push({
          field: 'actions',
          message: 'Potential infinite loop detected: "project_status_changed" updates project status without conditions. Please add conditions to prevent indefinite chaining.',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitizes payload and error messages to strip API keys, secrets, or internal authorization tokens.
   */
  public static sanitizeLogData(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    const SENSITIVE_KEYS = [
      'authorization',
      'password',
      'secret',
      'key',
      'token',
      'api_key',
      'apiKey',
      'webhook_secret',
      'webhookSecret',
      'bearer',
      'cookie',
    ];

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeLogData(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lower.includes(sk))) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        sanitized[k] = this.sanitizeLogData(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}
