import { Router } from 'express';
import { PaymentSubmissionController } from './payment-submission.controller';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export const paymentSubmissionsRouter = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws as any,
  },
});

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }

    if (!token) throw new Error('No token provided');

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Rate limiter for payment submission proof (max 10 submissions per hour per user)
const userSubmissionTimestamps = new Map<string, number[]>();
const submissionRateLimiter = (req: any, res: any, next: any) => {
  const userId = req.user?.id;
  if (!userId) return next();

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxSubmissions = 10;

  const timestamps = userSubmissionTimestamps.get(userId) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= maxSubmissions) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded: You have submitted too many payment proofs. Please try again later.'
    });
  }

  validTimestamps.push(now);
  userSubmissionTimestamps.set(userId, validTimestamps);
  next();
};

paymentSubmissionsRouter.use(requireAuth);

// Routes
paymentSubmissionsRouter.post('/', submissionRateLimiter, PaymentSubmissionController.submitProof);
paymentSubmissionsRouter.get('/', PaymentSubmissionController.listSubmissions);
paymentSubmissionsRouter.post('/:id/confirm', PaymentSubmissionController.confirmSubmission);
paymentSubmissionsRouter.post('/:id/reject', PaymentSubmissionController.rejectSubmission);
paymentSubmissionsRouter.get('/:id/receipt-url', PaymentSubmissionController.getReceiptUrl);
