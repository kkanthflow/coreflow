import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { 
  auvrynFiles, 
  fileVersions, 
  fileLinks,
  clientReleases,
  downloadRequests
} from "../../drizzle/schema.js";
import { recordAuditEvent } from "./audit.service.js";

// ==========================================
// FILE UPLOAD & VERSIONING
// ==========================================
export async function createFileWithVersion(params: {
  organizationId: number;
  name: string;
  mimeType: string;
  uploaderId: number;
  storagePath: string;
  size: number;
  checksum?: string;
  visibility?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx: any) => {
    // 1. Create Logical File
    const [file] = await tx.insert(auvrynFiles).values({
      organizationId: params.organizationId,
      name: params.name,
      mimeType: params.mimeType,
      createdBy: params.uploaderId,
      visibility: params.visibility || 'internal',
      status: 'draft',
    }).returning();

    // 2. Create V1 Version
    const [version] = await tx.insert(fileVersions).values({
      fileId: file.id,
      versionNumber: 1,
      storagePath: params.storagePath,
      size: params.size,
      checksum: params.checksum,
      uploadedBy: params.uploaderId,
    }).returning();

    // 3. Update File with current version
    await tx.update(auvrynFiles)
      .set({ currentVersionId: version.id })
      .where(eq(auvrynFiles.id, file.id));

    // 4. Audit Log
    await recordAuditEvent({
      actorUserId: params.uploaderId,
      organizationId: params.organizationId,
      actionType: "file_uploaded",
      resourceType: "file",
      resourceId: file.id,
      description: `File ${params.name} uploaded.`,
      newValues: { file, version },
    });

    return { file, version };
  });
}

// ==========================================
// CLIENT RELEASES
// ==========================================
export async function releaseFileToClient(params: {
  organizationId: number;
  fileId: number;
  fileVersionId: number;
  clientId: number;
  releaserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [release] = await db.insert(clientReleases).values({
    fileId: params.fileId,
    fileVersionId: params.fileVersionId,
    clientId: params.clientId,
    status: 'released',
  }).returning();

  await recordAuditEvent({
    actorUserId: params.releaserId,
    organizationId: params.organizationId,
    actionType: "client_file_released",
    resourceType: "client_release",
    resourceId: release.id,
    clientId: params.clientId,
  });

  return release;
}
