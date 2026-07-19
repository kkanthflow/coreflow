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

      // Verify permissions (e.g. check if user is invited or in workspace)
      // For now, allow workspace members
      const participantName = user.user_metadata?.full_name || user.email;

      // Generate LiveKit Token
      const token = LiveKitService.generateToken(
        meeting.room_name,
        user.id,
        participantName,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        }
      );

      // Track participant in DB
      await MeetingsService.trackParticipant(meeting.id, user.id);

      res.json({ token, roomUrl: process.env.LIVEKIT_API_URL });
    } catch (error: any) {
      console.error('Error joining meeting:', error);
      res.status(500).json({ error: 'Failed to join meeting' });
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
