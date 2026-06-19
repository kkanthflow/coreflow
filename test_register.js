const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseKey = 'sb_publishable_2JfQZp49VDHRRO9ZjM9T6g_lz5E3BOb';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = 'org_test_' + Date.now() + '@example.com';
  const password = 'password123';
  const orgName = 'Test Org ' + Date.now();

  console.log(`[Test] 1. Signing up user: ${email}`);
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Owner',
        role: 'owner',
      }
    }
  });

  if (signUpError) {
    console.error("[Test] SignUp Error:", signUpError);
    return;
  }

  const userId = authData.user?.id;
  console.log(`[Test] SignUp Success. User ID: ${userId}`);

  console.log(`[Test] 2. Creating organization: ${orgName}`);
  const { data: newOrg, error: createOrgError } = await supabase
    .from('organizations')
    .insert({ name: orgName })
    .select('id')
    .single();

  if (createOrgError) {
    console.error("[Test] Create Org Error:", createOrgError);
    return;
  }
  const orgId = newOrg.id;
  console.log(`[Test] Org Created. ID: ${orgId}`);

  console.log(`[Test] 3. Linking user to org in user_organizations...`);
  const { error: linkError } = await supabase
    .from('user_organizations')
    .insert({ user_id: userId, org_id: orgId, role: 'owner' });

  if (linkError) {
    console.error("[Test] Link User to Org Error:", linkError);
    return;
  }
  console.log(`[Test] Link Success.`);

  console.log(`[Test] 4. Updating user role to owner...`);
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'owner' })
    .eq('id', userId);

  if (updateError) {
    console.error("[Test] Update User Role Error:", updateError);
    return;
  }
  console.log(`[Test] Update Role Success. All steps completed successfully!`);
}

test();
