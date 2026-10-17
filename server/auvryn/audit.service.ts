import { getDb } from "../db.js";
import { auditLogs } from "../../drizzle/schema.js";

type AuditEventParams = {
  actorUserId?: number | null;
  organizationId?: number | null;
  actionType: string;
  resourceType: string;
  resourceId?: string | number | null;
  projectId?: number | null;
  taskId?: number | null;
  clientId?: number | null;
  departmentId?: number | null;
  description?: string | null;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  platform?: string;
  requestId?: string;
  success?: boolean;
};

export async function recordAuditEvent(params: AuditEventParams) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId || null,
      organizationId: params.organizationId || null,
      actionType: params.actionType,
      resourceType: params.resourceType,
      resourceId: params.resourceId ? String(params.resourceId) : null,
      projectId: params.projectId || null,
      taskId: params.taskId || null,
      clientId: params.clientId || null,
      departmentId: params.departmentId || null,
      description: params.description || null,
      oldValues: params.oldValues || null,
      newValues: params.newValues || null,
      metadata: params.metadata || {},
      platform: params.platform || null,
      requestId: params.requestId || null,
      success: params.success !== false, // default to true
    });
  } catch (error) {
    // We log the error but don't throw to prevent breaking business flows,
    // though for critical transactions we might want to insert this inside a tx context.
    console.error("Failed to record audit event:", error);
  }
}
