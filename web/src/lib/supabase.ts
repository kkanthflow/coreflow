import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2JfQZp49VDHRRO9ZjM9T6g_lz5E3BOb';

// If the environment variables are missing, we fall back to the known development values above.
if (!supabaseUrl || supabaseUrl === 'https://placeholder-url.supabase.co') {
  console.warn('Supabase URL or Anon Key is missing from environment variables. Using fallback values.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
