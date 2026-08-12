var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      jwtSecret: process.env.JWT_SECRET ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/security/redis.ts
var MemoryCache, redisClient, useMemoryFallback, REDIS_URL, memoryStore, cache;
var init_redis = __esm({
  "server/security/redis.ts"() {
    "use strict";
    MemoryCache = class {
      store = /* @__PURE__ */ new Map();
      async get(key) {
        const record = this.store.get(key);
        if (!record) return null;
        if (Date.now() > record.expiresAt) {
          this.store.delete(key);
          return null;
        }
        return record.value;
      }
      async set(key, value, mode, duration) {
        let expiresAt = Infinity;
        if (mode === "EX" && duration) {
          expiresAt = Date.now() + duration * 1e3;
        } else if (mode === "PX" && duration) {
          expiresAt = Date.now() + duration;
        }
        this.store.set(key, { value, expiresAt });
        return "OK";
      }
      async incr(key) {
        const val = await this.get(key);
        const num = val ? parseInt(val, 10) : 0;
        const next = num + 1;
        await this.set(key, next.toString());
        return next;
      }
      async del(key) {
        const deleted = this.store.delete(key);
        return deleted ? 1 : 0;
      }
      async ttl(key) {
        const record = this.store.get(key);
        if (!record) return -2;
        if (Date.now() > record.expiresAt) {
          this.store.delete(key);
          return -2;
        }
        if (record.expiresAt === Infinity) return -1;
        return Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1e3));
      }
    };
    redisClient = null;
    useMemoryFallback = true;
    REDIS_URL = process.env.REDIS_URL;
    if (REDIS_URL) {
      try {
        const Redis = __require("ioredis");
        redisClient = new Redis(REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2e3
        });
        redisClient.on("error", (err) => {
          console.warn("[Redis] Connection error, falling back to memory:", err.message);
          useMemoryFallback = true;
        });
        redisClient.on("connect", () => {
          console.log("[Redis] Connected successfully.");
          useMemoryFallback = false;
        });
        useMemoryFallback = false;
      } catch (e) {
        console.warn("[Redis] Failed to load ioredis library, using in-memory store instead.");
        useMemoryFallback = true;
      }
    } else {
      console.log("[Redis] REDIS_URL not configured. Running in-memory cache mode.");
    }
    memoryStore = new MemoryCache();
    cache = {
      async get(key) {
        if (useMemoryFallback) {
          return memoryStore.get(key);
        }
        try {
          return await redisClient.get(key);
        } catch (err) {
          return memoryStore.get(key);
        }
      },
      async set(key, value, expireInSeconds) {
        if (useMemoryFallback) {
          await memoryStore.set(key, value, expireInSeconds ? "EX" : void 0, expireInSeconds);
          return;
        }
        try {
          if (expireInSeconds) {
            await redisClient.set(key, value, "EX", expireInSeconds);
          } else {
            await redisClient.set(key, value);
          }
        } catch (err) {
          await memoryStore.set(key, value, expireInSeconds ? "EX" : void 0, expireInSeconds);
        }
      },
      async incr(key, expireInSeconds) {
        if (useMemoryFallback) {
          const next = await memoryStore.incr(key);
          if (expireInSeconds && next === 1) {
            await memoryStore.set(key, next.toString(), "EX", expireInSeconds);
          }
          return next;
        }
        try {
          const next = await redisClient.incr(key);
          if (expireInSeconds && next === 1) {
            await redisClient.expire(key, expireInSeconds);
          }
          return next;
        } catch (err) {
          const next = await memoryStore.incr(key);
          if (expireInSeconds && next === 1) {
            await memoryStore.set(key, next.toString(), "EX", expireInSeconds);
          }
          return next;
        }
      },
      async del(key) {
        if (useMemoryFallback) {
          await memoryStore.del(key);
          return;
        }
        try {
          await redisClient.del(key);
        } catch (err) {
          await memoryStore.del(key);
        }
      },
      async getTtl(key) {
        if (useMemoryFallback) {
          return memoryStore.ttl(key);
        }
        try {
          return await redisClient.ttl(key);
        } catch (err) {
          return memoryStore.ttl(key);
        }
      }
    };
  }
});

// server/security/validation.ts
var validation_exports = {};
__export(validation_exports, {
  forgotPasswordSchema: () => forgotPasswordSchema,
  loginSchema: () => loginSchema,
  mfaVerifySchema: () => mfaVerifySchema,
  refreshTokenSchema: () => refreshTokenSchema,
  sanitizationMiddleware: () => sanitizationMiddleware,
  sanitizeInput: () => sanitizeInput,
  validateBody: () => validateBody
});
import { z } from "zod";
function sanitizeInput(input) {
  if (typeof input === "string") {
    return input.trim().replace(/\0/g, "").normalize("NFC");
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }
  if (typeof input === "object" && input !== null) {
    const sanitized = {};
    for (const key of Object.keys(input)) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}
function sanitizationMiddleware(req, res, next) {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
}
function validateBody(schema) {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message
        }));
        res.status(400).json({
          error: "Validation failed: Invalid request payload.",
          details
        });
        return;
      }
      res.status(400).json({ error: "Invalid request payload." });
    }
  };
}
var loginSchema, mfaVerifySchema, refreshTokenSchema, forgotPasswordSchema;
var init_validation = __esm({
  "server/security/validation.ts"() {
    "use strict";
    loginSchema = z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(100),
      deviceId: z.string().max(255).optional(),
      platform: z.string().max(100).optional(),
      fingerprint: z.string().max(255).optional(),
      captchaToken: z.string().max(255).optional()
    }).strict();
    mfaVerifySchema = z.object({
      code: z.string().length(6),
      challengeId: z.string().uuid().nullable().optional(),
      factorId: z.string().max(255).optional(),
      tempAccessToken: z.string().max(2048)
    }).strict();
    refreshTokenSchema = z.object({
      refresh_token: z.string().max(2048)
    }).strict();
    forgotPasswordSchema = z.object({
      email: z.string().email().max(255)
    }).strict();
  }
});

// server/_core/notification.ts
var notification_exports = {};
__export(notification_exports, {
  dispatchFCMPush: () => dispatchFCMPush,
  notifyOwner: () => notifyOwner
});
import { TRPCError } from "@trpc/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient as createClient3 } from "@supabase/supabase-js";
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
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
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
function getSupabaseAdmin() {
  if (!supabaseClient) {
    const supabaseUrl4 = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    supabaseClient = createClient3(supabaseUrl4, supabaseKey);
  }
  return supabaseClient;
}
function getFirebaseApp() {
  if (fcmApp) return fcmApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    fcmApp = existingApps[0];
    console.log("[FCM] Reusing existing Firebase app instance.");
    return fcmApp;
  }
  let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64Key = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64Key && !serviceAccountString) {
    try {
      serviceAccountString = Buffer.from(b64Key, "base64").toString("utf8");
    } catch (e) {
      console.error("[FCM] Failed to decode base64 service account credentials:", e);
    }
  }
  if (serviceAccountString && !serviceAccountString.trim().startsWith("{")) {
    try {
      serviceAccountString = Buffer.from(serviceAccountString, "base64").toString("utf8");
    } catch (e) {
      console.error("[FCM] Failed to decode FIREBASE_SERVICE_ACCOUNT as base64:", e);
    }
  }
  if (!serviceAccountString) {
    const fs = __require("fs");
    const path2 = __require("path");
    const localKeyPath = path2.join(process.cwd(), "coreflow-2af5c-cc11e0599b34.json");
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
      let body = key.replace(/-----BEGIN PRIVATE KEY-----/gi, "").replace(/-----END PRIVATE KEY-----/gi, "").replace(/\s+/g, "");
      let chunks = body.match(/.{1,64}/g);
      if (chunks) {
        serviceAccount.private_key = "-----BEGIN PRIVATE KEY-----\n" + chunks.join("\n") + "\n-----END PRIVATE KEY-----\n";
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
async function dispatchFCMPush(data) {
  const supabase3 = getSupabaseAdmin();
  const app = getFirebaseApp();
  if (!app) {
    console.error("[FCM] Firebase app is not initialized. Cannot dispatch push.");
    await supabase3.from("notifications").update({ delivery_status: "failed", delivery_error: "Firebase app not initialized" }).eq("id", data.id);
    return;
  }
  const messaging = getMessaging(app);
  try {
    const { data: prefRows } = await supabase3.from("notification_preferences").select("chat_enabled, meetings_enabled, tasks_enabled, finance_enabled, announcements_enabled").eq("user_id", data.userId);
    if (prefRows && prefRows.length > 0) {
      const pref = prefRows[0];
      const isChatDisabled = data.type === "chat" && !pref.chat_enabled;
      const isMeetingDisabled = data.type === "meeting" && !pref.meetings_enabled;
      const isTaskDisabled = data.type === "task" && !pref.tasks_enabled;
      const isFinanceDisabled = data.type === "finance" && !pref.finance_enabled;
      const isAnnouncementDisabled = data.type === "announcements" && !pref.announcements_enabled;
      if (isChatDisabled || isMeetingDisabled || isTaskDisabled || isFinanceDisabled || isAnnouncementDisabled) {
        console.log(`[FCM] Notification skipped for user ${data.userId} due to preference settings.`);
        await supabase3.from("notifications").update({ delivery_status: "failed", delivery_error: "Skipped by preferences" }).eq("id", data.id);
        return;
      }
    }
    let query2 = supabase3.from("user_push_tokens").select("token, device_id, platform").eq("user_id", data.userId).eq("is_enabled", true);
    if (data.senderId && data.senderId !== data.userId) {
      const { data: senderTokens } = await supabase3.from("user_push_tokens").select("token").eq("user_id", data.senderId);
      if (senderTokens && senderTokens.length > 0) {
        const excludeTokens = senderTokens.map((t2) => t2.token);
        query2 = query2.not("token", "in", excludeTokens);
      }
    }
    const { data: deviceTokens } = await query2;
    const tokens = (deviceTokens || []).map((t2) => t2.token);
    if (!tokens || tokens.length === 0) {
      console.log(`[FCM] No devices found for user ${data.userId}`);
      await supabase3.from("notifications").update({ delivery_status: "failed", delivery_error: "No active device tokens found" }).eq("id", data.id);
      return;
    }
    const { data: nData } = await supabase3.from("notifications").select("delivery_attempts").eq("id", data.id).single();
    const attempts = (nData?.delivery_attempts || 0) + 1;
    await supabase3.from("notifications").update({ delivery_status: "sending", delivery_attempts: attempts }).eq("id", data.id);
    console.log(`[FCM] Dispatching to ${tokens.length} device(s) for user ${data.userId}`);
    const multicastMessage = {
      tokens,
      notification: {
        title: data.title,
        body: data.message
      },
      data: {
        id: data.id,
        type: data.type || "",
        entity_type: data.entityType || "",
        entity_id: data.entityId || "",
        action_url: data.actionUrl || "",
        sender_id: data.senderId || ""
      },
      android: {
        priority: "high",
        notification: {
          channelId: data.type === "chat" ? "chat" : data.type === "meeting" ? "meetings" : data.type === "task" || data.type === "task_assigned" ? "tasks" : "default",
          sound: "default"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    };
    const response = await sendWithRetry(messaging, multicastMessage);
    const tokensToDelete = [];
    response.responses.forEach((res, idx) => {
      if (!res.success && res.error) {
        const errorCode = res.error.code;
        const token = tokens[idx];
        const device = deviceTokens[idx];
        console.warn(`[FCM] Send failed for user ${data.userId} device ${device.device_id}:`, res.error.message);
        if (errorCode === "messaging/registration-token-not-registered" || errorCode === "messaging/invalid-argument") {
          tokensToDelete.push(token);
        }
      }
    });
    if (tokensToDelete.length > 0) {
      console.log(`[FCM] Deleting ${tokensToDelete.length} unregistered / invalid tokens.`);
      await supabase3.from("user_push_tokens").delete().in("token", tokensToDelete);
    }
    const successCount = response.successCount;
    if (successCount > 0) {
      await supabase3.from("notifications").update({ delivery_status: "delivered", delivery_error: null }).eq("id", data.id);
    } else {
      await supabase3.from("notifications").update({ delivery_status: "failed", delivery_error: "All token dispatches failed" }).eq("id", data.id);
    }
  } catch (err) {
    console.error("[FCM] Critical push dispatch failure:", err);
    await supabase3.from("notifications").update({ delivery_status: "failed", delivery_error: err.message || "Unknown error" }).eq("id", data.id);
  }
}
async function sendWithRetry(messaging, payload, attempt = 1) {
  try {
    return await messaging.sendEachForMulticast(payload);
  } catch (error) {
    const isTransient = error.code === "messaging/internal-error" || error.code === "messaging/server-unavailable";
    if (isTransient && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1e3;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(messaging, payload, attempt + 1);
    }
    throw error;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString2, buildEndpointUrl, validatePayload, supabaseClient, fcmApp, PushQueue, pushQueue;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    init_env();
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
    buildEndpointUrl = (baseUrl) => {
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
    };
    validatePayload = (input) => {
      if (!isNonEmptyString2(input.title)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString2(input.content)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
    supabaseClient = null;
    fcmApp = null;
    PushQueue = class {
      queue = [];
      activeCount = 0;
      concurrencyLimit = 50;
      enqueue(task) {
        this.queue.push(task);
        this.processNext();
      }
      async processNext() {
        if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) return;
        this.activeCount++;
        const task = this.queue.shift();
        try {
          await task();
        } catch (e) {
          console.error("[PushQueue] Task execution failed:", e);
        } finally {
          this.activeCount--;
          this.processNext();
        }
      }
    };
    pushQueue = new PushQueue();
  }
});

// server/security/rateLimit.ts
var rateLimit_exports = {};
__export(rateLimit_exports, {
  aiRateLimiter: () => aiRateLimiter,
  globalRateLimiter: () => globalRateLimiter
});
function globalRateLimiter(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const key = `rate:global:${ip}`;
  cache.incr(key, LIMIT_WINDOW_S).then((attempts) => {
    if (attempts > MAX_GLOBAL_REQ) {
      res.setHeader("Retry-After", LIMIT_WINDOW_S);
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }
    next();
  }).catch(() => {
    next();
  });
}
function aiRateLimiter(req, res, next) {
  const orgId = req.headers["x-org-id"] || "anonymous";
  const key = `rate:ai:org:${orgId}`;
  cache.incr(key, LIMIT_WINDOW_S).then((attempts) => {
    if (attempts > MAX_AI_REQ) {
      res.setHeader("Retry-After", LIMIT_WINDOW_S);
      res.status(429).json({ error: "Organization AI query quota exceeded. Please try again later." });
      return;
    }
    next();
  }).catch(() => {
    next();
  });
}
var LIMIT_WINDOW_S, MAX_GLOBAL_REQ, MAX_AI_REQ;
var init_rateLimit = __esm({
  "server/security/rateLimit.ts"() {
    "use strict";
    init_redis();
    LIMIT_WINDOW_S = parseInt(process.env.RATE_LIMIT_WINDOW_S || "60", 10);
    MAX_GLOBAL_REQ = parseInt(process.env.RATE_LIMIT_API_MAX || "10000", 10);
    MAX_AI_REQ = parseInt(process.env.RATE_LIMIT_AI_MAX || "10", 10);
  }
});

// server/_core/load-env-local.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// server/_core/index.ts
import { createServer } from "http";
import net from "net";

// server/_core/app.ts
import express from "express";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import { serial, pgEnum, pgTable, text, timestamp, varchar, boolean, integer, jsonb } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", [
  "student",
  "faculty",
  "club_admin",
  "placement_cell",
  "department_admin",
  "college_administrator",
  "super_admin",
  "admin"
]);
var eventTypeEnum = pgEnum("event_type", ["workshop", "seminar", "hackathon", "cultural", "sports", "other"]);
var jobTypeEnum = pgEnum("job_type", ["internship", "full_time", "part_time"]);
var lostFoundCategoryEnum = pgEnum("lost_found_category", ["electronics", "documents", "clothing", "other"]);
var lostFoundStatusEnum = pgEnum("lost_found_status", ["lost", "found", "returned"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  // Auth provider ID
  name: text("name"),
  // nullable, may be set later
  email: varchar("email", { length: 320 }).unique(),
  // nullable, may be set later
  role: roleEnum("role").default("student").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  department: varchar("department", { length: 100 }),
  year: integer("year"),
  skills: jsonb("skills"),
  // Array of skill strings
  githubUrl: text("githubUrl"),
  linkedinUrl: text("linkedinUrl"),
  portfolioUrl: text("portfolioUrl"),
  loginMethod: varchar("loginMethod", { length: 100 }),
  // optional login method
  lastSignedIn: timestamp("lastSignedIn"),
  // optional timestamp of last sign‑in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrls: jsonb("mediaUrls"),
  // Array of media URLs
  isPinned: boolean("isPinned").default(false),
  isOfficial: boolean("isOfficial").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  eventType: eventTypeEnum("eventType").default("other").notNull(),
  organizerId: integer("organizerId").notNull().references(() => users.id),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  location: varchar("location", { length: 255 }),
  coverImageUrl: text("coverImageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  hasAttended: boolean("hasAttended").default(false),
  registeredAt: timestamp("registeredAt").defaultNow().notNull()
});
var clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: text("logoUrl"),
  adminId: integer("adminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var clubMembers = pgTable("club_members", {
  id: serial("id").primaryKey(),
  clubId: integer("clubId").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  // committee, member
  joinedAt: timestamp("joinedAt").defaultNow().notNull()
});
var jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  jobType: jobTypeEnum("jobType").notNull(),
  description: text("description").notNull(),
  eligibilityCriteria: text("eligibilityCriteria"),
  deadline: timestamp("deadline"),
  postedById: integer("postedById").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  projectCategory: varchar("projectCategory", { length: 100 }),
  // hackathon, research, etc.
  requiredSkills: jsonb("requiredSkills"),
  creatorId: integer("creatorId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var lostAndFoundItems = pgTable("lost_and_found_items", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: lostFoundCategoryEnum("category").notNull(),
  status: lostFoundStatusEnum("status").default("lost").notNull(),
  location: varchar("location", { length: 255 }),
  imageUrl: text("imageUrl"),
  reporterId: integer("reporterId").notNull().references(() => users.id),
  dateReported: timestamp("dateReported").defaultNow().notNull()
});
var campusProjects = pgTable("campus_projects", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  techStack: jsonb("techStack"),
  githubUrl: text("githubUrl"),
  liveDemoUrl: text("liveDemoUrl"),
  coverImageUrl: text("coverImageUrl"),
  ownerId: integer("ownerId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  department: varchar("department", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  facultyName: varchar("facultyName", { length: 255 }).notNull(),
  rating: integer("rating").notNull(),
  comments: text("comments"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull()
  // Anonymous submission, so no userId
});
var achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  clubId: integer("clubId").references(() => clubs.id, { onDelete: "cascade" }),
  imageUrl: text("imageUrl"),
  awardedAt: timestamp("awardedAt").defaultNow().notNull()
});
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/db.ts
init_env();
var _db = null;
var queryClient = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      queryClient = postgres(process.env.DATABASE_URL);
      _db = drizzle(queryClient);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getParentDomain(hostname) {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return void 0;
  }
  const parts = hostname.split(".");
  if (parts.length < 3) {
    return void 0;
  }
  return "." + parts.slice(-2).join(".");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
  statusCode;
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
init_env();
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  client;
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(GET_USER_INFO_PATH, {
      accessToken: token.accessToken
    });
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(platforms.filter((p) => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    const { SignJWT } = await import("jose");
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { jwtVerify } = await import("jose");
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function syncUser(userInfo) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }
  const lastSignedIn = /* @__PURE__ */ new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return saved ?? {
    openId: userInfo.openId,
    name: userInfo.name,
    email: userInfo.email,
    loginMethod: userInfo.loginMethod ?? null,
    lastSignedIn
  };
}
function buildUserResponse(user) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? /* @__PURE__ */ new Date()).toISOString()
  };
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const frontendUrl = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app.get("/api/oauth/mobile", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user)
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });
  app.post("/api/auth/session", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

// server/_core/storageProxy.ts
init_env();
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
var supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!token) {
      res.status(401).send("Unauthorized: Bearer token is required in Authorization header.");
      return;
    }
    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        res.status(401).send("Unauthorized: Invalid session token.");
        return;
      }
      const { data: fileRecord, error: fileError } = await userClient.from("files").select("id, org_id").eq("storage_path", key).maybeSingle();
      if (fileError) {
        console.error("[StorageProxy] Auth DB error:", fileError);
        res.status(403).send("Forbidden: Authorization check failed.");
        return;
      }
      const isPublicPath = key.startsWith("avatars/") || key.startsWith("public/") || key.startsWith("temp/");
      if (!fileRecord && !isPublicPath) {
        res.status(403).send("Forbidden: You do not have access to this resource.");
        try {
          await userClient.from("activity_logs").insert({
            org_id: user.user_metadata?.org_id || null,
            actor_id: user.id,
            action: "unauthorized_file_access",
            entity_type: "file",
            entity_id: null,
            new_value: { key, ip: req.ip }
          });
        } catch (e) {
        }
        return;
      }
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/security/authProxy.ts
import { createClient as createClient2 } from "@supabase/supabase-js";

// server/security/auth-protection.ts
init_redis();

// server/security/db.ts
import { Pool } from "pg";
var pool = null;
function getSecurityDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Security database configuration error: DATABASE_URL is not set in environment.");
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 2e3
    });
  }
  return pool;
}
async function query(text2, params) {
  const p = getSecurityDbPool();
  return p.query(text2, params);
}

// server/security/auth-protection.ts
var SECURITY_CONFIG = {
  IP_LIMIT_WINDOW_S: 60,
  // 1 minute
  IP_LIMIT_MAX_ATTEMPTS: 5,
  // 5 attempts within 1 minute
  IP_LOCK_1_DURATION_S: 900,
  // 15 minutes
  IP_LOCK_2_DURATION_S: 3600,
  // 1 hour
  ACCOUNT_LOCK_MAX_ATTEMPTS: 8,
  // Lock account on 8th failure
  ACCOUNT_LOCK_DURATION_S: 900,
  // 15 minutes
  ORG_SPRAY_WINDOW_S: 600,
  // 10 minutes
  ORG_SPRAY_MAX_ATTEMPTS: 50,
  // 50 failures across org
  ORG_SPRAY_LOCK_DURATION_S: 1800,
  // 30 minutes
  CAPTCHA_SCORE_THRESHOLD: 50,
  // Triggers CAPTCHA if risk >= 50
  MFA_SCORE_THRESHOLD: 70
  // Triggers MFA if risk >= 70
};
var AuthProtectionService = class {
  // 1. IP rate limit and lockout verification
  static async checkIpLimit(ip) {
    const lockKey = `lock:ip:${ip}`;
    const lockedUntilStr = await cache.get(lockKey);
    if (lockedUntilStr) {
      const lockedUntil = parseInt(lockedUntilStr, 10);
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1e3));
      if (remaining > 0) {
        return { allowed: false, lockTimeRemaining: remaining };
      }
    }
    const windowKey = `attempts:ip:${ip}`;
    const count = await cache.incr(windowKey, SECURITY_CONFIG.IP_LIMIT_WINDOW_S);
    if (count >= 25) {
      const lockDuration = SECURITY_CONFIG.IP_LOCK_2_DURATION_S;
      await cache.set(lockKey, (Date.now() + lockDuration * 1e3).toString(), lockDuration);
      await query(
        "INSERT INTO public.security_events (event_type, severity, details) VALUES ($1, $2, $3)",
        ["brute_force_ip", "high", JSON.stringify({ ip, attempts: count, duration: "1h" })]
      );
      return { allowed: false, lockTimeRemaining: lockDuration };
    } else if (count >= 10) {
      const lockDuration = SECURITY_CONFIG.IP_LOCK_1_DURATION_S;
      await cache.set(lockKey, (Date.now() + lockDuration * 1e3).toString(), lockDuration);
      return { allowed: false, lockTimeRemaining: lockDuration };
    }
    return { allowed: true };
  }
  // 2. User account lockout and progressive backoff delay evaluation
  static async checkAccountLimit(email) {
    const lockKey = `lock:account:${email}`;
    const lockedUntilStr = await cache.get(lockKey);
    if (lockedUntilStr) {
      const lockedUntil = parseInt(lockedUntilStr, 10);
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1e3));
      if (remaining > 0) {
        return { allowed: false, lockTimeRemaining: remaining };
      }
    }
    const countKey = `attempts:account:${email}`;
    const countStr = await cache.get(countKey);
    const count = countStr ? parseInt(countStr, 10) : 0;
    if (count >= 10) {
      return { allowed: false, requiresEmailVerify: true };
    } else if (count >= SECURITY_CONFIG.ACCOUNT_LOCK_MAX_ATTEMPTS) {
      const lockDuration = SECURITY_CONFIG.ACCOUNT_LOCK_DURATION_S;
      await cache.set(lockKey, (Date.now() + lockDuration * 1e3).toString(), lockDuration);
      return { allowed: false, lockTimeRemaining: lockDuration };
    }
    let delayMs = 0;
    if (count === 5) delayMs = 2e3;
    else if (count === 6) delayMs = 4e3;
    else if (count === 7) delayMs = 8e3;
    else if (count === 8) delayMs = 16e3;
    return { allowed: true, delayMs };
  }
  // 3. Device protection evaluation
  static async checkDeviceLimit(deviceId) {
    if (!deviceId) return { allowed: true, captchaRequired: false };
    const deviceKey = `attempts:device:${deviceId}`;
    const count = await cache.incr(deviceKey, 86400);
    if (count >= 10) {
      return { allowed: true, captchaRequired: true };
    }
    try {
      const res = await query("SELECT captcha_required FROM public.device_security WHERE device_id = $1", [deviceId]);
      if (res.rows.length > 0 && res.rows[0].captcha_required) {
        return { allowed: true, captchaRequired: true };
      }
    } catch (e) {
    }
    return { allowed: true, captchaRequired: false };
  }
  // 4. Organization protection (failed logins monitoring across organization to prevent password spray)
  static async checkOrganizationLimit(orgId) {
    if (!orgId) return { allowed: true };
    const orgKey = `attempts:org:${orgId}`;
    const count = await cache.incr(orgKey, SECURITY_CONFIG.ORG_SPRAY_WINDOW_S);
    if (count >= SECURITY_CONFIG.ORG_SPRAY_MAX_ATTEMPTS) {
      await query(
        "INSERT INTO public.security_events (event_type, severity, details) VALUES ($1, $2, $3)",
        ["password_spray_org", "critical", JSON.stringify({ orgId, attempts: count })]
      );
      return { allowed: false };
    }
    return { allowed: true };
  }
  // 5. Dynamic risk scoring engine (0-100 scale)
  static async calculateRiskScore(details, isPasswordCorrect) {
    let score = 0;
    const reasons = [];
    const ua = details.userAgent || "";
    if (ua.includes("TorBrowser") || ua.includes("Tor/")) {
      score += 30;
      reasons.push("Tor Browser detected (+30)");
    }
    if (!isPasswordCorrect) {
      score += 10;
      reasons.push("Incorrect password (+10)");
    }
    const disposableDomains = ["mailinator.com", "trashmail.com", "yopmail.com", "tempmail.com"];
    const emailDomain = details.email.split("@")[1]?.toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      score += 30;
      reasons.push("Disposable email address domain detected (+30)");
    }
    try {
      const res = await query(
        "SELECT country, city, created_at FROM public.login_attempts WHERE email = $1 AND success = true ORDER BY created_at DESC LIMIT 1",
        [details.email]
      );
      if (res.rows.length > 0) {
        const lastLogin = res.rows[0];
        if (lastLogin.country && details.country && lastLogin.country !== details.country) {
          const timeDiffHours = (Date.now() - new Date(lastLogin.created_at).getTime()) / (1e3 * 60 * 60);
          if (timeDiffHours < 4) {
            score += 40;
            reasons.push(`Impossible travel detected: last login from ${lastLogin.city || lastLogin.country} ${timeDiffHours.toFixed(1)}h ago (+40)`);
          } else {
            score += 20;
            reasons.push("New country login (+20)");
          }
        }
      }
    } catch (e) {
    }
    return { score: Math.min(100, score), reasons };
  }
  // 6. Security Logging (excluding sensitive data)
  static async logAttempt(details, success, failureReason, riskScore = 0) {
    try {
      await query(
        `INSERT INTO public.login_attempts 
          (email, success, ip_address, device_id, platform, user_agent, country, city, failure_reason, risk_score, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          details.email,
          success,
          details.ip,
          details.deviceId || null,
          details.platform || null,
          details.userAgent || null,
          details.country || null,
          details.city || null,
          failureReason || null,
          riskScore,
          details.organizationId || null
        ]
      );
      const countKey = `attempts:account:${details.email}`;
      if (!success) {
        await cache.incr(countKey, 86400);
      } else {
        await cache.del(countKey);
        await cache.del(`lock:account:${details.email}`);
        if (details.deviceId) {
          await cache.del(`attempts:device:${details.deviceId}`);
        }
      }
    } catch (err) {
      console.error("[AuthProtection] Failed to log attempt:", err);
    }
  }
  // Helper to extract clean IP from proxy headers
  static getClientIp(req) {
    const trustedProxies = ["127.0.0.1", "::1"];
    let ip = req.ip || req.connection.remoteAddress || "";
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor && typeof xForwardedFor === "string") {
      const parts = xForwardedFor.split(",");
      const remoteIp = req.connection.remoteAddress || "";
      const isTrusted = trustedProxies.some((p) => remoteIp.includes(p));
      if (isTrusted || process.env.NODE_ENV !== "production") {
        ip = parts[0].trim();
      }
    }
    return ip;
  }
};

// server/security/authProxy.ts
init_redis();
init_validation();
import crypto from "crypto";
var supabaseUrl2 = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
var supabaseAnonKey2 = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
var supabase = createClient2(supabaseUrl2, supabaseAnonKey2, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    if (!isHttps) {
      return res.status(403).json({ error: "HTTPS connection required." });
    }
  }
  next();
}
function registerAuthProxyRoutes(app) {
  app.use("/api/auth/*", enforceHttps);
  app.post("/api/auth/login", validateBody(loginSchema), async (req, res) => {
    const startTime = Date.now();
    const { email, password, deviceId, userAgent, platform, fingerprint, captchaToken } = req.body;
    const ip = AuthProtectionService.getClientIp(req);
    const attemptDetails = {
      email,
      ip,
      deviceId,
      userAgent: userAgent || req.headers["user-agent"],
      platform,
      browserFingerprint: fingerprint
    };
    try {
      const ipCheck = await AuthProtectionService.checkIpLimit(ip);
      if (!ipCheck.allowed) {
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
          lockTimeRemaining: ipCheck.lockTimeRemaining
        });
      }
      const accountCheck = await AuthProtectionService.checkAccountLimit(email);
      if (!accountCheck.allowed) {
        if (accountCheck.requiresEmailVerify) {
          return res.status(423).json({
            error: "Too many login attempts. Please verify your email before logging in.",
            requiresEmailVerify: true
          });
        }
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
          lockTimeRemaining: accountCheck.lockTimeRemaining
        });
      }
      const deviceCheck = await AuthProtectionService.checkDeviceLimit(deviceId);
      const countVal = await cache.get(`attempts:account:${email}`);
      const isCaptchaTriggered = deviceCheck.captchaRequired || (countVal ? parseInt(countVal, 10) : 0) >= 5;
      if (isCaptchaTriggered) {
        if (!captchaToken) {
          return res.status(400).json({
            error: "Too many login attempts. Please complete verification.",
            captchaRequired: true
          });
        }
        if (captchaToken !== "VERIFIED_SLIDER_TOKEN") {
          return res.status(400).json({
            error: "Verification failed. Please try again.",
            captchaRequired: true
          });
        }
      }
      let organizationId;
      try {
        const userRes = await query("SELECT id FROM public.users WHERE email = $1 LIMIT 1", [email]);
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          const orgRes = await query("SELECT org_id FROM public.user_organizations WHERE user_id = $1 LIMIT 1", [userId]);
          if (orgRes.rows.length > 0) {
            organizationId = orgRes.rows[0].org_id;
          }
        }
      } catch (e) {
      }
      if (organizationId) {
        const orgCheck = await AuthProtectionService.checkOrganizationLimit(organizationId);
        if (!orgCheck.allowed) {
          return res.status(429).json({ error: "Too many login attempts. Please try again later." });
        }
      }
      if (accountCheck.delayMs && accountCheck.delayMs > 0) {
        await sleep(accountCheck.delayMs);
      }
      let authResult = await supabase.auth.signInWithPassword({ email, password });
      let authError = authResult.error;
      let data = authResult.data;
      let isLegacyUser = false;
      if (authError) {
        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
        const fallbackResult = await supabase.auth.signInWithPassword({ email, password: hashedPassword });
        if (!fallbackResult.error && fallbackResult.data.user && fallbackResult.data.session) {
          authResult = fallbackResult;
          authError = null;
          data = fallbackResult.data;
          isLegacyUser = true;
        }
      }
      let isSuccess = !authError && !!data.user && !!data.session;
      if (isSuccess && data.user && !data.user.email_confirmed_at) {
        isSuccess = false;
        authError = { message: "Please confirm your email address before logging in." };
        data = { user: null, session: null };
      }
      if (isSuccess && isLegacyUser && data.session) {
        const userClient2 = createClient2(supabaseUrl2, supabaseAnonKey2, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          },
          global: {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`
            }
          }
        });
        userClient2.auth.updateUser({ password }).catch((e) => {
          console.warn("[AuthProxy] Failed to upgrade legacy password in background:", e);
        });
      }
      const { score: riskScore } = await AuthProtectionService.calculateRiskScore(
        { ...attemptDetails, organizationId },
        isSuccess
      );
      await AuthProtectionService.logAttempt(
        { ...attemptDetails, organizationId },
        isSuccess,
        authError ? authError.message : void 0,
        riskScore
      );
      const duration = Date.now() - startTime;
      if (duration < 400) {
        await sleep(400 - duration);
      }
      if (!isSuccess || !data.session) {
        return res.status(400).json({ error: "Invalid email or password." });
      }
      const userClient = createClient2(supabaseUrl2, supabaseAnonKey2, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        }
      });
      const { data: mfaData } = await userClient.auth.mfa.listFactors();
      const activeFactor = mfaData?.totp?.find((f) => f.status === "verified");
      if (activeFactor) {
        const { data: challenge, error: challengeError } = await userClient.auth.mfa.challenge({
          factorId: activeFactor.id
        });
        if (!challengeError && challenge) {
          return res.json({
            success: true,
            mfaRequired: true,
            challengeId: challenge.id,
            factorId: activeFactor.id,
            tempSession: {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              user: data.session.user
            }
          });
        }
      }
      const isHighRisk = riskScore >= SECURITY_CONFIG.MFA_SCORE_THRESHOLD;
      if (isHighRisk) {
        return res.json({
          success: true,
          mfaRequired: true,
          tempSession: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.session.user
          }
        });
      }
      return res.json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.session.user,
          expires_at: data.session.expires_at
        }
      });
    } catch (err) {
      console.error("[AuthProxy] Login error:", err);
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  });
  app.post("/api/auth/mfa/verify", validateBody(mfaVerifySchema), async (req, res) => {
    const { code, challengeId, factorId, tempAccessToken } = req.body;
    try {
      const userClient = createClient2(supabaseUrl2, supabaseAnonKey2, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${tempAccessToken}`
          }
        }
      });
      const { data, error } = await userClient.auth.mfa.verify({
        challengeId: challengeId || void 0,
        factorId: factorId || void 0,
        code
      });
      if (error || !data) {
        return res.status(400).json({ error: error ? error.message : "MFA verification failed." });
      }
      return res.json({
        success: true,
        session: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
          expires_at: Math.floor(Date.now() / 1e3) + 3600
        }
      });
    } catch (err) {
      console.error("[MfaProxy] MFA verification error:", err);
      return res.status(500).json({ error: "MFA verification failed." });
    }
  });
  app.post("/api/auth/refresh", validateBody(refreshTokenSchema), async (req, res) => {
    const { refresh_token } = req.body;
    const ip = AuthProtectionService.getClientIp(req);
    const refreshKey = `rate:refresh:${ip}`;
    const attempts = await cache.incr(refreshKey, 60);
    if (attempts > 30) {
      return res.status(429).json({ error: "Too many refresh requests. Please try again later." });
    }
    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token });
      if (error || !data.session) {
        return res.status(401).json({ error: error ? error.message : "Invalid session." });
      }
      return res.json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.session.user,
          expires_at: data.session.expires_at
        }
      });
    } catch (err) {
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });
  app.post("/api/auth/forgot-password", validateBody(forgotPasswordSchema), async (req, res) => {
    const { email } = req.body;
    const ip = AuthProtectionService.getClientIp(req);
    const key = `rate:forgot:${ip}`;
    const count = await cache.incr(key, 3600);
    if (count > 3) {
      return res.status(429).json({ error: "Too many reset requests. Please try again later." });
    }
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "manuscoreflowapp://oauth/callback"
      });
      return res.json({ success: true, message: "If the email exists, a password reset link has been sent." });
    } catch (err) {
      return res.json({ success: true, message: "If the email exists, a password reset link has been sent." });
    }
  });
}

// server/_core/systemRouter.ts
init_notification();
import { z as z2 } from "zod";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/meetings/meetings.routes.ts
import { Router } from "express";

// server/meetings/meetings.service.ts
import { createClient as createClient4 } from "@supabase/supabase-js";
import crypto2 from "crypto";
var supabaseClient2 = null;
function getSupabase() {
  if (!supabaseClient2) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for meetings service");
    supabaseClient2 = createClient4(
      process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient2;
}
var MeetingsService = class {
  static async createMeeting(data) {
    const meetingId = crypto2.randomUUID();
    const roomName = `coreflow-${meetingId}`;
    const { data: meeting, error } = await getSupabase().from("meetings").insert({
      id: meetingId,
      host_id: data.hostId,
      workspace_id: data.workspaceId === "independent" ? null : data.workspaceId,
      title: data.title,
      description: data.description,
      start_time: data.startTime,
      end_time: data.endTime,
      room_name: roomName,
      status: "scheduled"
    }).select().single();
    if (error) throw error;
    const { error: settingsError } = await getSupabase().from("meeting_settings").insert({
      meeting_id: meeting.id,
      ...data.settings
    });
    if (settingsError) throw settingsError;
    await getSupabase().from("meeting_participants").insert({
      meeting_id: meeting.id,
      user_id: data.hostId,
      role: "host",
      can_share_screen: true,
      can_record: true,
      can_present: true,
      can_invite: true
    });
    return meeting;
  }
  static async getMeetingById(id) {
    const { data, error } = await getSupabase().from("meetings").select("*, meeting_settings(*)").eq("id", id).single();
    if (error) throw error;
    return data;
  }
  static async trackParticipant(meetingId, userId, hostId) {
    const isHost = userId === hostId;
    const { data, error } = await getSupabase().from("meeting_participants").select("*").eq("meeting_id", meetingId).eq("user_id", userId).single();
    if (!data) {
      const { data: newParticipant } = await getSupabase().from("meeting_participants").insert({
        meeting_id: meetingId,
        user_id: userId,
        status: "joined",
        role: isHost ? "host" : "attendee",
        admission_status: isHost ? "admitted" : "waiting"
        // host doesn't wait
      }).select().single();
      return newParticipant;
    } else {
      let updates = { status: "joined", joined_at: (/* @__PURE__ */ new Date()).toISOString() };
      if (isHost && data.role !== "host") {
        updates.role = "host";
        updates.admission_status = "admitted";
      } else if (data.admission_status === "none" && data.role !== "host") {
        updates.admission_status = "waiting";
      }
      const { data: updatedParticipant } = await getSupabase().from("meeting_participants").update(updates).eq("id", data.id).select().single();
      return updatedParticipant;
    }
  }
  static async inviteUser(meetingId, userId, hostId) {
    const { data, error } = await getSupabase().from("meeting_invitations").insert({
      meeting_id: meetingId,
      user_id: userId,
      invited_by: hostId
    }).select().single();
    if (error) throw error;
    return data;
  }
  static async updateInvitationStatus(meetingId, userId, status) {
    const { data, error } = await getSupabase().from("meeting_invitations").update({ status, accepted_at: status === "accepted" ? (/* @__PURE__ */ new Date()).toISOString() : null }).eq("meeting_id", meetingId).eq("user_id", userId).select().single();
    if (error) throw error;
    await getSupabase().from("meeting_participants").update({ status }).eq("meeting_id", meetingId).eq("user_id", userId);
    return data;
  }
  static getSupabase() {
    return getSupabase();
  }
  static async getInvitation(meetingId, userId) {
    const { data, error } = await getSupabase().from("meeting_invitations").select("*").eq("meeting_id", meetingId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  }
};

// server/meetings/livekit.service.ts
import { AccessToken, RoomServiceClient, WebhookReceiver, EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
var LiveKitService = class {
  static async generateToken(roomName, participantId, participantName, permissions) {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";
    if (!apiKey || !apiSecret) {
      console.warn("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing. Generating a dummy token.");
      return "dummy_token_for_" + participantId;
    }
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: permissions.canPublishData
    });
    return await at.toJwt();
  }
  static async verifyWebhook(body, authHeader) {
    const receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );
    const event = receiver.receive(body, authHeader);
    return event;
  }
  static async endRoom(roomName) {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";
    const wsUrl = process.env.LIVEKIT_URL || "https://coreflow-eo6z5wme.livekit.cloud";
    if (!apiKey || !apiSecret) {
      console.warn("LIVEKIT_API_KEY or secret missing, cannot end room.");
      return;
    }
    const roomService = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    try {
      await roomService.deleteRoom(roomName);
      console.log(`Successfully ended LiveKit room: ${roomName}`);
    } catch (e) {
      console.warn(`Could not end LiveKit room ${roomName}:`, e.message);
    }
  }
  static async startRecording(roomName) {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";
    const wsUrl = process.env.LIVEKIT_URL || "https://coreflow-eo6z5wme.livekit.cloud";
    if (!apiKey || !apiSecret) {
      throw new Error("LIVEKIT_API_KEY or secret missing, cannot start egress.");
    }
    const egressClient = new EgressClient(wsUrl, apiKey, apiSecret);
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `recordings/${roomName}-${Date.now()}.mp4`
    });
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput
      },
      {
        layout: "grid"
      }
    );
    return egressInfo.egressId;
  }
  static async stopRecording(egressId) {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";
    const wsUrl = process.env.LIVEKIT_URL || "https://coreflow-eo6z5wme.livekit.cloud";
    const egressClient = new EgressClient(wsUrl, apiKey, apiSecret);
    await egressClient.stopEgress(egressId);
  }
};

// server/meetings/meetings.controller.ts
var MeetingsController = class {
  static async createMeeting(req, res) {
    try {
      const { user } = req;
      const { title, description, startTime, endTime, settings } = req.body;
      const workspaceId = req.headers["x-workspace-id"];
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" });
      }
      const meeting = await MeetingsService.createMeeting({
        hostId: user.id,
        workspaceId,
        title,
        description,
        startTime,
        endTime,
        settings
      });
      res.status(201).json({ meeting });
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  }
  static async getMeetingDetails(req, res) {
    try {
      const { id } = req.params;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      res.json({ meeting });
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  }
  static async joinMeeting(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.status !== "scheduled" && meeting.status !== "active") {
        return res.status(403).json({ error: "Meeting is not available to join" });
      }
      const isHost = meeting.host_id === user.id;
      if (!isHost) {
        const invitation = await MeetingsService.getInvitation(meeting.id, user.id);
        if (!invitation) {
          return res.status(403).json({ error: "You are not invited to this meeting" });
        }
        if (invitation.status !== "accepted") {
          return res.status(403).json({ error: "You must accept the invitation before joining" });
        }
        if (meeting.is_locked) {
          return res.status(403).json({ error: "Meeting is locked" });
        }
      }
      if (!isHost) {
        const { data: hostParticipant } = await MeetingsService.getSupabase().from("meeting_participants").select("admission_status, status").eq("meeting_id", meeting.id).eq("user_id", meeting.host_id).eq("status", "joined").maybeSingle();
        if (!hostParticipant || hostParticipant.admission_status !== "admitted") {
          await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
          return res.status(400).json({ error: "waiting_room", details: "Waiting for the host to join the meeting" });
        }
      }
      const participant = await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
      if (!isHost && participant && participant.admission_status === "waiting") {
        return res.status(400).json({ error: "waiting_room", details: "Waiting for host approval to enter the room" });
      }
      const participantName = user.user_metadata?.full_name || user.email;
      const token = await LiveKitService.generateToken(
        meeting.room_name,
        user.id,
        participantName,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true
        }
      );
      res.json({ token, roomUrl: process.env.LIVEKIT_URL || "wss://coreflow-eo6z5wme.livekit.cloud" });
    } catch (error) {
      console.error("Error joining meeting:", error);
      res.status(500).json({ error: "Failed to join meeting", details: error?.message || String(error) });
    }
  }
  static async inviteUser(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { userId } = req.body;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: "Only the host can invite users" });
      }
      const invitation = await MeetingsService.inviteUser(meeting.id, userId, user.id);
      res.status(201).json({ invitation });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ error: "Failed to invite user" });
    }
  }
  static async acceptInvitation(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const invitation = await MeetingsService.updateInvitationStatus(id, user.id, "accepted");
      res.json({ invitation });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  }
  static async declineInvitation(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const invitation = await MeetingsService.updateInvitationStatus(id, user.id, "declined");
      res.json({ invitation });
    } catch (error) {
      console.error("Error declining invitation:", error);
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  }
  static async startRecording(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: "Only the host can record meetings" });
      }
      const egressId = await LiveKitService.startRecording(meeting.room_name);
      res.json({ egressId, message: "Recording started" });
    } catch (error) {
      console.error("Error starting recording:", error);
      res.status(500).json({ error: "Failed to start recording", details: error.message });
    }
  }
  static async stopRecording(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { egressId } = req.body;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: "Only the host can stop recordings" });
      }
      await LiveKitService.stopRecording(egressId);
      res.json({ message: "Recording stopped" });
    } catch (error) {
      console.error("Error stopping recording:", error);
      res.status(500).json({ error: "Failed to stop recording", details: error.message });
    }
  }
  static async getNotes(req, res) {
    try {
      const { id } = req.params;
      const { data, error } = await MeetingsService.getSupabase().from("meeting_notes").select("*").eq("meeting_id", id).maybeSingle();
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      res.json({ notes: data || { content: "" } });
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  }
  static async saveNotes(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { content } = req.body;
      const { data, error } = await MeetingsService.getSupabase().from("meeting_notes").upsert(
        {
          meeting_id: id,
          content,
          updated_by: user.id,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "meeting_id" }
      ).select().single();
      if (error) throw error;
      res.json({ notes: data });
    } catch (error) {
      console.error("Error saving notes:", error);
      res.status(500).json({ error: "Failed to save notes" });
    }
  }
  static async liveKitWebhook(req, res) {
    try {
      const event = await LiveKitService.verifyWebhook(req.body, req.headers.authorization);
      console.log("Received LiveKit event:", event);
      if (event.event === "egress_ended") {
        const egressInfo = event.egressInfo;
        const roomName = egressInfo?.roomName;
        const fileUrl = egressInfo?.fileResults?.[0]?.location || egressInfo?.file?.location;
        const durationSeconds = egressInfo?.updatedAt && egressInfo?.startedAt ? Math.floor((Number(egressInfo.updatedAt) - Number(egressInfo.startedAt)) / 1e9) : 0;
        if (roomName && fileUrl) {
          const { data: meeting } = await MeetingsService.getSupabase().from("meetings").select("id").eq("room_name", roomName).maybeSingle();
          if (meeting) {
            await MeetingsService.getSupabase().from("meeting_recordings").insert({
              meeting_id: meeting.id,
              file_url: fileUrl,
              duration: durationSeconds,
              resolution: "720p",
              file_size: egressInfo?.fileResults?.[0]?.size || egressInfo?.file?.size || 0,
              recording_status: "completed",
              started_at: egressInfo?.startedAt ? new Date(Number(egressInfo.startedAt) / 1e6).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
              finished_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            console.log(`Saved recording for room ${roomName} to Supabase.`);
          }
        }
      }
      res.status(200).send();
    } catch (error) {
      console.error("LiveKit Webhook error:", error);
      res.status(400).json({ error: "Invalid webhook" });
    }
  }
};

// server/meetings/meetings.routes.ts
import { createClient as createClient5 } from "@supabase/supabase-js";
var router2 = Router();
var supabaseUrl3 = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey3 = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
var supabase2 = createClient5(supabaseUrl3, supabaseAnonKey3);
var requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    if (!token) throw new Error("No token provided");
    const { data: { user }, error } = await supabase2.auth.getUser(token);
    if (error || !user) throw new Error("Invalid token");
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
router2.post("/", requireAuth, MeetingsController.createMeeting);
router2.get("/:id", requireAuth, MeetingsController.getMeetingDetails);
router2.post("/:id/join", requireAuth, MeetingsController.joinMeeting);
router2.post("/:id/invite", requireAuth, MeetingsController.inviteUser);
router2.post("/:id/invitations/accept", requireAuth, MeetingsController.acceptInvitation);
router2.post("/:id/invitations/decline", requireAuth, MeetingsController.declineInvitation);
router2.post("/:id/record/start", requireAuth, MeetingsController.startRecording);
router2.post("/:id/record/stop", requireAuth, MeetingsController.stopRecording);
router2.get("/:id/notes", requireAuth, MeetingsController.getNotes);
router2.post("/:id/notes", requireAuth, MeetingsController.saveNotes);
router2.post("/webhook/livekit", MeetingsController.liveKitWebhook);
var meetings_routes_default = router2;

// server/_core/cron.ts
import { createClient as createClient6 } from "@supabase/supabase-js";
var supabaseClient3 = null;
function getSupabase2() {
  if (!supabaseClient3) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for cron");
    supabaseClient3 = createClient6(
      process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient3;
}
function startCronJobs() {
  console.log("[Cron] Starting background jobs...");
  setInterval(async () => {
    try {
      const supabase3 = getSupabase2();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data: expiredMeetings, error } = await supabase3.from("meetings").select("id, room_name").lt("end_time", now).in("status", ["scheduled", "active"]);
      if (error) {
        console.error("[Cron] Error fetching expired meetings:", error);
        return;
      }
      if (!expiredMeetings || expiredMeetings.length === 0) {
        return;
      }
      for (const meeting of expiredMeetings) {
        const { error: updateError } = await supabase3.from("meetings").update({
          status: "completed",
          ended_at: now
        }).eq("id", meeting.id);
        if (updateError) {
          console.error(`[Cron] Failed to complete meeting ${meeting.id}:`, updateError);
          continue;
        }
        console.log(`[Cron] Automatically completed expired meeting: ${meeting.id}`);
        await supabase3.channel(`meeting-${meeting.id}`).send({
          type: "broadcast",
          event: "meeting_completed",
          payload: { meetingId: meeting.id }
        });
        await LiveKitService.endRoom(meeting.room_name);
      }
    } catch (err) {
      console.error("[Cron] Unexpected error in meeting expiration job:", err);
    }
  }, 60 * 1e3);
}

// server/_core/app.ts
function createExpressApp() {
  startCronJobs();
  if (!process.env.JWT_SECRET && process.env.SUPABASE_JWT_SECRET) {
    process.env.JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
  }
  const mandatorySecrets = [
    "DATABASE_URL",
    "JWT_SECRET"
  ];
  for (const secret of mandatorySecrets) {
    if (!process.env[secret]) {
      throw new Error(`[CRITICAL] Server startup failed: Missing mandatory environment variable "${secret}".`);
    }
  }
  if (!process.env.BUILT_IN_FORGE_API_URL || !process.env.BUILT_IN_FORGE_API_KEY) {
    console.warn("[WARN] Optional AI features (voice transcription, image generation) are disabled: BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY is missing.");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("X-XSS-Protection", "0");
    res.header("Referrer-Policy", "no-referrer");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const { sanitizationMiddleware: sanitizationMiddleware2 } = (init_validation(), __toCommonJS(validation_exports));
  app.use(sanitizationMiddleware2);
  const { globalRateLimiter: globalRateLimiter2 } = (init_rateLimit(), __toCommonJS(rateLimit_exports));
  app.use(globalRateLimiter2);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthProxyRoutes(app);
  app.use("/api/meetings", meetings_routes_default);
  app.post("/api/notifications/send-push", async (req, res) => {
    const authHeader = req.headers.authorization;
    const authSecret = "cf_internal_push_secret_2026";
    if (!authHeader || authHeader !== `Bearer ${authSecret}`) {
      res.status(401).json({ error: "Unauthorized access" });
      return;
    }
    const { id, user_id, title, message, type, entity_type, entity_id, action_url, sender_id } = req.body;
    if (!id || !user_id || !title || !message) {
      res.status(400).json({ error: "Missing required payload parameters" });
      return;
    }
    const { dispatchFCMPush: dispatchFCMPush2 } = (init_notification(), __toCommonJS(notification_exports));
    await dispatchFCMPush2({
      id,
      userId: user_id,
      title,
      message,
      type,
      entityType: entity_type,
      entityId: entity_id,
      actionUrl: action_url,
      senderId: sender_id || void 0
    });
    res.json({ success: true, status: "queued" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  return app;
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = createExpressApp();
  const server = createServer(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}
startServer().catch(console.error);
