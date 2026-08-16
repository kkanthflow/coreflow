import { Router } from 'express';
import { MeetingsController } from './meetings.controller.js';


const router = Router();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    
    if (!token) throw new Error("No token provided");

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) throw new Error("Invalid token");
    
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
router.post('/:id/invite', requireAuth, MeetingsController.inviteUser);
router.post('/:id/invitations/accept', requireAuth, MeetingsController.acceptInvitation);
router.post('/:id/invitations/decline', requireAuth, MeetingsController.declineInvitation);

router.post('/:id/end', requireAuth, MeetingsController.endMeeting);
router.post('/:id/participants/:userId/admit', requireAuth, MeetingsController.admitParticipant);

// Recording endpoints
router.post('/:id/record/start', requireAuth, MeetingsController.startRecording);
router.post('/:id/record/stop', requireAuth, MeetingsController.stopRecording);

// Notes endpoints
router.get('/:id/notes', requireAuth, MeetingsController.getNotes);
router.post('/:id/notes', requireAuth, MeetingsController.saveNotes);

// Public webhook endpoint (LiveKit authenticates via its own webhook secret)
router.post('/webhook/livekit', MeetingsController.liveKitWebhook);

export default router;
