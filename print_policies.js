const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseKey = 'sb_publishable_2JfQZp49VDHRRO9ZjM9T6g_lz5E3BOb';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'lokenderdina@gmail.com',
    password: 'password123'
  });

  const { data: policies, error } = await supabase.rpc('get_policies_debug');
  if (error) {
    // If RPC doesn't exist, we can select from pg_policies via raw SQL or just check how RLS behaves
    console.log('Error calling get_policies_debug, trying raw query via a general query if possible, or we will read migration files.');
    // Let's query pg_policies using a test select if we have a function, otherwise we will read the migration SQL files
  } else {
    console.log('Policies:', policies);
  }
}

run();
