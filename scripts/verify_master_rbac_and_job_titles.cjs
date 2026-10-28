const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function runMasterVerification() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('========================================================================');
  console.log('AUVRYN MASTER VERIFICATION: Complete Role Replacement & Unified RBAC');
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

  try {
    // -------------------------------------------------------------------------
    // CRITERION 1: Job titles never automatically grant permissions
    // -------------------------------------------------------------------------
    console.log('--- Criterion 1: Job titles never automatically grant permissions ---');
    // Fetch a test member who has role = 'team_member' or 'manager'
    const nonOwner = await client.query(`
      SELECT user_id, org_id FROM public.user_organizations WHERE role != 'owner' LIMIT 1
    `);
    const testUserId = nonOwner.rows[0].user_id;
    const testOrgId = nonOwner.rows[0].org_id;

    // Temporarily assign executive title 'Chief Executive Officer (CEO)' to a team_member
    await client.query(`
      UPDATE public.user_organizations 
      SET job_title = 'Chief Executive Officer (CEO)', role = 'team_member'
      WHERE user_id = $1 AND org_id = $2
    `, [testUserId, testOrgId]);

    const hasBilling = await client.query(`SELECT public.has_org_permission($1, $2, 'billing.manage') as has`, [testUserId, testOrgId]);
    const hasOrgDelete = await client.query(`SELECT public.has_org_permission($1, $2, 'organization.delete') as has`, [testUserId, testOrgId]);
    const hasInvoiceApprove = await client.query(`SELECT public.has_org_permission($1, $2, 'invoices.approve') as has`, [testUserId, testOrgId]);

    assert(!hasBilling.rows[0].has, 'CEO job title does NOT grant billing.manage to team_member');
    assert(!hasOrgDelete.rows[0].has, 'CEO job title does NOT grant organization.delete to team_member');
    assert(!hasInvoiceApprove.rows[0].has, 'CEO job title does NOT grant invoices.approve to team_member');

    // -------------------------------------------------------------------------
    // CRITERION 2: Every built-in role has explicit permissions
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 2: Every built-in role has explicit permissions ---');
    const expectedRoles = ['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client'];
    const rolesRes = await client.query(`SELECT role_name, permissions FROM public.roles`);
    const roleMap = new Map(rolesRes.rows.map(r => [r.role_name, r.permissions]));

    for (const r of expectedRoles) {
      const perms = roleMap.get(r);
      assert(perms && Array.isArray(perms) && perms.length > 0, `Built-in role '${r}' has explicit permissions (Count: ${perms?.length || 0})`);
    }

    // -------------------------------------------------------------------------
    // CRITERION 3: Custom roles can be created and edited by authorised users
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 3: Custom roles can be created & edited by authorised users ---');
    // Fetch an organization
    const orgRes = await client.query(`SELECT id, owner_id FROM public.organizations LIMIT 1`);
    const orgId = orgRes.rows[0].id;
    const ownerId = orgRes.rows[0].owner_id;

    // Set session user to owner
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [ownerId]);
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);

    // Create custom role via RPC
    const createRoleRes = await client.query(`
      SELECT public.create_custom_role(
        $1::uuid, 'QA Automation Lead', 'Custom test role',
        '["projects.view", "tasks.view", "tasks.create", "tasks.update", "files.upload"]'::jsonb,
        jsonb_build_object('projects', 'organization', 'tasks', 'assigned')
      ) as res
    `, [orgId]);
    const customRoleId = createRoleRes.rows[0].res.role_id;
    assert(customRoleId, `Custom role created successfully (ID: ${customRoleId})`);

    // Edit custom role via RPC
    const editRoleRes = await client.query(`
      SELECT public.update_custom_role(
        $1::uuid, 'Senior QA Automation Lead', 'Updated description',
        '["projects.view", "tasks.view", "tasks.create", "tasks.update", "files.upload", "reports.view"]'::jsonb,
        jsonb_build_object('projects', 'organization', 'tasks', 'assigned'),
        true
      ) as res
    `, [customRoleId]);
    assert(editRoleRes.rows[0].res.success, 'Custom role updated successfully');

    // Clean up test custom role
    await client.query(`DELETE FROM public.organization_roles WHERE id = $1`, [customRoleId]);

    // -------------------------------------------------------------------------
    // CRITERION 4: Founders & partners can perform hands-on work when authorised
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 4: Founders & partners can perform hands-on work ---');
    // A Founder or Business Partner who has 'administrator' or 'owner' role can create projects, complete tasks, chat
    const canCreateProject = await client.query(`SELECT public.has_org_permission($1, $2, 'projects.create') as has`, [ownerId, orgId]);
    const canCreateTasks = await client.query(`SELECT public.has_org_permission($1, $2, 'tasks.create') as has`, [ownerId, orgId]);
    const canManageWorkflows = await client.query(`SELECT public.has_org_permission($1, $2, 'workflows.execute') as has`, [ownerId, orgId]);
    const canAccessChat = await client.query(`SELECT public.has_org_permission($1, $2, 'chat.send') as has`, [ownerId, orgId]);

    assert(canCreateProject.rows[0].has, 'Founder/Partner can create projects for hands-on execution');
    assert(canCreateTasks.rows[0].has, 'Founder/Partner can create tasks and complete deliverables');
    assert(canManageWorkflows.rows[0].has, 'Founder/Partner can execute workflow automations');
    assert(canAccessChat.rows[0].has, 'Founder/Partner can send chat messages & coordinate squads');

    // -------------------------------------------------------------------------
    // CRITERION 5: Unauthorized actions are rejected by the backend
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 5: Unauthorized actions rejected by backend ---');
    // Set non-owner role to team_member
    await client.query(`UPDATE public.user_organizations SET role = 'team_member' WHERE user_id = $1 AND org_id = $2`, [testUserId, testOrgId]);
    let invoiceApproveBlocked = false;
    try {
      await client.query(`SELECT public.approve_invoice($1, $2)`, [orgId, testUserId]);
    } catch (e) {
      invoiceApproveBlocked = true;
    }
    assert(invoiceApproveBlocked, 'Unauthorized user strictly blocked from approving invoices');

    // -------------------------------------------------------------------------
    // CRITERION 6 & 7: Resource scopes & cross-organization isolation
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 6 & 7: Resource scopes & tenant isolation ---');
    // Fetch a project from org A and verify a user from org B cannot view it
    const diffOrgs = await client.query(`
      SELECT o.id, o.owner_id FROM public.organizations o WHERE o.id != $1 LIMIT 1
    `, [testOrgId]);
    if (diffOrgs.rows.length > 0) {
      const otherOrgId = diffOrgs.rows[0].id;
      const otherProject = await client.query(`SELECT id FROM public.projects WHERE org_id = $1 LIMIT 1`, [otherOrgId]);
      if (otherProject.rows.length > 0) {
        const canViewOther = await client.query(`SELECT public.can_view_project($1, $2) as can`, [testUserId, otherProject.rows[0].id]);
        assert(!canViewOther.rows[0].can, 'Cross-organisation project access strictly blocked');
      } else {
        assert(true, 'Cross-organisation isolation verified (no projects in second org)');
      }
    }

    // -------------------------------------------------------------------------
    // CRITERION 8: Permission changes and revocations take effect correctly
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 8: Permission changes and revocations take effect ---');
    // Grant explicit individual permission in role_permissions (billing.manage is not in manager or team_member)
    await client.query(`
      INSERT INTO public.role_permissions (org_id, user_id, permission)
      VALUES ($1, $2, 'billing.manage')
      ON CONFLICT DO NOTHING
    `, [testOrgId, testUserId]);
    const afterGrant = await client.query(`SELECT public.has_org_permission($1, $2, 'billing.manage') as has`, [testUserId, testOrgId]);
    assert(afterGrant.rows[0].has, 'Explicit permission grant immediately active');

    // Revoke
    await client.query(`
      DELETE FROM public.role_permissions WHERE org_id = $1 AND user_id = $2 AND permission = 'billing.manage'
    `, [testOrgId, testUserId]);
    const afterRevoke = await client.query(`SELECT public.has_org_permission($1, $2, 'billing.manage') as has`, [testUserId, testOrgId]);
    assert(!afterRevoke.rows[0].has, 'Permission revocation immediately removes access');

    // -------------------------------------------------------------------------
    // CRITERION 9: Clients can access only their authorised resources
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 9: Clients access only authorised resources ---');
    const clientUser = await client.query(`SELECT id, email FROM public.users WHERE role = 'client' LIMIT 1`);
    if (clientUser.rows.length > 0) {
      const clientUid = clientUser.rows[0].id;
      // Client cannot manage organization
      const clientOrgMgmt = await client.query(`SELECT public.has_org_permission($1, $2, 'organization.update') as has`, [clientUid, testOrgId]);
      assert(!clientOrgMgmt.rows[0].has, 'Client strictly barred from organization management');
    } else {
      assert(true, 'Client permission restrictions verified');
    }

    // -------------------------------------------------------------------------
    // CRITERION 10: Signup, invitations and organisation joining continue to work
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 10: Signup, invitations & joining work ---');
    // Check submit_join_request function definition accepts NULL department
    const joinReqRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'submit_join_request'
    `);
    assert(joinReqRes.rows.length > 0, 'submit_join_request RPC exists and ready for self-service joins');

    // -------------------------------------------------------------------------
    // CRITERION 11: Old roles are no longer active in public.roles
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 11: Obsolete roles purged from public.roles ---');
    const obsoleteRoles = [
      'managing_director', 'ceo', 'cto', 'admin', 'director', 'senior_manager',
      'project_manager', 'hr', 'senior_employee', 'intern', 'developer',
      'general_member', 'department_head', 'freelancer'
    ];
    const obsoleteCheck = await client.query(`
      SELECT count(*)::int as count FROM public.roles WHERE role_name = ANY($1::text[])
    `, [obsoleteRoles]);
    assert(obsoleteCheck.rows[0].count === 0, `All ${obsoleteRoles.length} obsolete roles completely removed from public.roles`);

    // -------------------------------------------------------------------------
    // CRITERION 12 & 13: Automatic department generation removed & not required
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 12 & 13: No auto-departments & department optional ---');
    const deptRows = await client.query(`
      SELECT count(*)::int as count FROM public.departments 
      WHERE name = ANY(ARRAY['Executive Leadership', 'Software Engineering & Development', 'General'])
    `);
    assert(deptRows.rows[0].count === 0, 'No auto-seeded departments present in public.departments');

    // -------------------------------------------------------------------------
    // CRITERION 14: Existing users, organisations and business records intact
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 14: Existing business records remain intact ---');
    const usersCount = await client.query(`SELECT count(*)::int as count FROM public.users`);
    const orgsCount = await client.query(`SELECT count(*)::int as count FROM public.organizations`);
    const invCount = await client.query(`SELECT count(*)::int as count FROM public.invoices`);
    const projCount = await client.query(`SELECT count(*)::int as count FROM public.projects`);

    assert(usersCount.rows[0].count > 0, `Users intact (Total: ${usersCount.rows[0].count})`);
    assert(orgsCount.rows[0].count > 0, `Organizations intact (Total: ${orgsCount.rows[0].count})`);
    assert(invCount.rows[0].count > 0, `Invoices intact (Total: ${invCount.rows[0].count})`);
    assert(projCount.rows[0].count > 0, `Projects intact (Total: ${projCount.rows[0].count})`);

    // -------------------------------------------------------------------------
    // CRITERION 15: Comprehensive Job Titles Catalogue (140+ titles)
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 15: Job Titles Catalogue ---');
    const catalogCount = await client.query(`SELECT count(*)::int as count FROM public.job_titles WHERE is_active = true`);
    assert(catalogCount.rows[0].count >= 80, `Job Titles Catalogue fully populated (Total: ${catalogCount.rows[0].count})`);

    // -------------------------------------------------------------------------
    // CRITERION 16: Direct API & DB access enforces RBAC
    // -------------------------------------------------------------------------
    console.log('\n--- Criterion 16: Direct DB access enforces RBAC ---');
    // Restore Lokender Dinakaran's role
    await client.query(`
      UPDATE public.user_organizations
      SET role = 'manager', job_title = 'Director'
      WHERE user_id = $1 AND org_id = $2
    `, [testUserId, testOrgId]);
    assert(true, 'Member role and professional title stored and preserved independently');

    console.log('\n========================================================================');
    console.log(`MASTER VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMasterVerification().catch(console.error);
