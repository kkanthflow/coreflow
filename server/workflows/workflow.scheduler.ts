import { supabaseAdmin } from '../_core/supabase.js';
import { WorkflowEngine } from './workflow.engine.js';
import { WorkflowDefinition } from './workflow.types.js';

export class WorkflowScheduler {
  private static isRunning = false;

  /**
   * Scans and dispatches scheduled workflows and overdue tasks.
   * Can be called by continuous background timer or by /api/workflows/cron
   */
  public static async runScheduledChecks(): Promise<{
    scheduledExecuted: number;
    overdueTasksDetected: number;
  }> {
    if (this.isRunning) {
      console.log('[WorkflowScheduler] Job already running, skipping overlapping tick.');
      return { scheduledExecuted: 0, overdueTasksDetected: 0 };
    }

    this.isRunning = true;
    let scheduledExecuted = 0;
    let overdueTasksDetected = 0;

    try {
      const now = new Date();
      const currentIso = now.toISOString();

      // 1. Fetch active scheduled workflows (schedule_cron)
      const { data: cronWorkflows } = await supabaseAdmin
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'schedule_cron')
        .eq('status', 'active');

      if (cronWorkflows && cronWorkflows.length > 0) {
        for (const wf of cronWorkflows) {
          try {
            // Idempotency: execute scheduled tasks at most once per minute
            const idempotencyKey = `cron_${wf.id}_${now.toISOString().slice(0, 16)}`;
            
            await WorkflowEngine.executeWorkflow(wf as WorkflowDefinition, {
              triggerType: 'schedule_cron',
              accountId: wf.account_id,
              accountType: wf.account_type,
              data: { scheduledAt: currentIso },
              idempotencyKey,
            });
            scheduledExecuted++;
          } catch (wfErr) {
            console.error(`[WorkflowScheduler] Scheduled workflow ${wf.id} failed:`, wfErr);
          }
        }
      }

      // 2. Detect overdue tasks that haven't been completed
      const todayDate = now.toISOString().split('T')[0];
      const { data: overdueTasks } = await supabaseAdmin
        .from('tasks')
        .select('id, title, status, priority, due_date, org_id, assignee_id, project_id')
        .lt('due_date', todayDate)
        .not('status', 'in', '("done","completed")')
        .limit(50);

      if (overdueTasks && overdueTasks.length > 0) {
        for (const task of overdueTasks) {
          try {
            const accountId = task.org_id || task.assignee_id || 'system';
            const accountType = task.org_id ? 'organization' : 'freelancer';
            const idempotencyKey = `overdue_${task.id}_${todayDate}`;

            await WorkflowEngine.triggerWorkflows({
              triggerType: 'task_overdue',
              accountId,
              accountType,
              data: {
                task,
                detectedAt: currentIso,
              },
              idempotencyKey,
            });
            overdueTasksDetected++;
          } catch (tErr) {
            console.error(`[WorkflowScheduler] Overdue trigger for task ${task.id} failed:`, tErr);
          }
        }
      }

      return { scheduledExecuted, overdueTasksDetected };
    } catch (err) {
      console.error('[WorkflowScheduler] Scheduler error:', err);
      return { scheduledExecuted, overdueTasksDetected };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Starts a background interval (e.g. every 5 minutes) when running on long-lived server.
   */
  public static startBackgroundWorker(intervalMs = 300000): NodeJS.Timeout {
    console.log(`[WorkflowScheduler] Background worker started (interval: ${intervalMs / 1000}s)`);
    return setInterval(() => {
      this.runScheduledChecks().catch(console.error);
    }, intervalMs);
  }
}
