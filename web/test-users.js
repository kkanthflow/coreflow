import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDM5NTUsImV4cCI6MjA5Njc3OTk1NX0.xmZ5bCZimFP4-AO9Y3CPMD_9thUK0qpilajd6zftvs0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function test() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log("Data:", data, "Error:", error);
}
test();
