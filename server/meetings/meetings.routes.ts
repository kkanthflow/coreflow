import { Router } from 'express';
import { MeetingsController } from './meetings.controller.js';
import { sdk } from '../_core/sdk.js';

const router = Router();

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const user = await sdk.authenticateRequest(req);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Secured user endpoints
router.post('/', requireAuth, MeetingsController.createMeeting);
router.get('/:id', requireAuth, MeetingsController.getMeetingDetails);
router.post('/:id/join', requireAuth, MeetingsController.joinMeeting);

// Public webhook endpoint (LiveKit authenticates via its own webhook secret)
router.post('/webhook/livekit', MeetingsController.liveKitWebhook);

export default router;
