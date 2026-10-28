const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function runTests() {
  await client.connect();
  console.log('Connected to PostgreSQL. Starting Full Self-Service Joining Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`TEST [${passed + failed + 1}]: ${name} ... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log('FAILED ✗');
      console.error('   -> Error:', err.message);
      failed++;
    }
  }

  // Setup IDs
  const testOwnerId = 'a1111111-1111-4111-a111-111111111111';
  const testManagerId = 'b2222222-2222-4222-a222-222222222222';
  const testApplicantId = 'c3333333-3333-4333-a333-333333333333';
  const testApplicant2Id = 'd4444444-4444-4444-a444-444444444444';
  const testOrgId = 'e5555555-5555-4555-a555-555555555555';
  const testPrivateOrgId = 'f6666666-6666-4666-a666-666666666666';
  const testDeptId = 'd7777777-7777-4777-a777-777777777777';

  // 1. Initial cleanup
  await client.query(`DELETE FROM public.organization_join_requests WHERE org_id IN ($1, $2) OR user_id IN ($3, $4, $5, $6);`, [testOrgId, testPrivateOrgId, testOwnerId, testManagerId, testApplicantId, testApplicant2Id]);
  await client.query(`DELETE FROM public.user_organizations WHERE org_id IN ($1, $2) OR user_id IN ($3, $4, $5, $6);`, [testOrgId, testPrivateOrgId, testOwnerId, testManagerId, testApplicantId, testApplicant2Id]);
  await client.query(`DELETE FROM public.departments WHERE id = $1 OR org_id IN ($2, $3);`, [testDeptId, testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.projects WHERE org_id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.organizations WHERE id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.users WHERE id IN ($1, $2, $3, $4);`, [testOwnerId, testManagerId, testApplicantId, testApplicant2Id]);

  // Seed baseline
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, account_type, account_setup_completed)
    VALUES 
      ($1, 'owner_alpha@testcorp.com', 'Alpha Owner', 'owner', 'organization', true),
      ($2, 'manager_alpha@testcorp.com', 'Alpha Manager', 'manager', 'organization', true),
      ($3, 'applicant_beta@gmail.com', 'Beta Applicant', 'general_member', null, false),
      ($4, 'applicant_gamma@gmail.com', 'Gamma Applicant', 'general_member', null, false);
  `, [testOwnerId, testManagerId, testApplicantId, testApplicant2Id]);

  await client.query(`
    INSERT INTO public.organizations (id, name, owner_id, industry, is_discoverable)
    VALUES 
      ($1, 'Stellar Innovations Global', $2, 'Software', true),
      ($3, 'Stealth Private Labs', $2, 'Defense', false);
  `, [testOrgId, testOwnerId, testPrivateOrgId]);

  await client.query(`
    INSERT INTO public.departments (id, org_id, name)
    VALUES ($1, $2, 'Engineering');
  `, [testDeptId, testOrgId]);

  await client.query(`
    INSERT INTO public.user_organizations (user_id, org_id, role)
    VALUES 
      ($1, $2, 'owner'),
      ($3, $2, 'manager');
  `, [testOwnerId, testOrgId, testManagerId]);

  // Project under Stellar Innovations
  await client.query(`
    INSERT INTO public.projects (id, title, org_id, owner_id, status)
    VALUES ('99999999-9999-4999-a999-999999999999', 'Confidential Core Kernel', $1, $2, 'active');
  `, [testOrgId, testOwnerId]);

  // TEST 1: Organization Search by Name
  await test('Search discoverable organizations by name query', async () => {
    const res = await client.query(`SELECT * FROM public.search_discoverable_organizations('Stellar');`);
    if (res.rows.length === 0) throw new Error('Stellar Innovations not found in search');
    const org = res.rows.find(o => o.id === testOrgId);
    if (!org) throw new Error('Expected org not found');
    if (org.name !== 'Stellar Innovations Global') throw new Error(`Wrong name: ${org.name}`);
    if (org.industry !== 'Software') throw new Error(`Wrong industry: ${org.industry}`);
  });

  // TEST 2: Private / Non-discoverable organizations are excluded
  await test('Search excludes non-discoverable / private organizations', async () => {
    const res = await client.query(`SELECT * FROM public.search_discoverable_organizations('Stealth');`);
    const foundPrivate = res.rows.find(o => o.id === testPrivateOrgId);
    if (foundPrivate) throw new Error('Private organization leaked in search!');
  });

  // TEST 3: No sensitive or confidential fields leaked
  await test('Search returns non-sensitive fields and conceals confidential info', async () => {
    const res = await client.query(`SELECT * FROM public.search_discoverable_organizations('Stellar');`);
    const org = res.rows[0];
    const forbidden = ['owner_id', 'gst_number', 'pan_number', 'address', 'billing_email', 'bank_account'];
    for (const field of forbidden) {
      if (org[field] !== undefined) {
        throw new Error(`Confidential field "${field}" leaked in search!`);
      }
    }
  });

  // TEST 4: Submit Join Request without Org ID / Invite Token
  let reqId = null;
  await test('Employee can submit join request for discoverable organization', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    const res = await client.query(`
      SELECT public.submit_join_request($1, 'Senior Backend Engineer', $2) as data;
    `, [testOrgId, testDeptId]);
    await client.query(`COMMIT;`);

    const result = res.rows[0].data;
    if (!result.success || result.status !== 'pending') {
      throw new Error(`Failed to submit request: ${JSON.stringify(result)}`);
    }
    reqId = result.id;
  });

  // TEST 5: Duplicate Pending Request Safety (Idempotent)
  await test('Duplicate pending request is handled safely without error', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    const res = await client.query(`
      SELECT public.submit_join_request($1, 'Senior Backend Engineer') as data;
    `, [testOrgId]);
    await client.query(`COMMIT;`);

    const result = res.rows[0].data;
    if (!result.is_duplicate || result.status !== 'pending') {
      throw new Error(`Expected is_duplicate=true, got: ${JSON.stringify(result)}`);
    }
  });

  // TEST 6: Get User Join Request Status
  await test('Applicant can retrieve their active pending request status', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    const res = await client.query(`SELECT public.get_user_join_request_status() as data;`);
    await client.query(`COMMIT;`);

    const result = res.rows[0].data;
    if (!result.has_pending_request || result.org_name !== 'Stellar Innovations Global') {
      throw new Error(`Invalid status: ${JSON.stringify(result)}`);
    }
  });

  // TEST 7: Cancel Join Request
  await test('Applicant can cancel their pending request', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    const res = await client.query(`SELECT public.cancel_join_request($1) as data;`, [reqId]);
    await client.query(`COMMIT;`);

    const result = res.rows[0].data;
    if (!result.success) throw new Error(`Cancel failed: ${JSON.stringify(result)}`);

    // Verify status is no longer pending
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    const checkRes = await client.query(`SELECT public.get_user_join_request_status() as data;`);
    await client.query(`COMMIT;`);
    if (checkRes.rows[0].data.has_pending_request) {
      throw new Error('has_pending_request is still true after cancellation');
    }
  });

  // Re-submit for approval testing
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
  const reSub = await client.query(`
    SELECT public.submit_join_request($1, 'Lead Architect', $2) as data;
  `, [testOrgId, testDeptId]);
  await client.query(`COMMIT;`);
  reqId = reSub.rows[0].data.id;

  // TEST 8: Self-approval is strictly forbidden
  await test('Security: User cannot approve their own join request', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicantId}", "role": "authenticated"}', true);`);
    let threw = false;
    try {
      await client.query(`SELECT public.approve_organization_join_request($1, 'employee');`, [reqId]);
    } catch (err) {
      threw = true;
    }
    await client.query(`ROLLBACK;`);
    if (!threw) throw new Error('Applicant was able to approve their own request!');
  });

  // TEST 9: Unauthorized user cannot approve join request
  await test('Security: Non-manager cannot approve join requests', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicant2Id}", "role": "authenticated"}', true);`);
    let threw = false;
    try {
      await client.query(`SELECT public.approve_organization_join_request($1, 'employee');`, [reqId]);
    } catch (err) {
      threw = true;
    }
    await client.query(`ROLLBACK;`);
    if (!threw) throw new Error('Unauthorized stranger was able to approve join request!');
  });

  // TEST 10: Unauthorized user cannot self-assign elevated role (e.g. owner)
  await test('Security: Approval fails if attempting to assign unauthorized owner role', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testManagerId}", "role": "authenticated"}', true);`);
    let threw = false;
    try {
      await client.query(`SELECT public.approve_organization_join_request($1, 'owner');`, [reqId]);
    } catch (err) {
      threw = true;
    }
    await client.query(`ROLLBACK;`);
    if (!threw) throw new Error('Manager was able to grant owner role via join approval!');
  });

  // TEST 11: Authorized Management (Manager/Admin/Owner) can review and approve
  await test('Authorized management reviews and approves request with department and role assignment', async () => {
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testManagerId}", "role": "authenticated"}', true);`);
    
    // Check pending list
    const listRes = await client.query(`SELECT * FROM public.get_organization_join_requests($1, 'pending');`, [testOrgId]);
    if (listRes.rows.length === 0) throw new Error('No pending requests found by manager');

    // Approve
    const appRes = await client.query(`
      SELECT public.approve_organization_join_request($1, 'senior_employee', $2, 'Approved by team lead') as data;
    `, [reqId, testDeptId]);
    await client.query(`COMMIT;`);

    const result = appRes.rows[0].data;
    if (!result.success) throw new Error(`Approval failed: ${JSON.stringify(result)}`);

    // Verify membership created in user_organizations
    const memRes = await client.query(`
      SELECT * FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;
    `, [testOrgId, testApplicantId]);
    if (memRes.rows.length === 0 || memRes.rows[0].role !== 'senior_employee') {
      throw new Error(`Membership not created or incorrect role: ${JSON.stringify(memRes.rows[0])}`);
    }

    // Verify user profile activated
    const userRes = await client.query(`
      SELECT account_setup_completed, default_workspace_id, role FROM public.users WHERE id = $1;
    `, [testApplicantId]);
    if (!userRes.rows[0].account_setup_completed || userRes.rows[0].role !== 'senior_employee') {
      throw new Error(`User profile not activated: ${JSON.stringify(userRes.rows[0])}`);
    }
  });

  // TEST 12: Rejection Workflow (Rejected applicant gains 0 access)
  await test('Rejection workflow leaves applicant unapproved with zero memberships', async () => {
    // Submit request as applicant 2
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicant2Id}", "role": "authenticated"}', true);`);
    const sub2 = await client.query(`SELECT public.submit_join_request($1, 'Designer') as data;`, [testOrgId]);
    await client.query(`COMMIT;`);
    const req2Id = sub2.rows[0].data.id;

    // Manager rejects applicant 2
    await client.query(`BEGIN;`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testManagerId}", "role": "authenticated"}', true);`);
    const rejRes = await client.query(`
      SELECT public.reject_organization_join_request($1, 'Position currently filled') as data;
    `, [req2Id]);
    await client.query(`COMMIT;`);

    if (!rejRes.rows[0].data.success) throw new Error('Rejection RPC returned false');

    // Verify applicant 2 has 0 memberships
    const memRes = await client.query(`SELECT * FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;`, [testOrgId, testApplicant2Id]);
    if (memRes.rows.length > 0) throw new Error('Rejected applicant gained membership!');

    // Verify user profile setup completed is false
    const uRes = await client.query(`SELECT account_setup_completed FROM public.users WHERE id = $1;`, [testApplicant2Id]);
    if (uRes.rows[0].account_setup_completed) throw new Error('Rejected user was activated!');
  });

  // Cleanup test data
  await client.query(`DELETE FROM public.organization_join_requests WHERE org_id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.user_organizations WHERE org_id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.projects WHERE org_id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.departments WHERE org_id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.organizations WHERE id IN ($1, $2);`, [testOrgId, testPrivateOrgId]);
  await client.query(`DELETE FROM public.users WHERE id IN ($1, $2, $3, $4);`, [testOwnerId, testManagerId, testApplicantId, testApplicant2Id]);

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log(`========================================\n`);

  await client.end();
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
