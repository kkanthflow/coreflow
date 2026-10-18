import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../_core/supabase.js';
import { WorkflowValidator } from './workflow.validator.js';
import { WorkflowEngine } from './workflow.engine.js';
import { WORKFLOW_TEMPLATES } from './workflow.templates.js';
import { WorkflowScheduler } from './workflow.scheduler.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import { WorkflowDefinition, WorkflowStatus } from './workflow.types.js';

export const workflowsRouter = Router();

/**
 * Authentication & Account Context Helper
 */
async function resolveAuthContext(req: Request): Promise<{
  userId: string;
  userRole?: string;
  accountId: string;
  accountType: 'freelancer' | 'organization';
  orgRole?: string;
  error?: string;
  status?: number;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: '', accountId: '', accountType: 'freelancer', error: 'Authentication required. Missing Bearer token.', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

  if (authErr || !user) {
    return { userId: '', accountId: '', accountType: 'freelancer', error: 'Invalid or expired session token.', status: 401 };
  }

  const reqOrgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || (req.body?.orgId as string);

  if (reqOrgId && reqOrgId !== 'undefined' && reqOrgId !== 'null') {
    // Verify membership in requested organization
    const { data: membership } = await supabaseAdmin
      .from('user_organizations')
      .select('role')
      .eq('org_id', reqOrgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return { userId: user.id, accountId: reqOrgId, accountType: 'organization', error: 'Access denied: You are not a member of this organization.', status: 403 };
    }

    return {
      userId: user.id,
      accountId: reqOrgId,
      accountType: 'organization',
      orgRole: membership.role,
    };
  }

  // Check personal account type from users table
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('account_type, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    userRole: userProfile?.role,
    accountId: user.id,
    accountType: userProfile?.account_type === 'organization' ? 'organization' : 'freelancer',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/workflows/usage — Account Workflow Allowance & Current Usage
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/usage', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const quota = await EntitlementsService.checkEntitlement({
      userId: auth.userId,
      orgId: auth.accountType === 'organization' ? auth.accountId : null,
      feature: 'workflows',
    });

    res.json({
      success: true,
      current: quota.current,
      limit: quota.limit,
      remaining: quota.remaining,
      unlimited: quota.unlimited,
      tier: quota.tier,
      allowed: quota.allowed,
      upgradeUrl: quota.upgradeUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve workflow usage' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/workflows/templates — Workflow Templates Library
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/templates', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    templates: WORKFLOW_TEMPLATES,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/workflows — List Workflows for Current Account
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const status = req.query.status as string;
    const category = req.query.category as string;
    const search = req.query.search as string;

    let query = supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('account_id', auth.accountId)
      .eq('account_type', auth.accountType)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      query = query.not('status', 'eq', 'archived');
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data: workflows, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      workflows: workflows || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch workflows' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/workflows — Create Workflow with Plan Limit Enforcement
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  // In Organization context, require managerial role
  if (auth.accountType === 'organization') {
    if (!['owner', 'administrator', 'director', 'manager'].includes(auth.orgRole || '')) {
      res.status(403).json({ error: 'Forbidden: Only organization owners and managers can create workflows.' });
      return;
    }
  }

  try {
    // 1. Quota Enforcement
    const quota = await EntitlementsService.checkEntitlement({
      userId: auth.userId,
      orgId: auth.accountType === 'organization' ? auth.accountId : null,
      feature: 'workflows',
    });

    if (!quota.allowed) {
      res.status(403).json({
        error: `Workflow allowance limit of ${quota.limit} reached on your current plan. Please upgrade at /pricing to add more workflows.`,
        errorCode: 'QUOTA_EXCEEDED_WORKFLOWS',
        current: quota.current,
        limit: quota.limit,
        tier: quota.tier,
      });
      return;
    }

    const payload: Partial<WorkflowDefinition> = {
      ...req.body,
      account_id: auth.accountId,
      account_type: auth.accountType,
      created_by: auth.userId,
      webhook_secret: req.body.webhook_secret || crypto.randomBytes(24).toString('hex'),
    };

    // 2. Deterministic Validation
    const validation = WorkflowValidator.validate(payload);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }

    const { data: newWf, error: insertErr } = await supabaseAdmin
      .from('workflows')
      .insert({
        name: payload.name,
        description: payload.description || null,
        account_id: auth.accountId,
        account_type: auth.accountType,
        created_by: auth.userId,
        status: payload.status || 'draft',
        category: payload.category || 'project_task',
        trigger_type: payload.trigger_type,
        trigger_config: payload.trigger_config || {},
        conditions: payload.conditions || [],
        actions: payload.actions || [],
        webhook_secret: payload.webhook_secret,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json({
      success: true,
      workflow: newWf,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create workflow' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/workflows/:id — Get Single Workflow Details
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/:id', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const { data: workflow, error } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('account_id', auth.accountId)
      .maybeSingle();

    if (error || !workflow) {
      res.status(404).json({ error: 'Workflow not found or access denied.' });
      return;
    }

    res.json({ success: true, workflow });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching workflow' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT /api/workflows/:id — Update Workflow Definition
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.put('/:id', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('account_id', auth.accountId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: 'Workflow not found or access denied.' });
      return;
    }

    const payload: Partial<WorkflowDefinition> = {
      ...req.body,
      account_id: auth.accountId,
      account_type: auth.accountType,
    };

    const validation = WorkflowValidator.validate(payload);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }

    const { data: updatedWf, error: updateErr } = await supabaseAdmin
      .from('workflows')
      .update({
        name: payload.name,
        description: payload.description || null,
        category: payload.category,
        trigger_type: payload.trigger_type,
        trigger_config: payload.trigger_config,
        conditions: payload.conditions,
        actions: payload.actions,
        status: payload.status || existing.status,
        version: (existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ success: true, workflow: updatedWf });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error updating workflow' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/workflows/:id/state — Activate, Pause, or Archive
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/:id/state', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  const nextState = req.body.status as WorkflowStatus;
  if (!['draft', 'active', 'paused', 'archived'].includes(nextState)) {
    res.status(400).json({ error: 'Invalid state requested.' });
    return;
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('account_id', auth.accountId)
      .maybeSingle();

    if (!existing) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }

    // If activating from non-active state, verify quota
    if (nextState === 'active' && existing.status !== 'active') {
      const quota = await EntitlementsService.checkEntitlement({
        userId: auth.userId,
        orgId: auth.accountType === 'organization' ? auth.accountId : null,
        feature: 'workflows',
      });

      if (!quota.allowed) {
        res.status(403).json({
          error: `Cannot activate workflow. Plan limit of ${quota.limit} workflows reached. Please upgrade to activate more automations.`,
          errorCode: 'QUOTA_EXCEEDED_WORKFLOWS',
        });
        return;
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('workflows')
      .update({ status: nextState, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, workflow: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error changing workflow state' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/workflows/:id/test — Manual Test Execution
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/:id/test', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('account_id', auth.accountId)
      .maybeSingle();

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }

    // Execute test run with mock event payload
    const testPayload = req.body.eventData || {
      task: {
        id: crypto.randomUUID(),
        title: 'Test Verification Task',
        priority: 'urgent',
        status: 'todo',
      },
      project: {
        id: crypto.randomUUID(),
        title: 'Test Verification Project',
        status: 'active',
      },
      userId: auth.userId,
    };

    const execution = await WorkflowEngine.executeWorkflow(
      workflow as WorkflowDefinition,
      {
        triggerType: workflow.trigger_type,
        accountId: auth.accountId,
        accountType: auth.accountType,
        userId: auth.userId,
        data: testPayload,
        idempotencyKey: `test_${workflow.id}_${Date.now()}`,
      }
    );

    res.json({
      success: true,
      execution,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Test execution failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET /api/workflows/:id/executions — Execution History for Workflow
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/:id/executions', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const { data: executions, error } = await supabaseAdmin
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', req.params.id)
      .eq('account_id', auth.accountId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, executions: executions || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching executions' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /api/workflows/executions/all — All Executions across Account
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/executions/all', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const status = req.query.status as string;
    let query = supabaseAdmin
      .from('workflow_executions')
      .select('*, workflow:workflows(name, category)')
      .eq('account_id', auth.accountId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: executions, error } = await query;
    if (error) throw error;

    res.json({ success: true, executions: executions || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching executions' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. POST /api/workflows/executions/:id/retry — Retry Failed Execution
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/executions/:id/retry', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const { data: exec } = await supabaseAdmin
      .from('workflow_executions')
      .select('*, workflow:workflows(*)')
      .eq('id', req.params.id)
      .eq('account_id', auth.accountId)
      .maybeSingle();

    if (!exec) {
      res.status(404).json({ error: 'Execution record not found.' });
      return;
    }

    const retryRecord = await WorkflowEngine.executeWorkflow(
      exec.workflow as WorkflowDefinition,
      {
        triggerType: exec.trigger_type,
        accountId: exec.account_id,
        accountType: exec.account_type,
        userId: auth.userId,
        data: exec.event_reference,
        idempotencyKey: `retry_${exec.id}_${Date.now()}`,
      }
    );

    res.json({ success: true, execution: retryRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error retrying execution' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. GET /api/workflows/approvals — Pending Approvals List
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.get('/approvals/pending', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  try {
    const { data: approvals, error } = await supabaseAdmin
      .from('workflow_approvals')
      .select('*, workflow:workflows(name, category)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, approvals: approvals || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching approvals' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. POST /api/workflows/approvals/:id/decide — Approve or Reject
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/approvals/:id/decide', async (req: Request, res: Response) => {
  const auth = await resolveAuthContext(req);
  if (auth.error) {
    res.status(auth.status || 401).json({ error: auth.error });
    return;
  }

  const { decision, notes } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ error: 'Decision must be "approved" or "rejected".' });
    return;
  }

  try {
    if (decision === 'approved') {
      const result = await WorkflowEngine.resumeApprovedExecution(req.params.id, auth.userId, notes);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, status: 'approved' });
    } else {
      const nowIso = new Date().toISOString();
      await supabaseAdmin.from('workflow_approvals').update({
        status: 'rejected',
        decision_by: auth.userId,
        decision_notes: notes || null,
        decided_at: nowIso,
        updated_at: nowIso,
      }).eq('id', req.params.id);

      res.json({ success: true, status: 'rejected' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Decision failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. POST /api/workflows/webhook/:id — Authenticated Inbound Webhook Trigger
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/webhook/:id', async (req: Request, res: Response) => {
  try {
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .eq('trigger_type', 'webhook_inbound')
      .maybeSingle();

    if (!workflow) {
      res.status(404).json({ error: 'Active inbound webhook workflow not found.' });
      return;
    }

    // Verify webhook secret if configured
    if (workflow.webhook_secret) {
      const providedSecret = (req.headers['x-auvryn-secret'] as string) || req.query.secret;
      if (providedSecret !== workflow.webhook_secret) {
        res.status(401).json({ error: 'Unauthorized webhook request. Secret mismatch.' });
        return;
      }
    }

    const execution = await WorkflowEngine.executeWorkflow(
      workflow as WorkflowDefinition,
      {
        triggerType: 'webhook_inbound',
        accountId: workflow.account_id,
        accountType: workflow.account_type,
        data: {
          payload: req.body,
          headers: req.headers,
          receivedAt: new Date().toISOString(),
        },
        idempotencyKey: `wh_${workflow.id}_${Date.now()}`,
      }
    );

    res.json({ success: true, executionId: execution.id, status: execution.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Webhook trigger failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. POST /api/workflows/cron — Scheduled Task Trigger Endpoint
// ─────────────────────────────────────────────────────────────────────────────
workflowsRouter.post('/cron', async (req: Request, res: Response) => {
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET || 'cf_internal_cron_secret_2026';

  if (cronSecret !== expectedSecret && process.env.NODE_ENV === 'production') {
    res.status(401).json({ error: 'Unauthorized cron runner request.' });
    return;
  }

  try {
    const result = await WorkflowScheduler.runScheduledChecks();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cron execution failed' });
  }
});
