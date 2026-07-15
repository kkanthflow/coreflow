import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
const admin = require("firebase-admin");
import { Pool } from "pg";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured.",
    });
  }

  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured.",
    });
  }

  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ENTERPRISE FCM DISPATCH PIPELINE
// ─────────────────────────────────────────────────────────────────────────

let dbPool: Pool | null = null;
function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return dbPool;
}

let fcmApp: any = null;
function getFirebaseAdmin() {
  if (fcmApp) return fcmApp;

  let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64Key = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64Key && !serviceAccountString) {
    try {
      serviceAccountString = Buffer.from(b64Key, "base64").toString("utf8");
    } catch (e) {
      console.error("[FCM] Failed to decode base64 service account credentials:", e);
    }
  }

  if (!serviceAccountString) {
    const fs = require("fs");
    const path = require("path");
    const localKeyPath = path.join(process.cwd(), "coreflow-2af5c-cc11e0599b34.json");
    if (fs.existsSync(localKeyPath)) {
      const localKey = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
      fcmApp = admin.initializeApp({
        credential: admin.credential.cert(localKey),
      });
      console.log("[FCM] Firebase Admin SDK initialized successfully via local service account key.");
      return fcmApp;
    }
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT environment variable is not set and local service account key is missing.");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    fcmApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[FCM] Firebase Admin SDK initialized successfully via environment variable.");
    return fcmApp;
  } catch (err) {
    console.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", err);
    return null;
  }
}

class PushQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private concurrencyLimit = 50;

  enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.processNext();
  }

  private async processNext() {
    if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) return;

    this.activeCount++;
    const task = this.queue.shift()!;
    try {
      await task();
    } catch (e) {
      console.error("[PushQueue] Task execution failed:", e);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }
}

const pushQueue = new PushQueue();

export type PushNotificationData = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
};

export function dispatchFCMPush(data: PushNotificationData) {
  pushQueue.enqueue(async () => {
    const pool = getDbPool();
    const fb = getFirebaseAdmin();

    if (!fb) {
      console.error("[FCM] Firebase Admin SDK is not initialized. Cannot dispatch push.");
      await pool.query(
        "UPDATE public.notifications SET delivery_status = 'failed', delivery_error = 'Firebase SDK not initialized' WHERE id = $1",
        [data.id]
      );
      return;
    }

    try {
      // 1. Check user notification preferences before sending
      const prefResult = await pool.query(
        `SELECT chat_enabled, meetings_enabled, tasks_enabled, finance_enabled, announcements_enabled 
         FROM public.notification_preferences WHERE user_id = $1`,
        [data.userId]
      );

      if (prefResult.rows.length > 0) {
        const pref = prefResult.rows[0];
        const isChatDisabled = data.type === "chat" && !pref.chat_enabled;
        const isMeetingDisabled = data.type === "meeting" && !pref.meetings_enabled;
        const isTaskDisabled = data.type === "task" && !pref.tasks_enabled;
        const isFinanceDisabled = data.type === "finance" && !pref.finance_enabled;
        const isAnnouncementDisabled = data.type === "announcements" && !pref.announcements_enabled;

        if (isChatDisabled || isMeetingDisabled || isTaskDisabled || isFinanceDisabled || isAnnouncementDisabled) {
          console.log(`[FCM] Notification skipped for user ${data.userId} due to preference settings.`);
          await pool.query(
            "UPDATE public.notifications SET delivery_status = 'failed', delivery_error = 'Skipped by preferences' WHERE id = $1",
            [data.id]
          );
          return;
        }
      }

      // 2. Fetch all active push tokens for this user
      const tokensResult = await pool.query(
        "SELECT token, device_id, platform FROM public.user_push_tokens WHERE user_id = $1 AND is_enabled = true",
        [data.userId]
      );

      const deviceTokens = tokensResult.rows;
      if (deviceTokens.length === 0) {
        console.log(`[FCM] No active device tokens found for user ${data.userId}.`);
        await pool.query(
          "UPDATE public.notifications SET delivery_status = 'failed', delivery_error = 'No active tokens' WHERE id = $1",
          [data.id]
        );
        return;
      }

      // Update notification status to 'sending' and increment attempt count
      await pool.query(
        "UPDATE public.notifications SET delivery_status = 'sending', delivery_attempts = delivery_attempts + 1 WHERE id = $1",
        [data.id]
      );

      // 3. Build payload for Firebase
      const tokens = deviceTokens.map((t) => t.token);
      const payload: any = {
        tokens,
        notification: {
          title: data.title,
          body: data.message,
        },
        data: {
          id: data.id,
          type: data.type,
          entity_type: data.entityType || "",
          entity_id: data.entityId || "",
          action_url: data.actionUrl || "",
        },
        android: {
          priority: "high",
          notification: {
            channelId: data.type === "chat" ? "chat" : data.type === "meeting" ? "meetings" : data.type === "task" ? "tasks" : "default",
            sound: "default",
            clickAction: "default",
          },
        },
      };

      // 4. Send multicast message
      const response = await sendWithRetry(fb, payload);

      // 5. Audit results and self-heal unregistered tokens
      const tokensToDelete: string[] = [];
      response.responses.forEach((res: any, idx: number) => {
        if (!res.success && res.error) {
          const errorCode = res.error.code;
          const token = tokens[idx];
          const device = deviceTokens[idx];

          console.warn(`[FCM] Send failed for user ${data.userId} device ${device.device_id}:`, res.error.message);

          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument"
          ) {
            tokensToDelete.push(token);
          }
        }
      });

      if (tokensToDelete.length > 0) {
        console.log(`[FCM] Deleting ${tokensToDelete.length} unregistered / invalid tokens.`);
        await pool.query(
          "DELETE FROM public.user_push_tokens WHERE token = ANY($1)",
          [tokensToDelete]
        );
      }

      const successCount = response.successCount;
      if (successCount > 0) {
        await pool.query(
          "UPDATE public.notifications SET delivery_status = 'sent', delivery_error = null WHERE id = $1",
          [data.id]
        );
      } else {
        await pool.query(
          "UPDATE public.notifications SET delivery_status = 'failed', delivery_error = 'All token dispatches failed' WHERE id = $1",
          [data.id]
        );
      }

    } catch (err: any) {
      console.error("[FCM] Critical push dispatch failure:", err);
      await pool.query(
        "UPDATE public.notifications SET delivery_status = 'failed', delivery_error = $2 WHERE id = $1",
        [data.id, err.message || "Unknown error"]
      );
    }
  });
}

async function sendWithRetry(
  fb: any,
  payload: any,
  attempt = 1
): Promise<any> {
  try {
    return await fb.messaging().sendEachForMulticast(payload);
  } catch (error: any) {
    const isTransient = error.code === "messaging/internal-error" || error.code === "messaging/server-unavailable";
    if (isTransient && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(fb, payload, attempt + 1);
    }
    throw error;
  }
}
