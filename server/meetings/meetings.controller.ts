import { Request, Response } from 'express';
import { MeetingsService } from './meetings.service.js';
import { LiveKitService } from './livekit.service.js';

export class MeetingsController {
  static async createMeeting(req: Request, res: Response) {
    try {
      const { user } = req as any; // From auth middleware
      const { title, description, startTime, endTime, settings } = req.body;
      const workspaceId = req.headers['x-workspace-id'] as string;

      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      const meeting = await MeetingsService.createMeeting({
        hostId: user.id,
        workspaceId,
        title,
        description,
        startTime,
        endTime,
        settings,
      });

      res.status(201).json({ meeting });
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  }

  static async getMeetingDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      res.json({ meeting });
    } catch (error: any) {
      console.error('Error fetching meeting:', error);
      res.status(500).json({ error: 'Failed to fetch meeting' });
    }
  }

  static async joinMeeting(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

      // Validate Meeting Status
      if (meeting.status !== 'scheduled' && meeting.status !== 'active') {
        return res.status(403).json({ error: 'Meeting is not available to join' });
      }

      // Check if meeting has ended - REMOVED: allow joining after end time (like Google Meet)

      const isHost = meeting.host_id === user.id;

      // Validate Invitation for non-hosts
      if (!isHost) {
        const invitation = await MeetingsService.getInvitation(meeting.id, user.id);
        if (!invitation) {
          return res.status(403).json({ error: 'You are not invited to this meeting' });
        }
        if (invitation.status !== 'accepted') {
          return res.status(403).json({ error: 'You must accept the invitation before joining' });
        }
        // Check if locked
        if (meeting.is_locked) {
          return res.status(403).json({ error: 'Meeting is locked' });
        }
      }

      // If caller is not the host, ensure the host has already joined the meeting.
      // If the host is not active, return a 400 'waiting_room' response so they wait.
      if (!isHost) {
        const { data: hostParticipant } = await (MeetingsService as any).getSupabase()
          .from('meeting_participants')
          .select('admission_status, status')
          .eq('meeting_id', meeting.id)
          .eq('user_id', meeting.host_id)
          .eq('status', 'joined')
          .maybeSingle();

        if (!hostParticipant || hostParticipant.admission_status !== 'admitted') {
          // Put attendee in 'waiting' state in meeting_participants
          await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
          return res.status(400).json({ error: 'waiting_room', details: 'Waiting for the host to join the meeting' });
        }
      }

      // Track participant
      const participant = await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
      
      // If the participant's admission_status is still 'waiting', return a 400 'waiting_room' response
      if (!isHost && participant && participant.admission_status === 'waiting') {
        return res.status(400).json({ error: 'waiting_room', details: 'Waiting for host approval to enter the room' });
      }

      const participantName = user.user_metadata?.full_name || user.email;

      // Generate LiveKit Token
      const token = await LiveKitService.generateToken(
        meeting.room_name,
        user.id,
        participantName,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        }
      );

      let roomUrl = process.env.LIVEKIT_URL || "wss://coreflow-eo6z5wme.livekit.cloud";
      roomUrl = roomUrl.replace(/^["']|["']$/g, '');

      res.json({ token, roomUrl });
    } catch (error: any) {
      console.error('Error joining meeting:', error);
      res.status(500).json({ error: 'Failed to join meeting', details: error?.message || String(error) });
    }
  }

  static async inviteUser(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      const { userId } = req.body;
      
      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: 'Only the host can invite users' });
      }

      const invitation = await MeetingsService.inviteUser(meeting.id, userId, user.id);
      res.status(201).json({ invitation });
    } catch (error: any) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }

  static async acceptInvitation(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      const invitation = await MeetingsService.updateInvitationStatus(id, user.id, 'accepted');
      res.json({ invitation });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ error: 'Failed to accept invitation' });
    }
  }

  static async declineInvitation(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      const invitation = await MeetingsService.updateInvitationStatus(id, user.id, 'declined');
      res.json({ invitation });
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      res.status(500).json({ error: 'Failed to decline invitation' });
    }
  }

  static async startRecording(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: 'Only the host can record meetings' });
      }

      const egressId = await LiveKitService.startRecording(meeting.room_name);
      
      res.json({ egressId, message: 'Recording started' });
    } catch (error: any) {
      console.error('Error starting recording:', error);
      res.status(500).json({ error: 'Failed to start recording', details: error.message });
    }
  }

  static async stopRecording(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      const { egressId } = req.body;
      
      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: 'Only the host can stop recordings' });
      }

      await LiveKitService.stopRecording(egressId);
      
      res.json({ message: 'Recording stopped' });
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      res.status(500).json({ error: 'Failed to stop recording', details: error.message });
    }
  }

  static async getNotes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const { data, error } = await MeetingsService.getSupabase()
        .from('meeting_notes')
        .select('*')
        .eq('meeting_id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      res.json({ notes: data || { content: '' } });
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  }

  static async saveNotes(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;
      const { content } = req.body;

      const { data, error } = await MeetingsService.getSupabase()
        .from('meeting_notes')
        .upsert(
          {
            meeting_id: id,
            content,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'meeting_id' }
        )
        .select()
        .single();

      if (error) throw error;
      res.json({ notes: data });
    } catch (error: any) {
      console.error('Error saving notes:', error);
      res.status(500).json({ error: 'Failed to save notes' });
    }
  }

  static async endMeeting(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id } = req.params;

      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      
      // Only the host can end the meeting for everyone
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: 'Only the host can end the meeting' });
      }

      await MeetingsService.getSupabase()
        .from('meetings')
        .update({ status: 'completed' })
        .eq('id', meeting.id);

      // Tell LiveKit to end the room (which kicks everyone out)
      await LiveKitService.endRoom(meeting.room_name);

      res.json({ message: 'Meeting ended successfully' });
    } catch (error: any) {
      console.error('Error ending meeting:', error);
      res.status(500).json({ error: 'Failed to end meeting' });
    }
  }

  static async admitParticipant(req: Request, res: Response) {
    try {
      const { user } = req as any;
      const { id, userId } = req.params;

      const meeting = await (MeetingsService.getMeetingById(id) as any);
      if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
      
      // Only the host can admit participants
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: 'Only the host can admit participants' });
      }

      await MeetingsService.getSupabase()
        .from('meeting_participants')
        .update({ admission_status: 'admitted' })
        .eq('meeting_id', meeting.id)
        .eq('user_id', userId);

      res.json({ message: 'Participant admitted successfully' });
    } catch (error: any) {
      console.error('Error admitting participant:', error);
      res.status(500).json({ error: 'Failed to admit participant' });
    }
  }

  static async liveKitWebhook(req: Request, res: Response) {
    try {
      // Receive webhooks from LiveKit to update DB events
      const event = await LiveKitService.verifyWebhook(req.body, req.headers.authorization);
      console.log('Received LiveKit event:', event);
      
      // We can handle event.event like 'participant_joined', 'participant_left', etc.
      if (event.event === 'participant_left') {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;

        if (roomName && identity) {
          const { data: meeting } = await MeetingsService.getSupabase()
            .from('meetings')
            .select('id, host_id')
            .eq('room_name', roomName)
            .maybeSingle();

          if (meeting) {
            if (meeting.host_id === identity) {
              await MeetingsService.getSupabase()
                .from('meetings')
                .update({ status: 'completed' })
                .eq('id', meeting.id);
              console.log(`Host left, marked meeting ${meeting.id} as completed.`);
            }
            
            await MeetingsService.getSupabase()
              .from('meeting_participants')
              .update({ status: 'left' })
              .eq('meeting_id', meeting.id)
              .eq('user_id', identity);
          }
        }
      } else if (event.event === 'room_finished') {
        const roomName = event.room?.name;
        if (roomName) {
          const { data: meeting } = await MeetingsService.getSupabase()
            .from('meetings')
            .select('id')
            .eq('room_name', roomName)
            .maybeSingle();

          if (meeting) {
            await MeetingsService.getSupabase()
              .from('meetings')
              .update({ status: 'completed' })
              .eq('id', meeting.id);
            console.log(`Room finished, marked meeting ${meeting.id} as completed.`);
          }
        }
      } else if (event.event === 'egress_ended') {
        const egressInfo = event.egressInfo as any;
        const roomName = egressInfo?.roomName;
        const fileUrl = egressInfo?.fileResults?.[0]?.location || egressInfo?.file?.location;
        const durationSeconds = (egressInfo?.updatedAt && egressInfo?.startedAt) 
            ? Math.floor((Number(egressInfo.updatedAt) - Number(egressInfo.startedAt)) / 1000000000) 
            : 0;

        if (roomName && fileUrl) {
          // Find the meeting by room_name
          const { data: meeting } = await MeetingsService.getSupabase()
            .from('meetings')
            .select('id')
            .eq('room_name', roomName)
            .maybeSingle();

          if (meeting) {
            await MeetingsService.getSupabase().from('meeting_recordings').insert({
              meeting_id: meeting.id,
              file_url: fileUrl,
              duration: durationSeconds,
              resolution: '720p',
              file_size: egressInfo?.fileResults?.[0]?.size || egressInfo?.file?.size || 0,
              recording_status: 'completed',
              started_at: egressInfo?.startedAt ? new Date(Number(egressInfo.startedAt) / 1000000).toISOString() : new Date().toISOString(),
              finished_at: new Date().toISOString(),
            });
            console.log(`Saved recording for room ${roomName} to Supabase.`);
          }
        }
      }
      
      res.status(200).send();
    } catch (error: any) {
      console.error('LiveKit Webhook error:', error);
      res.status(400).json({ error: 'Invalid webhook' });
    }
  }
}
