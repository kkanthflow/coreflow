import { TRPCError } from "@trpc/server";
import { getDb } from "../db.js";
import { organizationMemberships } from "../../drizzle/schema.js";
import { and, eq } from "drizzle-orm";

export const ROLE_HIERARCHY = {
  owner: 100,
  administrator: 90,
  director: 80,
  senior_manager: 70,
  manager: 60,
  team_lead: 50,
  senior_employee: 40,
  employee: 30,
  intern: 20,
  freelancer: 10,
} as const;

export type AuvrynRole = keyof typeof ROLE_HIERARCHY;

/**
 * Checks if the actor's role is strictly greater than the target role.
 */
export function canManageRole(actorRole: AuvrynRole, targetRole: AuvrynRole): boolean {
  if (actorRole === 'owner') return true; // Owner can manage anyone
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Validates if a user has sufficient permissions within an organization.
 * Throws TRPCError if unauthorized.
 */
export async function enforceOrgPermission(userId: number, organizationId: number, requiredRoleLevel: number = 0) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const membershipList = await db.select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      )
    );

  if (membershipList.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization." });
  }

  const membership = membershipList[0];
  const userRole = membership.accessRole as AuvrynRole;
  const userPower = ROLE_HIERARCHY[userRole] || 0;

  if (userPower < requiredRoleLevel) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions for this action." });
  }

  return { membership, userPower };
}

/**
 * Fetches the user's highest role power level across all their memberships.
 */
export async function getHighestRolePower(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const memberships = await db.select({ role: organizationMemberships.accessRole })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, userId));

  if (memberships.length === 0) return 0;

  return Math.max(...memberships.map(m => ROLE_HIERARCHY[m.role as AuvrynRole] || 0));
}
