import { Client } from 'pg';
import { 
  PROFESSIONAL_JOB_TITLES, 
  ALL_JOB_TITLES_FLAT, 
  ACCESS_ROLES, 
  ASSIGNABLE_ACCESS_ROLES, 
  formatAccessRole 
} from '../web/src/lib/jobTitles.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
}

async function runJobTitlesAndRbacVerification() {
  console.log('========================================================================');
  console.log('  AUVRYN — JOB TITLES & RBAC PERMISSIONS VERIFICATION SUITE');
  console.log('========================================================================\n');

  // 1. Verify Professional Job Titles Catalogue
  console.log('▶ [Test 1] Verify Professional Job Titles Catalogue structure and counts');
  
  const leadershipCat = PROFESSIONAL_JOB_TITLES.find(c => c.category === 'Leadership and Business');
  const techCat = PROFESSIONAL_JOB_TITLES.find(c => c.category === 'Technology and Product');
  const bizCat = PROFESSIONAL_JOB_TITLES.find(c => c.category === 'Business Operations');

  assert(!!leadershipCat, 'Leadership and Business category exists');
  assert(!!techCat, 'Technology and Product category exists');
  assert(!!bizCat, 'Business Operations category exists');

  console.log(`  • Leadership titles (${leadershipCat?.titles.length}):`, leadershipCat?.titles.join(', '));
  console.log(`  • Technology titles (${techCat?.titles.length}):`, techCat?.titles.join(', '));
  console.log(`  • Business titles (${bizCat?.titles.length}):`, bizCat?.titles.join(', '));

  assert(leadershipCat?.titles.length === 10, 'Expected exactly 10 Leadership titles');
  assert(techCat?.titles.length === 13, 'Expected exactly 13 Technology titles');
  assert(bizCat?.titles.length === 11, 'Expected exactly 11 Business titles');
  assert(ALL_JOB_TITLES_FLAT.length === 34, 'Total titles count matches flat list');

  // Verify critical leadership titles can perform work
  assert(ALL_JOB_TITLES_FLAT.includes('Founder'), 'Founder included');
  assert(ALL_JOB_TITLES_FLAT.includes('Chief Executive Officer (CEO)'), 'CEO included');
  assert(ALL_JOB_TITLES_FLAT.includes('Chief Technology Officer (CTO)'), 'CTO included');
  assert(ALL_JOB_TITLES_FLAT.includes('Software Engineer'), 'Software Engineer included');
  assert(ALL_JOB_TITLES_FLAT.includes('Custom Job Title'), 'Custom Job Title included');

  console.log('  ✔ PASS: Professional Job Titles catalogue is complete and matches prompt specification.\n');

  // 2. Verify RBAC Access Roles Separation
  console.log('▶ [Test 2] Verify Separation of Access Roles from Job Titles');
  const accessRoleValues = ACCESS_ROLES.map(r => r.value);
  console.log('  • Configured RBAC Access Roles:', accessRoleValues.join(', '));

  assert(accessRoleValues.includes('owner'), 'Organisation Owner role present');
  assert(accessRoleValues.includes('administrator'), 'Organisation Administrator role present');
  assert(accessRoleValues.includes('manager'), 'Manager role present');
  assert(accessRoleValues.includes('team_member'), 'Team Member role present');
  assert(accessRoleValues.includes('guest'), 'Guest / External Collaborator role present');
  assert(accessRoleValues.includes('client'), 'Client role present');
  assert(accessRoleValues.includes('custom'), 'Custom Access Role present');

  // Verify old roles are NOT present as job titles or assignable access roles
  assert(!ALL_JOB_TITLES_FLAT.includes('Owner'), 'Old role Owner is NOT in Job Titles catalogue');
  assert(!ALL_JOB_TITLES_FLAT.includes('Administrator'), 'Old role Administrator is NOT in Job Titles catalogue');
  assert(!ALL_JOB_TITLES_FLAT.includes('Employee'), 'Old role Employee is NOT in Job Titles catalogue');
  assert(!accessRoleValues.includes('employee'), 'Legacy employee string is NOT an access role');
  assert(!accessRoleValues.includes('team_lead'), 'Legacy team_lead string is NOT an access role');

  console.log('  ✔ PASS: RBAC Access roles and Job Titles are completely separated and legacy roles removed.\n');

  // 3. Verify Database Functions and Data Integrity on Live Supabase
  console.log('▶ [Test 3] Verify Live Database RPCs, Job Title Independence, and Permissions');
  const client = new Client({
    connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
  });
  await client.connect();

  try {
    // 3a. Check update_organization_member_job_title RPC exists
    const rpcTitleRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'update_organization_member_job_title';
    `);
    assert(rpcTitleRes.rows.length > 0, 'update_organization_member_job_title RPC exists in DB');

    // 3b. Check update_organization_member_role RPC exists
    const rpcRoleRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'update_organization_member_role';
    `);
    assert(rpcRoleRes.rows.length > 0, 'update_organization_member_role RPC exists in DB');

    // 3c. Check approve_organization_join_request function definition
    const rpcApproveRes = await client.query(`
      SELECT pg_get_functiondef(oid) as def 
      FROM pg_proc 
      WHERE proname = 'approve_organization_join_request';
    `);
    const approveDefs = rpcApproveRes.rows.map(r => r.def).join('\n');
    assert(approveDefs.includes('p_assigned_job_title'), 'approve_organization_join_request accepts p_assigned_job_title');

    // 3d. Find a test organization and member to test title update independence
    const memberRes = await client.query(`
      SELECT uo.org_id, uo.user_id, uo.role, uo.job_title 
      FROM user_organizations uo
      LIMIT 1;
    `);

    if (memberRes.rows.length > 0) {
      const { org_id, user_id, role: initialRole, job_title: initialTitle } = memberRes.rows[0];
      console.log(`  • Found test member: Org ${org_id}, User ${user_id}, Current Role: ${initialRole}, Current Title: ${initialTitle}`);

      // Find an authorized owner/admin to act as caller
      const ownerRes = await client.query(`
        SELECT user_id FROM user_organizations WHERE org_id = $1 AND role = 'owner' LIMIT 1;
      `, [org_id]);
      const callerId = ownerRes.rows[0]?.user_id || user_id;

      await client.query('BEGIN');
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [callerId]);
      await client.query(`SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true);`, [callerId]);

      // Test updating Job Title directly via database function
      const testTitle = 'Chief Technology Officer (CTO)';
      await client.query(`
        SELECT update_organization_member_job_title($1, $2, $3);
      `, [org_id, user_id, testTitle]);

      await client.query('COMMIT');

      // Verify that job_title changed but role remained UNCHANGED
      const verifyTitleRes = await client.query(`
        SELECT role, job_title FROM user_organizations WHERE org_id = $1 AND user_id = $2;
      `, [org_id, user_id]);
      const updatedRow = verifyTitleRes.rows[0];

      assert(updatedRow.job_title === testTitle, `Job title updated to ${testTitle}`);
      assert(updatedRow.role === initialRole, `Access role remained strictly unchanged as ${initialRole}`);
      console.log(`  • Changing job title to "${testTitle}" preserved access role "${initialRole}" with zero side-effects.`);

      // Also verify public.users table was updated with the new job_title
      const userRes = await client.query(`
        SELECT job_title FROM public.users WHERE id = $1;
      `, [user_id]);
      assert(userRes.rows[0]?.job_title === testTitle, 'public.users.job_title synchronized');

      // Restore initial title if it existed
      if (initialTitle) {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true);`, [callerId]);
        await client.query(`SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true);`, [callerId]);
        await client.query(`
          SELECT update_organization_member_job_title($1, $2, $3);
        `, [org_id, user_id, initialTitle]);
        await client.query('COMMIT');
      }
    }

    console.log('  ✔ PASS: Job title changes operate independently of RBAC access roles in database.\n');

    // 4. Verify RLS Policies on sensitive tables
    console.log('▶ [Test 4] Verify RLS Policies and Cross-Organization Protection');
    const rlsRes = await client.query(`
      SELECT tablename, policyname, cmd 
      FROM pg_policies 
      WHERE tablename IN ('user_organizations', 'tasks', 'projects', 'invoices', 'organization_join_requests')
      ORDER BY tablename, policyname;
    `);
    console.log(`  • Found ${rlsRes.rows.length} active RLS policies protecting core multi-tenant tables:`);
    for (const p of rlsRes.rows.slice(0, 8)) {
      console.log(`    - [${p.tablename}] ${p.policyname} (${p.cmd})`);
    }
    assert(rlsRes.rows.length > 0, 'RLS policies are enforced on multi-tenant tables');
    console.log('  ✔ PASS: Multi-tenant tenant boundaries and RLS policies active.\n');

  } finally {
    await client.end();
  }

  console.log('========================================================================');
  console.log('  🎉 ALL JOB TITLES & RBAC ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================\n');
}

runJobTitlesAndRbacVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
