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

    // 2. Create Default Department
    const [generalDept] = await tx.insert(departments).values({
      organizationId: org.id,
      name: "General",
    }).returning();

    // 3. Add user as owner and administrator
    const [membership] = await tx.insert(organizationMemberships).values({
      userId: params.userId,
      organizationId: org.id,
      departmentId: generalDept.id,
      jobTitle: params.jobTitle || "Founder / Owner",
      accessRole: "administrator",
      isOwner: true,
    }).returning();

    // 4. Audit Log
    await recordAuditEvent({
      actorUserId: params.userId,
      organizationId: org.id,
      actionType: "organization_created",
      resourceType: "organization",
      resourceId: org.id,
      description: `Organization ${params.name} created.`,
      newValues: org,
    });

    return { organization: org, membership, defaultDepartment: generalDept };
  });
}

// ==========================================
// JOIN REQUESTS
// ==========================================
export async function createJoinRequest(params: {
  userId: number;
  organizationId: number;
  departmentId: number;
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
    departmentId: params.departmentId,
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
    departmentId: params.departmentId,
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
// WORKSPACE PROVISIONING (OAUTH)
// ==========================================
export async function provisionGoogleUserWorkspace(params: {
  userId: number;       // Drizzle User ID
  userOpenId: string;   // Supabase Auth UUID
  fullName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // 1. Update user to freelancer role
    await tx.execute(sql`
      UPDATE users 
      SET role = 'freelancer', default_workspace_id = 'independent' 
      WHERE id = ${params.userOpenId}::uuid
    `);

    // 2. Insert into Supabase legacy tables (workspaces, workspace_members, freelancer_profiles)
    // using raw SQL since they aren't in Drizzle schema.
    await tx.execute(sql`
      INSERT INTO freelancer_profiles (id, freelancer_type) 
      VALUES (${params.userOpenId}::uuid, 'independent')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Check if independent workspace exists
    const existingWs = await tx.execute(sql`
      SELECT id FROM workspaces 
      WHERE owner_id = ${params.userOpenId}::uuid 
      AND type = 'independent'
      LIMIT 1;
    `);

    let wsId;
    if (existingWs.length > 0) {
      wsId = existingWs[0].id;
    } else {
      const insertedWs = await tx.execute(sql`
        INSERT INTO workspaces (name, type, owner_id, status)
        VALUES (${params.fullName} || ' Freelancing', 'independent', ${params.userOpenId}::uuid, 'active')
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

    return { success: true, workspaceId: wsId };
  });
}