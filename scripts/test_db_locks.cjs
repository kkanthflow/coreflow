const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function testDatabaseLocks() {
  await client.connect();
  console.log('--- Testing PostgreSQL Subscription Lock Scenarios ---');

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testOrgId = '22222222-2222-2222-2222-222222222222';

  // 1. Clean up any previous test subscriptions
  await client.query('DELETE FROM public.subscriptions WHERE user_id = $1 OR organization_id = $2', [testUserId, testOrgId]);

  // Scenario A: Pending paid subscription (Payment unverified)
  await client.query(`
    INSERT INTO public.subscriptions (
      id, user_id, plan_tier, plan_interval, status, payment_status,
      razorpay_subscription_id, current_period_start, current_period_end, created_at
    ) VALUES (
      gen_random_uuid(), $1, 'freelancer_pro', 'monthly', 'pending', 'pending',
      'sub_test_pending_lock', NOW(), NOW() + INTERVAL '1 month', NOW()
    )
  `, [testUserId]);

  const resPending = await client.query('SELECT * FROM public.fn_get_effective_limits($1, NULL)', [testUserId]);
  console.log('Scenario A (Pending subscription):', {
    tier: resPending.rows[0].out_plan_tier,
    maxProjects: resPending.rows[0].out_max_projects,
    isLocked: resPending.rows[0].out_is_locked
  });
  if (resPending.rows[0].out_plan_tier !== 'freelancer_free' || resPending.rows[0].out_max_projects !== 3 || !resPending.rows[0].out_is_locked) {
    throw new Error('Scenario A failed: pending subscription was not locked to freelancer_free!');
  }

  // Scenario B: Active paid subscription
  await client.query('DELETE FROM public.subscriptions WHERE user_id = $1', [testUserId]);
  await client.query(`
    INSERT INTO public.subscriptions (
      id, user_id, plan_tier, plan_interval, status, payment_status,
      razorpay_subscription_id, current_period_start, current_period_end, created_at
    ) VALUES (
      gen_random_uuid(), $1, 'freelancer_starter', 'monthly', 'active', 'paid',
      'sub_test_active_paid', NOW(), NOW() + INTERVAL '1 month', NOW()
    )
  `, [testUserId]);

  const resActive = await client.query('SELECT * FROM public.fn_get_effective_limits($1, NULL)', [testUserId]);
  console.log('Scenario B (Active subscription):', {
    tier: resActive.rows[0].out_plan_tier,
    maxProjects: resActive.rows[0].out_max_projects,
    isLocked: resActive.rows[0].out_is_locked
  });
  if (resActive.rows[0].out_plan_tier !== 'freelancer_starter' || resActive.rows[0].out_max_projects !== 10 || resActive.rows[0].out_is_locked) {
    throw new Error('Scenario B failed: active subscription was not granted freelancer_starter limits!');
  }

  // Scenario C: Suspended subscription
  await client.query('DELETE FROM public.subscriptions WHERE user_id = $1', [testUserId]);
  await client.query(`
    INSERT INTO public.subscriptions (
      id, user_id, plan_tier, plan_interval, status, payment_status,
      razorpay_subscription_id, current_period_start, current_period_end, created_at
    ) VALUES (
      gen_random_uuid(), $1, 'freelancer_pro', 'monthly', 'suspended', 'failed',
      'sub_test_suspended', NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 month', NOW()
    )
  `, [testUserId]);

  const resSuspended = await client.query('SELECT * FROM public.fn_get_effective_limits($1, NULL)', [testUserId]);
  console.log('Scenario C (Suspended subscription):', {
    tier: resSuspended.rows[0].out_plan_tier,
    maxProjects: resSuspended.rows[0].out_max_projects,
    isLocked: resSuspended.rows[0].out_is_locked
  });
  if (resSuspended.rows[0].out_plan_tier !== 'freelancer_free' || resSuspended.rows[0].out_max_projects !== 3 || !resSuspended.rows[0].out_is_locked) {
    throw new Error('Scenario C failed: suspended subscription was not locked to freelancer_free!');
  }

  // Scenario D: Organization Past Due beyond 3-day grace period
  await client.query(`
    INSERT INTO public.subscriptions (
      id, user_id, organization_id, plan_tier, plan_interval, status, payment_status,
      razorpay_subscription_id, current_period_start, current_period_end, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, 'business_pro', 'monthly', 'past_due', 'pending',
      'sub_test_org_past_due', NOW() - INTERVAL '35 days', NOW() - INTERVAL '5 days', NOW()
    )
  `, [testUserId, testOrgId]);

  const resPastDue = await client.query('SELECT * FROM public.fn_get_effective_limits($1, $2)', [testUserId, testOrgId]);
  console.log('Scenario D (Org Past Due beyond grace period):', {
    tier: resPastDue.rows[0].out_plan_tier,
    maxProjects: resPastDue.rows[0].out_max_projects,
    maxSeats: resPastDue.rows[0].out_max_seats,
    isLocked: resPastDue.rows[0].out_is_locked
  });
  if (resPastDue.rows[0].out_plan_tier !== 'business_free' || resPastDue.rows[0].out_max_projects !== 5 || resPastDue.rows[0].out_max_seats !== 3 || !resPastDue.rows[0].out_is_locked) {
    throw new Error('Scenario D failed: past due org was not locked to business_free!');
  }

  // Cleanup
  await client.query('DELETE FROM public.subscriptions WHERE user_id = $1 OR organization_id = $2', [testUserId, testOrgId]);
  console.log('✅ ALL DATABASE LOCK SCENARIOS PASSED WITH 100% ACCURACY!');

  await client.end();
}

testDatabaseLocks().catch(err => {
  console.error(err);
  process.exit(1);
});
