const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

const EXPECTED_DEPARTMENTS = [
  'Executive Leadership',
  'Software Engineering & Development',
  'Cybersecurity & Information Security',
  'DevOps, Cloud & Infrastructure',
  'Quality Assurance & Testing',
  'Product Management & Design',
  'Data, Analytics & Artificial Intelligence',
  'Project & Program Management',
  'Finance & Accounting',
  'Human Resources & People Operations',
  'Sales & Business Development',
  'Marketing & Communications',
  'Customer Support & Professional Services',
  'Legal, Compliance & Risk',
  'Administration & Internal IT',
  'Research & Development'
];

const EXPECTED_CAREER_LEVELS = [
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'
];

async function runTestSuite() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('========================================================================');
  console.log('AUVRYN Enterprise Job Roles & RBAC System Verification');
  console.log('Timestamp:', new Date().toISOString());
  console.log('PostgreSQL Target: Supabase Pooler');
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
    // TEST 1: Verify Auto-Generated Departments Removed & Backed Up
    // -------------------------------------------------------------------------
    console.log('--- Suite 1: Cleaned Department Architecture & Functional Domains ---');
    const autoDeptsRes = await client.query(`
      SELECT count(*)::int as count FROM public.departments 
      WHERE name = ANY($1::text[])
    `, [EXPECTED_DEPARTMENTS]);
    assert(autoDeptsRes.rows[0].count === 0, 'Auto-generated predefined departments cleanly removed from public.departments');

    const backupRes = await client.query(`
      SELECT count(*)::int as count FROM public._backup_auto_seeded_departments
    `);
    assert(backupRes.rows[0].count === 336, `Auto-generated departments safely backed up in public._backup_auto_seeded_departments (Found: ${backupRes.rows[0].count})`);

    const customDeptRes = await client.query(`
      SELECT id, name, org_id FROM public.departments WHERE is_deleted = false
    `);
    const customDeptNames = customDeptRes.rows.map(d => d.name);
    assert(customDeptNames.includes('Finance Department'), 'User-created custom department (Finance Department) strictly preserved');

    // Verify all 16 domains are covered in the Job Titles catalogue
    const domainsRes = await client.query(`
      SELECT DISTINCT department_name FROM public.job_titles WHERE is_active = true
    `);
    const catalogDomains = domainsRes.rows.map(d => d.department_name);
    let missingDomains = EXPECTED_DEPARTMENTS.filter(d => !catalogDomains.includes(d));
    assert(missingDomains.length === 0, 'All 16 functional domains represented in Job Roles Catalogue', `Missing: ${missingDomains.join(', ')}`);

    // -------------------------------------------------------------------------
    // TEST 2: Verify Job Roles Catalogue & Career Levels
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 2: Job Roles Catalogue & Seniority ---');
    const jtRes = await client.query(`
      SELECT id, title, department_name, career_level, is_active FROM public.job_titles WHERE is_active = true
    `);
    const jobTitles = jtRes.rows;
    assert(jobTitles.length >= 60, `Job titles catalogue populated (Found: ${jobTitles.length} active titles)`);

    const sampleKeywords = [
      'CEO',
      'CTO',
      'CFO',
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full-Stack Developer',
      'Mobile',
      'Security Analyst',
      'Penetration Tester',
      'DevOps Engineer',
      'QA Engineer',
      'Product Manager',
      'Data',
      'Project Manager',
      'Accountant',
      'Human Resources',
      'Sales Manager',
      'Marketing Specialist',
      'Customer Success Manager',
      'Legal Counsel'
    ];

    const catalogTitles = jobTitles.map(j => j.title);
    let missingKeywords = sampleKeywords.filter(k => !catalogTitles.some(t => t.includes(k)));
    assert(missingKeywords.length === 0, 'Key enterprise job titles exist in catalogue across domains', `Missing keywords: ${missingKeywords.join(', ')}`);

    // Verify Career Levels representation
    const catalogLevels = new Set(jobTitles.map(j => j.career_level));
    let missingLevels = EXPECTED_CAREER_LEVELS.filter(l => !catalogLevels.has(l));
    assert(missingLevels.length === 0, 'All 10 career levels (L1 - L10) present in catalogue', `Missing: ${missingLevels.join(', ')}`);

    // -------------------------------------------------------------------------
    // TEST 3: Principle of Least Privilege & Independence of Job Title
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 3: Independence of Job Title vs Application Permissions ---');
    const orgRes = await client.query(`SELECT id, name FROM public.organizations WHERE name = 'Skavelon Technologies' LIMIT 1`);
    const testOrgId = orgRes.rows[0].id;

    const ownerRes = await client.query(`SELECT id FROM public.users WHERE email = 'kk5480346@gmail.com'`);
    const ownerId = ownerRes.rows[0].id;

    // Simulate authenticated session as Workspace Owner
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);

    const memberRes = await client.query(`SELECT id, email FROM public.users WHERE email = 'lokenderdina@gmail.com'`);
    const testMemberId = memberRes.rows[0].id;

    // Fetch CTO job title from catalogue
    const ctoJt = jobTitles.find(j => j.title.includes('CTO'));
    assert(ctoJt !== undefined, 'Found Chief Technology Officer (CTO) job title in catalogue');

    // Assign prestigious job title "CTO" (L10 level), but application role "employee"
    const assignRes = await client.query(`
      SELECT public.assign_member_job_and_role(
        $1, $2, 'employee', NULL, $3, NULL, 'L10'
      ) as res
    `, [testOrgId, testMemberId, ctoJt.id]);

    assert(assignRes.rows[0].res?.success, 'Assigned prestigious job title CTO (L10) with base employee role');

    // Test permission check: A base employee with job title CTO must NOT automatically have billing.manage or organization.delete
    const billingPermRes = await client.query(`
      SELECT public.has_org_permission($1, $2, 'billing.manage') as has_perm
    `, [testMemberId, testOrgId]);
    assert(billingPermRes.rows[0].has_perm === false, 'CTO job title does NOT grant billing.manage (Least Privilege enforced)');

    const deleteOrgPermRes = await client.query(`
      SELECT public.has_org_permission($1, $2, 'organization.delete') as has_perm
    `, [testMemberId, testOrgId]);
    assert(deleteOrgPermRes.rows[0].has_perm === false, 'CTO job title does NOT grant organization.delete (Least Privilege enforced)');

    // -------------------------------------------------------------------------
    // TEST 4: Custom Roles Creation, Update, and Assignment
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 4: Custom Roles & Granular Permission Delegation ---');
    // Create custom role: "Lead Systems Auditor"
    const createRoleRes = await client.query(`
      SELECT public.create_custom_role(
        $1,
        'Lead Systems Auditor',
        'Audits systems and workflows',
        '["audit_logs.view", "reports.view", "workflows.view"]'::jsonb,
        '{"projects": "organization", "tasks": "organization"}'::jsonb
      ) as res
    `, [testOrgId]);

    const customRoleId = createRoleRes.rows[0].res?.role_id;
    assert(customRoleId !== undefined, 'Successfully created custom organization role with selected permissions');

    // Update custom role permissions
    const updateRoleRes = await client.query(`
      SELECT public.update_custom_role(
        $1,
        'Lead Systems Auditor (Expanded)',
        'Expanded auditor scope with security management',
        '["audit_logs.view", "reports.view", "workflows.view", "security.manage"]'::jsonb,
        '{"projects": "organization"}'::jsonb,
        true
      ) as res
    `, [customRoleId]);

    assert(updateRoleRes.rows[0].res?.success, 'Updated custom role permissions successfully');

    // Assign custom role to member
    const secAnalystJt = jobTitles.find(j => j.title.includes('Security Analyst'));
    const assignCustomRes = await client.query(`
      SELECT public.assign_member_job_and_role(
        $1, $2, 'employee', $3, $4, NULL, 'L5'
      ) as res
    `, [testOrgId, testMemberId, customRoleId, secAnalystJt?.id || null]);

    assert(assignCustomRes.rows[0].res?.success, 'Assigned custom role to member');

    // Verify member now has security.manage permission via custom role
    const secPermRes = await client.query(`
      SELECT public.has_org_permission($1, $2, 'security.manage') as has_perm
    `, [testMemberId, testOrgId]);
    assert(secPermRes.rows[0].has_perm === true, 'Member granted security.manage via custom role permissions');

    // Verify member still denied billing.manage
    const stillDeniedRes = await client.query(`
      SELECT public.has_org_permission($1, $2, 'billing.manage') as has_perm
    `, [testMemberId, testOrgId]);
    assert(stillDeniedRes.rows[0].has_perm === false, 'Member still denied ungranted billing.manage permission');

    // Clean up custom role: Deleting custom role must automatically fallback members
    const deleteRoleRes = await client.query(`
      SELECT public.delete_custom_role($1) as res
    `, [customRoleId]);

    assert(deleteRoleRes.rows[0].res?.success, 'Deleted custom role with automatic member fallback to employee');

    // After deletion, member no longer has security.manage
    const secAfterDeleteRes = await client.query(`
      SELECT public.has_org_permission($1, $2, 'security.manage') as has_perm
    `, [testMemberId, testOrgId]);
    assert(secAfterDeleteRes.rows[0].has_perm === false, 'Revoked security.manage after custom role deletion');

    // Restore member back to original role
    await client.query(`
      UPDATE public.user_organizations 
      SET role = 'director', custom_role_id = NULL 
      WHERE org_id = $1 AND user_id = $2
    `, [testOrgId, testMemberId]);
    await client.query(`UPDATE public.users SET role = 'director' WHERE id = $1`, [testMemberId]);

    // -------------------------------------------------------------------------
    // TEST 5: Last Owner Protection & Anti-Self-Elevation
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 5: Last Owner Protection & Anti-Self-Elevation ---');
    let selfElevationBlocked = false;
    try {
      await client.query(`
        SELECT public.assign_member_job_and_role(
          $1, $2, 'employee', NULL, NULL, NULL, 'L5'
        ) as res
      `, [testOrgId, ownerId]);
    } catch (e) {
      if (e.message.includes('Security violation')) {
        selfElevationBlocked = true;
      }
    }
    assert(selfElevationBlocked, 'Anti-self-elevation guard blocked self-modification of entitlements');

    // Test caller as another user attempting to demote primary owner
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: testMemberId, role: 'authenticated' })]);
    let ownerDemotionBlocked = false;
    try {
      await client.query(`
        SELECT public.assign_member_job_and_role(
          $1, $2, 'employee', NULL, NULL, NULL, 'L5'
        ) as res
      `, [testOrgId, ownerId]);
    } catch (e) {
      if (e.message.includes('Security violation') || e.message.includes('Access denied')) {
        ownerDemotionBlocked = true;
      }
    }
    assert(ownerDemotionBlocked, 'Prevented unauthorized demotion of primary organization owner');

    // Reset caller back to owner
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);

    // -------------------------------------------------------------------------
    // TEST 6: Preservation of Existing Accounts, Invoices, Clients, and Data
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 6: Data Integrity & Backward Compatibility ---');
    // Check user account kk5480346@gmail.com
    const userRes = await client.query(`
      SELECT id, email, full_name FROM public.users WHERE email = 'kk5480346@gmail.com'
    `);
    assert(userRes.rows.length > 0, 'Account kk5480346@gmail.com preserved intact');

    // Check critical invoices: INV-381608 & INV-544320
    const inv381Res = await client.query(`
      SELECT id, invoice_number, total_amount FROM public.invoices WHERE invoice_number = 'INV-381608'
    `);
    assert(inv381Res.rows.length > 0, 'Invoice INV-381608 preserved intact');

    const inv544Res = await client.query(`
      SELECT id, invoice_number, total_amount FROM public.invoices WHERE invoice_number = 'INV-544320'
    `);
    assert(inv544Res.rows.length > 0, 'Invoice INV-544320 preserved intact');

    // Check client EJOUMALE
    const clientRes = await client.query(`
      SELECT id, name FROM public.clients WHERE name ILIKE '%EJOUMALE%'
    `);
    assert(clientRes.rows.length > 0, 'Client EJOUMALE preserved intact');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================================\n');

    await client.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error running verification suite:', err);
    await client.end();
    process.exit(1);
  }
}

runTestSuite();
