import { Router } from 'express';
import { ClientController } from './client.controller';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

export const clientsRouter = Router();

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

// Mount client management endpoints
clientsRouter.post('/portal-account', requireAuth, ClientController.saveClientWithPortal);
clientsRouter.post('/:id/toggle-portal', requireAuth, ClientController.togglePortalAccess);
clientsRouter.post('/:id/resend-access', requireAuth, ClientController.resendAccessLink);
clientsRouter.post('/:id/reset-password', requireAuth, ClientController.resetPassword);
clientsRouter.post('/:id/sync-projects', requireAuth, ClientController.syncProjects);
clientsRouter.get('/:id/details', requireAuth, ClientController.getClientDetails);
