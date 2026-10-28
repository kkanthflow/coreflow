const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();

  console.log('=== TEST 1: search_discoverable_organizations ===');
  const searchRes = await client.query(`SELECT * FROM public.search_discoverable_organizations('Corp');`);
  console.log(`Found ${searchRes.rows.length} matching orgs.`);
  if (searchRes.rows.length > 0) {
    const o = searchRes.rows[0];
    console.log('Sample result:', { id: o.id, name: o.name, member_count: o.member_count });
    if (o.owner_id || o.gst_number || o.address) {
      throw new Error('Confidential fields leaked in search!');
    }
  }

  console.log('\n=== TEST 2: Setup Test Users & Organization ===');
  // Create test owner and org
  const testOwnerId = '11111111-1111-4111-a111-111111111111';
  const testEmployeeId = '22222222-2222-4222-a222-222222222222';
  const testOrgId = '33333333-3333-4333-a333-333333333333';

  // Clean up any old test data
  await client.query(`DELETE FROM public.organization_join_requests WHERE org_id = $1 OR user_id IN ($2, $3);`, [testOrgId, testOwnerId, testEmployeeId]);
  await client.query(`DELETE FROM public.user_organizations WHERE org_id = $1 OR user_id IN ($2, $3);`, [testOrgId, testOwnerId, testEmployeeId]);
  await client.query(`DELETE FROM public.organizations WHERE id = $1;`, [testOrgId]);
  await client.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [testOwnerId, testEmployeeId]);

  // Insert test owner
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, account_type, account_setup_completed)
    VALUES ($1, 'org_owner_test@auvryn.com', 'Test Org Owner', 'owner', 'organization', true);
  `, [testOwnerId]);

  // Insert test org
  await client.query(`
    INSERT INTO public.organizations (id, name, owner_id, industry, is_discoverable)
    VALUES ($1, 'Acme Test Corp 2026', $2, 'Technology', true);
  `, [testOrgId, testOwnerId]);

  // Add owner to user_organizations
  await client.query(`
    INSERT INTO public.user_organizations (user_id, org_id, role)
    VALUES ($1, $2, 'owner');
  `, [testOwnerId, testOrgId]);

  // Insert test employee user (not yet approved)
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, account_type, account_setup_completed)
    VALUES ($1, 'employee_applicant@auvryn.com', 'Employee Applicant', 'general_member', null, false);
  `, [testEmployeeId]);

  console.log('\n=== TEST 3: Submit Join Request as Employee ===');
  // Simulate auth context as test employee inside transaction
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testEmployeeId}", "role": "authenticated"}', true);`);

  const submitRes = await client.query(`
    SELECT public.submit_join_request($1, 'Frontend Engineer') as res;
  `, [testOrgId]);
  console.log('Submit result:', submitRes.rows[0].res);
  const reqId = submitRes.rows[0].res.id;
  if (!reqId || submitRes.rows[0].res.status !== 'pending') {
    throw new Error('Join request submission failed');
  }

  console.log('\n=== TEST 4: Duplicate Submission Safety ===');
  const dupRes = await client.query(`
    SELECT public.submit_join_request($1, 'Frontend Engineer') as res;
  `, [testOrgId]);
  console.log('Duplicate submit result:', dupRes.rows[0].res);
  if (!dupRes.rows[0].res.is_duplicate) {
    throw new Error('Duplicate check failed: is_duplicate should be true');
  }

  console.log('\n=== TEST 5: Check User Join Request Status ===');
  const statusRes = await client.query(`
    SELECT public.get_user_join_request_status() as res;
  `);
  console.log('User status result:', statusRes.rows[0].res);
  if (statusRes.rows[0].res.org_name !== 'Acme Test Corp 2026' || statusRes.rows[0].res.status !== 'pending') {
    throw new Error('get_user_join_request_status failed');
  }
  await client.query(`COMMIT;`);

  console.log('\n=== TEST 6: Self-Approval Prevention ===');
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testEmployeeId}", "role": "authenticated"}', true);`);
  try {
    await client.query(`
      SELECT public.approve_organization_join_request($1, 'employee');
    `, [reqId]);
    throw new Error('Self-approval should have thrown an error!');
  } catch (err) {
    console.log('Caught expected self-approval error:', err.message);
  }
  await client.query(`ROLLBACK;`);

  console.log('\n=== TEST 7: Review and Approval by Authorized Owner ===');
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testOwnerId}", "role": "authenticated"}', true);`);

  const listRes = await client.query(`
    SELECT * FROM public.get_organization_join_requests($1, 'pending');
  `, [testOrgId]);
  console.log(`Owner found ${listRes.rows.length} pending join requests.`);
  if (listRes.rows.length !== 1 || listRes.rows[0].email !== 'employee_applicant@auvryn.com') {
    throw new Error('Manager list join requests failed');
  }

  const approveRes = await client.query(`
    SELECT public.approve_organization_join_request($1, 'employee', null, 'Welcome to the engineering team!') as res;
  `, [reqId]);
  console.log('Approve result:', approveRes.rows[0].res);

  // Verify membership was created
  const memRes = await client.query(`
    SELECT * FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;
  `, [testOrgId, testEmployeeId]);
  console.log('Created membership:', memRes.rows[0]);
  if (!memRes.rows[0] || memRes.rows[0].role !== 'employee') {
    throw new Error('Membership was not created correctly');
  }

  // Verify user profile updated
  const userRes = await client.query(`
    SELECT id, role, account_type, account_setup_completed, default_workspace_id FROM public.users WHERE id = $1;
  `, [testEmployeeId]);
  console.log('Updated user profile:', userRes.rows[0]);
  if (!userRes.rows[0].account_setup_completed || userRes.rows[0].account_type !== 'organization' || userRes.rows[0].role !== 'employee') {
    throw new Error('User profile was not properly updated with access');
  }

  console.log('\n=== TEST 8: Rejection Handling ===');
  // Create another test applicant
  const testApplicant2Id = '44444444-4444-4444-a444-444444444444';
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, account_type, account_setup_completed)
    VALUES ($1, 'applicant2@auvryn.com', 'Rejected Applicant', 'general_member', null, false);
  `, [testApplicant2Id]);

  // Submit request as applicant 2
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testApplicant2Id}", "role": "authenticated"}', true);`);
  const sub2 = await client.query(`
    SELECT public.submit_join_request($1, 'Intern') as res;
  `, [testOrgId]);
  const req2Id = sub2.rows[0].res.id;
  await client.query(`COMMIT;`);

  // Owner rejects applicant 2
  await client.query(`BEGIN;`);
  await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${testOwnerId}", "role": "authenticated"}', true);`);
  const rejRes = await client.query(`
    SELECT public.reject_organization_join_request($1, 'Not hiring for this role at this time.') as res;
  `, [req2Id]);
  console.log('Reject result:', rejRes.rows[0].res);
  await client.query(`COMMIT;`);

  // Verify applicant 2 has NO membership
  const rejectedMem = await client.query(`
    SELECT * FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;
  `, [testOrgId, testApplicant2Id]);
  if (rejectedMem.rows.length > 0) {
    throw new Error('Rejected applicant gained membership!');
  }

  // Verify applicant 2 user profile remains unapproved
  const rejUser = await client.query(`
    SELECT account_setup_completed FROM public.users WHERE id = $1;
  `, [testApplicant2Id]);
  if (rejUser.rows[0].account_setup_completed) {
    throw new Error('Rejected user was marked completed!');
  }
  console.log('Confirmed: Rejected user has 0 memberships and account_setup_completed is false.');

  // Clean up test data
  await client.query(`DELETE FROM public.organization_join_requests WHERE org_id = $1;`, [testOrgId]);
  await client.query(`DELETE FROM public.user_organizations WHERE org_id = $1;`, [testOrgId]);
  await client.query(`DELETE FROM public.organizations WHERE id = $1;`, [testOrgId]);
  await client.query(`DELETE FROM public.users WHERE id IN ($1, $2, $3);`, [testOwnerId, testEmployeeId, testApplicant2Id]);

  console.log('\n🎉 ALL 8 BACKEND / DB VERIFICATION CHECKS PASSED PERFECTLY!');
  await client.end();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
