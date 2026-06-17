import { supabase } from '@/lib/supabase';

export async function getMe() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    // Fetch custom profile data if needed, or just return auth user
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    return profile || session.user;
  } catch (error) {
    console.error('[API] getMe failed:', error);
    return null;
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
