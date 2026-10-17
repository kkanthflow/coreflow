import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Disable automatic body parser to preserve the exact raw buffer for HMAC-SHA256 signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzk1NSwiZXhwIjoyMDk2Nzc5OTU1fQ.zsR3c5QISHMSo9MgsaWCLVaeEBs5gZIlQ8eue4eF12o';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const PRIMARY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'Krishna0okanth#@';
const FALLBACK_SECRET = process.env.RAZORPAY_KEY_SECRET || 'jX3JWseZHp08O1haOrJdt5sP';

// Helper to buffer the raw body from the request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

function verifySignature(rawBuffer, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature, X-Razorpay-Event-Id');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed. Razorpay webhooks require POST.' }));
    return;
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const signature = req.headers['x-razorpay-signature'] || '';
    const eventHeaderId = req.headers['x-razorpay-event-id'] || '';

    if (!signature) {
      console.warn('[Razorpay Webhook] Rejected: Missing X-Razorpay-Signature header');
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing X-Razorpay-Signature header' }));
      return;
    }

    // 1. Verify HMAC SHA-256 signature using primary secret (Krishna0okanth#@) or fallback
    const isValid = verifySignature(rawBodyBuffer, signature, PRIMARY_SECRET) ||
                    verifySignature(rawBodyBuffer, signature, FALLBACK_SECRET);

    if (!isValid) {
      console.warn('[Razorpay Webhook] Rejected: Signature mismatch');
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid webhook signature' }));
      return;
    }

    // 2. Parse payload safely
    const payload = JSON.parse(rawBodyBuffer.toString('utf8'));
    const eventId = eventHeaderId || payload.event_id || payload.id || `evt_${Date.now()}`;
    const eventType = payload.event;

    console.log(`[Razorpay Webhook] Verified event: ${eventType} (${eventId})`);

    // 3. Idempotency Check: check if event already recorded
    const { data: existing } = await supabaseAdmin
      .from('subscription_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing) {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed (idempotent ignore)`);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, status: 'ignored', reason: 'duplicate_event' }));
      return;
    }

    const subEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;

    if (subEntity) {
      const rzpSubId = subEntity.id;
      let newStatus = subEntity.status;

      switch (eventType) {
        case 'subscription.authenticated':
          newStatus = 'authenticated';
          break;
        case 'subscription.activated':
        case 'subscription.charged':
          newStatus = 'active';
          break;
        case 'subscription.pending':
          newStatus = 'pending';
          break;
        case 'subscription.halted':
          newStatus = 'halted';
          break;
        case 'subscription.cancelled':
          newStatus = 'cancelled';
          break;
        case 'subscription.completed':
          newStatus = 'completed';
          break;
      }

      // Update subscription in DB
      const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000).toISOString() : null;
      const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000).toISOString() : null;

      const { data: updatedSub } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: newStatus,
          current_period_start: currentStart || undefined,
          current_period_end: currentEnd || undefined,
          paid_count: subEntity.paid_count || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_subscription_id', rzpSubId)
        .select()
        .maybeSingle();

      const userId = updatedSub?.user_id || subEntity.notes?.userId || subEntity.customer_id;
      const orgId = updatedSub?.organization_id || subEntity.notes?.orgId;
      const tier = updatedSub?.plan_tier || subEntity.notes?.tier || 'freelancer';

      // Keep user access in sync
      if (userId) {
        const targetTier = newStatus === 'cancelled' ? 'freelancer' : tier;
        const targetStatus = newStatus === 'cancelled' ? 'cancelled' : (newStatus === 'halted' ? 'halted' : 'active');

        await supabaseAdmin
          .from('users')
          .update({
            current_plan_tier: targetTier,
            subscription_status: targetStatus,
          })
          .eq('id', userId);
        console.log(`[Razorpay Webhook] Synced user ${userId} to plan=${targetTier}, status=${targetStatus}`);
      }

      // Keep organization access in sync if applicable
      if (orgId) {
        const targetTier = newStatus === 'cancelled' ? 'freelancer' : tier;
        const targetStatus = newStatus === 'cancelled' ? 'cancelled' : (newStatus === 'halted' ? 'halted' : 'active');

        await supabaseAdmin
          .from('organizations')
          .update({
            current_plan_tier: targetTier,
            subscription_status: targetStatus,
          })
          .eq('id', orgId);
        console.log(`[Razorpay Webhook] Synced organization ${orgId} to plan=${targetTier}, status=${targetStatus}`);
      }

      // Record payment log if charged
      if (paymentEntity && (eventType === 'subscription.charged' || eventType === 'payment.captured')) {
        await supabaseAdmin.from('subscription_payments').upsert({
          id: crypto.randomUUID(),
          subscription_id: updatedSub?.id || null,
          razorpay_subscription_id: rzpSubId,
          razorpay_payment_id: paymentEntity.id,
          amount: paymentEntity.amount,
          currency: paymentEntity.currency || 'INR',
          status: paymentEntity.status || 'captured',
          method: paymentEntity.method,
          captured_at: new Date().toISOString(),
        }, { onConflict: 'razorpay_payment_id' });
      }
    }

    // Save event for idempotency
    await supabaseAdmin.from('subscription_webhook_events').insert({
      id: crypto.randomUUID(),
      event_id: eventId,
      event_type: eventType,
      entity_id: subEntity?.id || paymentEntity?.id || null,
      payload,
      status: 'processed',
      processed_at: new Date().toISOString(),
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, eventId, eventType, status: 'processed' }));
  } catch (err) {
    console.error('[Razorpay Webhook] Handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Webhook processing error', message: err.message }));
  }
}
