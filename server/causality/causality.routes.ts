import { Router } from 'express';
import { CausalityController } from './causality.controller';
import { requireEntitlement } from '../subscriptions/entitlements.middleware.js';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const router = Router();

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

// Core "WHY?" endpoints (Deterministic, Strictly No AI)
router.get('/why/delivery', requireAuth, CausalityController.getWhyDelivery);
router.get('/why/cost', requireAuth, CausalityController.getWhyCost);
router.get('/why/progress', requireAuth, CausalityController.getWhyProgress);
router.get('/why/scope', requireAuth, CausalityController.getWhyScope);

// Project DNA Graph
router.get('/dna', requireAuth, CausalityController.getProjectDNA);

// Proof & Evidence
router.get('/proof', requireAuth, CausalityController.getProjectProof);

// Commitments & Change Requests
router.get('/commitments', requireAuth, CausalityController.getCommitmentHistory);
router.post('/change-requests', requireAuth, CausalityController.createChangeRequest);
router.post('/change-requests/:id/decide', requireAuth, CausalityController.decideChangeRequest);

// Receipts & Verification
router.get('/receipts/:code', CausalityController.getReceiptByCode); // Public verification by receipt ID

// Responsibility & Lifecycle
router.get('/responsibility', requireAuth, CausalityController.getResponsibilityState);
router.post('/seal', requireAuth, CausalityController.sealProject);

// Playback & Historical Compare
router.get('/playback', requireAuth, CausalityController.getPlaybackState);
router.get('/compare', requireAuth, CausalityController.compareStates);

// Client Provisioning & Access Assignment
router.post('/provision-client', requireAuth, CausalityController.provisionClientUser);

// Project Creation via Central Service
router.post('/projects', requireAuth, requireEntitlement('projects'), CausalityController.createProject);

export default router;
