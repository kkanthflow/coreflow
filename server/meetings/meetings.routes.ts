import { Router } from 'express';
import { MeetingsController } from './meetings.controller.js';
// import { requireAuth } from '../_core/auth.middleware'; // Replace with actual auth middleware

const router = Router();

// Secure all routes with authentication middleware (assuming it exists in coreflow)
// router.use(requireAuth); 

router.post('/', MeetingsController.createMeeting);
router.get('/:id', MeetingsController.getMeetingDetails);
router.post('/:id/join', MeetingsController.joinMeeting);
router.post('/webhook/livekit', MeetingsController.liveKitWebhook);

export default router;
