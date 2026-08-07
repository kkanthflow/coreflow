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

      // Check if meeting has ended
      if (meeting.end_time && new Date(meeting.end_time) < new Date()) {
        return res.status(410).json({ error: 'This meeting has already ended' });
      }

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

      // Track participant
      await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);

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

      res.json({ token, roomUrl: process.env.LIVEKIT_URL || "wss://coreflow-eo6z5wme.livekit.cloud" });
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

  static async liveKitWebhook(req: Request, res: Response) {
    try {
      // Receive webhooks from LiveKit to update DB events
      const event = await LiveKitService.verifyWebhook(req.body, req.headers.authorization);
      console.log('Received LiveKit event:', event);
      
      // We can handle event.event like 'participant_joined', 'participant_left', etc.
      res.status(200).send();
    } catch (error: any) {
      console.error('LiveKit Webhook error:', error);
      res.status(400).json({ error: 'Invalid webhook' });
    }
  }
}
