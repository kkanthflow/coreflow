/**
 * AUVRYN — Global Supabase Integration & Account Data Integrity Verification Suite
 * 
 * Tests:
 * 1. kk5480346@gmail.com data access (verifies 2 invoices and 1 client).
 * 2. Organization owner access and membership synchronization.
 * 3. Client account access (ejoucit@gmail.com client access to invoices, draft protection).
 * 4. Freelancer account access and workspace isolation.
 * 5. Self-service organization joining flow (search, request, management approval, RBAC).
 * 6. Cross-account & organization isolation (pending users blocked from org data).
 * 7. Analytics and Dashboard query compatibility (no 400 Bad Request errors).
 */

const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function runTests() {
  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('AUVRYN: GLOBAL SUPABASE INTEGRATION & DATA INTEGRITY TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failedTests++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 1: kk5480346@gmail.com DATA ACCESS & INTEGRITY
  // -------------------------------------------------------------------------
  console.log('─── TEST SUITE 1: Verified User Profile & Records Recovery ───');
  
  const userRes = await pgClient.query(`
    SELECT id, email, role, default_workspace_id, account_type, account_setup_completed 
    FROM public.users 
    WHERE email = 'kk5480346@gmail.com'
  `);
  const user = userRes.rows[0];
  assert(user !== undefined, 'User kk5480346@gmail.com exists in public.users');
  assert(user?.account_type === 'organization', 'Account type is organization');
  assert(user?.account_setup_completed === true, 'Account setup is completed (not blocked in onboarding)');
  assert(user?.role === 'owner', 'Role is owner');

  // Verify Skavelon Technologies owner_id
  const orgRes = await pgClient.query(`
    SELECT id, name, owner_id 
    FROM public.organizations 
    WHERE id = $1
  `, [user?.default_workspace_id]);
  const org = orgRes.rows[0];
  assert(org?.owner_id === user?.id, 'Organization owner_id is synced to authenticated user ID');

  // Verify RLS Invoices query under user session
  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claim.sub" = '${user.id}';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.email" = '${user.email}';`);

  const invQuery = await pgClient.query(`
    SELECT id, invoice_number, total_amount, paid_amount, balance_due, status 
    FROM public.invoices 
    WHERE is_deleted = false AND (organization_id = $1 OR (organization_id IS NULL AND owner_id = $2))
    ORDER BY invoice_number;
  `, [org.id, user.id]);

  assert(invQuery.rows.length === 2, `User can access exactly 2 invoices under RLS (Found: ${invQuery.rows.length})`);
  const invNumbers = invQuery.rows.map(i => i.invoice_number);
  assert(invNumbers.includes('INV-381608') && invNumbers.includes('INV-544320'), 'Invoices INV-381608 and INV-544320 retrieved cleanly');

  // Verify RLS Clients query under user session
  const clientQuery = await pgClient.query(`
    SELECT id, name, email 
    FROM public.clients 
    WHERE is_deleted = false AND (organization_id = $1 OR (organization_id IS NULL AND owner_id = $2));
  `, [org.id, user.id]);

  assert(clientQuery.rows.length === 1, `User can access exactly 1 client under RLS (Found: ${clientQuery.rows.length})`);
  assert(clientQuery.rows[0]?.name === 'EJOUMALE', `Client entity name is EJOUMALE (Found: ${clientQuery.rows[0]?.name})`);

  await pgClient.query('ROLLBACK;');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: CLIENT PORTAL ACCESS & FINANCIAL PRIVACY
  // -------------------------------------------------------------------------
  console.log('\n─── TEST SUITE 2: Client Portal Account & Draft Privacy ───');
  
  const clientUserRes = await pgClient.query(`
    SELECT id, email, role, account_type, account_setup_completed 
    FROM public.users 
    WHERE email = 'ejoucit@gmail.com'
  `);
  const clientUser = clientUserRes.rows[0];
  assert(clientUser !== undefined, 'Client user ejoucit@gmail.com exists');
  assert(clientUser?.role === 'client', 'Client user role is client');
  assert(clientUser?.account_setup_completed === true, 'Client user account_setup_completed is true');

  // Simulate client user session
  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claim.sub" = '${clientUser.id}';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.email" = '${clientUser.email}';`);

  const clientInvoices = await pgClient.query(`
    SELECT id, invoice_number, total_amount, status 
    FROM public.invoices 
    WHERE is_deleted = false
  `);
  assert(clientInvoices.rows.length >= 2, `Client receives their authorized project invoices under RLS (Found: ${clientInvoices.rows.length})`);

  // Verify client cannot see drafts from other organizations
  const clientDrafts = clientInvoices.rows.filter(i => i.status === 'draft');
  assert(clientDrafts.length === 0, 'Client is strictly prevented from seeing draft invoices');

  await pgClient.query('ROLLBACK;');

  // -------------------------------------------------------------------------
  // TEST SUITE 3: FREELANCER WORKSPACE ACCESS & PERMISSIONS
  // -------------------------------------------------------------------------
  console.log('\n─── TEST SUITE 3: Freelancer Account & Workspace Access ───');

  const freelancerRes = await pgClient.query(`
    SELECT id, email, role, account_type, default_workspace_id, account_setup_completed 
    FROM public.users 
    WHERE role = 'freelancer' OR account_type = 'freelancer'
    LIMIT 1;
  `);
  const freelancer = freelancerRes.rows[0];
  if (freelancer) {
    assert(freelancer.account_type === 'freelancer', 'Freelancer account_type is freelancer');
    assert(freelancer.account_setup_completed === true, 'Freelancer account_setup_completed is true');

    // Test permission check
    const permRes = await pgClient.query(`
      SELECT public.has_permission($1, 'create_invoices') as can_invoice,
             public.has_permission($1, 'manage_organization') as can_manage_org;
    `, [freelancer.id]);
    assert(permRes.rows[0].can_invoice === true, 'Freelancer has permission to create invoices');
    assert(permRes.rows[0].can_manage_org === false, 'Freelancer is prevented from managing organizations');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: SELF-SERVICE JOIN WORKFLOW & ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n─── TEST SUITE 4: Organization Self-Service Join & RBAC Isolation ───');

  // Create temporary test applicant
  const testApplicantId = '99999999-0000-0000-0000-000000000001';
  const testApplicantEmail = 'test_applicant_integrity@example.com';

  // Clean previous test data if any
  await pgClient.query(`DELETE FROM public.organization_join_requests WHERE user_id = $1`, [testApplicantId]);
  await pgClient.query(`DELETE FROM public.user_organizations WHERE user_id = $1`, [testApplicantId]);
  await pgClient.query(`DELETE FROM public.users WHERE id = $1`, [testApplicantId]);

  // Insert applicant into public.users (simulating fresh signup)
  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role, account_type, account_setup_completed, default_workspace_id)
    VALUES ($1, $2, 'Jane Applicant', 'general_member', NULL, false, NULL)
  `, [testApplicantId, testApplicantEmail]);

  // Test 4A: Search discoverable organization
  const searchRes = await pgClient.query(`
    SELECT * FROM public.search_discoverable_organizations('Skavelon');
  `);
  assert(searchRes.rows.length >= 1, `Organization search finds discoverable orgs by name (Found: ${searchRes.rows.length})`);
  assert(searchRes.rows[0]?.name.toLowerCase().includes('skavelon'), 'Search result contains Skavelon Technologies');

  // Test 4B: Submit join request as applicant
  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claim.sub" = '${testApplicantId}';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.email" = '${testApplicantEmail}';`);

  const submitRes = await pgClient.query(`
    SELECT public.submit_join_request($1, 'Frontend Engineer') as result;
  `, [org.id]);
  const submitData = submitRes.rows[0].result;
  assert(submitData.success === true, 'Join request submitted successfully via RPC');
  assert(submitData.status === 'pending', 'Join request initial status is pending');

  // Test 4C: Verify pending applicant is BLOCKED from organization data under RLS
  const blockedInvoices = await pgClient.query(`
    SELECT * FROM public.invoices WHERE organization_id = $1;
  `, [org.id]);
  assert(blockedInvoices.rows.length === 0, 'Pending applicant is strictly blocked from reading organization invoices');

  const blockedClients = await pgClient.query(`
    SELECT * FROM public.clients WHERE organization_id = $1;
  `, [org.id]);
  assert(blockedClients.rows.length === 0, 'Pending applicant is strictly blocked from reading organization clients');

  await pgClient.query('COMMIT;');

  // Test 4D: Org Manager approves join request with assigned role
  await pgClient.query('BEGIN;');
  await pgClient.query('SET LOCAL ROLE authenticated;');
  await pgClient.query(`SET LOCAL "request.jwt.claim.sub" = '${user.id}';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.email" = '${user.email}';`);

  const approveRes = await pgClient.query(`
    SELECT public.approve_organization_join_request($1, 'employee', NULL, 'Welcome to the team!') as result;
  `, [submitData.request_id]);
  assert(approveRes.rows[0].result.success === true, 'Authorized manager approved join request via RPC');

  await pgClient.query('COMMIT;');

  // Approval already completed by RPC!

  // Verify approved user's updated profile and data access
  const approvedUser = (await pgClient.query(`SELECT * FROM public.users WHERE id = $1`, [testApplicantId])).rows[0];
  assert(approvedUser.account_type === 'organization', 'Approved user account_type is organization');
  assert(approvedUser.account_setup_completed === true, 'Approved user account_setup_completed is true');
  assert(approvedUser.default_workspace_id === org.id, 'Approved user default_workspace_id set to org ID');

  // Verify employee has baseline employee permissions but cannot delete invoices
  const employeePerms = await pgClient.query(`
    SELECT public.has_permission($1, 'view_projects') as can_view_projects,
           public.has_permission($1, 'delete_invoices') as can_delete_invoices;
  `, [testApplicantId]);
  assert(employeePerms.rows[0].can_view_projects === true, 'Approved employee can view projects');
  assert(employeePerms.rows[0].can_delete_invoices === false, 'Approved employee cannot delete invoices (RBAC strictly enforced)');

  // Clean up test applicant
  await pgClient.query(`DELETE FROM public.organization_join_requests WHERE user_id = $1`, [testApplicantId]);
  await pgClient.query(`DELETE FROM public.user_organizations WHERE user_id = $1`, [testApplicantId]);
  await pgClient.query(`DELETE FROM public.users WHERE id = $1`, [testApplicantId]);

  // -------------------------------------------------------------------------
  // TEST SUITE 5: ANALYTICS & DASHBOARD SCHEMA VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n─── TEST SUITE 5: Analytics & Dashboard Query Compatibility ───');

  // Verify Analytics query executes without 400 Bad Request error
  try {
    const analyticsRes = await pgClient.query(`
      SELECT id, status, total_amount, paid_amount, balance_due 
      FROM public.invoices 
      WHERE is_deleted = false AND organization_id = $1;
    `, [org.id]);
    assert(true, 'Analytics query using paid_amount executes with 0 errors');
    assert(analyticsRes.rows.length === 2, `Analytics loaded ${analyticsRes.rows.length} invoices for telemetry`);
  } catch (err) {
    assert(false, 'Analytics query failed', err.message);
  }

  // Verify Dashboard metric query
  try {
    const dashInvoices = await pgClient.query(`
      SELECT id, invoice_number, total_amount, paid_amount, balance_due, status 
      FROM public.invoices 
      WHERE is_deleted = false AND (organization_id = $1 OR (organization_id IS NULL AND owner_id = $2));
    `, [org.id, user.id]);

    const dashClients = await pgClient.query(`
      SELECT count(*) 
      FROM public.clients 
      WHERE is_deleted = false AND (organization_id = $1 OR (organization_id IS NULL AND owner_id = $2));
    `, [org.id, user.id]);

    assert(dashInvoices.rows.length === 2, `Dashboard invoices count is 2 (Found: ${dashInvoices.rows.length})`);
    assert(parseInt(dashClients.rows[0].count) === 1, `Dashboard clients count is 1 (Found: ${dashClients.rows[0].count})`);
  } catch (err) {
    assert(false, 'Dashboard queries failed', err.message);
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('═══════════════════════════════════════════════════════════════');

  await pgClient.end();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
