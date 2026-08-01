// Depending on how DB is accessed, maybe supabase-admin? We will use Supabase client.
import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;
function getSupabase(): any {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for meetings service");
    supabaseClient = createClient(
      process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
  }
  return supabaseClient;
}

export class MeetingsService {
  static async createMeeting(data: any) {
    // Generate a unique room name for LiveKit
    const roomName = `cf-meeting-${Math.random().toString(36).substring(2, 10)}`;

    const { data: meeting, error } = await getSupabase()
      .from('meetings')
      .insert({
        host_id: data.hostId,
        workspace_id: data.workspaceId === 'independent' ? null : data.workspaceId,
        title: data.title,
        description: data.description,
        start_time: data.startTime,
        end_time: data.endTime,
        room_name: roomName,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw error;

    // Create Settings
    const { error: settingsError } = await getSupabase()
      .from('meeting_settings')
      .insert({
        meeting_id: meeting.id,
        ...data.settings
      });

    if (settingsError) throw settingsError;

    // Add Host as participant with 'host' role
    await getSupabase().from('meeting_participants').insert({
      meeting_id: meeting.id,
      user_id: data.hostId,
      role: 'host',
      can_share_screen: true,
      can_record: true,
      can_present: true,
      can_invite: true,
    });

    return meeting;
  }

  static async getMeetingById(id: string) {
    const { data, error } = await getSupabase()
      .from('meetings')
      .select('*, meeting_settings(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async trackParticipant(meetingId: string, userId: string, hostId: string) {
    const isHost = userId === hostId;

    const { data, error } = await getSupabase()
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .single();

    if (!data) {
      // Create invited participant row if they weren't explicitly invited
      const { data: newParticipant } = await getSupabase().from('meeting_participants').insert({
        meeting_id: meetingId,
        user_id: userId,
        status: 'joined',
        role: isHost ? 'host' : 'attendee',
        admission_status: isHost ? 'admitted' : 'waiting', // host doesn't wait
      }).select().single();
      return newParticipant;
    } else {
      let updates: any = { status: 'joined', joined_at: new Date().toISOString() };
      
      if (isHost && data.role !== 'host') {
        updates.role = 'host';
        updates.admission_status = 'admitted';
      } else if (data.admission_status === 'none' && data.role !== 'host') {
        updates.admission_status = 'waiting';
      }

      const { data: updatedParticipant } = await getSupabase()
        .from('meeting_participants')
        .update(updates)
        .eq('id', data.id)
        .select().single();
      return updatedParticipant;
    }
  }
}
