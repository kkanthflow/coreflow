import { Router, Request, Response } from 'express';
import { SubscriptionService } from './subscription.service.js';

export const webhookRouter = Router();

/**
 * Razorpay Webhook Handler
 * Route: POST /api/webhooks/razorpay
 * 
 * Verifies the webhook signature using the exact raw buffer and webhook secret.
 * Processes subscription lifecycle events:
 * - subscription.authenticated
 * - subscription.activated
 * - subscription.charged
 * - subscription.pending
 * - subscription.halted
 * - subscription.cancelled
 * - subscription.completed
 * - payment.failed
 * Enforces idempotency via event IDs.
 */
webhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const eventHeaderId = (req.headers['x-razorpay-event-id'] as string) || '';

    // Retrieve raw body buffer saved by middleware, or stringify if not available
    const rawBody: Buffer | string = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!signature) {
      console.warn('[Razorpay Webhook] Rejected: Missing X-Razorpay-Signature header');
      res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
      return;
    }

    const result = await SubscriptionService.processWebhookEvent({
      rawBody,
      signature,
      eventId: eventHeaderId || undefined,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Razorpay Webhook] Processing error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed', message: err.message });
  }
});

