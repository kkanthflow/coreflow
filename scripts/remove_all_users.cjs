const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function removeAllUsers() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');
    console.log('Beginning complete removal of all users and related data...');

    await client.query('BEGIN');

    // 1. Delete meetings and conference records (some FKs have NO ACTION)
    console.log('- Cleaning meeting records...');
    await client.query('DELETE FROM public.meeting_notes').catch(() => {});
    await client.query('DELETE FROM public.meeting_participants').catch(() => {});
    await client.query('DELETE FROM public.meeting_invitations').catch(() => {});
    await client.query('DELETE FROM public.meeting_keys').catch(() => {});
    await client.query('DELETE FROM public.meetings').catch(() => {});

    // 2. Delete chat messages, channels, and keys
    console.log('- Cleaning chat and messaging records...');
    await client.query('DELETE FROM public.message_reads').catch(() => {});
    await client.query('DELETE FROM public.chat_messages').catch(() => {});
    await client.query('DELETE FROM public.channel_members').catch(() => {});
    await client.query('DELETE FROM public.channel_keys').catch(() => {});
    await client.query('DELETE FROM public.channel_mutes').catch(() => {});
    await client.query('DELETE FROM public.chat_channels').catch(() => {});

    // 3. Delete tasks, projects, invoices, and client access
    console.log('- Cleaning tasks, projects, and invoices...');
    await client.query('DELETE FROM public.task_comments').catch(() => {});
    await client.query('DELETE FROM public.task_activity').catch(() => {});
    await client.query('DELETE FROM public.tasks').catch(() => {});
    await client.query('DELETE FROM public.project_milestones').catch(() => {});
    await client.query('DELETE FROM public.project_client_access').catch(() => {});
    await client.query('DELETE FROM public.project_members').catch(() => {});
    await client.query('DELETE FROM public.files').catch(() => {});
    await client.query('DELETE FROM public.invoices').catch(() => {});
    await client.query('DELETE FROM public.projects').catch(() => {});

    // 4. Delete subscriptions and payment logs
    console.log('- Cleaning subscriptions and payments...');
    await client.query('DELETE FROM public.subscription_payments').catch(() => {});
    await client.query('DELETE FROM public.subscriptions').catch(() => {});
    await client.query('DELETE FROM public.subscription_webhook_events').catch(() => {});

    // 5. Delete user organizations and organizations
    console.log('- Cleaning organizations and workspaces...');
    await client.query('DELETE FROM public.user_organizations').catch(() => {});
    await client.query('DELETE FROM public.organizations').catch(() => {});
    await client.query('DELETE FROM public.workspace_members').catch(() => {});
    await client.query('DELETE FROM public.workspaces').catch(() => {});

    // 6. Delete user settings, profiles, tokens, logs
    console.log('- Cleaning user profiles and auxiliary tables...');
    await client.query('DELETE FROM public.user_push_tokens').catch(() => {});
    await client.query('DELETE FROM public.user_public_keys').catch(() => {});
    await client.query('DELETE FROM public.privacy_settings').catch(() => {});
    await client.query('DELETE FROM public.user_blocks').catch(() => {});
    await client.query('DELETE FROM public.notification_preferences').catch(() => {});
    await client.query('DELETE FROM public.freelancer_profiles').catch(() => {});
    await client.query('DELETE FROM public.activity_logs').catch(() => {});
    await client.query('DELETE FROM public.audit_logs').catch(() => {});
    await client.query('DELETE FROM public.notifications').catch(() => {});

    // 7. Delete from public.users
    console.log('- Deleting from public.users...');
    const pubUserResult = await client.query('DELETE FROM public.users');
    console.log(`  Deleted ${pubUserResult.rowCount} rows from public.users`);

    // 8. Delete from auth.users (cascades to identities, sessions, refresh_tokens, etc.)
    console.log('- Deleting from auth.users...');
    const authUserResult = await client.query('DELETE FROM auth.users');
    console.log(`  Deleted ${authUserResult.rowCount} rows from auth.users`);

    await client.query('COMMIT');
    console.log('Transaction COMMITTED successfully.');

    // 9. Verify final counts
    const verifyAuth = await client.query('SELECT count(*) FROM auth.users');
    const verifyPub = await client.query('SELECT count(*) FROM public.users');
    console.log('Final auth.users count:', verifyAuth.rows[0].count);
    console.log('Final public.users count:', verifyPub.rows[0].count);

    await client.end();
  } catch (err) {
    console.error('Error during user deletion:', err);
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back.');
    } catch {}
    process.exit(1);
  }
}

removeAllUsers();
