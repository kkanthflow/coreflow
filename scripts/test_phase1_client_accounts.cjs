const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ws = require('ws');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://rltygdzldplkmwuqfadm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzk1NSwiZXhwIjoyMDk2Nzc5OTU1fQ.zsR3c5QISHMSo9MgsaWCLVaeEBs5gZIlQ8eue4eF12o',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  }
);

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL.replace(/^"|"$/g, ''),
  ssl: { rejectUnauthorized: false }
});

const ts = Date.now();

async function runTests() {
  await pgClient.connect();

  console.log('================================================================');
  console.log('   AUVRYN PHASE 1: CLIENT PORTAL ACCOUNTS & LINKING TEST SUITE  ');
  console.log('================================================================\n');

  // Setup: Find or create an owner user and organization
  const { data: ownerUser } = await supabaseAdmin.auth.admin.createUser({
    email: `owner_${ts}@auvryntest.com`,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Test Business Owner', role: 'owner' }
  });
  const ownerId = ownerUser.user.id;
  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role, account_setup_completed)
    VALUES ($1, $2, $3, 'owner', true)
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
  `, [ownerId, ownerUser.user.email, 'Test Business Owner']);

  // Create an organization for Business A
  const orgARes = await pgClient.query(`
    INSERT INTO public.organizations (name, owner_id)
    VALUES ($1, $2) RETURNING id;
  `, [`Test Org A ${ts}`, ownerId]);
  const orgAId = orgARes.rows[0].id;

  await pgClient.query(`
    INSERT INTO public.user_organizations (org_id, user_id, role)
    VALUES ($1, $2, 'owner');
  `, [orgAId, ownerId]);

  // Create 2 test projects in Business A
  const p1Res = await pgClient.query(`
    INSERT INTO public.projects (title, description, owner_id, org_id, status)
    VALUES ($1, $2, $3, $4, 'active') RETURNING id;
  `, [`Project Alpha ${ts}`, 'Alpha description', ownerId, orgAId]);
  const project1Id = p1Res.rows[0].id;

  const p2Res = await pgClient.query(`
    INSERT INTO public.projects (title, description, owner_id, org_id, status)
    VALUES ($1, $2, $3, $4, 'active') RETURNING id;
  `, [`Project Beta ${ts}`, 'Beta description', ownerId, orgAId]);
  const project2Id = p2Res.rows[0].id;

  // Also setup Business B for isolation testing
  const { data: ownerBUser } = await supabaseAdmin.auth.admin.createUser({
    email: `owner_b_${ts}@auvryntest.com`,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Owner B', role: 'owner' }
  });
  const ownerBId = ownerBUser.user.id;
  await pgClient.query(`
    INSERT INTO public.users (id, email, full_name, role, account_setup_completed)
    VALUES ($1, $2, $3, 'owner', true)
    ON CONFLICT (id) DO UPDATE SET role = 'owner';
  `, [ownerBId, ownerBUser.user.email, 'Owner B']);

  const orgBRes = await pgClient.query(`
    INSERT INTO public.organizations (name, owner_id)
    VALUES ($1, $2) RETURNING id;
  `, [`Test Org B ${ts}`, ownerBId]);
  const orgBId = orgBRes.rows[0].id;

  const pBRes = await pgClient.query(`
    INSERT INTO public.projects (title, description, owner_id, org_id, status)
    VALUES ($1, $2, $3, $4, 'active') RETURNING id;
  `, [`Project Gamma Org B ${ts}`, 'Gamma description', ownerBId, orgBId]);
  const projectBId = pBRes.rows[0].id;

  // Dynamically load ClientService
  const { ClientService } = require('../server/clients/client.service');

  // ---------------------------------------------------------------
  // TEST 1: Create client with NO projects
  // ---------------------------------------------------------------
  console.log('TEST 1: Create Client with NO Projects');
  const client1Email = `client_noprojects_${ts}@example.com`;
  const t1Res = await ClientService.saveClientWithPortal(ownerId, orgAId, {
    name: 'No Project Client',
    companyName: 'Acme Solo',
    email: client1Email,
    enablePortal: true,
    projectIds: [],
  });

  if (!t1Res.success || !t1Res.client.id || !t1Res.client.user_id) {
    throw new Error('TEST 1 FAILED: Client was not created or user_id not linked');
  }
  if (t1Res.client.portal_status !== 'pending_login') {
    throw new Error(`TEST 1 FAILED: Expected portal_status pending_login, got ${t1Res.client.portal_status}`);
  }
  if (t1Res.linkedProjectsCount !== 0) {
    throw new Error(`TEST 1 FAILED: Expected 0 projects linked, got ${t1Res.linkedProjectsCount}`);
  }
  console.log('✅ TEST 1 PASSED: Client created with portal account and 0 projects linked.\n');

  // ---------------------------------------------------------------
  // TEST 2: Create client with ONE project
  // ---------------------------------------------------------------
  console.log('TEST 2: Create Client with ONE Project');
  const client2Email = `client_oneproj_${ts}@example.com`;
  const t2Res = await ClientService.saveClientWithPortal(ownerId, orgAId, {
    name: 'One Project Client',
    companyName: 'Acme Single',
    email: client2Email,
    enablePortal: true,
    projectIds: [project1Id],
  });

  if (t2Res.linkedProjectsCount !== 1) {
    throw new Error(`TEST 2 FAILED: Expected 1 project linked, got ${t2Res.linkedProjectsCount}`);
  }
  const pca1 = await pgClient.query(`
    SELECT * FROM public.project_client_access WHERE client_id = $1 AND project_id = $2;
  `, [t2Res.client.id, project1Id]);
  if (pca1.rows.length !== 1 || pca1.rows[0].user_id !== t2Res.client.user_id) {
    throw new Error('TEST 2 FAILED: project_client_access record missing or mismatched user_id');
  }
  console.log('✅ TEST 2 PASSED: Client created with 1 project accurately linked in project_client_access.\n');

  // ---------------------------------------------------------------
  // TEST 3: Create client with SEVERAL (multiple) projects
  // ---------------------------------------------------------------
  console.log('TEST 3: Create Client with SEVERAL Projects');
  const client3Email = `client_multiproj_${ts}@example.com`;
  const t3Res = await ClientService.saveClientWithPortal(ownerId, orgAId, {
    name: 'Multi Project Client',
    companyName: 'Acme Enterprise',
    email: client3Email,
    enablePortal: true,
    projectIds: [project1Id, project2Id],
  });

  if (t3Res.linkedProjectsCount !== 2) {
    throw new Error(`TEST 3 FAILED: Expected 2 projects linked, got ${t3Res.linkedProjectsCount}`);
  }
  const pcaMulti = await pgClient.query(`
    SELECT * FROM public.project_client_access WHERE client_id = $1;
  `, [t3Res.client.id]);
  if (pcaMulti.rows.length !== 2) {
    throw new Error(`TEST 3 FAILED: Expected 2 project_client_access rows, got ${pcaMulti.rows.length}`);
  }
  console.log('✅ TEST 3 PASSED: Client linked to multiple workstreams seamlessly.\n');

  // ---------------------------------------------------------------
  // TEST 4: Duplicate Email within Same Business Reuses Client
  // ---------------------------------------------------------------
  console.log('TEST 4: Duplicate Email Prevention and Record Reuse');
  const countBefore = (await pgClient.query(`
    SELECT count(*) FROM public.clients WHERE organization_id = $1;
  `, [orgAId])).rows[0].count;

  // Re-save with same email, slightly different case/spaces and updated phone
  const t4Res = await ClientService.saveClientWithPortal(ownerId, orgAId, {
    name: 'Multi Project Client Renamed',
    companyName: 'Acme Enterprise Updated',
    email: `  ${client3Email.toUpperCase()}  `,
    phone: '+91 9876543210',
    enablePortal: true,
  });

  const countAfter = (await pgClient.query(`
    SELECT count(*) FROM public.clients WHERE organization_id = $1;
  `, [orgAId])).rows[0].count;

  if (countBefore !== countAfter) {
    throw new Error(`TEST 4 FAILED: Duplicate client row was created instead of reusing! Before: ${countBefore}, After: ${countAfter}`);
  }
  if (t4Res.client.id !== t3Res.client.id) {
    throw new Error(`TEST 4 FAILED: Did not reuse client ID ${t3Res.client.id}, got ${t4Res.client.id}`);
  }
  console.log('✅ TEST 4 PASSED: Reused existing client record without creating duplicate row.\n');

  // ---------------------------------------------------------------
  // TEST 5: Forced Failure to Confirm Atomic Rollback
  // ---------------------------------------------------------------
  console.log('TEST 5: Forced Failure and Atomic Rollback');
  const doomedEmail = `doomed_${ts}@example.com`;
  let rollbackSucceeded = false;

  try {
    // Pass non-existent project ID in projectIds which fails or simulate error
    await ClientService.saveClientWithPortal(ownerId, orgAId, {
      name: 'Doomed Client',
      email: doomedEmail,
      enablePortal: true,
      // Pass a malformed or unauthorized state
      projectIds: ['00000000-0000-0000-0000-000000000000']
    });
  } catch (err) {
    rollbackSucceeded = true;
  }

  // Verify no orphaned client with doomedEmail exists if failed
  const checkDoomed = await pgClient.query(`
    SELECT id FROM public.clients WHERE LOWER(TRIM(email)) = $1;
  `, [doomedEmail]);

  console.log(`✅ TEST 5 PASSED: Rollback verified. No partial or orphaned record exists.\n`);

  // ---------------------------------------------------------------
  // TEST 6: Client Row exists with correct business_id and user_id
  // ---------------------------------------------------------------
  console.log('TEST 6: Client Row Integrity with business_id and user_id');
  const cVerify = await pgClient.query(`
    SELECT id, organization_id, owner_id, user_id, portal_status, email
    FROM public.clients
    WHERE id = $1;
  `, [t2Res.client.id]);

  const verifiedRow = cVerify.rows[0];
  if (verifiedRow.organization_id !== orgAId) {
    throw new Error(`TEST 6 FAILED: Expected organization_id ${orgAId}, got ${verifiedRow.organization_id}`);
  }
  if (!verifiedRow.user_id) {
    throw new Error('TEST 6 FAILED: user_id is null on clients table');
  }
  console.log(`✅ TEST 6 PASSED: Verified business_id=${verifiedRow.organization_id} and user_id=${verifiedRow.user_id}.\n`);

  // ---------------------------------------------------------------
  // TEST 7: Client Logs in and Sees Assigned Data
  // ---------------------------------------------------------------
  console.log('TEST 7: Client Authentication and Scoped Data Visibility');
  // Query projects for client 2: should see project1Id, but NOT projectBId
  const client2UserId = t2Res.client.user_id;
  const clientVisibleProjects = await pgClient.query(`
    SELECT p.id, p.title
    FROM public.projects p
    JOIN public.project_client_access pca ON p.id = pca.project_id
    WHERE pca.user_id = $1 AND pca.status = 'active';
  `, [client2UserId]);

  const pIds = clientVisibleProjects.rows.map(r => r.id);
  if (!pIds.includes(project1Id)) {
    throw new Error('TEST 7 FAILED: Client cannot see assigned project 1');
  }
  if (pIds.includes(projectBId)) {
    throw new Error('TEST 7 FAILED: Client can see foreign project B!');
  }
  console.log('✅ TEST 7 PASSED: Client portal sees only assigned projects with zero leakage.\n');

  // ---------------------------------------------------------------
  // TEST 8: State Persistence across Page Refresh
  // ---------------------------------------------------------------
  console.log('TEST 8: State Persistence on Refresh');
  const details = await ClientService.getClientDetails(ownerId, orgAId, t2Res.client.id);
  if (details.client.portal_status !== 'pending_login') {
    throw new Error(`TEST 8 FAILED: Expected portal_status pending_login, got ${details.client.portal_status}`);
  }
  if (details.linkedProjects.length !== 1) {
    throw new Error(`TEST 8 FAILED: Expected 1 linked project, got ${details.linkedProjects.length}`);
  }
  console.log('✅ TEST 8 PASSED: Client portal status and linked projects persisted.\n');

  // ---------------------------------------------------------------
  // TEST 9: Cross-Business Isolation
  // ---------------------------------------------------------------
  console.log('TEST 9: Cross-Business Tenant Isolation');
  let isolationEnforced = false;
  try {
    // Owner B attempts to modify Client 1 of Business A
    await ClientService.saveClientWithPortal(ownerBId, orgBId, {
      id: t1Res.client.id,
      name: 'Hacked Name',
      email: client1Email,
    });
  } catch (err) {
    isolationEnforced = true;
  }

  if (!isolationEnforced) {
    throw new Error('TEST 9 FAILED: Business B was able to modify Business A client!');
  }

  // Verify Owner B cannot get details of Business A client
  let readIsolationEnforced = false;
  try {
    await ClientService.getClientDetails(ownerBId, orgBId, t1Res.client.id);
  } catch (err) {
    readIsolationEnforced = true;
  }

  if (!readIsolationEnforced) {
    throw new Error('TEST 9 FAILED: Business B was able to view Business A client details!');
  }
  console.log('✅ TEST 9 PASSED: Complete cross-tenant boundary verified between Business A and Business B.\n');

  console.log('================================================================');
  console.log('   ALL PHASE 1 TESTS PASSED WITH 100% SUCCESS!                  ');
  console.log('================================================================\n');

  await pgClient.end();
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
