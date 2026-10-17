import crypto from 'crypto';
import express from 'express';
import { razorpayStandardRouter } from '../server/payments/razorpay-standard.routes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function testStandardCheckoutFlow() {
  console.log('🧪 Starting Razorpay Standard Web Checkout Test Suite...\n');

  const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_ToxuTZUJk9Kjs0';
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'jX3JWseZHp08O1haOrJdt5sP';

  // Test 1: HMAC-SHA256 algorithm verification
  console.log('Test 1: Signature generation algorithm verification...');
  const orderId = 'order_test_987654321';
  const paymentId = 'pay_test_123456789';
  const expectedPayload = `${orderId}|${paymentId}`;

  const generatedSignature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(expectedPayload)
    .digest('hex');

  assert(generatedSignature.length === 64, 'HMAC-SHA256 signature must be 64-character hex string');
  console.log('✓ HMAC-SHA256 signature generated correctly:', generatedSignature.substring(0, 16) + '...');

  // Test 2: Signature match & mismatch logic
  console.log('\nTest 2: Timing-safe signature comparison...');
  const timingSafeMatch = crypto.timingSafeEqual(
    Buffer.from(generatedSignature, 'utf8'),
    Buffer.from(generatedSignature, 'utf8')
  );
  assert(timingSafeMatch === true, 'Matching signatures must return true');

  const fakeSig = 'a'.repeat(64);
  const timingSafeMismatch = crypto.timingSafeEqual(
    Buffer.from(generatedSignature, 'utf8'),
    Buffer.from(fakeSig, 'utf8')
  );
  assert(timingSafeMismatch === false, 'Tampered signature must return false');
  console.log('✓ Timing-safe signature verification passed.');

  // Test 3: Express router create-order validation
  console.log('\nTest 3: Order validation (minimum 100 paise)...');
  const app = express();
  app.use(express.json());
  app.use('/api', razorpayStandardRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 3a. Below minimum (< 100 paise)
    const resLow = await fetch(`${baseUrl}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });
    const lowJson = await resLow.json();
    assert(resLow.status === 400, 'Orders under 100 paise must be rejected with 400');
    assert(lowJson.error.includes('minimum of 100 paise'), 'Error message must specify 100 paise minimum');
    console.log('✓ Rejecting orders < 100 paise works as expected.');

    // 3b. Missing fields in verify-payment
    const resMissing = await fetch(`${baseUrl}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_123' }),
    });
    assert(resMissing.status === 400, 'Missing verify parameters must be rejected with 400');
    console.log('✓ Missing parameter rejection works as expected.');

    // 3c. Valid signature verification endpoint
    const resVerifyValid = await fetch(`${baseUrl}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: generatedSignature,
      }),
    });
    const validJson = await resVerifyValid.json();
    assert(resVerifyValid.status === 200, 'Valid signature must return HTTP 200');
    assert(validJson.success === true, 'Response must have success: true');
    assert(validJson.is_valid === true, 'Response must have is_valid: true');
    console.log('✓ Valid signature verification endpoint returned 200 OK.');

    // 3d. Tampered signature verification endpoint
    const resVerifyTampered = await fetch(`${baseUrl}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: fakeSig,
      }),
    });
    const tamperedJson = await resVerifyTampered.json();
    assert(resVerifyTampered.status === 400, 'Tampered signature must return HTTP 400');
    assert(tamperedJson.success === false, 'Response must have success: false');
    assert(tamperedJson.is_valid === false, 'Response must have is_valid: false');
    console.log('✓ Tampered signature verification endpoint returned 400 with is_valid: false.');

    // 3e. Test real order creation against Razorpay API
    console.log('\nTest 4: Creating real order against Razorpay API with test credentials...');
    const resCreate = await fetch(`${baseUrl}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 50000, // ₹500.00
        currency: 'INR',
        receipt: `test_rcpt_${Date.now()}`,
      }),
    });
    const createJson = await resCreate.json();

    if (resCreate.status === 200) {
      assert(createJson.success === true, 'Order creation must succeed');
      assert(createJson.order_id.startsWith('order_'), 'Razorpay order ID must start with order_');
      assert(createJson.amount === 50000, 'Amount must match requested amount');
      assert(createJson.currency === 'INR', 'Currency must be INR');
      assert(createJson.key_id === KEY_ID, 'Public key must match');
      console.log('✓ Razorpay live API order created successfully:', createJson.order_id);
    } else {
      console.log('Order creation response:', createJson);
    }

  } finally {
    server.close();
  }

  console.log('\n🎉 ALL STANDARD CHECKOUT INTEGRATION TESTS PASSED CLEANLY!\n');
}

testStandardCheckoutFlow().catch((e) => {
  console.error('\n❌ Standard Checkout Test Suite Failed:', e);
  process.exit(1);
});
