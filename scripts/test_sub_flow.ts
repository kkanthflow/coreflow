import { supabaseAdmin } from '../server/_core/supabase.js';
import { SubscriptionService } from '../server/subscriptions/subscription.service.js';

async function main() {
  console.log('Testing Supabase Admin subscriptions operations:');
  
  const testSub = {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '7f76bf0c-2ed9-4f79-ac12-da06c25079e1',
    organization_id: 'a1641901-1ce1-400c-bb20-c723710da323',
    customer_type: 'organization' as const,
    payer_user_id: '7f76bf0c-2ed9-4f79-ac12-da06c25079e1',
    workspace_type: 'organization' as const,
    plan_tier: 'business_pro' as const,
    plan_interval: 'monthly' as const,
    razorpay_subscription_id: 'sub_test_check_persist',
    status: 'active' as const,
    payment_status: 'paid' as const,
    cancel_at_period_end: false,
    total_count: 12,
    paid_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(testSub, { onConflict: 'razorpay_subscription_id' })
    .select()
    .single();

  console.log('Upsert result:', { data: !!data, error });

  // Clean up test sub
  await supabaseAdmin.from('subscriptions').delete().eq('razorpay_subscription_id', 'sub_test_check_persist');

  // Now test getActiveSubscription
  const orgSub = await SubscriptionService.getActiveSubscription({
    userId: '7f76bf0c-2ed9-4f79-ac12-da06c25079e1',
    orgId: 'a1641901-1ce1-400c-bb20-c723710da323',
  });
  console.log('getActiveSubscription with orgId:', {
    hasSub: !!orgSub,
    tier: orgSub?.plan_tier,
    status: orgSub?.status,
  });

  const nullOrgSub = await SubscriptionService.getActiveSubscription({
    userId: '7f76bf0c-2ed9-4f79-ac12-da06c25079e1',
    orgId: null,
  });
  console.log('getActiveSubscription with orgId=null:', {
    hasSub: !!nullOrgSub,
    tier: nullOrgSub?.plan_tier,
    status: nullOrgSub?.status,
  });
}

main().catch(console.error);
