import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EmailService } from './email.service';
import { supabaseAdmin } from '../_core/supabase';

export const emailRouter = Router();

// Middleware: Authenticate Bearer JWT
const requireAuth = async (req: any, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication token is required' });
      return;
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired authentication session' });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized request', details: err.message });
  }
};

const testEmailSchema = z.object({
  recipient: z.string().trim().email('Valid recipient email address is required'),
});

/**
 * POST /api/email/test
 * Diagnostic test email dispatch workflow
 */
emailRouter.post('/test', requireAuth, async (req: any, res: Response) => {
  try {
    const parseResult = testEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.issues.map((i) => i.message).join(', '),
      });
      return;
    }

    const { recipient } = parseResult.data;
    const actor = req.user;
    const actorEmail = actor.email || 'Auvryn Administrator';

    console.log(`[EmailRouter] Test email dispatch requested by ${actorEmail} to ${recipient}`);

    const result = await EmailService.sendTestEmail({
      recipientEmail: recipient,
      requestedBy: actorEmail,
      userId: actor.id,
      organizationId: req.headers['x-organization-id'] || undefined,
    });

    if (!result.success) {
      res.status(502).json({
        success: false,
        error: result.error || 'Failed to dispatch test email via Resend',
        sender: EmailService.getFromAddress(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Diagnostic test email sent successfully to ${recipient}`,
      deliveryId: result.id,
      sender: EmailService.getFromAddress(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[EmailRouter.test] Internal error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error while processing test email',
      message: err.message,
    });
  }
});

/**
 * GET /api/email/logs
 * Retrieve delivery audit logs with pagination
 */
emailRouter.get('/logs', requireAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const orgId = req.headers['x-organization-id'] as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('email_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},user_id.eq.${userId}`);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error('[EmailRouter.logs] Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to retrieve email audit logs', details: err.message });
  }
});
