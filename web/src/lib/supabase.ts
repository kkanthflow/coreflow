import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rltygdzldplkmwuqfadm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDM5NTUsImV4cCI6MjA5Njc3OTk1NX0.xmZ5bCZimFP4-AO9Y3CPMD_9thUK0qpilajd6zftvs0';

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
