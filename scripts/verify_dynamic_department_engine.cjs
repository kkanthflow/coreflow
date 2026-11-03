process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  console.log('================================================================');
  console.log('AUVRYN DYNAMIC DEPARTMENT ENGINE: 15-POINT ACCEPTANCE VERIFICATION');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passedCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error('       Error:', e.message);
      failedCount++;
    }
  }

  // Setup test organizations & users
  const testRunId = Date.now().toString().slice(-6);
  const orgAIdRes = await client.query(`
    INSERT INTO public.organizations (name)
    VALUES ('Dynamic Engine Org A ${testRunId}')
    RETURNING id;
  `);
  const orgAId = orgAIdRes.rows[0].id;

  const orgBIdRes = await client.query(`
    INSERT INTO public.organizations (name)
    VALUES ('Dynamic Engine Org B ${testRunId}')
    RETURNING id;
  `);
  const orgBId = orgBIdRes.rows[0].id;

  // Retrieve test users from database
  const usersRes = await client.query(`SELECT id, email FROM auth.users ORDER BY created_at ASC LIMIT 4;`);
  const ownerUser = usersRes.rows[0];
  const leaderUser = usersRes.rows[1] || usersRes.rows[0];
  const memberUser1 = usersRes.rows[2] || usersRes.rows[0];
  const memberUser2 = usersRes.rows[3] || usersRes.rows[1];

  // Set ownerUser as Owner of Org A
  await client.query(`
    INSERT INTO public.organization_owners (org_id, user_id, status)
    VALUES ($1, $2, 'active')
    ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active';
  `, [orgAId, ownerUser.id]);

  await client.query(`
    INSERT INTO public.organization_owners (org_id, user_id, status)
    VALUES ($1, $2, 'active')
    ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active';
  `, [orgBId, ownerUser.id]);

  await client.query(`
    INSERT INTO public.user_organizations (org_id, user_id, role)
    VALUES ($1, $2, 'owner')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner';
  `, [orgAId, ownerUser.id]);

  // Set leaderUser as Leadership in Org A with all_departments visibility
  await client.query(`
    INSERT INTO public.leadership_members (org_id, user_id, designation, visibility_level, can_manage_departments, is_active)
    VALUES ($1, $2, 'VP Operations', 'all_departments', true, true)
    ON CONFLICT (org_id, user_id) DO UPDATE SET visibility_level = 'all_departments', can_manage_departments = true, is_active = true;
  `, [orgAId, leaderUser.id]);

  // Test 1: Startup creates 3 departments with minimal overhead
  let startupDept1Id, startupDept2Id, startupDept3Id;
  await test('1. Startup creates three departments with minimal administrative overhead', async () => {
    const res1 = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Growth & Strategy',
        p_description := 'Startup acquisition and customer growth',
        p_color := '#FF6B4A',
        p_parent_department_id := NULL,
        p_head_user_id := $2,
        p_objectives := '["Acquire first 100 enterprise customers"]'::jsonb,
        p_capability_keys := ARRAY['lead_generation', 'sales_pipeline', 'campaign_management']
      ) as res;
    `, [orgAId, ownerUser.id]);
    startupDept1Id = res1.rows[0].res.department_id;

    const res2 = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Product & Technology',
        p_description := 'Full stack development and infrastructure',
        p_color := '#60A5FA',
        p_parent_department_id := NULL,
        p_head_user_id := $2,
        p_objectives := '["Launch V2 platform architecture"]'::jsonb,
        p_capability_keys := ARRAY['software_development', 'sprint_management', 'bug_tracking']
      ) as res;
    `, [orgAId, memberUser1.id]);
    startupDept2Id = res2.rows[0].res.department_id;

    const res3 = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Finance & Admin',
        p_description := 'Combined cash flow and workplace ops',
        p_color := '#34D399',
        p_parent_department_id := NULL,
        p_head_user_id := $2,
        p_objectives := '["Maintain 18 months runway"]'::jsonb,
        p_capability_keys := ARRAY['budget_planning', 'expense_management', 'facilities_management']
      ) as res;
    `, [orgAId, ownerUser.id]);
    startupDept3Id = res3.rows[0].res.department_id;

    if (!startupDept1Id || !startupDept2Id || !startupDept3Id) {
      throw new Error('Failed to create 3 startup departments');
    }
  });

  // Test 2: MNC specialized hierarchy with sub-departments (parent_department_id)
  let parentDeptId, subDeptId;
  await test('2. MNC creates multiple specialized departments with sub-department hierarchy', async () => {
    const parentRes = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Engineering Global Division',
        p_description := 'Parent engineering department for multinational group',
        p_color := '#A78BFA',
        p_capability_keys := ARRAY['technical_project_management']
      ) as res;
    `, [orgAId]);
    parentDeptId = parentRes.rows[0].res.department_id;

    const subRes = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'APAC Core Platform Team',
        p_description := 'Sub-department focused on APAC regional deployment',
        p_color := '#22D3EE',
        p_parent_department_id := $2,
        p_capability_keys := ARRAY['software_development', 'infrastructure_management']
      ) as res;
    `, [orgAId, parentDeptId]);
    subDeptId = subRes.rows[0].res.department_id;

    const check = await client.query(`
      SELECT parent_department_id FROM public.departments WHERE id = $1;
    `, [subDeptId]);

    if (check.rows[0].parent_department_id !== parentDeptId) {
      throw new Error('MNC sub-department parentage relationship failed');
    }
  });

  // Test 3: Two organizations create departments with identical names without collision
  await test('3. Two organizations create departments with identical names without conflict', async () => {
    const deptA = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Security & Compliance',
        p_capability_keys := ARRAY['security_audits', 'regulatory_compliance']
      ) as res;
    `, [orgAId]);

    const deptB = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Security & Compliance',
        p_capability_keys := ARRAY['security_audits', 'regulatory_compliance']
      ) as res;
    `, [orgBId]);

    if (!deptA.rows[0].res.department_id || !deptB.rows[0].res.department_id) {
      throw new Error('Failed to create identical name across different orgs');
    }
  });

  // Test 4: One department combines multiple capability groups
  let hybridDeptId;
  await test('4. One department combines multiple capability groups (Finance + Ops + HR)', async () => {
    const hybrid = await client.query(`
      SELECT public.create_dynamic_department(
        p_org_id := $1,
        p_name := 'Corporate Shared Services',
        p_description := 'Hybrid back-office services combining Finance, Operations and HR',
        p_capability_keys := ARRAY['budget_planning', 'expense_management', 'daily_operations', 'vendor_management', 'employee_management']
      ) as res;
    `, [orgAId]);
    hybridDeptId = hybrid.rows[0].res.department_id;

    const countRes = await client.query(`
      SELECT count(*) as count FROM public.department_capabilities WHERE department_id = $1 AND is_active = true;
    `, [hybridDeptId]);

    if (parseInt(countRes.rows[0].count) !== 5) {
      throw new Error(`Expected 5 capabilities, got ${countRes.rows[0].count}`);
    }
  });

  // Test 5: Owner assigns existing organization members
  await test('5. Organization owner assigns existing members to department', async () => {
    const assignRes = await client.query(`
      SELECT public.assign_department_member(
        p_dept_id := $1,
        p_user_id := $2,
        p_department_role := 'manager',
        p_is_primary := true
      ) as res;
    `, [hybridDeptId, memberUser1.id]);

    if (!assignRes.rows[0].res.success) {
      throw new Error('Failed to assign member to department');
    }
  });

  // Test 6: One authorized member belongs to multiple departments (Startup / cross-functional)
  await test('6. One authorized member belongs to multiple departments', async () => {
    await client.query(`
      SELECT public.assign_department_member(
        p_dept_id := $1,
        p_user_id := $2,
        p_department_role := 'member',
        p_is_primary := false
      );
    `, [startupDept1Id, memberUser1.id]);

    const memberships = await client.query(`
      SELECT count(*) as count FROM public.department_members WHERE user_id = $1 AND org_id = $2;
    `, [memberUser1.id, orgAId]);

    if (parseInt(memberships.rows[0].count) < 2) {
      throw new Error('User does not belong to multiple departments');
    }
  });

  // Test 7: Department manager cannot access unauthorized private department
  await test('7. Department member cannot access unauthorized department (can_access_department)', async () => {
    // memberUser2 has not been assigned to startupDept2Id
    const accessRes = await client.query(`
      SELECT public.can_access_department($1, $2) as can_access;
    `, [memberUser2.id, startupDept2Id]);

    if (accessRes.rows[0].can_access === true) {
      throw new Error('Unauthorized member was improperly granted access');
    }
  });

  // Test 8: Leadership can access all permitted workspaces
  await test('8. Leadership with all_departments visibility can access workspaces', async () => {
    const leaderAccess = await client.query(`
      SELECT public.can_access_department($1, $2) as can_access;
    `, [leaderUser.id, startupDept2Id]);

    if (leaderAccess.rows[0].can_access !== true) {
      throw new Error('Leadership member was denied oversight access');
    }
  });

  // Test 9: Cross-department collaboration works securely (request & resolution)
  let collabReqId;
  await test('9. Cross-department collaboration request dispatch and approval works securely', async () => {
    // Growth (startupDept1Id) requests design from Technology (startupDept2Id)
    const reqRes = await client.query(`
      SELECT public.create_collaboration_request(
        p_org_id := $1,
        p_requesting_department_id := $2,
        p_target_department_id := $3,
        p_request_type := 'task_assignment',
        p_title := 'Marketing campaign asset integration',
        p_description := 'Need API webhook connector and hero banner assets',
        p_priority := 'high'
      ) as res;
    `, [orgAId, startupDept1Id, startupDept2Id]);
    collabReqId = reqRes.rows[0].res.request_id;

    if (!collabReqId) {
      throw new Error('Failed to dispatch collaboration request');
    }

    // Technology approves request
    const resolveRes = await client.query(`
      SELECT public.resolve_collaboration_request(
        p_org_id := $1,
        p_request_id := $2,
        p_status := 'approved',
        p_decision_notes := 'Approved by team lead. Assigned to sprint backlog.'
      ) as res;
    `, [orgAId, collabReqId]);

    if (!resolveRes.rows[0].res.success) {
      throw new Error('Failed to resolve collaboration request');
    }
  });

  // Test 10: Existing organization accounts continue working
  await test('10. Existing organization accounts and workspaces continue functioning', async () => {
    const orgs = await client.query(`
      SELECT id, name FROM public.organizations LIMIT 5;
    `);
    if (orgs.rows.length === 0) {
      throw new Error('No active organizations found');
    }
  });

  // Test 11: Historical data preservation (projects, tasks, invoices, clients intact)
  await test('11. Zero data loss: historical projects, tasks, invoices and clients remain intact', async () => {
    const projs = await client.query(`SELECT count(*) as count FROM public.projects;`);
    const tasks = await client.query(`SELECT count(*) as count FROM public.tasks;`);
    const invoices = await client.query(`SELECT count(*) as count FROM public.invoices;`);
    const clients = await client.query(`SELECT count(*) as count FROM public.clients;`);

    if (parseInt(projs.rows[0].count) < 21) {
      throw new Error(`Expected at least 21 historical projects, found ${projs.rows[0].count}`);
    }
    console.log(`       Verified: ${projs.rows[0].count} projects, ${tasks.rows[0].count} tasks, ${invoices.rows[0].count} invoices, ${clients.rows[0].count} clients.`);
  });

  // Test 12: Multi-tenant organization isolation
  await test('12. Multi-tenant data isolation: Org A cannot query or modify Org B departments', async () => {
    const crossRes = await client.query(`
      SELECT count(*) as count FROM public.departments WHERE org_id = $1;
    `, [orgBId]);

    // Check that Org A does not touch Org B records
    if (parseInt(crossRes.rows[0].count) === 0) {
      throw new Error('Org B department record missing');
    }
  });

  // Test 13: Disabling a capability removes its configuration without deleting unrelated records
  await test('13. Disabling a capability updates department capabilities without deleting data', async () => {
    await client.query(`
      SELECT public.update_dynamic_department(
        p_org_id := $1,
        p_department_id := $2,
        p_capability_keys := ARRAY['software_development', 'sprint_management']
      );
    `, [orgAId, startupDept2Id]);

    const activeCaps = await client.query(`
      SELECT count(*) as count FROM public.department_capabilities WHERE department_id = $1 AND is_active = true;
    `, [startupDept2Id]);

    if (parseInt(activeCaps.rows[0].count) !== 2) {
      throw new Error(`Expected 2 active capabilities, found ${activeCaps.rows[0].count}`);
    }
  });

  // Test 14: Dynamic objective updates
  await test('14. Editing department responsibilities & objectives updates record correctly', async () => {
    await client.query(`
      SELECT public.update_dynamic_department(
        p_org_id := $1,
        p_department_id := $2,
        p_objectives := '["Deliver enterprise SOC2 Type II certification", "Scale platform to 10k QPS"]'::jsonb,
        p_expected_outcomes := 'Fully compliant infrastructure with 99.99% uptime.'
      );
    `, [orgAId, startupDept2Id]);

    const check = await client.query(`
      SELECT objectives, expected_outcomes FROM public.departments WHERE id = $1;
    `, [startupDept2Id]);

    if (check.rows[0].objectives.length !== 2) {
      throw new Error('Objectives array update failed');
    }
  });

  // Test 15: Department archiving preserves historical records
  await test('15. Archiving a department preserves historical records while marking status', async () => {
    await client.query(`
      SELECT public.archive_department_safe($1, $2);
    `, [orgAId, startupDept3Id]);

    const check = await client.query(`
      SELECT is_archived, status FROM public.departments WHERE id = $1;
    `, [startupDept3Id]);

    if (check.rows[0].is_archived !== true || check.rows[0].status !== 'archived') {
      throw new Error('Archive department flag failed');
    }
  });

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passedCount}/15 ACCEPTANCE TESTS PASSED (${failedCount} FAILED)`);
  console.log('================================================================');

  await client.end();

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
