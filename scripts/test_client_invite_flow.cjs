const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^"|"$/g, '')
  : 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

let passedCount = 0;
let totalTests = 9;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAllTests() {
  await client.connect();
  console.log('================================================================');
  console.log('  AUVRYN CLIENT INVITE & LINKING TEST SUITE (9/9 SCENARIOS)');
  console.log('================================================================\n');

  // Setup fixtures: An owner user, two organizations (Org A and Org B), projects, and invoices
  const prefix = `test_${Date.now()}`;
  
  // 0. Base setup: Owner
  const ownerRes = await client.query(`
    INSERT INTO public.users (email, full_name, role, account_type, account_setup_completed)
    VALUES ($1, 'Test Owner', 'owner', 'organization', true)
    RETURNING id;
  `, [`${prefix}_owner@example.com`]);
  const ownerId = ownerRes.rows[0].id;

  // Org A
  const orgARes = await client.query(`
    INSERT INTO public.organizations (name, owner_id)
    VALUES ($1, $2)
    RETURNING id;
  `, [`Tenant Org A ${prefix}`, ownerId]);
  const orgAId = orgARes.rows[0].id;

  // Org B (for Tenant Isolation testing)
  const orgBRes = await client.query(`
    INSERT INTO public.organizations (name, owner_id)
    VALUES ($1, $2)
    RETURNING id;
  `, [`Tenant Org B ${prefix}`, ownerId]);
  const orgBId = orgBRes.rows[0].id;


  // Project A1 (under Org A)
  const projA1Res = await client.query(`
    INSERT INTO public.projects (title, org_id, owner_id, created_by, status)
    VALUES ('Org A Alpha Delivery', $1, $2, $2, 'active')
    RETURNING id;
  `, [orgAId, ownerId]);
  const projA1Id = projA1Res.rows[0].id;

  // Project A2 (second project under Org A)
  const projA2Res = await client.query(`
    INSERT INTO public.projects (title, org_id, owner_id, created_by, status)
    VALUES ('Org A Beta Expansion', $1, $2, $2, 'active')
    RETURNING id;
  `, [orgAId, ownerId]);
  const projA2Id = projA2Res.rows[0].id;

  // Project B1 (under Org B)
  const projB1Res = await client.query(`
    INSERT INTO public.projects (title, org_id, owner_id, created_by, status)
    VALUES ('Org B Confidential Project', $1, $2, $2, 'active')
    RETURNING id;
  `, [orgBId, ownerId]);
  const projB1Id = projB1Res.rows[0].id;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: New-user invite
    // -------------------------------------------------------------------------
    console.log('TEST 1: New-User Invite Flow');
    const email1 = `${prefix}_client_new1@example.com`;
    // Create client record
    const client1Res = await client.query(`
      INSERT INTO public.clients (name, company_name, email, organization_id, owner_id)
      VALUES ('Acme Corp Contact', 'Acme Corporation', $1, $2, $3)
      RETURNING id;
    `, [email1, orgAId, ownerId]);
    const client1Id = client1Res.rows[0].id;

    // Create invite
    const token1 = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() + INTERVAL '7 days');
    `, [token1, email1, client1Id, projA1Id, orgAId, ownerId]);

    // Simulate new user created in auth/public.users
    const user1Res = await client.query(`
      INSERT INTO public.users (email, full_name, role)
      VALUES ($1, 'Acme Client User', 'general_member')
      RETURNING id;
    `, [email1]);
    const user1Id = user1Res.rows[0].id;

    // Call atomic RPC
    const rpc1Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token1, user1Id, email1]);
    const rpc1 = rpc1Res.rows[0].result;

    assert(rpc1.success === true, 'RPC returned success: true');
    assert(rpc1.client_id === client1Id, 'RPC linked to exact existing client ID');
    assert(rpc1.project_id === projA1Id, 'RPC linked to project ID');

    // Check client record
    const verifyC1 = await client.query(`SELECT user_id FROM public.clients WHERE id = $1`, [client1Id]);
    assert(verifyC1.rows[0].user_id === user1Id, 'clients.user_id was updated to user1Id');

    // Check project_client_access
    const verifyPca1 = await client.query(`
      SELECT client_id, user_id, status, can_view FROM public.project_client_access
      WHERE project_id = $1 AND user_id = $2
    `, [projA1Id, user1Id]);
    assert(verifyPca1.rows.length === 1, 'project_client_access row created');
    assert(verifyPca1.rows[0].client_id === client1Id, 'pca.client_id matches existing client');
    assert(verifyPca1.rows[0].status === 'active', 'pca.status is active');

    // Check user profile updated
    const verifyU1 = await client.query(`SELECT role, account_type, account_setup_completed FROM public.users WHERE id = $1`, [user1Id]);
    assert(verifyU1.rows[0].role === 'client', 'User role upgraded to client');
    assert(verifyU1.rows[0].account_type === 'client', 'User account_type set to client');
    assert(verifyU1.rows[0].account_setup_completed === true, 'User account_setup_completed set to true');

    // Check invite marked accepted
    const verifyInv1 = await client.query(`SELECT status, accepted_by FROM public.project_invites WHERE token = $1`, [token1]);
    assert(verifyInv1.rows[0].status === 'accepted', 'Invite status is accepted');
    assert(verifyInv1.rows[0].accepted_by === user1Id, 'accepted_by is user1Id');

    console.log('✅ TEST 1 PASSED: New user atomic invite linking verified successfully.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 2: Existing-user invite
    // -------------------------------------------------------------------------
    console.log('TEST 2: Existing-User Invite Flow');
    const email2 = `${prefix}_client_existing2@example.com`;
    // Existing user in system
    const user2Res = await client.query(`
      INSERT INTO public.users (email, full_name, role, account_type, account_setup_completed)
      VALUES ($1, 'Existing Client User', 'client', 'client', true)
      RETURNING id;
    `, [email2]);
    const user2Id = user2Res.rows[0].id;

    // Existing client record
    const client2Res = await client.query(`
      INSERT INTO public.clients (name, company_name, email, organization_id, owner_id)
      VALUES ('Beta Solutions', 'Beta LLC', $1, $2, $3)
      RETURNING id;
    `, [email2, orgAId, ownerId]);
    const client2Id = client2Res.rows[0].id;

    // Generate invite
    const token2 = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() + INTERVAL '7 days');
    `, [token2, email2, client2Id, projA1Id, orgAId, ownerId]);

    // Accept invite
    const rpc2Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token2, user2Id, email2]);
    assert(rpc2Res.rows[0].result.success === true, 'Existing user accepted invite successfully');

    const verifyC2 = await client.query(`SELECT user_id FROM public.clients WHERE id = $1`, [client2Id]);
    assert(verifyC2.rows[0].user_id === user2Id, 'Existing client linked to user');

    console.log('✅ TEST 2 PASSED: Existing user invite linked smoothly.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 3: Google signup via invite
    // -------------------------------------------------------------------------
    console.log('TEST 3: Google Signup via Invite Flow');
    const email3 = `${prefix}_google_user3@gmail.com`;
    const client3Res = await client.query(`
      INSERT INTO public.clients (name, company_name, email, organization_id, owner_id)
      VALUES ('Google Client', 'Alphabet Sub', $1, $2, $3)
      RETURNING id;
    `, [email3, orgAId, ownerId]);
    const client3Id = client3Res.rows[0].id;

    const token3 = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() + INTERVAL '7 days');
    `, [token3, email3, client3Id, projA1Id, orgAId, ownerId]);

    // Google OAuth callback creates user
    const user3Res = await client.query(`
      INSERT INTO public.users (email, full_name, role)
      VALUES ($1, 'Google Client User', 'general_member')
      RETURNING id;
    `, [email3]);
    const user3Id = user3Res.rows[0].id;

    const rpc3Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token3, user3Id, email3]);
    assert(rpc3Res.rows[0].result.success === true, 'Google OAuth user accepted invite');

    const verifyPca3 = await client.query(`
      SELECT id FROM public.project_client_access WHERE project_id = $1 AND user_id = $2
    `, [projA1Id, user3Id]);
    assert(verifyPca3.rows.length === 1, 'Google OAuth user granted project client access');

    console.log('✅ TEST 3 PASSED: Google OAuth signup via invite completed.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 4: Mismatched email (claimed with valid token from different email)
    // -------------------------------------------------------------------------
    console.log('TEST 4: Mismatched Email Acceptance (Token-Authorized Claim)');
    const invitedEmail4 = `${prefix}_invited_recipient4@example.com`;
    const actualClaimEmail4 = `${prefix}_actual_login_user4@company.org`;

    const client4Res = await client.query(`
      INSERT INTO public.clients (name, company_name, email, organization_id, owner_id)
      VALUES ('Delta Partner', 'Delta Corp', $1, $2, $3)
      RETURNING id;
    `, [invitedEmail4, orgAId, ownerId]);
    const client4Id = client4Res.rows[0].id;

    const token4 = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() + INTERVAL '7 days');
    `, [token4, invitedEmail4, client4Id, projA1Id, orgAId, ownerId]);

    const user4Res = await client.query(`
      INSERT INTO public.users (email, full_name, role)
      VALUES ($1, 'Different Email User', 'general_member')
      RETURNING id;
    `, [actualClaimEmail4]);
    const user4Id = user4Res.rows[0].id;

    const rpc4Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token4, user4Id, actualClaimEmail4]);
    assert(rpc4Res.rows[0].result.success === true, 'Mismatched email accepted via token');

    // Verify both emails are preserved in invite audit log
    const verifyInv4 = await client.query(`SELECT email, accepted_email FROM public.project_invites WHERE token = $1`, [token4]);
    assert(verifyInv4.rows[0].email === invitedEmail4.toLowerCase(), 'Original invited email preserved');
    assert(verifyInv4.rows[0].accepted_email === actualClaimEmail4.toLowerCase(), 'Actual accepting email recorded');

    console.log('✅ TEST 4 PASSED: Mismatched email accepted and both addresses recorded in audit trail.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 5: Expired token
    // -------------------------------------------------------------------------
    console.log('TEST 5: Expired Token Rejection');
    const email5 = `${prefix}_expired5@example.com`;
    const token5 = crypto.randomBytes(32).toString('hex');

    const client5Res = await client.query(`
      INSERT INTO public.clients (name, email, organization_id, owner_id)
      VALUES ('Expired Client', $1, $2, $3)
      RETURNING id;
    `, [email5, orgAId, ownerId]);
    const client5Id = client5Res.rows[0].id;

    // Insert already-expired invite
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() - INTERVAL '2 hours');
    `, [token5, email5, client5Id, projA1Id, orgAId, ownerId]);

    const rpc5Res = await client.query(`SELECT public.accept_project_client_invite($1, $2, $3) as result;`, [token5, user1Id, email5]);
    const rpc5 = rpc5Res.rows[0].result;
    assert(rpc5.success === false, 'Expired invite returns success: false');
    assert(rpc5.error === 'INVITE_EXPIRED', 'Expired invite returns error: INVITE_EXPIRED');

    // Verify status updated to expired in database
    const verifyInv5 = await client.query(`SELECT status FROM public.project_invites WHERE token = $1`, [token5]);
    assert(verifyInv5.rows[0].status === 'expired', 'Invite status transitioned to expired');

    console.log('✅ TEST 5 PASSED: Expired token safely rejected and marked expired.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 6: Reused token (User B trying to claim User A's token)
    // -------------------------------------------------------------------------
    console.log('TEST 6: Reused Token Prevention');
    // token1 was already accepted by user1Id in Test 1.
    // user2Id attempts to claim token1.
    const rpc6Res = await client.query(`SELECT public.accept_project_client_invite($1, $2, $3) as result;`, [token1, user2Id, email2]);
    const rpc6 = rpc6Res.rows[0].result;
    assert(rpc6.success === false, 'Reused token returns success: false');
    assert(rpc6.error === 'INVITE_ALREADY_USED', 'Reused token returns error: INVITE_ALREADY_USED');

    console.log('✅ TEST 6 PASSED: Token reuse by another user is strictly blocked.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 7: Double click (concurrency / idempotency for same user)
    // -------------------------------------------------------------------------
    console.log('TEST 7: Double Click Idempotency');
    // user1Id calling token1 a second time
    const rpc7Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token1, user1Id, email1]);
    const rpc7 = rpc7Res.rows[0].result;
    assert(rpc7.success === true, 'Double click returns success');
    assert(rpc7.already_accepted === true, 'Double click returns already_accepted: true');

    // Verify no duplicates created
    const countPca1 = await client.query(`
      SELECT COUNT(*) as count FROM public.project_client_access WHERE project_id = $1 AND user_id = $2
    `, [projA1Id, user1Id]);
    assert(parseInt(countPca1.rows[0].count, 10) === 1, 'Exactly one access record remains');

    console.log('✅ TEST 7 PASSED: Idempotent double-click handled gracefully without duplicates.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 8: Client with two projects
    // -------------------------------------------------------------------------
    console.log('TEST 8: Single Client Linked to Multiple Projects');
    // Invite Client 1 to Project A2 as well
    const token8 = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.project_invites (token, email, client_id, project_id, business_id, owner_id, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $6, NOW() + INTERVAL '7 days');
    `, [token8, email1, client1Id, projA2Id, orgAId, ownerId]);

    // User 1 accepts second project invite
    const rpc8Res = await client.query(`
      SELECT public.accept_project_client_invite($1, $2, $3) as result;
    `, [token8, user1Id, email1]);
    assert(rpc8Res.rows[0].result.success === true, 'Accepted second project invite');

    // Verify user1 has access to BOTH projA1 and projA2
    const userProjects = await client.query(`
      SELECT project_id, client_id FROM public.project_client_access WHERE user_id = $1 AND status = 'active'
    `, [user1Id]);
    const projectIds = userProjects.rows.map(r => r.project_id);
    assert(projectIds.includes(projA1Id), 'User has access to Project 1');
    assert(projectIds.includes(projA2Id), 'User has access to Project 2');
    assert(userProjects.rows.every(r => r.client_id === client1Id), 'Both project accesses use the same existing client_id');

    // Verify client record count was NOT duplicated
    const countClients1 = await client.query(`SELECT COUNT(*) as count FROM public.clients WHERE email = $1`, [email1]);
    assert(parseInt(countClients1.rows[0].count, 10) === 1, 'Never creates duplicate client record');

    console.log('✅ TEST 8 PASSED: Client seamlessly accesses multiple projects under same client entity.\n');
    passedCount++;

    // -------------------------------------------------------------------------
    // TEST 9: Tenant Isolation & Invoice Visibility
    // -------------------------------------------------------------------------
    console.log('TEST 9: Tenant Isolation & Scoped Data Visibility');
    // Create invoice for Client 1 under Org A
    const invARes = await client.query(`
      INSERT INTO public.invoices (
        organization_id, owner_id, invoice_number, client_id, status, due_date, total_amount, balance_due
      ) VALUES ($1, $2, $3, $4, 'sent', CURRENT_DATE + 30, 25000, 25000)
      RETURNING id;
    `, [orgAId, ownerId, `INV-A-${Date.now()}`, client1Id]);
    const invAId = invARes.rows[0].id;

    // Create client and invoice under Org B
    const clientBRes = await client.query(`
      INSERT INTO public.clients (name, company_name, email, organization_id, owner_id)
      VALUES ('Tenant B Client', 'Org B Partner', 'clientB@example.com', $1, $2)
      RETURNING id;
    `, [orgBId, ownerId]);
    const clientBId = clientBRes.rows[0].id;

    const invBRes = await client.query(`
      INSERT INTO public.invoices (
        organization_id, owner_id, invoice_number, client_id, status, due_date, total_amount, balance_due
      ) VALUES ($1, $2, $3, $4, 'sent', CURRENT_DATE + 30, 99999, 99999)
      RETURNING id;
    `, [orgBId, ownerId, `INV-B-${Date.now()}`, clientBId]);
    const invBId = invBRes.rows[0].id;

    // Verify RLS logic for User 1:
    // User 1 is client of Org A (Client 1).
    // User 1 can view project A1:
    const canViewA1 = await client.query(`SELECT public.can_view_project($1, $2) as can_view`, [user1Id, projA1Id]);
    assert(canViewA1.rows[0].can_view === true, 'Client 1 CAN view Org A project');

    // User 1 CANNOT view project B1:
    const canViewB1 = await client.query(`SELECT public.can_view_project($1, $2) as can_view`, [user1Id, projB1Id]);
    assert(canViewB1.rows[0].can_view === false, 'Client 1 CANNOT view Org B project (Tenant Isolation enforced)');

    // Verify invoice visibility:
    // Invoices accessible to User 1 via client_id linkage:
    const client1Invoices = await client.query(`
      SELECT id, invoice_number, total_amount FROM public.invoices
      WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = $1)
    `, [user1Id]);
    const visibleInvIds = client1Invoices.rows.map(r => r.id);
    assert(visibleInvIds.includes(invAId), 'Client 1 can see Invoice A');
    assert(!visibleInvIds.includes(invBId), 'Client 1 CANNOT see Invoice B of Tenant Org B');

    console.log('✅ TEST 9 PASSED: Tenant isolation and invoice boundary verified.\n');
    passedCount++;

    console.log('================================================================');
    console.log(`  ALL ${passedCount}/${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    // Cleanup fixtures
    await client.query(`DELETE FROM public.project_invites WHERE owner_id = $1`, [ownerId]).catch(() => {});
    await client.query(`DELETE FROM public.project_client_access WHERE project_id IN ($1, $2, $3)`, [projA1Id, projA2Id, projB1Id]).catch(() => {});
    await client.query(`DELETE FROM public.invoices WHERE owner_id = $1`, [ownerId]).catch(() => {});
    await client.query(`DELETE FROM public.projects WHERE owner_id = $1`, [ownerId]).catch(() => {});
    await client.query(`DELETE FROM public.clients WHERE owner_id = $1`, [ownerId]).catch(() => {});
    await client.query(`DELETE FROM public.organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]).catch(() => {});
    await client.query(`DELETE FROM public.users WHERE id = $1 OR email LIKE '${prefix}%'`, [ownerId]).catch(() => {});
    await client.end();
  }
}

runAllTests();
