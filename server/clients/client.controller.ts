import { Request, Response } from 'express';
import { ClientService } from './client.service';

export class ClientController {
  static async saveClientWithPortal(req: any, res: Response) {
    try {
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.saveClientWithPortal(req.user.id, orgIdHeader, req.body);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.saveClientWithPortal] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to save client portal account',
      });
    }
  }

  static async togglePortalAccess(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.togglePortalAccess(req.user.id, orgIdHeader, id, Boolean(enabled));
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.togglePortalAccess] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to toggle portal access',
      });
    }
  }

  static async resendAccessLink(req: any, res: Response) {
    try {
      const { id } = req.params;
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.resendAccessLink(req.user.id, orgIdHeader, id);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.resendAccessLink] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to resend access link',
      });
    }
  }

  static async resetPassword(req: any, res: Response) {
    try {
      const { id } = req.params;
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.triggerPasswordReset(req.user.id, orgIdHeader, id);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.resetPassword] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to trigger password reset',
      });
    }
  }

  static async syncProjects(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { projectIds } = req.body;
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.syncProjects(req.user.id, orgIdHeader, id, projectIds || []);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.syncProjects] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to sync client projects',
      });
    }
  }

  static async getClientDetails(req: any, res: Response) {
    try {
      const { id } = req.params;
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const result = await ClientService.getClientDetails(req.user.id, orgIdHeader, id);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[ClientController.getClientDetails] Error:', err);
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to fetch client details',
      });
    }
  }
}
