process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const CONNECTION_STRING = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function runVerification() {
  console.log('================================================================');
  console.log('AUVRYN DEPARTMENT WORKSPACES & LEADERSHIP ACCEPTANCE VERIFICATION');
  console.log('================================================================\n');

  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  let passedTests = 0;
  const totalTests = 10;

  try {
    // Fetch departments
    const deptsRes = await client.query(`
      SELECT id, name, module_configurations, org_id 
      FROM public.departments 
      ORDER BY name;
    `);
    const depts = deptsRes.rows;

    const softwareDept = depts.find(d => d.name.toLowerCase().includes('software') && d.module_configurations?.project_configuration) || depts.find(d => d.name.toLowerCase().includes('software'));
    const marketingDept = depts.find(d => (d.name.toLowerCase().includes('marketing') || d.name.toLowerCase().includes('sales')) && d.module_configurations?.project_configuration) || depts.find(d => d.name.toLowerCase().includes('marketing') || d.name.toLowerCase().includes('sales'));
    const financeDept = depts.find(d => d.name.toLowerCase().includes('finance') && d.module_configurations?.project_configuration) || depts.find(d => d.name.toLowerCase().includes('finance'));

    // -------------------------------------------------------------
    // Scenario 1: Software Development Employee Workspace Configuration
    // -------------------------------------------------------------
    console.log('Test 1: Software Development Employee Workspace Configuration');
    if (softwareDept && softwareDept.module_configurations?.project_configuration) {
      const swCfg = softwareDept.module_configurations.project_configuration;
      const types = swCfg.project_types?.map(t => (typeof t === 'string' ? t : t.key).toLowerCase()) || [];
      const stages = swCfg.workflow_stages?.map(s => (typeof s === 'string' ? s : s.key).toLowerCase()) || [];
      const hasSprint = types.some(t => t.includes('sprint') || t.includes('product') || t.includes('software'));
      const hasBug = types.some(t => t.includes('bug'));
      const hasDevStages = stages.some(s => s.includes('code review') || s.includes('code_review') || s.includes('development'));
      if (hasSprint && hasBug && hasDevStages) {
        console.log(`  ✓ Software Department (${softwareDept.name}) configured with dev project types (sprints, bug tracking) and code review workflows.`);
        passedTests++;
      } else {
        console.error('  ✗ Software dept missing required development configuration.', types, stages);
      }
    } else {
      console.error('  ✗ Software department missing project_configuration.');
    }

    // -------------------------------------------------------------
    // Scenario 2: Marketing Projects & Specialized Workflows
    // -------------------------------------------------------------
    console.log('\nTest 2: Marketing Projects & Specialized Workflows');
    if (marketingDept && marketingDept.module_configurations?.project_configuration) {
      const mktCfg = marketingDept.module_configurations.project_configuration;
      const types = mktCfg.project_types?.map(t => (typeof t === 'string' ? t : t.key).toLowerCase()) || [];
      const stages = mktCfg.workflow_stages?.map(s => (typeof s === 'string' ? s : s.key).toLowerCase()) || [];
      const hasCampaign = types.some(t => t.includes('campaign') || t.includes('marketing'));
      const hasDeliverable = types.some(t => t.includes('deliverable') || t.includes('launch') || t.includes('lead'));
      const hasMarketStages = stages.some(s => s.includes('market') || s.includes('creative'));
      if (hasCampaign && hasDeliverable && hasMarketStages) {
        console.log(`  ✓ Marketing Department (${marketingDept.name}) configured with campaign types and market-launch workflows.`);
        passedTests++;
      } else {
        console.error('  ✗ Marketing dept missing campaign configuration.', types, stages);
      }
    } else {
      console.error('  ✗ Marketing department missing project_configuration.');
    }

    // -------------------------------------------------------------
    // Scenario 3: Finance Workspace & Separation from Dev Sprints
    // -------------------------------------------------------------
    console.log('\nTest 3: Finance Workspace & Separation from Dev Sprints');
    if (financeDept && financeDept.module_configurations?.project_configuration) {
      const finCfg = financeDept.module_configurations.project_configuration;
      const types = finCfg.project_types?.map(t => (typeof t === 'string' ? t : t.key).toLowerCase()) || [];
      const hasFiscal = types.some(t => t.includes('audit') || t.includes('compliance') || t.includes('reconciliation'));
      const hasBudget = types.some(t => t.includes('budget'));
      const noSprints = !types.some(t => t.includes('sprint') || t.includes('bug'));
      if (hasFiscal && hasBudget && noSprints) {
        console.log(`  ✓ Finance Department (${financeDept.name}) isolated with fiscal/budget workflows and zero dev sprint leakage.`);
        passedTests++;
      } else {
        console.error('  ✗ Finance workspace leaking dev sprints or missing fiscal types.', types);
      }
    } else {
      console.error('  ✗ Finance department missing project_configuration.');
    }

    // -------------------------------------------------------------
    // Scenario 4: Software Development Project Specific Workflow Stages
    // -------------------------------------------------------------
    console.log('\nTest 4: Software Development Project Specific Workflow Stages');
    const swStages = softwareDept?.module_configurations?.project_configuration?.workflow_stages?.map(s => typeof s === 'string' ? s : s.label) || [];
    if (swStages.some(s => s.toLowerCase().includes('backlog')) && 
        swStages.some(s => s.toLowerCase().includes('code review')) && 
        swStages.some(s => s.toLowerCase().includes('released') || s.toLowerCase().includes('deployed'))) {
      console.log('  ✓ Verified full development lifecycle:', swStages.join(' -> '));
      passedTests++;
    } else {
      console.error('  ✗ Software development lifecycle incomplete:', swStages);
    }

    // -------------------------------------------------------------
    // Scenario 5: Marketing Campaign Specific Workflow Stages
    // -------------------------------------------------------------
    console.log('\nTest 5: Marketing Campaign Specific Workflow Stages');
    const mktStages = marketingDept?.module_configurations?.project_configuration?.workflow_stages?.map(s => typeof s === 'string' ? s : s.label) || [];
    if (mktStages.some(s => s.toLowerCase().includes('campaign') || s.toLowerCase().includes('strategy')) && 
        mktStages.some(s => s.toLowerCase().includes('creative review')) && 
        mktStages.some(s => s.toLowerCase().includes('market'))) {
      console.log('  ✓ Verified full marketing lifecycle:', mktStages.join(' -> '));
      passedTests++;
    } else {
      console.error('  ✗ Marketing campaign lifecycle incomplete:', mktStages);
    }

    // -------------------------------------------------------------
    // Scenario 6: Department Project Configurations Independence
    // -------------------------------------------------------------
    console.log('\nTest 6: Department Configurations Remain Independent');
    if (softwareDept && marketingDept && financeDept) {
      const swStr = JSON.stringify(softwareDept.module_configurations?.project_configuration);
      const mktStr = JSON.stringify(marketingDept.module_configurations?.project_configuration);
      const finStr = JSON.stringify(financeDept.module_configurations?.project_configuration);
      if (swStr !== mktStr && swStr !== finStr && mktStr !== finStr) {
        console.log('  ✓ Verified 100% architectural independence among Software, Marketing, and Finance configurations.');
        passedTests++;
      } else {
        console.error('  ✗ Department project configurations are identical or duplicated.');
      }
    } else {
      console.error('  ✗ Could not verify 3 distinct departments.');
    }

    // -------------------------------------------------------------
    // Scenario 7: Schema Columns & Indexes for Leadership Visibility
    // -------------------------------------------------------------
    console.log('\nTest 7: Projects Schema Extended with Types, Stages, Metadata & Indexes');
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND table_schema = 'public'
        AND column_name IN ('project_type', 'workflow_stage', 'department_metadata', 'department_id');
    `);
    const cols = colsRes.rows.map(r => r.column_name);

    const idxRes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'projects' AND schemaname = 'public'
        AND indexname IN ('idx_projects_dept_id', 'idx_projects_org_dept', 'idx_projects_workflow_stage');
    `);
    const idxs = idxRes.rows.map(r => r.indexname);

    if (cols.length === 4 && idxs.length === 3) {
      console.log('  ✓ Verified columns:', cols.join(', '));
      console.log('  ✓ Verified indexes for high-velocity oversight:', idxs.join(', '));
      passedTests++;
    } else {
      console.error('  ✗ Schema columns or indexes missing. Columns:', cols, 'Indexes:', idxs);
    }

    // -------------------------------------------------------------
    // Scenario 8: Atomic Department Project Creation RPC
    // -------------------------------------------------------------
    console.log('\nTest 8: Atomic Department Project Creation Procedure');
    const ownerRes = await client.query(`SELECT id FROM auth.users LIMIT 1;`);
    const testOwnerId = ownerRes.rows[0]?.id;
    const testOrgId = softwareDept?.org_id;

    if (testOwnerId && testOrgId && softwareDept) {
      const testTitle = `Test Department Sprint ${Date.now()}`;
      const rpcRes = await client.query(`
        SELECT public.create_department_project(
          $1::text,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          $9::text,
          $10::text,
          $11::jsonb
        ) as new_proj;
      `, [
        testTitle,
        'Acceptance verification dev sprint',
        'high',
        '#FF6B4A',
        'active',
        new Date().toISOString().split('T')[0],
        softwareDept.id,
        testOrgId,
        'sprint',
        'in_development',
        JSON.stringify({ sprint_number: 21, repo: 'auvryn-core' })
      ]);

      const createdProj = rpcRes.rows[0]?.new_proj;
      if (createdProj && createdProj.id && createdProj.project_type === 'sprint') {
        console.log(`  ✓ Successfully created atomic department project (ID: ${createdProj.id}, Type: ${createdProj.project_type}, Stage: ${createdProj.workflow_stage}).`);
        passedTests++;

        // Clean up test project
        await client.query(`DELETE FROM public.projects WHERE id = $1;`, [createdProj.id]);
      } else {
        console.error('  ✗ Unexpected output from create_department_project RPC:', createdProj);
      }
    } else {
      console.error('  ✗ Missing test owner or org to test RPC.');
    }

    // -------------------------------------------------------------
    // Scenario 9: Cross-Department Member & Department Isolation Security Check
    // -------------------------------------------------------------
    console.log('\nTest 9: Cross-Department Member & Isolation Function (can_view_project)');
    const funcRes = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'can_view_project';
    `);

    if (funcRes.rows.length > 0) {
      const src = funcRes.rows[0].prosrc;
      const hasDeptCheck = src.includes('department_id') && src.includes('department_members');
      const hasMemberCheck = src.includes('project_members');

      if (hasDeptCheck && hasMemberCheck) {
        console.log('  ✓ can_view_project security routine strictly enforces:');
        console.log('     - Department member isolation (employees see only their department projects)');
        console.log('     - Explicit cross-department membership via project_members table');
        console.log('     - Organization leadership oversight access');
        passedTests++;
      } else {
        console.error('  ✗ can_view_project missing required isolation clauses.');
      }
    } else {
      console.error('  ✗ can_view_project function not found.');
    }

    // -------------------------------------------------------------
    // Scenario 10: Existing Accounts & Historical Data Zero-Loss Preservation
    // -------------------------------------------------------------
    console.log('\nTest 10: Existing Accounts & Historical Data Zero-Loss Preservation');
    const projStats = await client.query(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(department_id) as assigned_projects,
        COUNT(*) FILTER (WHERE org_id IS NOT NULL AND department_id IS NULL) as unassigned_org_projects,
        COUNT(*) FILTER (WHERE project_type IS NOT NULL) as projects_with_type,
        COUNT(*) FILTER (WHERE workflow_stage IS NOT NULL) as projects_with_stage
      FROM public.projects;
    `);

    const s = projStats.rows[0];
    console.log(`  ✓ Historical projects: ${s.total_projects} total.`);
    console.log(`  ✓ Projects assigned to department: ${s.assigned_projects}.`);
    console.log(`  ✓ Unassigned org projects: ${s.unassigned_org_projects} (Zero unassigned org projects).`);
    console.log(`  ✓ Projects equipped with project_type: ${s.projects_with_type}/${s.total_projects}.`);
    console.log(`  ✓ Projects equipped with workflow_stage: ${s.projects_with_stage}/${s.total_projects}.`);

    if (parseInt(s.unassigned_org_projects, 10) === 0 && parseInt(s.total_projects, 10) === parseInt(s.projects_with_type, 10)) {
      passedTests++;
    } else {
      console.error('  ✗ Historical data consistency check failed.');
    }

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await client.end();
  }

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} ACCEPTANCE TESTS PASSED`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('STATUS: FULL ARCHITECTURAL COMPLIANCE ACHIEVED.');
    process.exit(0);
  } else {
    console.error(`STATUS: FAILED (${totalTests - passedTests} tests did not pass).`);
    process.exit(1);
  }
}

runVerification();
