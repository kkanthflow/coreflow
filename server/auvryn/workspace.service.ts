import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { 
  organizations, 
  organizationMemberships, 
  organizationJoinRequests, 
  departments,
  users
} from "../../drizzle/schema.js";
import { recordAuditEvent } from "./audit.service.js";
import { enforceOrgPermission, canManageRole, AuvrynRole } from "./rbac.service.js";
import { EntitlementsService } from "../subscriptions/entitlements.service.js";

// ==========================================
// WORKSPACE/ORG CREATION
// ==========================================
export async function createOrganization(params: {
  userId: number;
  name: string;
  workspaceType: "independent" | "organization";
  jobTitle?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx: any) => {
    // 1. Create Organization
    const [org] = await tx.insert(organizations).values({
      name: params.name,
      workspaceType: params.workspaceType,
      ownerId: params.userId,
    }).returning();

    // 2. Add user as owner and administrator (departments are optional and user-created)
    const [membership] = await tx.insert(organizationMemberships).values({
      userId: params.userId,
      organizationId: org.id,
      departmentId: null,
      jobTitle: params.jobTitle || "Founder / Owner",
      accessRole: "administrator",
      isOwner: true,
    }).returning();

    // 3. Audit Log
    await recordAuditEvent({
      actorUserId: params.userId,
      organizationId: org.id,
      actionType: "organization_created",
      resourceType: "organization",
      resourceId: org.id,
      description: `Organization ${params.name} created.`,
      newValues: org,
    });

    return { organization: org, membership };
  });
}

// ==========================================
// JOIN REQUESTS
// ==========================================
export async function createJoinRequest(params: {
  userId: number;
  organizationId: number;
  departmentId?: number | null;
  jobTitle: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Enforce seat limit before creating join request to prevent overbooking
  const seatCheck = await EntitlementsService.checkEntitlement({
    userId: String(params.userId),
    orgId: String(params.organizationId),
    feature: 'seats',
  });
  if (!seatCheck.allowed) {
    throw new Error(`quota_exceeded:seats: Organization team seat quota of ${seatCheck.limit} reached for ${seatCheck.tier} tier.`);
  }

  const [request] = await db.insert(organizationJoinRequests).values({
    userId: params.userId,
    organizationId: params.organizationId,
    departmentId: params.departmentId || null,
    jobTitle: params.jobTitle,
    message: params.message || null,
    status: "pending",
  }).returning();

  await recordAuditEvent({
    actorUserId: params.userId,
    organizationId: params.organizationId,
    actionType: "join_request_created",
    resourceType: "organization_join_request",
    resourceId: request.id,
    departmentId: params.departmentId || null,
  });

  return request;
}

export async function approveJoinRequest(params: {
  requestId: number;
  reviewerId: number;
  assignedRole: AuvrynRole;
  reviewNotes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Enforce the reviewer has manager-level access (power level >= 60)
  const { userPower: reviewerPower, membership: reviewerMembership } = await enforceOrgPermission(params.reviewerId, 1 /* TODO: Needs Org ID from request */, 60);

  return await db.transaction(async (tx: any) => {
    const [request] = await tx.select().from(organizationJoinRequests).where(eq(organizationJoinRequests.id, params.requestId));
    if (!request) throw new Error("Request not found");

    if (!canManageRole(reviewerMembership.accessRole as AuvrynRole, params.assignedRole)) {
       throw new Error(`Reviewer role (${reviewerMembership.accessRole}) cannot assign role ${params.assignedRole}`);
    }

    // Enforce seat limit before membership creation
    const seatCheck = await EntitlementsService.checkEntitlement({
      userId: String(request.userId),
      orgId: String(request.organizationId),
      feature: 'seats',
    });
    if (!seatCheck.allowed) {
      throw new Error(`quota_exceeded:seats: Organization team seat quota of ${seatCheck.limit} reached for ${seatCheck.tier} tier. Upgrade at /pricing.`);
    }

    const [updatedRequest] = await tx.update(organizationJoinRequests)
      .set({
        status: "approved",
        reviewedBy: params.reviewerId,
        reviewedAt: new Date(),
        assignedRole: params.assignedRole,
        reviewNotes: params.reviewNotes || null,
      })
      .where(eq(organizationJoinRequests.id, params.requestId))
      .returning();

    const [membership] = await tx.insert(organizationMemberships).values({
      userId: updatedRequest.userId,
      organizationId: updatedRequest.organizationId,
      departmentId: updatedRequest.departmentId,
      jobTitle: updatedRequest.jobTitle,
      accessRole: params.assignedRole,
      isOwner: false,
    }).returning();

    await recordAuditEvent({
      actorUserId: params.reviewerId,
      organizationId: request.organizationId,
      actionType: "join_request_approved",
      resourceType: "organization_join_request",
      resourceId: request.id,
      newValues: membership,
    });

    return { request, membership };
  });
}

// ==========================================
// EXPLICIT WORKSPACE ONBOARDING (USER-SELECTED ONLY)
// ==========================================

export async function setupFreelancerWorkspace(params: {
  userId?: number;
  userOpenId: string;
  fullName: string;
  skills?: string[];
  portfolio?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // 1. Explicitly persist account_type as 'freelancer' and mark setup completed
    await tx.execute(sql`
      UPDATE users 
      SET 
        account_type = 'freelancer',
        role = 'freelancer', 
        default_workspace_id = 'independent',
        account_setup_completed = true,
        current_plan_tier = 'freelancer_free',
        subscription_status = 'free'
      WHERE id = ${params.userOpenId}::uuid
    `);

    // 2. Insert into freelancer_profiles
    await tx.execute(sql`
      INSERT INTO freelancer_profiles (id, freelancer_type, skills, portfolio) 
      VALUES (
        ${params.userOpenId}::uuid, 
        'independent', 
        ${params.skills || []}::text[], 
        ${params.portfolio || ''}
      )
      ON CONFLICT (id) DO UPDATE SET
        skills = EXCLUDED.skills,
        portfolio = EXCLUDED.portfolio;
    `);

    // 3. Ensure independent workspace exists
    const existingWs: any = await tx.execute(sql`
      SELECT id FROM workspaces 
      WHERE owner_id = ${params.userOpenId}::uuid 
      AND type = 'independent'
      LIMIT 1;
    `);

    let wsId;
    if (existingWs.length > 0) {
      wsId = existingWs[0].id;
    } else {
      const insertedWs: any = await tx.execute(sql`
        INSERT INTO workspaces (name, type, owner_id, status)
        VALUES (${params.fullName || 'User'} || ' Workspace', 'independent', ${params.userOpenId}::uuid, 'active')
        RETURNING id;
      `);
      wsId = insertedWs[0].id;
    }

    if (wsId) {
      await tx.execute(sql`
        INSERT INTO workspace_members (workspace_id, user_id, status)
        VALUES (${wsId}, ${params.userOpenId}::uuid, 'active')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
      `);
    }

    return { success: true, workspaceId: wsId, accountType: 'freelancer' };
  });
}

export async function setupOrganizationWorkspace(params: {
  userId?: number;
  userOpenId: string;
  fullName: string;
  orgName: string;
  jobTitle?: string;
  defaultCurrency?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // 1. Create Organization in Supabase organizations table
    const insertedOrg: any = await tx.execute(sql`
      INSERT INTO organizations (name, default_currency, current_plan_tier, subscription_status)
      VALUES (${params.orgName}, ${params.defaultCurrency || 'USD'}, 'business_free', 'free')
      RETURNING id;
    `);
    const orgId = insertedOrg[0].id;

    // 2. Add user as owner in user_organizations
    await tx.execute(sql`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${params.userOpenId}::uuid, ${orgId}::uuid, 'owner')
      ON CONFLICT DO NOTHING;
    `);

    // 3. Update user profile to account_type = 'organization', role = 'owner', default_workspace_id = orgId
    await tx.execute(sql`
      UPDATE users 
      SET 
        account_type = 'organization',
        role = 'owner', 
        default_workspace_id = ${String(orgId)},
        account_setup_completed = true,
        current_plan_tier = 'business_free',
        subscription_status = 'free'
      WHERE id = ${params.userOpenId}::uuid
    `);

    // 4. Create default organization workspace
    const insertedWs: any = await tx.execute(sql`
      INSERT INTO workspaces (name, type, owner_id, status)
      VALUES (${params.orgName}, 'organization', ${params.userOpenId}::uuid, 'active')
      RETURNING id;
    `);
    const wsId = insertedWs[0].id;

    if (wsId) {
      await tx.execute(sql`
        INSERT INTO workspace_members (workspace_id, user_id, status)
        VALUES (${wsId}, ${params.userOpenId}::uuid, 'active')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;
      `);
    }

    return { success: true, organizationId: orgId, workspaceId: wsId, accountType: 'organization' };
  });
}

export async function setupJoinOrganizationWorkspace(params: {
  userId?: number;
  userOpenId: string;
  fullName: string;
  organizationId: string;
  invitationToken?: string;
  invitedRole?: string;
  jobTitle?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate Organization Exists
  const orgCheck: any = await db.execute(sql`
    SELECT id, name, current_plan_tier FROM organizations WHERE id = ${params.organizationId}::uuid LIMIT 1;
  `);
  if (!orgCheck || orgCheck.length === 0) {
    throw new Error('Organization not found. Please verify the Organization ID.');
  }

  // Enforce seat limit before joining
  const seatCheck = await EntitlementsService.checkEntitlement({
    userId: params.userOpenId,
    orgId: params.organizationId,
    feature: 'seats',
  });
  if (!seatCheck.allowed) {
    throw new Error(`quota_exceeded:seats: Organization team member quota of ${seatCheck.limit} reached. Contact the organization owner to upgrade.`);
  }

  // Enforce: Prevent frontend requests from self-assigning unauthorized owner or admin roles
  let effectiveRole = 'employee';
  if (params.invitedRole && !['owner', 'administrator'].includes(params.invitedRole.toLowerCase())) {
    effectiveRole = params.invitedRole.toLowerCase();
  }

  return await db.transaction(async (tx) => {
    // Add user with invited role (never self-assign owner or administrator)
    await tx.execute(sql`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${params.userOpenId}::uuid, ${params.organizationId}::uuid, ${effectiveRole})
      ON CONFLICT (user_id, org_id) DO NOTHING;
    `);

    // Update user record: account_type = 'organization', account_setup_completed = true
    await tx.execute(sql`
      UPDATE users 
      SET 
        account_type = 'organization',
        role = ${effectiveRole}::user_role, 
        default_workspace_id = ${params.organizationId},
        account_setup_completed = true
      WHERE id = ${params.userOpenId}::uuid
    `);

    return { success: true, organizationId: params.organizationId, accountType: 'organization', role: effectiveRole };
  });
}

// Automatic account type assignment removed. Explicit selection required at /register/setup.
export async function provisionGoogleUserWorkspace(params: {
  userId: number;
  userOpenId: string;
  fullName: string;
}) {
  throw new Error('Automatic account type assignment is disabled. Users must explicitly select their operating architecture (Freelancer, Create Organization, or Join Organization) at /register/setup.');
}