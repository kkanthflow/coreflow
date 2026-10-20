const { Client } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const isApply = process.argv.includes('--apply');

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace(/^"|"$/g, ''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('====================================================');
  console.log(`AUVRYN CLIENT ACCOUNTS BACKFILL - MODE: ${isApply ? 'APPLY (LIVE WRITES)' : 'DRY RUN (NO WRITES)'}`);
  console.log('====================================================\n');

  let clientsLinked = 0;
  let clientsCreated = 0;
  let statusesFixed = 0;

  // 1. Find unlinked clients where email matches a registered user
  const unlinkedClients = await client.query(`
    SELECT c.id as client_id, c.name, c.email, c.organization_id, c.owner_id, c.portal_status, u.id as user_id, u.email as user_email
    FROM public.clients c
    JOIN public.users u ON LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
    WHERE c.user_id IS NULL AND c.is_deleted = false AND c.email IS NOT NULL;
  `);

  console.log(`1. Found ${unlinkedClients.rows.length} client(s) with matching users waiting to be linked:`);
  for (const row of unlinkedClients.rows) {
    console.log(`   - Client: "${row.name}" (${row.client_id}) -> User: "${row.user_email}" (${row.user_id})`);
    if (isApply) {
      await client.query(`
        UPDATE public.clients
        SET user_id = $1,
            portal_status = 'active',
            portal_enabled_at = COALESCE(portal_enabled_at, now()),
            updated_at = now()
        WHERE id = $2;
      `, [row.user_id, row.client_id]);

      await client.query(`
        UPDATE public.users
        SET account_type = 'client',
            role = CASE WHEN role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'freelancer') THEN role ELSE 'client' END,
            account_setup_completed = true,
            updated_at = now()
        WHERE id = $1;
      `, [row.user_id]);

      clientsLinked++;
    }
  }

  // 2. Find clients that have user_id but portal_status is 'no_access' or NULL
  const statusFixes = await client.query(`
    SELECT id, name, user_id, portal_status
    FROM public.clients
    WHERE user_id IS NOT NULL AND (portal_status IS NULL OR portal_status = 'no_access') AND is_deleted = false;
  `);

  console.log(`\n2. Found ${statusFixes.rows.length} linked client(s) with inactive portal_status:`);
  for (const row of statusFixes.rows) {
    console.log(`   - Client: "${row.name}" (${row.id}) [status: ${row.portal_status}] -> Updating to 'active'`);
    if (isApply) {
      await client.query(`
        UPDATE public.clients
        SET portal_status = 'active',
            portal_enabled_at = COALESCE(portal_enabled_at, now()),
            updated_at = now()
        WHERE id = $1;
      `, [row.id]);
      statusesFixed++;
    }
  }

  // 3. Find client users who do NOT have any client row at all
  const orphanUsers = await client.query(`
    SELECT u.id as user_id, u.email, u.full_name, uo.org_id
    FROM public.users u
    LEFT JOIN public.user_organizations uo ON u.id = uo.user_id
    WHERE (u.role = 'client' OR u.account_type = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.clients c WHERE c.user_id = u.id AND c.is_deleted = false
      );
  `);

  console.log(`\n3. Found ${orphanUsers.rows.length} client user(s) lacking a client row:`);
  for (const u of orphanUsers.rows) {
    console.log(`   - User: "${u.email}" (${u.user_id}) -> Creating client record`);
    if (isApply) {
      const orgId = u.org_id || null;
      await client.query(`
        INSERT INTO public.clients (
          organization_id, owner_id, name, email, user_id, portal_status, portal_enabled_at, is_deleted, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'active', now(), false, now(), now()
        )
        ON CONFLICT (COALESCE(organization_id, owner_id), LOWER(TRIM(email))) WHERE is_deleted = false AND email IS NOT NULL
        DO UPDATE SET user_id = EXCLUDED.user_id, portal_status = 'active', updated_at = now();
      `, [orgId, u.user_id, u.full_name || u.email.split('@')[0], u.email, u.user_id]);
      clientsCreated++;
    }
  }

  console.log('\n====================================================');
  if (isApply) {
    console.log('✅ BACKFILL APPLIED SUCCESSFULLY!');
    console.log(`- Clients linked to user accounts: ${clientsLinked}`);
    console.log(`- Portal statuses updated to active: ${statusesFixed}`);
    console.log(`- Missing client records created: ${clientsCreated}`);
  } else {
    console.log('DRY RUN COMPLETE. No changes were committed to database.');
    console.log('To apply these changes, re-run with: node scripts/backfill_client_accounts.cjs --apply');
  }
  console.log('====================================================\n');

  await client.end();
}

main().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
