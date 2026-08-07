import { createClient } from '@supabase/supabase-js';
import { LiveKitService } from '../meetings/livekit.service.js';

let supabaseClient: any = null;
function getSupabase(): any {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for cron");
    supabaseClient = createClient(
      process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
  }
  return supabaseClient;
}

export function startCronJobs() {
  console.log('[Cron] Starting background jobs...');

  // Run every 1 minute
  setInterval(async () => {
    try {
      const supabase = getSupabase();
      
      // Find meetings that have ended and are still marked as scheduled or active
      const now = new Date().toISOString();
      const { data: expiredMeetings, error } = await supabase
        .from('meetings')
        .select('id, room_name')
        .lt('end_time', now)
        .in('status', ['scheduled', 'active']);

      if (error) {
        console.error('[Cron] Error fetching expired meetings:', error);
        return;
      }

      if (!expiredMeetings || expiredMeetings.length === 0) {
        return;
      }

      for (const meeting of expiredMeetings) {
        // Update meeting status to completed
        const { error: updateError } = await supabase
          .from('meetings')
          .update({ 
            status: 'completed', 
            ended_at: now 
          })
          .eq('id', meeting.id);

        if (updateError) {
          console.error(`[Cron] Failed to complete meeting ${meeting.id}:`, updateError);
          continue;
        }

        console.log(`[Cron] Automatically completed expired meeting: ${meeting.id}`);

        // Broadcast a real-time event to kick users out gracefully if they are connected
        await supabase.channel(`meeting-${meeting.id}`).send({
          type: 'broadcast',
          event: 'meeting_completed',
          payload: { meetingId: meeting.id },
        });

        // Physically destroy the LiveKit room so users are forcefully disconnected
        await LiveKitService.endRoom(meeting.room_name);
      }
    } catch (err) {
      console.error('[Cron] Unexpected error in meeting expiration job:', err);
    }
  }, 60 * 1000); // 1 minute
}
