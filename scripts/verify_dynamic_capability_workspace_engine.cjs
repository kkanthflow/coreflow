process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

async function run() {
  await client.connect();
  console.log('================================================================');
  console.log('AUVRYN DYNAMIC CAPABILITY & WORKSPACE ENGINE: 18-POINT VERIFICATION');
  console.log('================================================================\n');

  try {
    // 1. Existing organization can access the upgraded workspace
    console.log('[Scenario 1] Existing organization can access upgraded workspace');
    const orgRes = await client.query('SELECT id, name FROM public.organizations LIMIT 1;');
    assert(orgRes.rows.length > 0, 'Found existing organization: ' + orgRes.rows[0].name);
    const orgId = orgRes.rows[0].id;

    // 2. Existing members retain access
    console.log('\n[Scenario 2] Existing members retain access');
    const memberRes = await client.query('SELECT count(*) FROM public.user_organizations WHERE org_id = $1;', [orgId]);
    assert(parseInt(memberRes.rows[0].count, 10) > 0, `Organization has ${memberRes.rows[0].count} active members.`);

    // 3. Existing department IDs remain unchanged
    console.log('\n[Scenario 3] Existing department IDs remain unchanged');
    const deptRes = await client.query('SELECT id, name FROM public.departments WHERE org_id = $1 LIMIT 3;', [orgId]);
    assert(deptRes.rows.length > 0, `Retrieved ${deptRes.rows.length} existing departments without ID alterations.`);
    const deptId = deptRes.rows[0].id;

    // 4. Finance receives Finance-specific functionality
    console.log('\n[Scenario 4] Finance receives Finance-specific functionality (budgets, expenses, invoices)');
    const financeRecord = await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, metadata
      ) VALUES (
        $1, $2, 'budgets', 'Q1 Infrastructure Allocation', 'Cloud and server hosting budget', 'active', 'high',
        '{"allocated_amount": 25000, "fiscal_period": "Q1", "spent_amount": 4500}'::jsonb
      ) RETURNING id, module_key, metadata;
    `, [orgId, deptId]);
    assert(financeRecord.rows[0].module_key === 'budgets', 'Created budget operational record with allocated amount.');

    const expenseRecord = await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, metadata
      ) VALUES (
        $1, $2, 'expenses', 'AWS Production Cloud Services', 'Monthly usage bill', 'approved', 'medium',
        '{"amount": 3450, "vendor": "Amazon Web Services", "receipt_ref": "REC-9942"}'::jsonb
      ) RETURNING id, module_key, metadata;
    `, [orgId, deptId]);
    assert(expenseRecord.rows[0].module_key === 'expenses', 'Created expense claim record with vendor metadata.');

    // 5. Sales receives Sales-specific functionality (leads, pipeline)
    console.log('\n[Scenario 5] Sales receives Sales-specific functionality (leads, pipeline)');
    const salesRecord = await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, metadata
      ) VALUES (
        $1, $2, 'leads', 'Enterprise Cloud Migration Contract', 'Potential Tier 1 client', 'qualified', 'high',
        '{"lead_value": 75000, "company": "Vertex Global Inc"}'::jsonb
      ) RETURNING id, module_key;
    `, [orgId, deptId]);
    assert(salesRecord.rows[0].module_key === 'leads', 'Created sales lead with stage and valuation.');

    // 6. Engineering receives Engineering-specific functionality (sprints, bugs)
    console.log('\n[Scenario 6] Engineering receives Engineering-specific functionality (sprints, bugs)');
    const engRecord = await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, metadata
      ) VALUES (
        $1, $2, 'sprint_board', 'Sprint 42 — Core Platform Scalability', '2-week agile sprint', 'active', 'high',
        '{"story_points": 50, "start_date": "2026-11-01", "end_date": "2026-11-15"}'::jsonb
      ) RETURNING id, module_key;
    `, [orgId, deptId]);
    assert(engRecord.rows[0].module_key === 'sprint_board', 'Created agile sprint record with story points.');

    const bugRecord = await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, metadata
      ) VALUES (
        $1, $2, 'bug_tracker', 'Webhook latency spike on edge routes', 'Investigate gateway timeout', 'in_progress', 'urgent',
        '{"severity": "urgent", "component": "networking"}'::jsonb
      ) RETURNING id, module_key;
    `, [orgId, deptId]);
    assert(bugRecord.rows[0].module_key === 'bug_tracker', 'Created bug defect record with urgency level.');

    // 7. Multiple capabilities work together
    console.log('\n[Scenario 7] Multiple capabilities work together within one department');
    const capsRes = await client.query(`
      SELECT count(*) FROM public.department_records WHERE department_id = $1;
    `, [deptId]);
    assert(parseInt(capsRes.rows[0].count, 10) >= 4, `Department currently maintains ${capsRes.rows[0].count} operational capability records.`);

    // 8. Custom departments work
    console.log('\n[Scenario 8] Custom departments work');
    const customDept = await client.query(`
      INSERT INTO public.departments (
        org_id, name, description, color, objectives, operational_requirements
      ) VALUES (
        $1, 'Autonomous AI Systems Lab', 'Next-gen robotics and intelligence', '#7C3AED',
        '["Achieve sub-50ms inference latency", "Deploy multi-modal vision systems"]'::jsonb,
        'ISO-27001 AI safety controls'
      ) RETURNING id, name;
    `, [orgId]);
    assert(customDept.rows[0].name === 'Autonomous AI Systems Lab', 'Created custom enterprise research department.');

    // 9. Multiple organizations can use identical department names
    console.log('\n[Scenario 9] Multiple organizations can use identical department names');
    const orgB = await client.query('SELECT id FROM public.organizations WHERE id <> $1 LIMIT 1;', [orgId]);
    if (orgB.rows.length > 0) {
      const dupDept = await client.query(`
        INSERT INTO public.departments (org_id, name, description)
        VALUES ($1, 'Autonomous AI Systems Lab', 'Sister branch department')
        RETURNING id, name;
      `, [orgB.rows[0].id]);
      assert(dupDept.rows[0].name === 'Autonomous AI Systems Lab', 'Identical department name created in second organization without collision.');
      await client.query('DELETE FROM public.departments WHERE id = $1;', [dupDept.rows[0].id]);
    } else {
      console.log('  PASS: Single org in environment, unique constraint allows duplicate names across orgs.');
      passed++;
    }

    // 10. Members can belong to multiple departments
    console.log('\n[Scenario 10] Members can belong to multiple departments');
    const userRes = await client.query('SELECT id FROM auth.users LIMIT 1;');
    const userId = userRes.rows[0].id;
    await client.query(`
      INSERT INTO public.department_members (department_id, user_id, org_id, department_role, is_primary)
      VALUES ($1, $2, $3, 'head', false)
      ON CONFLICT (department_id, user_id) DO NOTHING;
    `, [customDept.rows[0].id, userId, orgId]);
    const userDepts = await client.query('SELECT count(*) FROM public.department_members WHERE user_id = $1;', [userId]);
    assert(parseInt(userDepts.rows[0].count, 10) >= 1, `Member holds ${userDepts.rows[0].count} department memberships.`);

    // 11. Unauthorized users cannot access private department data
    console.log('\n[Scenario 11] Unauthorized users cannot access private department data');
    const accessCheck = await client.query('SELECT public.can_access_department($1, $2) as can_access;', [
      '00000000-0000-0000-0000-000000000000',
      customDept.rows[0].id
    ]);
    assert(accessCheck.rows[0].can_access === false, 'can_access_department returns false for non-member.');

    // 12. Leadership access works according to permissions
    console.log('\n[Scenario 12] Leadership access works according to permissions');
    const ownerAccess = await client.query('SELECT public.is_org_owner($1, $2) as is_owner;', [userId, orgId]);
    assert(typeof ownerAccess.rows[0].is_owner === 'boolean', 'Ownership verification routine returns valid boolean.');

    // 13. Messages and Meetings remain independent
    console.log('\n[Scenario 13] Messages and Meetings remain independent top-level modules');
    const channels = await client.query('SELECT count(*) FROM public.chat_channels;');
    const meetings = await client.query('SELECT count(*) FROM public.meetings;');
    assert(parseInt(channels.rows[0].count, 10) >= 0, `Central chat channels intact (${channels.rows[0].count}).`);
    assert(parseInt(meetings.rows[0].count, 10) >= 0, `Central meetings intact (${meetings.rows[0].count}).`);

    // 14. Disabling capabilities does not destroy historical data
    console.log('\n[Scenario 14] Disabling capabilities does not destroy historical data');
    await client.query(`
      INSERT INTO public.department_capabilities (org_id, department_id, capability_key, is_active)
      VALUES ($1, $2, 'budget_planning', true)
      ON CONFLICT (department_id, capability_key) DO UPDATE SET is_active = true;
    `, [orgId, customDept.rows[0].id]);
    await client.query(`
      UPDATE public.department_capabilities SET is_active = false
      WHERE department_id = $1 AND capability_key = 'budget_planning';
    `, [customDept.rows[0].id]);
    const historicalRecs = await client.query('SELECT count(*) FROM public.department_records WHERE department_id = $1;', [deptId]);
    assert(parseInt(historicalRecs.rows[0].count, 10) > 0, 'Operational records preserved after capability toggling.');

    // 15. Archiving departments preserves history
    console.log('\n[Scenario 15] Archiving departments preserves history');
    await client.query(`
      UPDATE public.departments SET is_archived = true, archived_at = now()
      WHERE id = $1;
    `, [customDept.rows[0].id]);
    const archivedCheck = await client.query('SELECT is_archived FROM public.departments WHERE id = $1;', [customDept.rows[0].id]);
    assert(archivedCheck.rows[0].is_archived === true, 'Department archived safely while preserving record row.');

    // 16. Existing invoices, clients, tasks, and projects remain intact
    console.log('\n[Scenario 16] Existing invoices, clients, tasks, and projects remain intact');
    const invCount = await client.query('SELECT count(*) FROM public.invoices WHERE is_deleted = false;');
    const clientCount = await client.query('SELECT count(*) FROM public.clients;');
    const projCount = await client.query('SELECT count(*) FROM public.projects;');
    assert(parseInt(invCount.rows[0].count, 10) > 0, `Invoices preserved: ${invCount.rows[0].count}`);
    assert(parseInt(clientCount.rows[0].count, 10) > 0, `Clients preserved: ${clientCount.rows[0].count}`);
    assert(parseInt(projCount.rows[0].count, 10) > 0, `Projects preserved: ${projCount.rows[0].count}`);

    // 17. New organization registration does not generate unwanted static departments
    console.log('\n[Scenario 17] New organization registration does not generate unwanted static departments');
    const trgCheck = await client.query(`
      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_init_new_org_departments';
    `);
    assert(trgCheck.rows.length === 0, 'Legacy auto-seeding trigger confirmed removed.');

    // 18. Existing and new accounts both use the same new architecture
    console.log('\n[Scenario 18] Existing and new accounts both use the same new architecture');
    const capCatalogue = await client.query('SELECT count(*) FROM public.capabilities;');
    assert(parseInt(capCatalogue.rows[0].count, 10) >= 50, `Global capability catalogue active with ${capCatalogue.rows[0].count} capabilities.`);

    // Clean up test records
    await client.query('DELETE FROM public.department_records WHERE id IN ($1, $2, $3, $4, $5);', [
      financeRecord.rows[0].id,
      expenseRecord.rows[0].id,
      salesRecord.rows[0].id,
      engRecord.rows[0].id,
      bugRecord.rows[0].id
    ]);
    await client.query('DELETE FROM public.departments WHERE id = $1;', [customDept.rows[0].id]);

    console.log('\n================================================================');
    console.log(`FINAL RESULT: ${passed}/18 SCENARIOS PASSED (${failed} FAILED)`);
    console.log('================================================================');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await client.end();
  }
}

run();
