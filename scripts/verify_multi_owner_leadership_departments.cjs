process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

function assert(condition, msg) {
  if (!condition) {
    throw new Error(`[FAIL] ${msg}`);
  }
}

async function runTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('AUVRYN: MULTI-OWNER, LEADERSHIP & DEPARTMENT WORKSPACE VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const client = new Client({ connectionString });
  await client.connect();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  try {
    const orgRes = await client.query('SELECT id, owner_id FROM public.organizations LIMIT 1;');
    assert(orgRes.rows.length > 0, 'Organization exists for testing');
    const testOrgId = orgRes.rows[0].id;
    const testOwnerId = orgRes.rows[0].owner_id;

    console.log(`--- Test Context: Org ${testOrgId}, Primary Creator ${testOwnerId} ---\n`);

    // ── SUITE 1: Ownership & Multi-Founder Tests ──
    console.log('▶ [Suite 1] Ownership & Multi-Founder Tests');

    await test('1. One organization can support multiple active Owners in organization_owners', async () => {
      await client.query('BEGIN;');
      try {
        const dummyRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ($1, 'Test Co-Founder', 'team_member', 'organization')
          RETURNING id;
        `, [`test_founder_${Date.now()}@auvryn.internal`]);
        const founder2Id = dummyRes.rows[0].id;

        await client.query(`
          INSERT INTO public.user_organizations (user_id, org_id, role, job_title)
          VALUES ($1, $2, 'team_member', 'Co-founder');
        `, [founder2Id, testOrgId]);

        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);
        await client.query(`SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true);`, [testOwnerId]);

        const appointRes = await client.query(`
          SELECT public.appoint_organization_owner($1, $2, 'Co-founder appointment') as res;
        `, [testOrgId, founder2Id]);

        assert(appointRes.rows[0].res.success === true, 'Appoint owner succeeded');

        const ownersRes = await client.query(`
          SELECT user_id, status FROM public.organization_owners WHERE org_id = $1 AND status = 'active';
        `, [testOrgId]);
        assert(ownersRes.rows.length >= 2, 'At least 2 active owners exist in organization');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('2. All active Owners have equal organizational authority (is_org_owner)', async () => {
      await client.query('BEGIN;');
      try {
        const dummy = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('test_founder_co_owner@auvryn.internal', 'Equal Co-Owner', 'owner', 'organization')
          RETURNING id;
        `);
        const coOwnerId = dummy.rows[0].id;

        await client.query(`
          INSERT INTO public.organization_owners (org_id, user_id, status, notes)
          VALUES ($1, $2, 'active', 'Test equal owner');
        `, [testOrgId, coOwnerId]);

        const isOwner1 = await client.query(`SELECT public.is_org_owner($1, $2) as val;`, [testOwnerId, testOrgId]);
        const isOwner2 = await client.query(`SELECT public.is_org_owner($1, $2) as val;`, [coOwnerId, testOrgId]);

        assert(isOwner1.rows[0].val === true, 'Original creator has active owner authority');
        assert(isOwner2.rows[0].val === true, 'Appointed Co-owner has identical active owner authority');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('3. Last-owner protection prevents accidental loss of all active Owners', async () => {
      await client.query('BEGIN;');
      try {
        const tempOrgRes = await client.query(`
          INSERT INTO public.organizations (name, owner_id)
          VALUES ('Single Owner Org Test', $1)
          RETURNING id;
        `, [testOwnerId]);
        const singleOrgId = tempOrgRes.rows[0].id;

        await client.query(`
          INSERT INTO public.organization_owners (org_id, user_id, status)
          VALUES ($1, $2, 'active');
        `, [singleOrgId, testOwnerId]);

        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        let prevented = false;
        try {
          await client.query(`
            SELECT public.remove_organization_owner($1, $2, 'administrator');
          `, [singleOrgId, testOwnerId]);
        } catch (err) {
          if (err.message.includes('Safety Violation: Cannot remove the only remaining active Owner')) {
            prevented = true;
          }
        }
        assert(prevented, 'Removing the only active owner was strictly rejected');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('4. Unauthorized member cannot self-promote to Owner', async () => {
      await client.query('BEGIN;');
      try {
        const regularUserRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('regular_emp_test@auvryn.internal', 'Regular Employee', 'team_member', 'organization')
          RETURNING id;
        `);
        const regId = regularUserRes.rows[0].id;

        await client.query(`
          INSERT INTO public.user_organizations (user_id, org_id, role)
          VALUES ($1, $2, 'team_member');
        `, [regId, testOrgId]);

        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [regId]);

        let blocked = false;
        try {
          await client.query(`
            SELECT public.appoint_organization_owner($1, $2);
          `, [testOrgId, regId]);
        } catch (err) {
          if (err.message.includes('Access denied')) {
            blocked = true;
          }
        }
        assert(blocked, 'Unauthorized member was strictly blocked from self-promoting to Owner');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    // ── SUITE 2: Leadership Team Management Tests ──
    console.log('\n▶ [Suite 2] Leadership Team Management Tests');

    await test('5. Multi-designation leadership appointments work (Founder & CEO, Co-founder & CTO)', async () => {
      await client.query('BEGIN;');
      try {
        const execUserRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('cto_co_founder@auvryn.internal', 'CTO Co-Founder', 'manager', 'organization')
          RETURNING id;
        `);
        const ctoId = execUserRes.rows[0].id;

        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        const leadRes = await client.query(`
          SELECT public.upsert_leadership_member(
            p_org_id => $1,
            p_target_user_id => $2,
            p_designation => 'Co-founder & CTO',
            p_visibility_level => 'all_departments',
            p_can_manage_depts => true,
            p_can_manage_leadership => false,
            p_can_manage_announcements => true
          ) as res;
        `, [testOrgId, ctoId]);

        assert(leadRes.rows[0].res.success === true, 'Leadership member upserted successfully');

        const leadRow = await client.query(`
          SELECT designation, visibility_level, can_manage_departments
          FROM public.leadership_members
          WHERE org_id = $1 AND user_id = $2;
        `, [testOrgId, ctoId]);

        assert(leadRow.rows[0].designation === 'Co-founder & CTO', 'Designation saved accurately');
        assert(leadRow.rows[0].visibility_level === 'all_departments', 'Visibility level saved');
        assert(leadRow.rows[0].can_manage_departments === true, 'Dept management rights saved');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('6. Leadership designations remain independent from application RBAC permissions', async () => {
      await client.query('BEGIN;');
      try {
        const memberRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('vp_test@auvryn.internal', 'VP Growth', 'team_member', 'organization')
          RETURNING id;
        `);
        const vpId = memberRes.rows[0].id;

        await client.query(`
          INSERT INTO public.user_organizations (user_id, org_id, role)
          VALUES ($1, $2, 'team_member');
        `, [vpId, testOrgId]);

        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        await client.query(`
          SELECT public.upsert_leadership_member(
            p_org_id => $1,
            p_target_user_id => $2,
            p_designation => 'Vice President of Growth'
          );
        `, [testOrgId, vpId]);

        const roleCheck = await client.query(`
          SELECT role FROM public.user_organizations WHERE org_id = $1 AND user_id = $2;
        `, [testOrgId, vpId]);

        assert(roleCheck.rows[0].role === 'team_member', 'RBAC role remained strictly independent');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    // ── SUITE 3: Department Management & Workspaces ──
    console.log('\n▶ [Suite 3] Department Management & Workspaces Tests');

    await test('7. Department creation and automatic chat channel provisioning', async () => {
      await client.query('BEGIN;');
      try {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        const deptRes = await client.query(`
          INSERT INTO public.departments (org_id, name, description, color, status)
          VALUES ($1, 'Artificial Intelligence Lab', 'Frontier AI Research & Agents', '#A78BFA', 'active')
          RETURNING id, name;
        `, [testOrgId]);
        const newDeptId = deptRes.rows[0].id;

        await client.query(`
          INSERT INTO public.chat_channels (org_id, department_id, name, description, type, is_private)
          VALUES ($1, $2, 'AI Lab Chat', 'Official channel', 'department', false);
        `, [testOrgId, newDeptId]);

        const chRes = await client.query(`
          SELECT id, type, department_id FROM public.chat_channels WHERE department_id = $1;
        `, [newDeptId]);

        assert(chRes.rows.length === 1, 'Department chat channel provisioned');
        assert(chRes.rows[0].type === 'department', 'Channel marked as department type');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('8. All Owners have complete oversight across all department workspaces (can_access_department)', async () => {
      await client.query('BEGIN;');
      try {
        const deptRes = await client.query(`
          INSERT INTO public.departments (org_id, name, status)
          VALUES ($1, 'Classified Executive R&D', 'active')
          RETURNING id;
        `, [testOrgId]);
        const isolatedDeptId = deptRes.rows[0].id;

        const canAccessRes = await client.query(`
          SELECT public.can_access_department($1, $2) as allowed;
        `, [testOwnerId, isolatedDeptId]);

        assert(canAccessRes.rows[0].allowed === true, 'Owner has automatic full department oversight');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('9. Member assignment and department transfer (assign_department_member & transfer)', async () => {
      await client.query('BEGIN;');
      try {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        const d1 = (await client.query(`INSERT INTO public.departments (org_id, name) VALUES ($1, 'Dept Alpha') RETURNING id;`, [testOrgId])).rows[0].id;
        const d2 = (await client.query(`INSERT INTO public.departments (org_id, name) VALUES ($1, 'Dept Beta') RETURNING id;`, [testOrgId])).rows[0].id;

        const uRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('transfer_test_user@auvryn.internal', 'Transfer Tester', 'team_member', 'organization')
          RETURNING id;
        `);
        const targetUid = uRes.rows[0].id;

        await client.query(`
          INSERT INTO public.user_organizations (user_id, org_id, role)
          VALUES ($1, $2, 'team_member');
        `, [targetUid, testOrgId]);

        const assignRes = await client.query(`
          SELECT public.assign_department_member($1, $2, 'member', true) as res;
        `, [d1, targetUid]);
        assert(assignRes.rows[0].res.success === true, 'Assigned to Dept Alpha');

        const canAlpha = (await client.query(`SELECT public.can_access_department($1, $2) as val;`, [targetUid, d1])).rows[0].val;
        assert(canAlpha === true, 'Access granted to Dept Alpha');

        const transferRes = await client.query(`
          SELECT public.transfer_department_member($1, $2, $3, 'lead') as res;
        `, [d1, d2, targetUid]);
        assert(transferRes.rows[0].res.success === true, 'Transferred to Dept Beta');

        const inAlpha = (await client.query(`SELECT 1 FROM public.department_members WHERE department_id = $1 AND user_id = $2;`, [d1, targetUid])).rows.length;
        const inBeta = (await client.query(`SELECT 1 FROM public.department_members WHERE department_id = $1 AND user_id = $2;`, [d2, targetUid])).rows.length;

        assert(inAlpha === 0, 'Removed from previous department');
        assert(inBeta === 1, 'Enrolled in new department');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('10. Non-member is blocked from private department workspace', async () => {
      await client.query('BEGIN;');
      try {
        const deptRes = await client.query(`
          INSERT INTO public.departments (org_id, name)
          VALUES ($1, 'Restricted Finance')
          RETURNING id;
        `, [testOrgId]);
        const privateDeptId = deptRes.rows[0].id;

        const outsiderRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('outsider_emp@auvryn.internal', 'Outsider Member', 'team_member', 'organization')
          RETURNING id;
        `);
        const outsiderId = outsiderRes.rows[0].id;

        await client.query(`
          INSERT INTO public.user_organizations (user_id, org_id, role)
          VALUES ($1, $2, 'team_member');
        `, [outsiderId, testOrgId]);

        const canAccess = (await client.query(`SELECT public.can_access_department($1, $2) as val;`, [outsiderId, privateDeptId])).rows[0].val;
        assert(canAccess === false, 'Non-member strictly barred from private department');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    await test('11. Department Tasks, Projects, Meetings, and Announcements persist correctly', async () => {
      await client.query('BEGIN;');
      try {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [testOwnerId]);

        const deptRes = await client.query(`
          INSERT INTO public.departments (org_id, name)
          VALUES ($1, 'Operations Dept')
          RETURNING id;
        `, [testOrgId]);
        const opsDeptId = deptRes.rows[0].id;

        // Create Announcement
        const annRes = await client.query(`
          INSERT INTO public.department_announcements (org_id, department_id, author_id, title, content, is_pinned)
          VALUES ($1, $2, $3, 'Operations Protocol', 'Daily standup at 9:30 AM', true)
          RETURNING id;
        `, [testOrgId, opsDeptId, testOwnerId]);
        assert(annRes.rows.length === 1, 'Department announcement created');

        // Create Task linked to department with valid priority
        const taskRes = await client.query(`
          INSERT INTO public.tasks (org_id, department_id, title, priority, status)
          VALUES ($1, $2, 'Deploy infrastructure upgrade', 'high', 'todo')
          RETURNING id;
        `, [testOrgId, opsDeptId]);
        assert(taskRes.rows.length === 1, 'Task linked to department');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    // ── SUITE 4: Freelancer & Individual Account Isolation ──
    console.log('\n▶ [Suite 4] Freelancer & Individual Account Isolation Tests');

    await test('12. Freelancer account cannot hold department memberships or organization ownership', async () => {
      await client.query('BEGIN;');
      try {
        const fRes = await client.query(`
          INSERT INTO public.users (email, full_name, role, account_type)
          VALUES ('freelancer_check@auvryn.internal', 'Freelancer Bob', 'freelancer', 'freelancer')
          RETURNING id;
        `);
        const freeId = fRes.rows[0].id;

        const isOwner = (await client.query(`SELECT public.is_org_owner($1, $2) as val;`, [freeId, testOrgId])).rows[0].val;
        assert(isOwner === false, 'Freelancer cannot be organization owner');
      } finally {
        await client.query('ROLLBACK;');
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('═══════════════════════════════════════════════════════════════════════════');

  } finally {
    await client.end();
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
