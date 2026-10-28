import { Resend } from 'resend';
import { supabaseAdmin } from '../_core/supabase';
import {
  getWelcomeEmail,
  getInvitationEmail,
  getTaskUpdateEmail,
  getInvoiceEmail,
  getPaymentConfirmationEmail,
  getReminderEmail,
  getTestEmail,
} from './email.templates';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateName: string;
  idempotencyKey?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  replyTo?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  id?: string;
  idempotent?: boolean;
  error?: string;
  skipped?: boolean;
}

export class EmailService {
  private static resendClient: Resend | null = null;

  /**
   * Resolve Resend client instance
   */
  private static getClient(): Resend | null {
    if (this.resendClient) return this.resendClient;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured in server environment.');
      return null;
    }

    try {
      this.resendClient = new Resend(apiKey);
      return this.resendClient;
    } catch (err: any) {
      console.error('[EmailService] Failed to initialize Resend client:', err.message);
      return null;
    }
  }

  /**
   * Get configured sender address
   */
  public static getFromAddress(): string {
    return process.env.RESEND_FROM_EMAIL || 'Auvryn <onboarding@resend.dev>';
  }

  /**
   * Core Email Delivery Pipeline with Idempotency, Preferences & Audit Logging
   */
  public static async sendEmail(opts: SendEmailOptions): Promise<EmailDeliveryResult> {
    const {
      to,
      subject,
      html,
      text,
      templateName,
      idempotencyKey,
      userId,
      organizationId,
      metadata = {},
      replyTo,
    } = opts;

    const recipient = Array.isArray(to) ? to.join(', ') : to;

    // 1. Check user notification preferences if user_id is provided
    if (userId) {
      try {
        const { data: pref } = await supabaseAdmin
          .from('notification_preferences')
          .select('email_enabled, email_task_updates, email_financial_alerts, email_invitations')
          .eq('user_id', userId)
          .maybeSingle();

        if (pref && pref.email_enabled === false) {
          console.log(`[EmailService] Email skipped for user ${userId} (email_enabled is false)`);
          return { success: true, skipped: true };
        }

        if (pref && templateName.includes('task') && pref.email_task_updates === false) {
          console.log(`[EmailService] Task email skipped for user ${userId} per preferences`);
          return { success: true, skipped: true };
        }

        if (pref && (templateName.includes('invoice') || templateName.includes('payment')) && pref.email_financial_alerts === false) {
          console.log(`[EmailService] Financial email skipped for user ${userId} per preferences`);
          return { success: true, skipped: true };
        }

        if (pref && templateName.includes('invite') && pref.email_invitations === false) {
          console.log(`[EmailService] Invitation email skipped for user ${userId} per preferences`);
          return { success: true, skipped: true };
        }
      } catch (prefErr: any) {
        console.warn('[EmailService] Note: Could not check notification preferences:', prefErr.message);
      }
    }

    // 2. Idempotency Check: prevent duplicate emails for identical event
    if (idempotencyKey) {
      try {
        const { data: existingLog } = await supabaseAdmin
          .from('email_logs')
          .select('id, status, resend_id, created_at')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingLog && existingLog.status === 'sent') {
          console.log(`[EmailService] Idempotency match: email with key "${idempotencyKey}" was already sent (Resend ID: ${existingLog.resend_id})`);
          return {
            success: true,
            id: existingLog.resend_id,
            idempotent: true,
          };
        }
      } catch (err: any) {
        console.warn('[EmailService] Note: Could not query existing email logs for idempotency:', err.message);
      }
    }

    // 3. Create initial queued audit log record
    let logRecordId: string | null = null;
    try {
      const { data: logEntry } = await supabaseAdmin
        .from('email_logs')
        .insert({
          idempotency_key: idempotencyKey || null,
          recipient,
          subject,
          template: templateName,
          status: 'queued',
          metadata,
          user_id: userId || null,
          organization_id: organizationId || null,
        })
        .select('id')
        .single();

      if (logEntry) logRecordId = logEntry.id;
    } catch (logErr: any) {
      console.warn('[EmailService] Could not insert initial email_logs entry:', logErr.message);
    }

    // 4. Validate Resend Client
    const client = this.getClient();
    if (!client) {
      const errorMsg = 'Resend client is uninitialized. Ensure RESEND_API_KEY is defined in server environment.';
      console.error(`[EmailService] ${errorMsg}`);
      if (logRecordId) {
        await supabaseAdmin
          .from('email_logs')
          .update({ status: 'failed', error: errorMsg })
          .eq('id', logRecordId);
      }
      return { success: false, error: errorMsg };
    }

    // 5. Dispatch email via Resend with safe retry mechanism
    const from = this.getFromAddress();
    let resendId: string | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await client.emails.send({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || undefined,
          replyTo: replyTo || undefined,
        });

        if (response.error) {
          throw new Error(response.error.message || 'Resend API returned an error');
        }

        resendId = response.data?.id || null;
        break; // Successfully sent
      } catch (sendErr: any) {
        lastError = sendErr;
        console.warn(`[EmailService] Send attempt ${attempt} failed for ${recipient}:`, sendErr.message);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    // 6. Finalize Audit Logging
    if (resendId) {
      console.log(`[EmailService] ✓ Email sent successfully via Resend. ID: ${resendId} (${recipient})`);
      if (logRecordId) {
        await supabaseAdmin
          .from('email_logs')
          .update({
            status: 'sent',
            resend_id: resendId,
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', logRecordId);
      }
      return { success: true, id: resendId };
    } else {
      const failureMsg = lastError?.message || 'Unknown Resend delivery failure';
      console.error(`[EmailService] ✗ Failed to deliver email to ${recipient}:`, failureMsg);
      if (logRecordId) {
        await supabaseAdmin
          .from('email_logs')
          .update({
            status: 'failed',
            error: failureMsg,
          })
          .eq('id', logRecordId);
      }
      return { success: false, error: failureMsg };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOW HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send Welcome Email to newly registered user
   */
  public static async sendWelcome(params: {
    email: string;
    name?: string;
    userId?: string;
    workspaceName?: string;
    loginUrl?: string;
  }) {
    const appUrl = process.env.VITE_APP_URL || process.env.EXPO_PUBLIC_OAUTH_SERVER_URL || 'https://coreflow-kk5480346-9617s-projects.vercel.app';
    const loginUrl = params.loginUrl || `${appUrl}/login`;
    const t = getWelcomeEmail({
      name: params.name,
      email: params.email,
      workspaceName: params.workspaceName,
      loginUrl,
    });

    return this.sendEmail({
      to: params.email,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'welcome',
      userId: params.userId,
      idempotencyKey: `welcome_${params.email}_${new Date().toISOString().slice(0, 10)}`,
    });
  }

  /**
   * Send Team or Client Invitation Email
   */
  public static async sendInvitation(params: {
    targetEmail: string;
    inviterName?: string;
    workspaceOrProjectName: string;
    role: string;
    inviteUrl: string;
    expiresAt?: string;
    isClient?: boolean;
    organizationId?: string;
    userId?: string;
  }) {
    const t = getInvitationEmail({
      inviterName: params.inviterName,
      targetEmail: params.targetEmail,
      workspaceOrProjectName: params.workspaceOrProjectName,
      role: params.role,
      inviteUrl: params.inviteUrl,
      expiresAt: params.expiresAt,
      isClient: params.isClient,
    });

    return this.sendEmail({
      to: params.targetEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: params.isClient ? 'client_invitation' : 'team_invitation',
      organizationId: params.organizationId,
      userId: params.userId,
      idempotencyKey: `invite_${params.targetEmail}_${encodeURIComponent(params.inviteUrl).slice(-20)}`,
    });
  }

  /**
   * Send Task or Project Milestone Update
   */
  public static async sendTaskUpdate(params: {
    recipientEmail: string;
    recipientName?: string;
    taskTitle: string;
    projectTitle: string;
    actionText: string;
    updatedBy?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    actionUrl: string;
    userId?: string;
    organizationId?: string;
  }) {
    const t = getTaskUpdateEmail({
      recipientName: params.recipientName,
      taskTitle: params.taskTitle,
      projectTitle: params.projectTitle,
      actionText: params.actionText,
      updatedBy: params.updatedBy,
      priority: params.priority,
      status: params.status,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl,
    });

    return this.sendEmail({
      to: params.recipientEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'task_update',
      userId: params.userId,
      organizationId: params.organizationId,
    });
  }

  /**
   * Send Invoice or Quotation Email
   */
  public static async sendInvoice(params: {
    recipientEmail: string;
    recipientName: string;
    invoiceNumber: string;
    amountFormatted: string;
    currency: string;
    dueDate?: string;
    organizationName: string;
    status: string;
    viewUrl: string;
    notes?: string;
    organizationId?: string;
    userId?: string;
  }) {
    const t = getInvoiceEmail({
      recipientName: params.recipientName,
      invoiceNumber: params.invoiceNumber,
      amountFormatted: params.amountFormatted,
      currency: params.currency,
      dueDate: params.dueDate,
      organizationName: params.organizationName,
      status: params.status,
      viewUrl: params.viewUrl,
      notes: params.notes,
    });

    return this.sendEmail({
      to: params.recipientEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'invoice_issued',
      organizationId: params.organizationId,
      userId: params.userId,
      idempotencyKey: `invoice_${params.invoiceNumber}_${params.status}`,
    });
  }

  /**
   * Send Verified Payment Confirmation
   */
  public static async sendPaymentConfirmation(params: {
    recipientEmail: string;
    recipientName: string;
    invoiceNumber?: string;
    paymentId: string;
    amountFormatted: string;
    currency: string;
    paidAt: string;
    receiptUrl?: string;
    isSubscription?: boolean;
    planName?: string;
    organizationId?: string;
    userId?: string;
  }) {
    const t = getPaymentConfirmationEmail({
      recipientName: params.recipientName,
      invoiceNumber: params.invoiceNumber,
      paymentId: params.paymentId,
      amountFormatted: params.amountFormatted,
      currency: params.currency,
      paidAt: params.paidAt,
      receiptUrl: params.receiptUrl,
      isSubscription: params.isSubscription,
      planName: params.planName,
    });

    return this.sendEmail({
      to: params.recipientEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'payment_confirmation',
      organizationId: params.organizationId,
      userId: params.userId,
      idempotencyKey: `payment_${params.paymentId}`,
    });
  }

  /**
   * Send Generic Reminder Email
   */
  public static async sendReminder(params: {
    recipientEmail: string;
    recipientName: string;
    title: string;
    details: string;
    actionText: string;
    actionUrl: string;
    dueDate?: string;
    userId?: string;
    organizationId?: string;
  }) {
    const t = getReminderEmail({
      recipientName: params.recipientName,
      title: params.title,
      details: params.details,
      actionText: params.actionText,
      actionUrl: params.actionUrl,
      dueDate: params.dueDate,
    });

    return this.sendEmail({
      to: params.recipientEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'reminder',
      userId: params.userId,
      organizationId: params.organizationId,
    });
  }

  /**
   * Send Test Email for Diagnostic Verification
   */
  public static async sendTestEmail(params: {
    recipientEmail: string;
    requestedBy: string;
    userId?: string;
    organizationId?: string;
  }) {
    const t = getTestEmail({
      recipientEmail: params.recipientEmail,
      requestedBy: params.requestedBy,
      serverTimestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
    });

    return this.sendEmail({
      to: params.recipientEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      templateName: 'diagnostic_test',
      userId: params.userId,
      organizationId: params.organizationId,
      metadata: { test: true, timestamp: Date.now() },
    });
  }
}
