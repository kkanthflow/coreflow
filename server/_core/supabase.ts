import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';
import { ENV } from './env';

if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
  console.warn('Supabase URL or Service Role Key is missing in environment variables.');
}

// Create a Supabase client with the service role key for backend operations
export const supabaseAdmin = createClient(
  ENV.supabaseUrl || 'https://placeholder.supabase.co',
  ENV.supabaseServiceRoleKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error('Failed to verify Supabase JWT token:', error);
    return null;
  }
}
