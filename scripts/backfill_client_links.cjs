const { Client } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^"|"$/g, '')
  : 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

const isApply = process.argv.includes('--apply');

async function runBackfill() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('====================================================');
    console.log(`AUVRYN CLIENT LINKING BACKFILL - MODE: ${isApply ? 'APPLY (LIVE WRITES)' : 'DRY RUN (NO WRITES)'}`);
    console.log('====================================================');

    // 1. Find unlinked clients whose email matches a signed up user
    const unlinkedClientsQuery = `
      SELECT 
        c.id AS client_id,
        c.name AS client_name,
        c.company_name,
        c.email AS client_email,
        u.id AS user_id,
        u.email AS user_email,
        u.role AS user_role,
        u.account_type,
        u.account_setup_completed
      FROM public.clients c
      JOIN public.users u ON LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
      WHERE c.user_id IS NULL AND c.is_deleted = FALSE;
    `;
    const unlinkedClients = await client.query(unlinkedClientsQuery);
    console.log(`\n1. Found ${unlinkedClients.rows.length} unlinked client record(s) matching signed-up user emails:`);
    for (const row of unlinkedClients.rows) {
      console.log(`   - Client: "${row.client_name}" (${row.client_id}) -> User: "${row.user_email}" (${row.user_id})`);
    }

    // 2. Find project_client_access records where client_id is NULL but user_id matches a client
    const unlinkedPcaQuery = `
      SELECT 
        pca.id AS pca_id,
        pca.project_id,
        pca.user_id,
        u.email AS user_email,
        c.id AS matching_client_id,
        c.name AS matching_client_name
      FROM public.project_client_access pca
      JOIN public.users u ON pca.user_id = u.id
      JOIN public.clients c ON LOWER(TRIM(u.email)) = LOWER(TRIM(c.email)) AND c.is_deleted = FALSE
      WHERE pca.client_id IS NULL;
    `;
    const unlinkedPca = await client.query(unlinkedPcaQuery);
    console.log(`\n2. Found ${unlinkedPca.rows.length} project_client_access record(s) with NULL client_id matching a client:`);
    for (const row of unlinkedPca.rows) {
      console.log(`   - Access ID: ${row.pca_id} (Project: ${row.project_id}) -> Link client_id: ${row.matching_client_id} (${row.matching_client_name})`);
    }

    // 3. Find pending project_invites matching signed-up users
    const pendingInvitesQuery = `
      SELECT 
        pi.id AS invite_id,
        pi.token,
        pi.email AS invite_email,
        pi.client_id,
        pi.project_id,
        u.id AS user_id,
        u.email AS user_email
      FROM public.project_invites pi
      JOIN public.users u ON LOWER(TRIM(pi.email)) = LOWER(TRIM(u.email))
      WHERE pi.status = 'pending';
    `;
    const pendingInvites = await client.query(pendingInvitesQuery);
    console.log(`\n3. Found ${pendingInvites.rows.length} pending project invite(s) matching signed-up user emails:`);
    for (const row of pendingInvites.rows) {
      console.log(`   - Invite: ${row.invite_id} (${row.invite_email}) -> User: ${row.user_id}`);
    }

    if (!isApply) {
      console.log('\n====================================================');
      console.log('DRY RUN COMPLETE. No changes were committed to database.');
      console.log('To apply these changes, re-run with: node scripts/backfill_client_links.cjs --apply');
      console.log('====================================================\n');
      return;
    }

    // APPLY CHANGES
    await client.query('BEGIN');

    let clientsLinked = 0;
    for (const row of unlinkedClients.rows) {
      await client.query(
        `UPDATE public.clients SET user_id = $1, updated_at = NOW() WHERE id = $2`,
        [row.user_id, row.client_id]
      );
      // Ensure user profile has client setup completed if unassigned
      await client.query(
        `UPDATE public.users 
         SET account_type = 'client', 
             account_setup_completed = TRUE, 
             role = CASE WHEN role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee', 'freelancer') THEN role ELSE 'client' END,
             updated_at = NOW() 
         WHERE id = $1`,
        [row.user_id]
      );
      clientsLinked++;
    }

    let pcaLinked = 0;
    for (const row of unlinkedPca.rows) {
      await client.query(
        `UPDATE public.project_client_access SET client_id = $1, updated_at = NOW() WHERE id = $2`,
        [row.matching_client_id, row.pca_id]
      );
      pcaLinked++;
    }

    let invitesAccepted = 0;
    for (const row of pendingInvites.rows) {
      // Accept invite
      await client.query(
        `SELECT public.accept_project_client_invite($1, $2, $3)`,
        [row.token, row.user_id, row.user_email]
      );
      invitesAccepted++;
    }

    await client.query('COMMIT');

    console.log('\n====================================================');
    console.log('✅ BACKFILL APPLIED SUCCESSFULLY!');
    console.log(`- Clients linked to user accounts: ${clientsLinked}`);
    console.log(`- Project access records updated: ${pcaLinked}`);
    console.log(`- Pending invites auto-accepted & linked: ${invitesAccepted}`);
    console.log('====================================================\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runBackfill();
