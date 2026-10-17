import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';

export const razorpayStandardRouter = Router();

function getRazorpayClient(): { client: any; keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_ToxuTZUJk9Kjs0';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'jX3JWseZHp08O1haOrJdt5sP';

  const client = new (Razorpay as any)({
    key_id: keyId,
    key_secret: keySecret,
  });

  return { client, keyId, keySecret };
}

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order
 * Request body: { amount (in paise, >= 100), currency?: string, receipt?: string, notes?: object }
 * Return: { order_id, amount, currency, key_id }
 */
razorpayStandardRouter.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validate amount: minimum 100 paise (₹1.00)
    if (typeof amount !== 'number' || isNaN(amount)) {
      res.status(400).json({
        error: 'Invalid amount. Amount must be a number in paise (100 paise = ₹1.00).',
      });
      return;
    }

    if (amount < 100) {
      res.status(400).json({
        error: 'Amount too small. Razorpay orders require a minimum of 100 paise (₹1.00).',
      });
      return;
    }

    const { client, keyId } = getRazorpayClient();

    // Call Razorpay API to create standard order
    const orderReceipt = receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const orderOptions = {
      amount: Math.round(amount),
      currency: (currency || 'INR').toUpperCase(),
      receipt: orderReceipt,
      notes: notes || {},
    };

    console.log('[Razorpay Standard] Creating order:', orderOptions);
    const order = await client.orders.create(orderOptions);

    console.log('[Razorpay Standard] Order created successfully:', order.id);

    res.status(200).json({
      success: true,
      order_id: order.id,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      key_id: keyId,
    });
  } catch (err: any) {
    console.error('[Razorpay Standard] Error creating order:', err);
    res.status(500).json({
      error: 'Failed to create Razorpay order',
      message: err.error?.description || err.message || 'Razorpay gateway error',
    });
  }
});

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 */
razorpayStandardRouter.post('/verify-payment', (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // support alternate parameter naming if client passes camelCase
      order_id,
      payment_id,
      signature,
    } = req.body;

    const orderId = razorpay_order_id || order_id;
    const paymentId = razorpay_payment_id || payment_id;
    const clientSignature = razorpay_signature || signature;

    // Validate missing fields
    if (!orderId || !paymentId || !clientSignature) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields for signature verification. Required: order_id, payment_id, signature.',
      });
      return;
    }

    const { keySecret } = getRazorpayClient();

    // Compute expected HMAC-SHA256 signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(clientSignature, 'utf8')
    );

    if (!isMatch) {
      console.warn(`[Razorpay Standard] Signature mismatch for order ${orderId} and payment ${paymentId}`);
      res.status(400).json({
        success: false,
        error: 'Payment verification failed: Signature mismatch',
        is_valid: false,
      });
      return;
    }

    console.log(`[Razorpay Standard] Payment verified successfully for order ${orderId}, payment ${paymentId}`);

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      is_valid: true,
      order_id: orderId,
      payment_id: paymentId,
      verified_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Razorpay Standard] Error during signature verification:', err);
    res.status(500).json({
      success: false,
      error: 'Internal error during payment verification',
      message: err.message,
    });
  }
});
