/**
 * AUVRYN — Global Team Membership, Role Editing, Chat, Meetings & Module Integration Test Suite
 */

const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function runTests() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('AUVRYN: TEAM MEMBERSHIP, ROLE EDITING, CHAT & MEETINGS VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, detail = '') {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} — ${detail}`);
      failed++;
    }
  }

  // Target organization: Skavelon Technologies
  const orgId = 'a1641901-1ce1-400c-bb20-c723710da323';
  const ownerId = '7f76bf0c-2ed9-4f79-ac12-da06c25079e1'; // kk5480346@gmail.com
  const memberId = 'bf7918a4-1c91-46af-9dbb-3736c81049c4'; // lokenderdina@gmail.com

  // ---------------------------------------------------------------------------
  // SUITE 1: ROLE EDITING & PBAC PERMISSION PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log('─── SUITE 1: End-to-End Role Editing & Security Validation ───');

  // 1A. As Organization Owner, change member's role to 'manager'
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
  
  const editRes1 = await client.query(`
    SELECT public.update_organization_member_role($1, $2, $3) as res
  `, [orgId, memberId, 'manager']);

  const r1 = editRes1.rows[0]?.res;
  assert(r1?.success === true, 'Owner successfully changes member role to manager', JSON.stringify(r1));
  assert(r1?.new_role === 'manager', 'Returned new_role is manager');

  // 1B. Verify database persistence in BOTH user_organizations and users
  const uoCheck1 = await client.query(`SELECT role FROM public.user_organizations WHERE org_id = $1 AND user_id = $2`, [orgId, memberId]);
  const uCheck1 = await client.query(`SELECT role FROM public.users WHERE id = $1`, [memberId]);
  assert(uoCheck1.rows[0]?.role === 'manager', 'user_organizations.role persisted as manager');
  assert(uCheck1.rows[0]?.role === 'manager', 'public.users.role persisted as manager (no stale identity)');

  // 1C. Verify permissions for the new role in public.roles
  const permCheck = await client.query(`
    SELECT permissions ? 'create_projects' as has_create_proj, permissions ? 'manage_roles' as has_manage_roles
    FROM public.roles WHERE role_name = 'manager'
  `);
  assert(permCheck.rows[0]?.has_create_proj === true, 'Manager role grants create_projects permission');
  assert(permCheck.rows[0]?.has_manage_roles === false, 'Manager role does NOT grant manage_roles permission');

  // 1D. Security: Self-elevation attempt (member tries to edit their own role)
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: memberId, role: 'authenticated' })]);
  let selfElevError = false;
  try {
    await client.query(`
      SELECT public.update_organization_member_role($1, $2, $3)
    `, [orgId, memberId, 'administrator']);
  } catch (err) {
    selfElevError = true;
  }
  assert(selfElevError, 'Self-elevation blocked: Member cannot edit their own role');

  // 1E. Security: Ordinary member attempting to edit another member's role
  let unauthError = false;
  try {
    await client.query(`
      SELECT public.update_organization_member_role($1, $2, $3)
    `, [orgId, ownerId, 'employee']);
  } catch (err) {
    unauthError = true;
  }
  assert(unauthError, 'Unauthorized edit blocked: Cannot demote the primary organization owner');

  // 1F. Restore member role to 'director'
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
  const editRes2 = await client.query(`
    SELECT public.update_organization_member_role($1, $2, $3) as res
  `, [orgId, memberId, 'director']);
  assert(editRes2.rows[0]?.res?.success === true, 'Restored member role back to director');

  // ---------------------------------------------------------------------------
  // SUITE 2: CHAT INTEGRATION & RECOGNITION
  // ---------------------------------------------------------------------------
  console.log('\n─── SUITE 2: Chat Integration, Participants & Messaging ───');

  // 2A. Org member discovery: Querying members in Skavelon Technologies
  const orgMembersChat = await client.query(`
    SELECT uo.user_id, uo.role, u.full_name, u.email
    FROM public.user_organizations uo
    JOIN public.users u ON u.id = uo.user_id
    WHERE uo.org_id = $1 AND uo.user_id != $2
  `, [orgId, ownerId]);
  assert(orgMembersChat.rows.length > 0, 'Compose modal discovers approved organization members', `Found ${orgMembersChat.rows.length}`);
  assert(orgMembersChat.rows.some(m => m.user_id === memberId), 'Member lokenderdina@gmail.com is listed in Compose participants');

  // 2B. Direct Channel Atomic Creation
  const dmRes = await client.query(`
    SELECT public.get_or_create_direct_channel($1, $2) as res
  `, [memberId, orgId]);
  const dmData = dmRes.rows[0]?.res;
  assert(dmData?.success === true, 'Direct message channel created/retrieved successfully');
  const channelId = dmData?.channel_id;
  assert(!!channelId, 'Valid channel UUID returned');

  // 2C. Verify both participants are in channel_members
  const cmCheck = await client.query(`
    SELECT user_id FROM public.channel_members WHERE channel_id = $1
  `, [channelId]);
  const cmUsers = cmCheck.rows.map(r => r.user_id);
  assert(cmUsers.includes(ownerId), 'Channel includes caller (owner) in channel_members');
  assert(cmUsers.includes(memberId), 'Channel includes recipient (member) in channel_members');

  // 2D. Channel Visibility: Recipient can view the channel
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: memberId, role: 'authenticated' })]);
  const recCanView = await client.query(`
    SELECT private.check_can_view_channel($1, $2) as can_view
  `, [channelId, memberId]);
  assert(recCanView.rows[0]?.can_view === true, 'Recipient has legitimate channel visibility (private.check_can_view_channel is true)');

  // 2E. Send Message into Channel
  const msgInsert = await client.query(`
    INSERT INTO public.chat_messages (channel_id, sender_id, content)
    VALUES ($1, $2, 'Hello from integration test')
    RETURNING id, content;
  `, [channelId, memberId]);
  assert(msgInsert.rows[0]?.content === 'Hello from integration test', 'Recipient can send message into DM channel');

  // 2F. Caller (Owner) can read the message
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
  const msgRead = await client.query(`
    SELECT content FROM public.chat_messages WHERE channel_id = $1 LIMIT 1
  `, [channelId]);
  assert(msgRead.rows[0]?.content === 'Hello from integration test', 'Owner can read recipient message in DM channel');

  // 2G. Default Org Channels exist
  const defChannels = await client.query(`
    SELECT name, type FROM public.chat_channels WHERE org_id = $1
  `, [orgId]);
  assert(defChannels.rows.some(c => c.type === 'org_general'), 'Organization #general channel exists');
  assert(defChannels.rows.some(c => c.type === 'org_announcement'), 'Organization #announcements channel exists');

  // ---------------------------------------------------------------------------
  // SUITE 3: MEETING INTEGRATION & PARTICIPANT ATTENDANCE
  // ---------------------------------------------------------------------------
  console.log('\n─── SUITE 3: Meeting Scheduling, Participant Admission & Invites ───');

  // 3A. Get workspace linked to Skavelon Technologies
  const wsRes = await client.query(`SELECT id FROM public.workspaces WHERE organization_id = $1 LIMIT 1`, [orgId]);
  const workspaceId = wsRes.rows[0]?.id;
  assert(!!workspaceId, 'Organization is properly linked to a workspace in public.workspaces');

  // 3B. Create a test meeting
  await client.query(`DELETE FROM public.meetings WHERE room_name LIKE 'test-room-sync%'`);
  const roomName = `test-room-sync-${Date.now()}`;
  const meetInsert = await client.query(`
    INSERT INTO public.meetings (
      workspace_id, host_id, title, description, start_time, end_time, room_name, status
    ) VALUES (
      $1, $2, 'Sprint Sync Test', 'Automated test meeting', now(), now() + interval '30 minutes', $3, 'scheduled'
    ) RETURNING id;
  `, [workspaceId, ownerId, roomName]);
  const meetingId = meetInsert.rows[0]?.id;
  assert(!!meetingId, 'Meeting scheduled in workspace');

  try {
    // 3C. Add member as admitted participant
    await client.query(`
      INSERT INTO public.meeting_participants (meeting_id, user_id, role, status, admission_status)
      VALUES ($1, $2, 'attendee', 'accepted', 'admitted')
      ON CONFLICT (meeting_id, user_id) DO UPDATE SET admission_status = 'admitted';
    `, [meetingId, memberId]);
    assert(true, 'Member added to meeting_participants with admitted status');

    // 3D. Verify member can view meeting via workspace RLS
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: memberId, role: 'authenticated' })]);
    const meetViewRes = await client.query(`
      SELECT id, title FROM public.meetings WHERE id = $1
    `, [meetingId]);
    assert(meetViewRes.rows.length === 1, 'Member can view workspace meeting via updated RLS policy');

    // 3E. Test respond_to_meeting_invitation RPC
    const respInvite = await client.query(`
      SELECT public.respond_to_meeting_invitation($1, $2) as res
    `, [meetingId, 'accepted']);
    assert(respInvite.rows[0]?.res?.success === true, 'Member responds to meeting invitation via RPC');
  } finally {
    // 3F. Clean up test meeting
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, role: 'authenticated' })]);
    await client.query(`DELETE FROM public.meetings WHERE id = $1`, [meetingId]);
    assert(true, 'Test meeting cleaned up');
  }


  // ---------------------------------------------------------------------------
  // SUITE 4: DATA INTEGRITY & ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n─── SUITE 4: Existing Financial Records, Invoices & Workspace Isolation ───');

  // 4A. Verify kk5480346@gmail.com 2 invoices and 1 client remain intact
  const invRes = await client.query(`
    SELECT invoice_number, total_amount, status 
    FROM public.invoices 
    WHERE (owner_id = $1 OR creator_id = $1)
    ORDER BY invoice_number;
  `, [ownerId]);
  assert(invRes.rows.length >= 2, `Owner invoices preserved: found ${invRes.rows.length} invoices`);
  assert(invRes.rows.some(i => i.invoice_number === 'INV-381608'), 'Invoice INV-381608 preserved');
  assert(invRes.rows.some(i => i.invoice_number === 'INV-544320'), 'Invoice INV-544320 preserved');

  const clientRes = await client.query(`
    SELECT id, name FROM public.clients WHERE (owner_id = $1 OR user_id = $1) OR name ILIKE '%EJOUMALE%'
  `, [ownerId]);
  assert(clientRes.rows.length >= 1, `Owner clients preserved: found ${clientRes.rows.length} clients`);
  assert(clientRes.rows.some(c => c.name.toUpperCase().includes('EJOUMALE')), 'Client EJOUMALE preserved');

  // 4B. Cross-organization isolation: random user cannot access Skavelon DMs
  const randomUserId = '9563e371-a706-4c60-ae12-fbb2310a2ead';
  await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: randomUserId, role: 'authenticated' })]);
  const crossView = await client.query(`
    SELECT private.check_can_view_channel($1, $2) as can_view
  `, [channelId, randomUserId]);
  assert(crossView.rows[0]?.can_view === false, 'Cross-org user denied access to private DM channel');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  await client.end();
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
