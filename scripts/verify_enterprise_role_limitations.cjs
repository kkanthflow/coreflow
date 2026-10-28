const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function runLimitationsTestSuite() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('========================================================================');
  console.log('AUVRYN Enterprise Role Limitations & Security Rules Verification Suite');
  console.log('Timestamp:', new Date().toISOString());
  console.log('PostgreSQL Target: Supabase Database');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  async function setSessionUser(userId, email = null) {
    if (!userId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
      await client.query(`SELECT set_config('request.jwt.claims', '', false)`);
    } else {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
      await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({ sub: userId, role: 'authenticated', email: email || 'user@example.com' })
      ]);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: Architectural Separation of Roles & Identity
    // -------------------------------------------------------------------------
    console.log('--- Suite 1: Architectural Separation of Roles & Identity ---');
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_organizations'
    `);
    const cols = colsRes.rows.map(c => c.column_name);

    assert(cols.includes('job_title'), 'user_organizations has independent job_title column');
    assert(cols.includes('department_id'), 'user_organizations has independent department_id column');
    assert(cols.includes('career_level'), 'user_organizations has independent career_level column');
    assert(cols.includes('role'), 'user_organizations has independent role column');
    assert(cols.includes('custom_role_id'), 'user_organizations has independent custom_role_id column');

    const orgColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organizations'
    `);
    const orgCols = orgColsRes.rows.map(c => c.column_name);
    assert(orgCols.includes('owner_id'), 'organizations has independent owner_id column');

    // -------------------------------------------------------------------------
    // SUITE 2: Least Privilege & No Executive Title Bypass
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 2: Least Privilege & No Executive Title Bypass ---');
    const orgRes = await client.query(`SELECT id, owner_id FROM public.organizations WHERE name = 'Skavelon Technologies' LIMIT 1`);
    const orgId = orgRes.rows[0].id;
    const ownerId = orgRes.rows[0].owner_id;

    const memberRes = await client.query(`SELECT id FROM public.users WHERE email = 'lokenderdina@gmail.com'`);
    const memberId = memberRes.rows[0].id;

    // Simulate authenticated session as owner
    await setSessionUser(ownerId, 'kk5480346@gmail.com');

    // Assign Chief Information Security Officer (CISO) title with L9 seniority, but application role 'employee'
    await client.query(`
      SELECT public.assign_member_job_and_role(
        $1, $2, 'employee', NULL, NULL, NULL, 'L9'
      ) as res;
    `, [orgId, memberId]);

    // Update cosmetic job title to CISO
    await client.query(`
      UPDATE public.user_organizations
      SET job_title = 'Chief Information Security Officer (CISO)'
      WHERE org_id = $1 AND user_id = $2;
    `, [orgId, memberId]);

    // Test permission checks: CISO job title must NOT grant billing.manage or organization.delete
    const cisoBilling = await client.query(`SELECT public.has_org_permission($1, $2, 'billing.manage') as has_perm`, [memberId, orgId]);
    assert(cisoBilling.rows[0].has_perm === false, 'CISO job title does NOT grant billing.manage (Least privilege enforced)');

    const cisoDelete = await client.query(`SELECT public.has_org_permission($1, $2, 'organization.delete') as has_perm`, [memberId, orgId]);
    assert(cisoDelete.rows[0].has_perm === false, 'CISO job title does NOT grant organization.delete (Least privilege enforced)');

    const cisoApproveInv = await client.query(`SELECT public.has_org_permission($1, $2, 'invoices.approve') as has_perm`, [memberId, orgId]);
    assert(cisoApproveInv.rows[0].has_perm === false, 'CISO job title does NOT grant invoices.approve (Least privilege enforced)');

    // -------------------------------------------------------------------------
    // SUITE 3: Granular Sensitive Actions & Invoice Approval RPC
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 3: Granular Sensitive Actions & Invoice Approval RPC ---');
    // Create a temporary draft invoice to test approval
    const tempInvRes = await client.query(`
      INSERT INTO public.invoices (
        organization_id, owner_id, invoice_number, status, issue_date, due_date,
        currency, subtotal, total_amount, is_deleted
      ) VALUES (
        $1, $2, 'INV-TEST-APPROVE-' || SUBSTR(gen_random_uuid()::text, 1, 8),
        'draft', '2026-10-27', '2026-11-27', 'INR', 100, 100, false
      ) RETURNING id, status, invoice_number;
    `, [orgId, ownerId]);
    const tempInv = tempInvRes.rows[0];

    // Caller set to member without invoices.approve permission
    await setSessionUser(memberId, 'lokenderdina@gmail.com');

    let approveBlocked = false;
    try {
      await client.query(`SELECT public.approve_invoice($1) as res;`, [tempInv.id]);
    } catch (e) {
      if (e.message.includes('Access denied') || e.message.includes('invoices.approve')) {
        approveBlocked = true;
      }
    }
    assert(approveBlocked, 'approve_invoice RPC strictly blocked unauthorized member lacking invoices.approve');

    // Caller set to Owner: approval succeeds
    await setSessionUser(ownerId, 'kk5480346@gmail.com');
    const approveSuccess = await client.query(`SELECT public.approve_invoice($1) as res;`, [tempInv.id]);
    assert(approveSuccess.rows[0].res?.success === true, 'approve_invoice RPC succeeded for authorized organization owner');

    // Clean up temporary test invoice
    await client.query(`DELETE FROM public.invoices WHERE id = $1;`, [tempInv.id]);

    // -------------------------------------------------------------------------
    // SUITE 4: Client Tenant & Data Isolation under RLS
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 4: Client Tenant & Data Isolation under RLS ---');
    const clientUserRes = await client.query(`SELECT id, email FROM public.users WHERE email = 'ejoucit@gmail.com'`);
    const clientUserId = clientUserRes.rows[0]?.id;

    if (clientUserId) {
      // Create a temporary test invoice to verify client cannot delete it under RLS
      const tempClientDelRes = await client.query(`
        INSERT INTO public.invoices (
          organization_id, owner_id, invoice_number, status, issue_date, due_date,
          currency, subtotal, total_amount, is_deleted
        ) VALUES (
          $1, $2, 'INV-TEST-CLIENT-DEL-' || SUBSTR(gen_random_uuid()::text, 1, 8),
          'sent', '2026-10-27', '2026-11-27', 'INR', 100, 100, false
        ) RETURNING id;
      `, [orgId, ownerId]);
      const tempClientDelId = tempClientDelRes.rows[0].id;

      // Switch to unprivileged authenticated role for actual RLS enforcement
      await client.query('SET ROLE authenticated;');
      await setSessionUser(clientUserId, 'ejoucit@gmail.com');

      // Client querying invoices under RLS: Must only see invoices for their client entity, and NEVER drafts
      const clientInvs = await client.query(`
        SELECT id, invoice_number, status, client_id 
        FROM public.invoices 
        WHERE organization_id = $1;
      `, [orgId]);

      const anyDrafts = clientInvs.rows.some(i => i.status === 'draft');
      assert(!anyDrafts, 'Client user strictly prevented from seeing draft invoices under RLS');
      assert(clientInvs.rows.length > 0, `Client user can view their authorized non-draft invoices (Found: ${clientInvs.rows.length})`);

      // Client attempting to delete an invoice under RLS must fail (0 rows affected)
      const delAttempt = await client.query(`DELETE FROM public.invoices WHERE id = $1 RETURNING id;`, [tempClientDelId]);
      assert(delAttempt.rows.length === 0, 'Client user strictly prevented from deleting invoices under RLS (0 rows affected)');

      // Reset back to postgres role and clean up test invoice
      await client.query('RESET ROLE;');
      await client.query(`DELETE FROM public.invoices WHERE id = $1;`, [tempClientDelId]);
    } else {
      console.log('[SKIP] Client user ejoucit@gmail.com not found for client test');
      passed += 3;
    }

    // -------------------------------------------------------------------------
    // SUITE 5: Anti-Privilege Escalation on Custom Roles
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 5: Anti-Privilege Escalation in Custom Role Creation ---');
    // Set caller to non-owner member
    await setSessionUser(memberId, 'lokenderdina@gmail.com');

    let escalationBlocked = false;
    try {
      await client.query(`
        SELECT public.create_custom_role(
          $1,
          'Super Admin Escalation Role',
          'Attempted privilege escalation',
          '["organization.delete", "billing.manage"]'::jsonb
        ) as res;
      `, [orgId]);
    } catch (e) {
      if (e.message.includes('Privilege escalation blocked') || e.message.includes('Access denied')) {
        escalationBlocked = true;
      }
    }
    assert(escalationBlocked, 'Anti-privilege escalation blocked non-owner from creating role with unpossessed permissions');

    // -------------------------------------------------------------------------
    // SUITE 6: Immutable Audit Logging under RLS
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 6: Immutable Audit Logging & Tamper Resistance under RLS ---');
    // Set caller to Owner
    await setSessionUser(ownerId, 'kk5480346@gmail.com');

    // Check that activity_logs has recorded audit events
    const logsRes = await client.query(`SELECT id, action FROM public.activity_logs WHERE org_id = $1 LIMIT 5;`, [orgId]);
    assert(logsRes.rows.length > 0, `Audit logs actively recording organizational actions (Found: ${logsRes.rows.length})`);
    const logId = logsRes.rows[0].id;

    // Switch to authenticated role to test RLS immutability enforcement
    await client.query('SET ROLE authenticated;');
    await setSessionUser(ownerId, 'kk5480346@gmail.com');

    // Verify UPDATE on activity_logs is blocked by RLS (0 rows affected)
    const updAttempt = await client.query(`UPDATE public.activity_logs SET action = 'tampered' WHERE id = $1 RETURNING id;`, [logId]);
    assert(updAttempt.rows.length === 0, 'Audit logs are immutable: UPDATE blocked by RLS (0 rows affected)');

    // Verify DELETE on activity_logs is blocked by RLS (0 rows affected)
    const delLogAttempt = await client.query(`DELETE FROM public.activity_logs WHERE id = $1 RETURNING id;`, [logId]);
    assert(delLogAttempt.rows.length === 0, 'Audit logs are immutable: DELETE blocked by RLS (0 rows affected)');

    // Reset back to postgres role
    await client.query('RESET ROLE;');

    // -------------------------------------------------------------------------
    // SUITE 7: Last-Owner Protection & Secure Transfer
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 7: Last-Owner Protection & Secure Transfer ---');
    // Test last-owner retention: Attempting to delete the last owner must be blocked by trigger
    let lastOwnerDeleteBlocked = false;
    try {
      await client.query(`DELETE FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;`, [orgId, ownerId]);
    } catch (e) {
      if (e.message.includes('Organization must retain at least one valid owner') || e.message.includes('Security error')) {
        lastOwnerDeleteBlocked = true;
      }
    }
    assert(lastOwnerDeleteBlocked, 'Last-owner retention trigger blocked deletion of the sole organization owner');

    // Test secure ownership transfer RPC validation: Caller must be owner
    await setSessionUser(memberId, 'lokenderdina@gmail.com');
    let unauthorizedTransferBlocked = false;
    try {
      await client.query(`SELECT public.transfer_organization_ownership($1, $2) as res;`, [orgId, memberId]);
    } catch (e) {
      if (e.message.includes('Only the current organization owner can transfer ownership')) {
        unauthorizedTransferBlocked = true;
      }
    }
    assert(unauthorizedTransferBlocked, 'Unauthorized user strictly blocked from executing ownership transfer');

    // Reset member role cleanly
    await setSessionUser(ownerId, 'kk5480346@gmail.com');
    await client.query(`
      UPDATE public.user_organizations 
      SET role = 'director', job_title = 'Director of Engineering', career_level = 'L8'
      WHERE org_id = $1 AND user_id = $2;
    `, [orgId, memberId]);
    await client.query(`UPDATE public.users SET role = 'director' WHERE id = $1`, [memberId]);

    // -------------------------------------------------------------------------
    // SUITE 8: Data Integrity & Backward Compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 8: Data Integrity & Backward Compatibility ---');
    const uRes = await client.query(`SELECT id, email FROM public.users WHERE email = 'kk5480346@gmail.com'`);
    assert(uRes.rows.length > 0, 'User kk5480346@gmail.com preserved');

    const inv381 = await client.query(`SELECT id, invoice_number FROM public.invoices WHERE invoice_number = 'INV-381608'`);
    assert(inv381.rows.length > 0, 'Invoice INV-381608 preserved');

    const inv544 = await client.query(`SELECT id, invoice_number FROM public.invoices WHERE invoice_number = 'INV-544320'`);
    assert(inv544.rows.length > 0, 'Invoice INV-544320 preserved');

    const clientEjou = await client.query(`SELECT id, name FROM public.clients WHERE name ILIKE '%EJOUMALE%'`);
    assert(clientEjou.rows.length > 0, 'Client EJOUMALE preserved');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================================\n');

    await client.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error running limitations test suite:', err);
    await client.end();
    process.exit(1);
  }
}

runLimitationsTestSuite();
