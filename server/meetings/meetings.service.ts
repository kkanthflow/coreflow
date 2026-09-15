import { supabaseAdmin } from '../_core/supabase';
import crypto from 'crypto';

function getSupabase(): any {
  return supabaseAdmin;
}

export class MeetingsService {
  static async createMeeting(data: any) {
    const meetingId = crypto.randomUUID();
    const roomName = `coreflow-${meetingId}`;

    const { data: meeting, error } = await getSupabase()
      .from('meetings')
      .insert({
        id: meetingId,
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

    // Add Host as participant with 'host' role and default admission_status 'admitted'
    await getSupabase().from('meeting_participants').insert({
      meeting_id: meeting.id,
      user_id: data.hostId,
      role: 'host',
      admission_status: 'admitted',
      status: 'invited',
      can_share_screen: true,
      can_record: true,
      can_present: true,
      can_invite: true,
    });

    return meeting;
  }

  static async getMeetingById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = getSupabase().from('meetings').select('*, meeting_settings(*)');
    if (isUuid) {
      query = query.or(`id.eq.${id},room_name.eq.${id}`);
    } else {
      query = query.eq('room_name', id);
    }
    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data;
  }

  static async trackParticipant(meetingId: string, userId: string, hostId: string) {
    const isHost = userId === hostId;

    const { data } = await getSupabase()
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      // Create participant row
      const { data: newParticipant } = await getSupabase().from('meeting_participants').insert({
        meeting_id: meetingId,
        user_id: userId,
        status: 'joined',
        role: isHost ? 'host' : 'attendee',
        admission_status: isHost ? 'admitted' : 'waiting', // host doesn't wait
        joined_at: new Date().toISOString(),
      }).select().single();
      return newParticipant;
    } else {
      let updates: any = { 
        status: 'joined', 
        joined_at: new Date().toISOString() 
      };
      
      if (isHost) {
        updates.role = 'host';
        updates.admission_status = 'admitted';
      } else if (!data.admission_status || data.admission_status === 'none') {
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

  static async inviteUser(meetingId: string, userId: string, hostId: string) {
    const { data, error } = await getSupabase()
      .from('meeting_invitations')
      .insert({
        meeting_id: meetingId,
        user_id: userId,
        invited_by: hostId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateInvitationStatus(meetingId: string, userId: string, status: string) {
    const { data, error } = await getSupabase()
      .from('meeting_invitations')
      .update({ status, accepted_at: status === 'accepted' ? new Date().toISOString() : null })
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    
    return data;
  }

  static getSupabase() {
    return getSupabase();
  }

  static async getInvitation(meetingId: string, userId: string) {
    const { data, error } = await getSupabase()
      .from('meeting_invitations')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
