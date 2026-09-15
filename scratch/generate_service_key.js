const jose = require('jose');
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const jwtSecret = 'p974uqY4Nqym9PuVTQjie4BwkyS2KKOwcDE9vXpdnnvh6LtN4JhCrc9QvXF+dmz04aHM3wlo9tpip94UUgWfHg==';
  const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDM5NTUsImV4cCI6MjA5Njc3OTk1NX0.xmZ5bCZimFP4-AO9Y3CPMD_9thUK0qpilajd6zftvs0';
  
  // Let's decode anonKey first to see payload details
  const decodedAnon = jose.decodeJwt(anonKey);
  console.log("Decoded Anon Key:", decodedAnon);

  // Generate service_role payload
  const payload = {
    iss: 'supabase',
    ref: decodedAnon.ref || 'rltygdzldplkmwuqfadm',
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
  };

  const secretBuffer = Buffer.from(jwtSecret, 'utf-8');
  
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secretBuffer);
  
  console.log("Generated service_role token:", token);

  // Now, try creating a Supabase client with this key and list users
  const ws = require('ws');
  const supabase = createClient(supabaseUrl, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Auth Admin listUsers failed:", error);
    } else {
      console.log("Auth Admin listUsers succeeded! Number of users:", data.users.length);
      if (data.users.length > 0) {
        console.log("First user email:", data.users[0].email);
      }
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

test();
