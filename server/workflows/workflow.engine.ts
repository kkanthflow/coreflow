import crypto from 'crypto';
import { supabaseAdmin } from '../_core/supabase.js';
import {
  WorkflowDefinition,
  WorkflowExecutionRecord,
  WorkflowApprovalRecord,
  WorkflowCondition,
  WorkflowAction,
  WorkflowEvent,
  ActionAttemptResult,
} from './workflow.types.js';
import { WorkflowValidator } from './workflow.validator.js';
import { dispatchFCMPush } from '../_core/notification.js';
import { EmailService } from '../email/email.service';

export class WorkflowEngine {
  private static MAX_EXECUTION_DEPTH = 5;

  /**
   * Helper to extract a dotted field from an object (e.g. "task.status" or "priority")
   */
  public static resolveFieldValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Evaluates deterministic conditions against event context.
   */
  public static evaluateConditions(conditions: WorkflowCondition[], context: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    let overallResult = true;
    let currentLogical: 'AND' | 'OR' = 'AND';

    for (const cond of conditions) {
      const actualValue = this.resolveFieldValue(context, cond.field);
      const targetValue = cond.value;
      let matched = false;

      switch (cond.operator) {
        case 'equals':
          matched = String(actualValue ?? '').toLowerCase() === String(targetValue ?? '').toLowerCase();
          break;
        case 'not_equals':
          matched = String(actualValue ?? '').toLowerCase() !== String(targetValue ?? '').toLowerCase();
          break;
        case 'greater_than':
          matched = Number(actualValue) > Number(targetValue);
          break;
        case 'less_than':
          matched = Number(actualValue) < Number(targetValue);
          break;
        case 'contains':
          matched = String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());
          break;
        case 'not_contains':
          matched = !String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());
          break;
        case 'is_empty':
          matched = actualValue === null || actualValue === undefined || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);
          break;
        case 'is_not_empty':
          matched = actualValue !== null && actualValue !== undefined && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);
          break;
        default:
          matched = false;
      }

      if (currentLogical === 'AND') {
        overallResult = overallResult && matched;
      } else {
        overallResult = overallResult || matched;
      }

      currentLogical = cond.logicalOperator || 'AND';
    }

    return overallResult;
  }

  /**
   * Replaces template strings like {{task.title}} or {{project.name}} with context values.
   */
  public static interpolateString(str: string, context: Record<string, any>): string {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const val = this.resolveFieldValue(context, path.trim());
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  /**
   * Executes a single action step deterministically.
   */
  private static async executeAction(
    action: WorkflowAction,
    context: Record<string, any>,
    workflow: WorkflowDefinition,
    executionId: string
  ): Promise<{ status: 'completed' | 'failed' | 'skipped'; output?: any; error?: string }> {
    const cfg = action.config || {};

    try {
      switch (action.type) {
        case 'create_task': {
          const title = this.interpolateString(cfg.title || cfg.titleTemplate || 'Automated Task', context);
          const description = this.interpolateString(cfg.description || '', context);
          const projectId = cfg.projectId || context.project?.id || context.task?.project_id || null;
          const assigneeId = cfg.assigneeId || null;
          const priority = cfg.priority || 'medium';
          const status = cfg.status || 'todo';
          const orgId = workflow.account_type === 'organization' ? workflow.account_id : null;

          const { data: newTask, error: taskErr } = await supabaseAdmin
            .from('tasks')
            .insert({
              id: crypto.randomUUID(),
              title,
              description,
              project_id: projectId,
              org_id: orgId,
              assignee_id: assigneeId,
              priority,
              status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (taskErr) throw taskErr;
          return { status: 'completed', output: { taskId: newTask.id, title: newTask.title } };
        }

        case 'update_task': {
          const taskId = cfg.taskId || context.task?.id;
          if (!taskId) throw new Error('Task ID missing for update_task action');

          const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (cfg.status) updates.status = cfg.status;
          if (cfg.priority) updates.priority = cfg.priority;
          if (cfg.assigneeId) updates.assignee_id = cfg.assigneeId;

          const { error: updErr } = await supabaseAdmin
            .from('tasks')
            .update(updates)
            .eq('id', taskId);

          if (updErr) throw updErr;
          return { status: 'completed', output: { taskId, updates } };
        }

        case 'assign_task': {
          const taskId = cfg.taskId || context.task?.id;
          const assigneeId = cfg.assigneeId;
          if (!taskId || !assigneeId) throw new Error('TaskId and AssigneeId required for assign_task action');

          const { error: assignErr } = await supabaseAdmin
            .from('tasks')
            .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
            .eq('id', taskId);

          if (assignErr) throw assignErr;

          // Also trigger assignment notification
          await supabaseAdmin.from('notifications').insert({
            id: crypto.randomUUID(),
            user_id: assigneeId,
            title: 'Task Assigned',
            message: `You have been assigned to task: ${context.task?.title || 'New Task'}`,
            type: 'task_assigned',
            entity_type: 'task',
            entity_id: taskId,
            created_at: new Date().toISOString(),
          });

          return { status: 'completed', output: { taskId, assigneeId } };
        }

        case 'create_subtasks': {
          const subtasks = cfg.subtasks || [];
          const parentTaskId = cfg.parentTaskId || context.task?.id;
          const projectId = cfg.projectId || context.project?.id || context.task?.project_id || null;
          const orgId = workflow.account_type === 'organization' ? workflow.account_id : null;

          const createdSubtasks: string[] = [];
          for (const item of subtasks) {
            const itemTitle = this.interpolateString(item.title, context);
            const { data: st } = await supabaseAdmin.from('tasks').insert({
              id: crypto.randomUUID(),
              title: itemTitle,
              description: `Subtask of ${parentTaskId || 'parent'}: ${item.description || ''}`,
              project_id: projectId,
              org_id: orgId,
              priority: item.priority || 'medium',
              status: 'todo',
            }).select('id').single();

            if (st) createdSubtasks.push(st.id);
          }
          return { status: 'completed', output: { createdCount: createdSubtasks.length, subtaskIds: createdSubtasks } };
        }

        case 'create_project': {
          const title = this.interpolateString(cfg.title || 'Automated Project', context);
          const description = this.interpolateString(cfg.description || '', context);
          const orgId = workflow.account_type === 'organization' ? workflow.account_id : null;
          const ownerId = cfg.ownerId || context.userId || workflow.created_by;

          const { data: newProj, error: pErr } = await supabaseAdmin
            .from('projects')
            .insert({
              id: crypto.randomUUID(),
              title,
              description,
              org_id: orgId,
              owner_id: ownerId,
              status: cfg.status || 'active',
              priority: cfg.priority || 'medium',
              cover_color: cfg.coverColor || '#FF6B4A',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (pErr) throw pErr;
          return { status: 'completed', output: { projectId: newProj.id, title: newProj.title } };
        }

        case 'update_project_status': {
          const projectId = cfg.projectId || context.project?.id || context.task?.project_id;
          const newStatus = cfg.status;
          if (!projectId || !newStatus) throw new Error('ProjectId and Status required for update_project_status');

          const { error: projUpdErr } = await supabaseAdmin
            .from('projects')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', projectId);

          if (projUpdErr) throw projUpdErr;
          return { status: 'completed', output: { projectId, newStatus } };
        }

        case 'send_notification': {
          const userId = cfg.userId || context.userId || context.task?.assignee_id || context.project?.owner_id;
          if (!userId) throw new Error('Recipient userId missing for send_notification action');

          const title = this.interpolateString(cfg.title || 'Workflow Notification', context);
          const message = this.interpolateString(cfg.message || '', context);
          const notifId = crypto.randomUUID();

          const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
            id: notifId,
            user_id: userId,
            title,
            message,
            type: cfg.type || 'workflow_alert',
            entity_type: cfg.entityType || 'workflow',
            entity_id: workflow.id,
            action_url: cfg.actionUrl || '/workflows',
            delivery_status: 'delivered',
            created_at: new Date().toISOString(),
          });

          if (notifErr) throw notifErr;

          // Dispatch FCM push in the background
          dispatchFCMPush({
            id: notifId,
            userId,
            title,
            message,
            type: cfg.type || 'workflow_alert',
            actionUrl: cfg.actionUrl || '/workflows',
          }).catch(() => {});

          return { status: 'completed', output: { notificationId: notifId, recipient: userId } };
        }

        case 'send_email': {
          const toEmail = this.interpolateString(cfg.to || context.user?.email || '', context);
          const subject = this.interpolateString(cfg.subject || 'Auvryn Notification', context);
          const body = this.interpolateString(cfg.body || '', context);

          if (!toEmail) {
            return { status: 'failed', error: 'No recipient email specified for send_email action' };
          }

          const emailRes = await EmailService.sendEmail({
            to: toEmail,
            subject,
            html: `<div style="font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">${body.replace(/\n/g, '<br/>')}</div>`,
            text: body,
            templateName: 'workflow_automation',
            organizationId: workflow.account_type === 'organization' ? workflow.account_id : undefined,
            userId: context.userId || workflow.created_by,
            idempotencyKey: `wf_${executionId}_${action.id}`,
          });

          return {
            status: emailRes.success ? 'completed' : 'failed',
            output: { to: toEmail, subject, deliveryId: emailRes.id, error: emailRes.error }
          };
        }

        case 'create_approval_request': {
          const approvalId = crypto.randomUUID();
          const title = this.interpolateString(cfg.title || 'Approval Request Required', context);
          const description = this.interpolateString(cfg.description || '', context);
          const approverId = cfg.approverId || null;
          const approverRole = cfg.approverRole || 'manager';

          const { error: appErr } = await supabaseAdmin.from('workflow_approvals').insert({
            id: approvalId,
            workflow_id: workflow.id,
            execution_id: executionId,
            title,
            description,
            status: 'pending',
            requested_by: context.userId || workflow.created_by,
            assigned_approver_id: approverId,
            approver_role: approverRole,
            resume_action_index: action.order + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (appErr) {
            console.warn('[WorkflowEngine] approval record DB note:', appErr.message);
          }
          return { status: 'completed', output: { approvalId, waiting: true } };
        }

        case 'send_webhook': {
          const url = cfg.url;
          if (!url) throw new Error('Destination webhook URL missing');

          const ssrf = WorkflowValidator.isSafeOutboundUrl(url);
          if (!ssrf.safe) throw new Error(`SSRF blocked: ${ssrf.reason}`);

          const payload = {
            event: context.event || workflow.trigger_type,
            workflow: { id: workflow.id, name: workflow.name },
            data: context,
            timestamp: new Date().toISOString(),
          };

          const bodyStr = JSON.stringify(payload);
          const signature = crypto.createHmac('sha256', workflow.webhook_secret || 'auvryn_wh_secret')
            .update(bodyStr)
            .digest('hex');

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000); // 10s strict timeout

          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Auvryn-Workflow-Webhook/1.0',
                'X-Auvryn-Signature': signature,
              },
              body: bodyStr,
              signal: controller.signal,
            });

            clearTimeout(timeout);
            return {
              status: resp.ok ? 'completed' : 'failed',
              output: { statusCode: resp.status, statusText: resp.statusText },
              error: resp.ok ? undefined : `Webhook responded with status ${resp.status}`,
            };
          } catch (err: any) {
            clearTimeout(timeout);
            throw new Error(`Webhook dispatch failed: ${err.message}`);
          }
        }

        case 'escalate_task': {
          const taskId = cfg.taskId || context.task?.id;
          if (!taskId) throw new Error('Task ID missing for escalation');

          const { error: escErr } = await supabaseAdmin.from('tasks').update({
            priority: 'urgent',
            updated_at: new Date().toISOString(),
          }).eq('id', taskId);

          if (escErr) throw escErr;
          return { status: 'completed', output: { taskId, escalatedPriority: 'urgent' } };
        }

        default:
          return { status: 'skipped', output: { reason: `Unknown action type ${action.type}` } };
      }
    } catch (err: any) {
      return { status: 'failed', error: err.message || String(err) };
    }
  }

  /**
   * Executes a workflow definition against an event.
   */
  public static async executeWorkflow(
    workflow: WorkflowDefinition,
    event: WorkflowEvent,
    resumeFromIndex = 0
  ): Promise<WorkflowExecutionRecord> {
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const depth = event.executionDepth || 0;

    // Cycle & Infinite Loop Breaker:
    if (depth >= this.MAX_EXECUTION_DEPTH) {
      const record: WorkflowExecutionRecord = {
        id: executionId,
        workflow_id: workflow.id!,
        account_id: workflow.account_id,
        account_type: workflow.account_type,
        triggered_by_user_id: event.userId || null,
        trigger_type: event.triggerType,
        event_reference: WorkflowValidator.sanitizeLogData(event.data),
        status: 'failed',
        actions_attempted: [],
        error_message: `Workflow aborted: Execution depth limit (${this.MAX_EXECUTION_DEPTH}) reached to prevent infinite loops.`,
        error_code: 'CYCLE_LIMIT_EXCEEDED',
        retry_count: 0,
        max_retries: 0,
        idempotency_key: event.idempotencyKey,
        execution_depth: depth,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        created_at: startedAt,
      };

      await supabaseAdmin.from('workflow_executions').insert(record);
      return record;
    }

    // Check conditions first
    const matched = this.evaluateConditions(workflow.conditions, event.data);
    if (!matched) {
      const record: WorkflowExecutionRecord = {
        id: executionId,
        workflow_id: workflow.id!,
        account_id: workflow.account_id,
        account_type: workflow.account_type,
        triggered_by_user_id: event.userId || null,
        trigger_type: event.triggerType,
        event_reference: WorkflowValidator.sanitizeLogData(event.data),
        status: 'completed',
        actions_attempted: [{
          actionId: 'conditions_check',
          type: 'update_task', // placeholder
          status: 'skipped',
          startedAt,
          completedAt: new Date().toISOString(),
          output: { reason: 'Conditions did not match event data.' },
        }],
        retry_count: 0,
        max_retries: 3,
        idempotency_key: event.idempotencyKey,
        execution_depth: depth,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(startedAt).getTime(),
        created_at: startedAt,
      };

      await supabaseAdmin.from('workflow_executions').insert(record);
      return record;
    }

    // Sort actions by order
    const actions = [...(workflow.actions || [])].sort((a, b) => a.order - b.order);
    const actionsAttempted: ActionAttemptResult[] = [];
    let overallStatus: WorkflowExecutionRecord['status'] = 'completed';
    let errorMessage: string | null = null;
    let errorCode: string | null = null;

    const startTimeMs = Date.now();

    for (let i = resumeFromIndex; i < actions.length; i++) {
      const action = actions[i];
      const stepStart = new Date().toISOString();

      const result = await this.executeAction(action, event.data, workflow, executionId);
      const stepEnd = new Date().toISOString();

      actionsAttempted.push({
        actionId: action.id,
        type: action.type,
        status: result.status,
        startedAt: stepStart,
        completedAt: stepEnd,
        output: WorkflowValidator.sanitizeLogData(result.output),
        error: result.error,
      });

      // If action is create_approval_request, pause execution until approved
      if (action.type === 'create_approval_request' && result.status === 'completed') {
        overallStatus = 'waiting_approval';
        break;
      }

      if (result.status === 'failed') {
        overallStatus = 'failed';
        errorMessage = result.error || 'Action failed execution';
        errorCode = `ACTION_${action.type.toUpperCase()}_FAILED`;
        break; // Stop sequential chain on failure
      }
    }

    const durationMs = Date.now() - startTimeMs;
    const finishedAt = new Date().toISOString();

    const record: WorkflowExecutionRecord = {
      id: executionId,
      workflow_id: workflow.id!,
      account_id: workflow.account_id,
      account_type: workflow.account_type,
      triggered_by_user_id: event.userId || null,
      trigger_type: event.triggerType,
      event_reference: WorkflowValidator.sanitizeLogData(event.data),
      status: overallStatus,
      actions_attempted: actionsAttempted,
      error_message: errorMessage,
      error_code: errorCode,
      retry_count: 0,
      max_retries: 3,
      idempotency_key: event.idempotencyKey,
      execution_depth: depth,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      created_at: startedAt,
    };

    await supabaseAdmin.from('workflow_executions').insert(record);

    // Update workflow stats
    await supabaseAdmin.from('workflows').update({
      last_executed_at: finishedAt,
      execution_count: (workflow.execution_count || 0) + 1,
      failure_count: overallStatus === 'failed' ? (workflow.failure_count || 0) + 1 : (workflow.failure_count || 0),
      updated_at: finishedAt,
    }).eq('id', workflow.id);

    return record;
  }

  /**
   * Dispatches an event to all matching active workflows.
   */
  public static async triggerWorkflows(event: WorkflowEvent): Promise<WorkflowExecutionRecord[]> {
    try {
      const query = supabaseAdmin
        .from('workflows')
        .select('*')
        .eq('trigger_type', event.triggerType)
        .eq('status', 'active');

      if (event.accountType === 'organization') {
        query.eq('account_id', event.accountId);
      } else {
        query.eq('account_id', event.accountId);
      }

      const { data: workflows, error } = await query;
      if (error || !workflows || workflows.length === 0) {
        return [];
      }

      const results: WorkflowExecutionRecord[] = [];
      for (const wf of workflows) {
        const res = await this.executeWorkflow(wf as WorkflowDefinition, event);
        results.push(res);
      }
      return results;
    } catch (err) {
      console.error('[WorkflowEngine] Trigger dispatch error:', err);
      return [];
    }
  }

  /**
   * Resumes a paused execution after an approval decision.
   */
  public static async resumeApprovedExecution(approvalId: string, decisionBy: string, decisionNotes?: string): Promise<{ success: boolean; error?: string }> {
    const { data: approval } = await supabaseAdmin
      .from('workflow_approvals')
      .select('*, workflow:workflows(*)')
      .eq('id', approvalId)
      .maybeSingle();

    if (!approval) return { success: false, error: 'Approval record not found' };
    if (approval.status !== 'pending') return { success: false, error: `Approval already resolved: ${approval.status}` };

    // Mark approval approved
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('workflow_approvals').update({
      status: 'approved',
      decision_by: decisionBy,
      decision_notes: decisionNotes || null,
      decided_at: nowIso,
      updated_at: nowIso,
    }).eq('id', approvalId);

    // Resume execution
    const workflow = approval.workflow as WorkflowDefinition;
    const resumeIndex = approval.resume_action_index || 0;

    await this.executeWorkflow(
      workflow,
      {
        triggerType: 'approval_completed',
        accountId: workflow.account_id,
        accountType: workflow.account_type,
        userId: decisionBy,
        data: { approvalId, decision: 'approved', notes: decisionNotes },
      },
      resumeIndex
    );

    return { success: true };
  }
}
