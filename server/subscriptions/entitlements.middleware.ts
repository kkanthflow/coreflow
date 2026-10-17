import { Request, Response, NextFunction } from 'express';
import { EntitlementsService } from './entitlements.service.js';

export type EntitlementFeature = 'invoices' | 'projects' | 'meetings' | 'seats' | 'analytics';

/**
 * Reusable Express middleware to enforce subscription plan quotas and feature entitlements.
 * If quota is exhausted, halts request and returns structured HTTP 403 response.
 */
export function requireEntitlement(feature: EntitlementFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Authentication required to access this resource',
        });
        return;
      }

      // Resolve orgId safely from header or query (never trust forged tier parameters)
      const orgId =
        (req.headers['x-organization-id'] as string) ||
        (req.headers['x-workspace-id'] as string) ||
        (req.query.orgId as string) ||
        (req.body && req.body.organizationId) ||
        null;

      const check = await EntitlementsService.checkEntitlement({
        userId: user.id,
        orgId,
        feature,
      });

      if (!check.allowed) {
        res.status(403).json({
          error: 'quota_exceeded',
          feature: check.feature,
          current: check.current,
          limit: check.limit,
          tier: check.tier,
          resetDate: check.resetDate,
          upgradeUrl: check.upgradeUrl || '/pricing',
          message: `Your ${check.tier} plan quota for ${check.feature} has been reached (${check.current}/${check.limit}). Please upgrade at /pricing to continue.`,
        });
        return;
      }

      // Attach entitlement check metadata to request context for downstream handlers
      (req as any).entitlement = check;
      next();
    } catch (err: any) {
      console.error(`[requireEntitlement:${feature}] Verification error:`, err);
      // In case of error in entitlement verification, fail securely or proceed if non-fatal
      res.status(500).json({
        error: 'entitlement_check_failed',
        message: 'Failed to verify subscription entitlements.',
      });
    }
  };
}
