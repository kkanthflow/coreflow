/**
 * Enterprise Responsive Email Templates for Auvryn Platform
 * Built for high-deliverability across all clients (Gmail, Apple Mail, Outlook).
 */

export interface BaseEmailTemplateParams {
  title: string;
  previewText?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function renderEmailLayout(params: BaseEmailTemplateParams): string {
  const { title, previewText = '', contentHtml, ctaText, ctaUrl, footerNote } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #090A0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .card { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #090A0E; color: #EDEDED;">
  <!-- Hidden Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    ${previewText}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #090A0E;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="container" style="max-width: 580px;">
          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #FF6B4A; margin-right: 8px;"></span>AUVRYN
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #717686; padding-top: 4px;">
                    Intelligent Workspace Platform
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td class="card" style="background-color: #12131A; border: 1px solid #1E202B; border-radius: 16px; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px; line-height: 1.3;">
                ${title}
              </h1>
              
              <div style="font-size: 14px; line-height: 1.6; color: #C2C5D1;">
                ${contentHtml}
              </div>

              ${ctaText && ctaUrl ? `
              <div style="margin-top: 32px; text-align: center;">
                <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #FF6B4A; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(255, 107, 74, 0.35); text-align: center;">
                  ${ctaText} &rarr;
                </a>
              </div>
              <div style="margin-top: 14px; text-align: center; font-size: 11px; color: #717686;">
                Or copy and paste this link into your browser:<br/>
                <a href="${ctaUrl}" target="_blank" style="color: #FF6B4A; text-decoration: underline; word-break: break-all;">${ctaUrl}</a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 20px; font-size: 12px; line-height: 1.5; color: #626575; text-align: center;">
              ${footerNote ? `<p style="margin: 0 0 8px 0;">${footerNote}</p>` : ''}
              <p style="margin: 0;">
                Sent securely by <strong>Auvryn</strong> &bull; Skavelon Technologies Enterprise Infrastructure<br/>
                If you did not request or expect this email, you can safely disregard it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC TEMPLATE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Welcome Email
 */
export function getWelcomeEmail(params: {
  name?: string;
  email: string;
  workspaceName?: string;
  loginUrl: string;
}) {
  const recipient = params.name || params.email.split('@')[0];
  const subject = `Welcome to Auvryn${params.workspaceName ? ` — ${params.workspaceName}` : ''}`;
  const preview = `Your Auvryn workspace is ready. Let's get started.`;

  const contentHtml = `
    <p>Hi <strong>${recipient}</strong>,</p>
    <p>Welcome to <strong>Auvryn</strong>! Your account has been initialized and your cloud workspace is ready for real-time collaboration, autonomous workflows, and client management.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <div style="font-size: 12px; color: #8C90A2; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Account Email</div>
      <div style="font-size: 14px; color: #FFFFFF; font-family: monospace;">${params.email}</div>
    </div>
    <p>You can immediately launch meetings, manage client projects, track financial milestones, and automate repetitive tasks directly from your dashboard.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: 'Welcome to Auvryn',
      previewText: preview,
      contentHtml,
      ctaText: 'Access Your Dashboard',
      ctaUrl: params.loginUrl,
      footerNote: 'You received this email because an account was registered with your address.',
    }),
    text: `Hi ${recipient},\n\nWelcome to Auvryn! Your workspace is ready.\n\nSign in here: ${params.loginUrl}\n\n— Auvryn Team`,
  };
}

/**
 * 2. Team or Client Invitation Email
 */
export function getInvitationEmail(params: {
  inviterName?: string;
  targetEmail: string;
  workspaceOrProjectName: string;
  role: string;
  inviteUrl: string;
  expiresAt?: string;
  isClient?: boolean;
}) {
  const inviter = params.inviterName || 'A team administrator';
  const roleDisplay = params.role.toUpperCase();
  const subject = params.isClient
    ? `You have been invited to collaborate on ${params.workspaceOrProjectName}`
    : `Invitation to join ${params.workspaceOrProjectName} on Auvryn`;
  const preview = `${inviter} invited you as ${roleDisplay} on ${params.workspaceOrProjectName}.`;

  const contentHtml = `
    <p>Hello,</p>
    <p><strong>${inviter}</strong> has invited you to join <strong>${params.workspaceOrProjectName}</strong> on the Auvryn Platform with the role of <strong style="color: #FF6B4A;">${roleDisplay}</strong>.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="color: #8C90A2; padding: 4px 0;">Workspace / Project:</td>
          <td style="color: #FFFFFF; font-weight: 600; text-align: right;">${params.workspaceOrProjectName}</td>
        </tr>
        <tr>
          <td style="color: #8C90A2; padding: 4px 0;">Assigned Role:</td>
          <td style="color: #FF6B4A; font-weight: 600; text-align: right;">${roleDisplay}</td>
        </tr>
        ${params.expiresAt ? `
        <tr>
          <td style="color: #8C90A2; padding: 4px 0;">Invitation Valid Until:</td>
          <td style="color: #E2E8F0; text-align: right;">${new Date(params.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <p>Click the button below to accept the invitation and activate your workspace access.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: params.isClient ? 'Project Collaboration Invitation' : 'Team Member Invitation',
      previewText: preview,
      contentHtml,
      ctaText: 'Accept Invitation & Join',
      ctaUrl: params.inviteUrl,
      footerNote: 'This secure invitation link is unique to you. Do not share it with unauthorized parties.',
    }),
    text: `You have been invited by ${inviter} to join ${params.workspaceOrProjectName} as ${roleDisplay}.\n\nAccept here: ${params.inviteUrl}\n\n— Auvryn Team`,
  };
}

/**
 * 3. Task / Project Update Email
 */
export function getTaskUpdateEmail(params: {
  recipientName?: string;
  taskTitle: string;
  projectTitle: string;
  actionText: string;
  updatedBy?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  actionUrl: string;
}) {
  const subject = `[${params.projectTitle}] ${params.actionText}: "${params.taskTitle}"`;
  const preview = `${params.updatedBy || 'A teammate'} ${params.actionText} on "${params.taskTitle}".`;

  const contentHtml = `
    <p>Hi <strong>${params.recipientName || 'there'}</strong>,</p>
    <p>${params.updatedBy ? `<strong>${params.updatedBy}</strong> ` : ''}${params.actionText.toLowerCase()} in project <strong>${params.projectTitle}</strong>.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <div style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 8px;">${params.taskTitle}</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #A0A5B5;">
        ${params.status ? `<tr><td style="padding: 2px 0;">Status:</td><td style="text-align: right; color: #FFFFFF; font-weight: 600;">${params.status}</td></tr>` : ''}
        ${params.priority ? `<tr><td style="padding: 2px 0;">Priority:</td><td style="text-align: right; color: #FF6B4A; font-weight: 600;">${params.priority.toUpperCase()}</td></tr>` : ''}
        ${params.dueDate ? `<tr><td style="padding: 2px 0;">Due Date:</td><td style="text-align: right; color: #FFFFFF;">${params.dueDate}</td></tr>` : ''}
      </table>
    </div>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: 'Task Assignment / Update',
      previewText: preview,
      contentHtml,
      ctaText: 'View Task in Workspace',
      ctaUrl: params.actionUrl,
    }),
    text: `Update in [${params.projectTitle}]: ${params.taskTitle}\nStatus: ${params.status || 'N/A'}\nView: ${params.actionUrl}`,
  };
}

/**
 * 4. Invoice / Quotation Email
 */
export function getInvoiceEmail(params: {
  recipientName: string;
  invoiceNumber: string;
  amountFormatted: string;
  currency: string;
  dueDate?: string;
  organizationName: string;
  status: string;
  viewUrl: string;
  notes?: string;
}) {
  const isQuotation = params.status === 'draft' || params.invoiceNumber.toLowerCase().includes('quot');
  const docType = isQuotation ? 'Quotation' : 'Invoice';
  const subject = `${docType} #${params.invoiceNumber} from ${params.organizationName} (${params.amountFormatted})`;
  const preview = `New ${docType.toLowerCase()} #${params.invoiceNumber} for ${params.amountFormatted} has been issued.`;

  const contentHtml = `
    <p>Dear <strong>${params.recipientName}</strong>,</p>
    <p><strong>${params.organizationName}</strong> has issued <strong>${docType} #${params.invoiceNumber}</strong> for your account.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #8C90A2; margin-bottom: 4px;">Total Amount Due</div>
      <div style="font-size: 28px; font-weight: 800; color: #4ADE80; font-family: monospace;">${params.amountFormatted}</div>
      ${params.dueDate ? `<div style="font-size: 12px; color: #8C90A2; margin-top: 6px;">Payment Due: <strong style="color: #FFFFFF;">${params.dueDate}</strong></div>` : ''}
    </div>
    ${params.notes ? `<p style="font-size: 13px; color: #A0A5B5; font-style: italic;">"${params.notes}"</p>` : ''}
    <p>Please review the invoice breakdown and submit payment details through your secure client portal link below.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: `${docType} #${params.invoiceNumber}`,
      previewText: preview,
      contentHtml,
      ctaText: `View & Pay ${docType}`,
      ctaUrl: params.viewUrl,
      footerNote: `Please reference ${params.invoiceNumber} on all remittances.`,
    }),
    text: `${docType} #${params.invoiceNumber} from ${params.organizationName}\nTotal Amount: ${params.amountFormatted}\nDue Date: ${params.dueDate || 'N/A'}\nView details: ${params.viewUrl}`,
  };
}

/**
 * 5. Payment Confirmation Email (Verified)
 */
export function getPaymentConfirmationEmail(params: {
  recipientName: string;
  invoiceNumber?: string;
  paymentId: string;
  amountFormatted: string;
  currency: string;
  paidAt: string;
  receiptUrl?: string;
  isSubscription?: boolean;
  planName?: string;
}) {
  const subject = params.isSubscription
    ? `Payment Confirmed: Auvryn ${params.planName || 'Subscription'} (${params.amountFormatted})`
    : `Payment Receipt: Invoice #${params.invoiceNumber} (${params.amountFormatted})`;
  const preview = `Your payment of ${params.amountFormatted} has been confirmed. Thank you!`;

  const contentHtml = `
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>We are pleased to confirm that your payment of <strong style="color: #4ADE80;">${params.amountFormatted}</strong> has been successfully processed and verified.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        ${params.invoiceNumber ? `<tr><td style="color: #8C90A2; padding: 4px 0;">Invoice / Reference:</td><td style="color: #FFFFFF; font-weight: 600; text-align: right;">#${params.invoiceNumber}</td></tr>` : ''}
        ${params.planName ? `<tr><td style="color: #8C90A2; padding: 4px 0;">Plan:</td><td style="color: #FFFFFF; font-weight: 600; text-align: right;">${params.planName}</td></tr>` : ''}
        <tr><td style="color: #8C90A2; padding: 4px 0;">Transaction ID:</td><td style="color: #A0A5B5; font-family: monospace; font-size: 11px; text-align: right;">${params.paymentId}</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Verified On:</td><td style="color: #FFFFFF; text-align: right;">${new Date(params.paidAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Status:</td><td style="color: #4ADE80; font-weight: 700; text-align: right;">VERIFIED & PAID</td></tr>
      </table>
    </div>
    <p>A permanent record of this transaction has been filed in your accounting history.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: 'Payment Confirmation & Receipt',
      previewText: preview,
      contentHtml,
      ctaText: params.receiptUrl ? 'Download Official Receipt' : undefined,
      ctaUrl: params.receiptUrl,
    }),
    text: `Payment Confirmed: ${params.amountFormatted}\nTransaction ID: ${params.paymentId}\nDate: ${params.paidAt}\nStatus: VERIFIED & PAID`,
  };
}

/**
 * 6. Reminder Email
 */
export function getReminderEmail(params: {
  recipientName: string;
  title: string;
  details: string;
  actionText: string;
  actionUrl: string;
  dueDate?: string;
}) {
  const subject = `Reminder: ${params.title}`;
  const preview = `Action required: ${params.title}`;

  const contentHtml = `
    <p>Hi <strong>${params.recipientName}</strong>,</p>
    <p>This is a reminder regarding: <strong>${params.title}</strong>.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #D1D5DB; line-height: 1.5;">${params.details}</p>
      ${params.dueDate ? `<div style="margin-top: 10px; font-size: 12px; color: #FF6B4A; font-weight: 600;">Due: ${params.dueDate}</div>` : ''}
    </div>
    <p>Please take action below at your earliest convenience.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: params.title,
      previewText: preview,
      contentHtml,
      ctaText: params.actionText,
      ctaUrl: params.actionUrl,
    }),
    text: `Reminder: ${params.title}\n${params.details}\nAction: ${params.actionUrl}`,
  };
}

/**
 * 7. Test Email Workflow
 */
export function getTestEmail(params: {
  recipientEmail: string;
  requestedBy: string;
  serverTimestamp: string;
  environment: string;
}) {
  const subject = `Auvryn Resend Integration Test — ${new Date().toLocaleTimeString()}`;
  const preview = `Diagnostic test email from your Auvryn server. Integration is operational.`;

  const contentHtml = `
    <p>Hello <strong>${params.requestedBy}</strong>,</p>
    <p>Congratulations! If you are reading this email, your <strong>Resend server-side email integration</strong> is fully operational.</p>
    <div style="background-color: #171923; border: 1px solid #232738; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #4ADE80; font-weight: 700; margin-bottom: 8px;">✓ System Diagnostic Report</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tr><td style="color: #8C90A2; padding: 4px 0;">Provider:</td><td style="color: #FFFFFF; font-weight: 600; text-align: right;">Resend SDK (Server-Side)</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Recipient:</td><td style="color: #FFFFFF; font-family: monospace; text-align: right;">${params.recipientEmail}</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Environment:</td><td style="color: #7DD3FC; text-align: right;">${params.environment}</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Server Time:</td><td style="color: #FFFFFF; text-align: right;">${params.serverTimestamp}</td></tr>
        <tr><td style="color: #8C90A2; padding: 4px 0;">Idempotency:</td><td style="color: #4ADE80; text-align: right;">Active &amp; Audited</td></tr>
      </table>
    </div>
    <p>All core notification workflows (Welcome, Invitations, Invoices, Payment Receipts, and Reminders) can now reliably dispatch emails through this pipeline.</p>
  `;

  return {
    subject,
    html: renderEmailLayout({
      title: 'Resend Email Service Operational',
      previewText: preview,
      contentHtml,
      footerNote: 'This is an automated diagnostic test message generated from Auvryn Settings.',
    }),
    text: `Auvryn Resend Integration Test\n\nRecipient: ${params.recipientEmail}\nEnvironment: ${params.environment}\nTimestamp: ${params.serverTimestamp}\n\nStatus: OPERATIONAL`,
  };
}
