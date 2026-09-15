import { createClient } from '@supabase/supabase-js';

import ws from 'ws';
import { ENV } from './env';

if (!ENV.supabaseUrl) {
  console.warn('Supabase URL is missing in environment variables.');
}

if (!ENV.supabaseServiceRoleKey || ENV.supabaseServiceRoleKey === 'placeholder-key' || ENV.supabaseServiceRoleKey === '[SENSITIVE]') {
  console.warn('Supabase Service Role Key is missing in environment variables.');
}

// Create a Supabase client with the service role key for backend operations
export const supabaseAdmin = createClient(
  ENV.supabaseUrl || 'https://rltygdzldplkmwuqfadm.supabase.co',
  ENV.supabaseServiceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzk1NSwiZXhwIjoyMDk2Nzc5OTU1fQ.zsR3c5QISHMSo9MgsaWCLVaeEBs5gZIlQ8eue4eF12o',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws as any,
    }
  }
);

/**
 * Validates a Supabase JWT token and returns the payload if valid.
 * @param token The JWT token to validate
 * @returns The decoded token payload, or null if invalid
 */
export async function verifySupabaseToken(token: string) {
  if (!ENV.jwtSecret) {
    console.warn('JWT_SECRET is not defined. Token verification will fail.');
    return null;
  }

  try {
    const secret = new TextEncoder().encode(ENV.jwtSecret);
    const { jwtVerify } = await (new Function("return import('jose')")());
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error('Failed to verify Supabase JWT token:', error);
    return null;
  }
}
