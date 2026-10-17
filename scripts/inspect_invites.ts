import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  realtime: { transport: ws as any }
});

async function main() {
  const tables = ['organization_invitations', 'invitations', 'organization_join_requests', 'team_invitations'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t}: Error:`, error.message);
    } else {
      console.log(`Table ${t}: Columns:`, data && data[0] ? Object.keys(data[0]) : '(empty table or row)');
    }
  }
}

main().catch(console.error);
