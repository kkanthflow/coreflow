import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { LiveKitService } from '../meetings/livekit.service.js';

let supabaseClient: any = null;
function getSupabase(): any {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for cron");
    supabaseClient = createClient(
      process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: ws as any,
        },
      }
    );
  }
  return supabaseClient;
}

export function startCronJobs() {
  console.log('[Cron] Background jobs initialized. Automated meeting termination is disabled; meetings end only when host ends the call.');
}
