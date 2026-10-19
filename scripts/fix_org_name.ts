import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
  {
    realtime: { transport: ws as any }
  }
);

async function main() {
  const { data: orgs, error } = await supabase.from('organizations').select('*');
  if (error) {
    console.error('Error fetching orgs:', error);
    return;
  }
  console.log('Current organizations in DB:', orgs);

  for (const org of orgs || []) {
    if (org.name && /Skavelon.*Technologies/i.test(org.name)) {
      console.log(`Updating org ID ${org.id} name from "${org.name}" to "Skavelon Technologies"...`);
      const { data: updated, error: updateErr } = await supabase
        .from('organizations')
        .update({
          name: 'Skavelon Technologies',
          address: 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13',
        })
        .eq('id', org.id)
        .select();
      if (updateErr) {
        console.error('Error updating org:', updateErr);
      } else {
        console.log('Updated org successfully:', updated);
      }
    }
  }
}

main().catch(console.error);
