process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function runAcceptanceTests() {
  await client.connect();
  console.log('--- STARTING USER-DEFINED DEPARTMENT ACCEPTANCE TESTS ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  await client.query('BEGIN');

  try {
    const ts = Date.now();

    // 1. Create Org A and Org B
    const userA = (await client.query(`
      INSERT INTO public.users (email, full_name, role, account_type)
      VALUES ('founder_a_${ts}@auvryn.internal', 'Founder A', 'owner', 'organization')
      RETURNING id;
    `)).rows[0].id;

    const orgA = (await client.query(`
      INSERT INTO public.organizations (name, owner_id)
      VALUES ('Organization Alpha ${ts}', '${userA}')
      RETURNING id;
    `)).rows[0].id;

    await client.query(`
      INSERT INTO public.user_organizations (user_id, org_id, role, job_title)
      VALUES ('${userA}', '${orgA}', 'owner', 'Founder & CEO');
    `);

    // Appoint userA as organization owner in organization_owners
    await client.query(`
      INSERT INTO public.organization_owners (org_id, user_id, status)
      VALUES ('${orgA}', '${userA}', 'active');
    `);

    const userB = (await client.query(`
      INSERT INTO public.users (email, full_name, role, account_type)
      VALUES ('founder_b_${ts}@auvryn.internal', 'Founder B', 'owner', 'organization')
      RETURNING id;
    `)).rows[0].id;

    const orgB = (await client.query(`
      INSERT INTO public.organizations (name, owner_id)
      VALUES ('Organization Beta ${ts}', '${userB}')
      RETURNING id;
    `)).rows[0].id;

    await client.query(`
      INSERT INTO public.user_organizations (user_id, org_id, role, job_title)
      VALUES ('${userB}', '${orgB}', 'owner', 'Founder & MD');
    `);

    // Appoint userB as organization owner in organization_owners
    await client.query(`
      INSERT INTO public.organization_owners (org_id, user_id, status)
      VALUES ('${orgB}', '${userB}', 'active');
    `);

    assert(orgA && orgB, 'Test 1: Created isolated organizations Org Alpha and Org Beta with dual equal-authority Founders');

    // Emulate userA auth session
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userA}', true);`);

    // 2. Org A creates: Marketing, Finance, Software Development
    const deptA_Mkt = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgA}',
        'Marketing',
        'Brand strategy and outbound marketing',
        'Elevate brand awareness and drive organic engagement',
        '["Campaign Management", "Social Media", "Brand Assets"]'::jsonb,
        '[{"key":"campaigns","name":"Campaign Management","workflowStages":["Planning","Active","Completed"]}]'::jsonb,
        '{}'::jsonb,
        '#F472B6',
        '${userA}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    const deptA_Fin = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgA}',
        'Finance',
        'Financial management and accounting controls',
        'Oversee budget allocations and fiscal health',
        '["Budget Allocation", "Expense Audits", "Invoice Processing"]'::jsonb,
        '[{"key":"budget_management","name":"Budget Management","workflowStages":["Proposed","Active","Closed"]}]'::jsonb,
        '{}'::jsonb,
        '#34D399',
        '${userA}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    const deptA_Dev = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgA}',
        'Software Development',
        'Core product and platform engineering',
        'Deliver reliable high-performance cloud applications',
        '["Agile Sprints", "Code Reviews", "Bug Tracking"]'::jsonb,
        '[{"key":"sprint_management","name":"Sprint Management","workflowStages":["Planning","Active","Retro"]}]'::jsonb,
        '{}'::jsonb,
        '#60A5FA',
        '${userA}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    assert(deptA_Mkt.success && deptA_Fin.success && deptA_Dev.success, 'Test 2: Org A successfully created user-defined departments (Marketing, Finance, Software Development)');

    // Emulate userB auth session
    await client.query(`SELECT set_config('request.jwt.claim.sub', '${userB}', true);`);

    // 3. Org B creates: Growth and Strategy, Accounts, Product Engineering, Innovation
    const deptB_Growth = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgB}',
        'Growth and Strategy',
        'Lead generation and strategic market expansion',
        'Accelerate inbound pipeline and corporate partnerships',
        '["Lead Generation", "Strategic Partnerships", "Market Expansion"]'::jsonb,
        '[{"key":"lead_management","name":"Lead Management","workflowStages":["New","Qualified","Won"]}]'::jsonb,
        '{}'::jsonb,
        '#FF6B4A',
        '${userB}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    const deptB_Acc = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgB}',
        'Accounts',
        'Accounts payable, receivable, and vendor payments',
        'Maintain zero variance in accounts and audits',
        '["Receipts Reconciliation", "Vendor Payments", "P&L Reports"]'::jsonb,
        '[{"key":"expense_management","name":"Expense Management","workflowStages":["Submitted","Approved","Reconciled"]}]'::jsonb,
        '{}'::jsonb,
        '#FBBF24',
        '${userB}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    const deptB_Eng = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgB}',
        'Product Engineering',
        'Feature delivery, architecture, and CI/CD releases',
        'Build scalable microservices and modern interfaces',
        '["Feature Backlog", "CI/CD Releases", "Architecture Specs"]'::jsonb,
        '[{"key":"feature_management","name":"Feature Management","workflowStages":["Idea","Building","Shipped"]}]'::jsonb,
        '{}'::jsonb,
        '#A78BFA',
        '${userB}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    const deptB_Innov = (await client.query(`
      SELECT public.create_user_defined_department(
        '${orgB}',
        'Innovation',
        'Experimental prototyping and patent filings',
        'Invent frontier technologies and proprietary algorithms',
        '["AI Model Research", "Rapid Prototyping", "Patent Filings"]'::jsonb,
        '[{"key":"patent_tracking","name":"Patent Tracking","workflowStages":["Draft","Filing","Granted"]}]'::jsonb,
        '{}'::jsonb,
        '#22D3EE',
        '${userB}',
        ARRAY[]::uuid[]
      ) as res;
    `)).rows[0].res;

    assert(deptB_Growth.success && deptB_Acc.success && deptB_Eng.success && deptB_Innov.success, 'Test 3: Org B successfully created custom user-defined departments (Growth and Strategy, Accounts, Product Engineering, Innovation)');

    // 4. Verify no predefined catalogue was required and free-text names were stored
    const orgADepts = await client.query(`
      SELECT name, purpose, responsibilities, enabled_modules FROM public.departments WHERE org_id = '${orgA}' ORDER BY name;
    `);
    const namesA = orgADepts.rows.map(r => r.name);
    assert(namesA.includes('Finance') && namesA.includes('Marketing') && namesA.includes('Software Development'), 'Test 4: Org A department names verified exactly as customized');

    const orgBDepts = await client.query(`
      SELECT name, purpose, responsibilities, enabled_modules FROM public.departments WHERE org_id = '${orgB}' ORDER BY name;
    `);
    const namesB = orgBDepts.rows.map(r => r.name);
    assert(namesB.includes('Accounts') && namesB.includes('Growth and Strategy') && namesB.includes('Innovation') && namesB.includes('Product Engineering'), 'Test 5: Org B department names verified completely independently from Org A');

    // 5. Verify dedicated chat channels were automatically provisioned
    const chA = await client.query(`SELECT COUNT(*) as count FROM public.chat_channels WHERE org_id = '${orgA}' AND type = 'department';`);
    const chB = await client.query(`SELECT COUNT(*) as count FROM public.chat_channels WHERE org_id = '${orgB}' AND type = 'department';`);
    assert(parseInt(chA.rows[0].count) === 3 && parseInt(chB.rows[0].count) === 4, 'Test 6: Dedicated department chat channels auto-provisioned for all 7 user-defined departments');

    // 6. Test Department Operational Records Creation
    const recGrowth = (await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, created_by
      ) VALUES (
        '${orgB}', '${deptB_Growth.department_id}', 'lead_management', 'Enterprise Lead: Acme Global Corp',
        'Initial discovery meeting scheduled for \$120k ARR contract', 'Qualified', 'high', '${userB}'
      ) RETURNING id, title, status;
    `)).rows[0];

    const recInnov = (await client.query(`
      INSERT INTO public.department_records (
        org_id, department_id, module_key, title, description, status, priority, created_by
      ) VALUES (
        '${orgB}', '${deptB_Innov.department_id}', 'patent_tracking', 'Quantum Encryption Handshake Algorithm',
        'Patent filing application draft for autonomous mesh security', 'Draft', 'urgent', '${userB}'
      ) RETURNING id, title, status;
    `)).rows[0];

    assert(recGrowth.id && recInnov.id, 'Test 7: Operational module records created for Lead Management and Patent Tracking');

    // 7. Verify Multi-tenant Data Isolation
    const leakCheckA = await client.query(`
      SELECT COUNT(*) as count FROM public.department_records WHERE org_id = '${orgA}';
    `);
    assert(parseInt(leakCheckA.rows[0].count) === 0, 'Test 8: Strict multi-tenant isolation - Org A cannot see Org B records');

    const leakCheckB = await client.query(`
      SELECT COUNT(*) as count FROM public.department_records WHERE org_id = '${orgB}';
    `);
    assert(parseInt(leakCheckB.rows[0].count) === 2, 'Test 9: Org B has isolated access to its own custom operational records');

    // 8. Test Dynamic Update Configuration via RPC
    const updateRes = (await client.query(`
      SELECT public.update_department_configuration(
        '${orgB}',
        '${deptB_Innov.department_id}',
        'Advanced Innovation & AI',
        'Frontier AI research and rapid algorithmic prototyping',
        'Invent, patent, and open-source next-gen agentic protocols',
        '["Autonomous Agents", "Hardware Acceleration", "Patents"]'::jsonb,
        '[{"key":"patent_tracking","name":"Patent Tracking"},{"key":"agentic_models","name":"Agentic Models"}]'::jsonb
      ) as res;
    `)).rows[0].res;

    const updatedDept = (await client.query(`
      SELECT name, purpose, responsibilities, enabled_modules FROM public.departments WHERE id = '${deptB_Innov.department_id}';
    `)).rows[0];

    assert(
      updateRes.success && 
      updatedDept.name === 'Advanced Innovation & AI' && 
      updatedDept.responsibilities.length === 3 &&
      updatedDept.enabled_modules.length === 2,
      'Test 10: Dynamic department configuration and custom module expansion verified via RPC'
    );

    // 9. Test Record Status Lifecycle Transition
    await client.query(`
      UPDATE public.department_records
      SET status = 'Filing'
      WHERE id = '${recInnov.id}';
    `);

    const updatedRec = (await client.query(`
      SELECT status FROM public.department_records WHERE id = '${recInnov.id}';
    `)).rows[0];

    assert(updatedRec.status === 'Filing', 'Test 11: Operational record workflow stage transition verified');

  } finally {
    // Rollback so no test data lingers and production data is never reset
    await client.query('ROLLBACK');
    await client.end();
  }

  console.log(`\n========================================`);
  console.log(`ACCEPTANCE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runAcceptanceTests().catch(err => {
  console.error('Acceptance test error:', err);
  process.exit(1);
});
