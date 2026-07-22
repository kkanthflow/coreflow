import { Router } from 'express';
import { MeetingsController } from './meetings.controller.js';


const router = Router();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
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
router.post('/:id/join-guest', MeetingsController.joinMeetingGuest);

// Public webhook endpoint (LiveKit authenticates via its own webhook secret)
router.post('/webhook/livekit', MeetingsController.liveKitWebhook);

export default router;
