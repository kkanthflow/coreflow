import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
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

import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

let fcmApp: App | null = null;

function getFirebaseApp(): App | null {
  // Return cached app if already initialized in this process
  if (fcmApp) return fcmApp;

  // Guard against duplicate initialization on warm Vercel lambdas
  const existingApps = getApps();
  if (existingApps.length > 0) {
    fcmApp = existingApps[0];
    console.log("[FCM] Reusing existing Firebase app instance.");
    return fcmApp;
  }

  // Resolve service account credentials
  let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64Key = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64Key && !serviceAccountString) {
    try {
      serviceAccountString = Buffer.from(b64Key, "base64").toString("utf8");
    } catch (e) {
      console.error("[FCM] Failed to decode base64 service account credentials:", e);
    }
  }

  // If the provided serviceAccountString is a base64 encoded JSON string, decode it
  if (serviceAccountString && !serviceAccountString.trim().startsWith("{")) {
    try {
      serviceAccountString = Buffer.from(serviceAccountString, "base64").toString("utf8");
    } catch (e) {
      console.error("[FCM] Failed to decode FIREBASE_SERVICE_ACCOUNT as base64:", e);
    }
  }

  if (!serviceAccountString) {
    const fs = require("fs");
    const path = require("path");
    const localKeyPath = path.join(process.cwd(), "coreflow-2af5c-cc11e0599b34.json");
    if (fs.existsSync(localKeyPath)) {
      try {
        const localKey = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
        fcmApp = initializeApp({ credential: cert(localKey) });
        console.log("[FCM] Firebase app initialized via local service account key.");
        return fcmApp;
      } catch (e) {
        console.error("[FCM] Failed to initialize Firebase app from local key:", e);
      }
    }
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT env var is not set and local key file is missing.");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    if (serviceAccount.private_key) {
      let key = serviceAccount.private_key;
      // Strip everything, including all types of whitespace and newlines
      let body = key.replace(/-----BEGIN PRIVATE KEY-----/gi, '').replace(/-----END PRIVATE KEY-----/gi, '').replace(/\s+/g, '');
      let chunks = body.match(/.{1,64}/g);
      if (chunks) {
        serviceAccount.private_key = '-----BEGIN PRIVATE KEY-----\n' + chunks.join('\n') + '\n-----END PRIVATE KEY-----\n';
      }
    }
    fcmApp = initializeApp({ credential: cert(serviceAccount) });
    console.log("[FCM] Firebase app initialized via environment variable.");
    return fcmApp;
  } catch (err) {
    console.error("[FCM] Failed to initialize Firebase app:", err);
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
  /** For chat messages: the sender's user ID. Used to exclude the sender's own devices from receiving a push. */
  senderId?: string;
};

export async function dispatchFCMPush(data: PushNotificationData): Promise<void> {
    const supabase = getSupabaseAdmin() as any;
    const app = getFirebaseApp();

    if (!app) {
      console.error("[FCM] Firebase app is not initialized. Cannot dispatch push.");
      await supabase
        .from("notifications")
        .update({ delivery_status: 'failed', delivery_error: 'Firebase app not initialized' })
        .eq('id', data.id);
      return;
    }

    const messaging = getMessaging(app);

    try {
      // 1. Check user notification preferences before sending
      const { data: prefRows } = await supabase
        .from("notification_preferences")
        .select("chat_enabled, meetings_enabled, tasks_enabled, finance_enabled, announcements_enabled")
        .eq("user_id", data.userId);

      if (prefRows && prefRows.length > 0) {
        const pref = prefRows[0];
        const isChatDisabled = data.type === "chat" && !pref.chat_enabled;
        const isMeetingDisabled = data.type === "meeting" && !pref.meetings_enabled;
        const isTaskDisabled = data.type === "task" && !pref.tasks_enabled;
        const isFinanceDisabled = data.type === "finance" && !pref.finance_enabled;
        const isAnnouncementDisabled = data.type === "announcements" && !pref.announcements_enabled;

        if (isChatDisabled || isMeetingDisabled || isTaskDisabled || isFinanceDisabled || isAnnouncementDisabled) {
          console.log(`[FCM] Notification skipped for user ${data.userId} due to preference settings.`);
          await supabase
            .from("notifications")
            .update({ delivery_status: 'failed', delivery_error: 'Skipped by preferences' })
            .eq('id', data.id);
          return;
        }
      }

      // 2. Fetch all active push tokens for this user, excluding the sender's own devices
      let query = supabase
        .from("user_push_tokens")
        .select("token, device_id, platform")
        .eq("user_id", data.userId)
        .eq("is_enabled", true);

      if (data.senderId && data.senderId !== data.userId) {
        const { data: senderTokens } = await supabase
          .from("user_push_tokens")
          .select("token")
          .eq("user_id", data.senderId);

        if (senderTokens && senderTokens.length > 0) {
          const excludeTokens = senderTokens.map((t: any) => t.token);
          query = query.not("token", "in", excludeTokens);
        }
      }

      const { data: deviceTokens } = await query;
      const tokens = (deviceTokens || []).map((t: any) => t.token);

      if (!tokens || tokens.length === 0) {
        console.log(`[FCM] No devices found for user ${data.userId}`);
        await supabase
          .from("notifications")
          .update({ delivery_status: 'failed', delivery_error: 'No active device tokens found' })
          .eq('id', data.id);
        return;
      }

      // Update notification status to 'sending' and increment attempt count
      const { data: nData } = await supabase.from("notifications").select("delivery_attempts").eq("id", data.id).single();
      const attempts = (nData?.delivery_attempts || 0) + 1;
      await supabase
        .from("notifications")
        .update({ delivery_status: 'sending', delivery_attempts: attempts })
        .eq('id', data.id);

      console.log(`[FCM] Dispatching to ${tokens.length} device(s) for user ${data.userId}`);

      // 4. Build and send multicast message using firebase-admin v14 modular API
      const multicastMessage: MulticastMessage = {
        tokens,
        notification: {
          title: data.title,
          body: data.message,
        },
        data: {
          id: data.id,
          type: data.type || "",
          entity_type: data.entityType || "",
          entity_id: data.entityId || "",
          action_url: data.actionUrl || "",
          sender_id: data.senderId || "",
        },
        android: {
          priority: "high",
          notification: {
            channelId: data.type === "chat" ? "chat" : data.type === "meeting" ? "meetings" : data.type === "task" || data.type === "task_assigned" ? "tasks" : "default",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await sendWithRetry(messaging, multicastMessage);

      // 5. Audit results and self-heal unregistered tokens
      const tokensToDelete: string[] = [];
      response.responses.forEach((res: any, idx: number) => {
        if (!res.success && res.error) {
          const errorCode = res.error.code;
          const token = tokens[idx];
          const device = deviceTokens![idx];

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
        await supabase
          .from("user_push_tokens")
          .delete()
          .in("token", tokensToDelete);
      }

      const successCount = response.successCount;
      if (successCount > 0) {
        await supabase
          .from("notifications")
          .update({ delivery_status: 'delivered', delivery_error: null })
          .eq('id', data.id);
      } else {
        await supabase
          .from("notifications")
          .update({ delivery_status: 'failed', delivery_error: 'All token dispatches failed' })
          .eq('id', data.id);
      }

    } catch (err: any) {
      console.error("[FCM] Critical push dispatch failure:", err);
      await supabase
        .from("notifications")
        .update({ delivery_status: 'failed', delivery_error: err.message || "Unknown error" })
        .eq('id', data.id);
    }
}

async function sendWithRetry(
  messaging: ReturnType<typeof getMessaging>,
  payload: MulticastMessage,
  attempt = 1
): Promise<any> {
  try {
    return await messaging.sendEachForMulticast(payload);
  } catch (error: any) {
    const isTransient = error.code === "messaging/internal-error" || error.code === "messaging/server-unavailable";
    if (isTransient && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(messaging, payload, attempt + 1);
    }
    throw error;
  }
}
