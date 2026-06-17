const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseKey = 'sb_publishable_2JfQZp49VDHRRO9ZjM9T6g_lz5E3BOb';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing signUp...");
  const { data, error } = await supabase.auth.signUp({
    email: 'test_session_' + Date.now() + '@example.com',
    password: 'password123',
    options: {
      data: {
        full_name: 'Test Freelancer',
        role: 'freelancer',
      }
    }
  });

  if (error) {
    console.error("SignUp Error:", error);
  } else {
    console.log("SignUp Success User ID:", data.user?.id);
    console.log("Has Session:", !!data.session);
  }
}

test();
