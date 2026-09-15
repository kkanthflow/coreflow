var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
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
import pg from "pg";

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

// server/_core/env.ts
var ENV = {
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

// server/db.ts
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
import ws from "ws";

// server/security/redis.ts
var MemoryCache = class {
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
var redisClient = null;
var useMemoryFallback = true;
var REDIS_URL = process.env.REDIS_URL;
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
var memoryStore = new MemoryCache();
var cache = {
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
import crypto from "crypto";

// server/security/validation.ts
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
var loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  deviceId: z.string().max(255).optional(),
  platform: z.string().max(100).optional(),
  fingerprint: z.string().max(255).optional(),
  captchaToken: z.string().max(255).optional()
}).strict();
var mfaVerifySchema = z.object({
  code: z.string().length(6),
  challengeId: z.string().uuid().nullable().optional(),
  factorId: z.string().max(255).optional(),
  tempAccessToken: z.string().max(2048)
}).strict();
var refreshTokenSchema = z.object({
  refresh_token: z.string().max(2048)
}).strict();
var forgotPasswordSchema = z.object({
  email: z.string().email().max(255)
}).strict();

// server/security/authProxy.ts
var supabaseUrl2 = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
var supabaseAnonKey2 = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
var supabase = createClient2(supabaseUrl2, supabaseAnonKey2, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: ws
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
import { z as z2 } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// server/_core/supabase.ts
import { createClient as createClient3 } from "@supabase/supabase-js";
import ws2 from "ws";
if (!ENV.supabaseUrl) {
  console.warn("Supabase URL is missing in environment variables.");
}
if (!ENV.supabaseServiceRoleKey || ENV.supabaseServiceRoleKey === "placeholder-key" || ENV.supabaseServiceRoleKey === "[SENSITIVE]") {
  console.warn("Supabase Service Role Key is missing in environment variables.");
}
var supabaseAdmin = createClient3(
  ENV.supabaseUrl || "https://rltygdzldplkmwuqfadm.supabase.co",
  ENV.supabaseServiceRoleKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIwMzk1NSwiZXhwIjoyMDk2Nzc5OTU1fQ.zsR3c5QISHMSo9MgsaWCLVaeEBs5gZIlQ8eue4eF12o",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    realtime: {
      transport: ws2
    }
  }
);

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
};
var validatePayload = (input) => {
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
  return supabaseAdmin;
}
var fcmApp = null;
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
    const possiblePaths = [
      path2.join(process.cwd(), "coreflow-2af5c-cc11e0599b34.json"),
      path2.join(__dirname, "../coreflow-2af5c-cc11e0599b34.json"),
      path2.join(__dirname, "../../coreflow-2af5c-cc11e0599b34.json")
    ];
    const localKeyPath = possiblePaths.find((p) => fs.existsSync(p));
    if (localKeyPath) {
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
var PushQueue = class {
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
var pushQueue = new PushQueue();
async function dispatchFCMPush(data) {
  const supabase4 = getSupabaseAdmin();
  const app = getFirebaseApp();
  if (!app) {
    console.error("[FCM] Firebase app is not initialized. Cannot dispatch push.");
    await supabase4.from("notifications").update({ delivery_status: "failed", delivery_error: "Firebase app not initialized" }).eq("id", data.id);
    return;
  }
  const messaging = getMessaging(app);
  try {
    const { data: prefRows } = await supabase4.from("notification_preferences").select("chat_enabled, meetings_enabled, tasks_enabled, finance_enabled, announcements_enabled").eq("user_id", data.userId);
    if (prefRows && prefRows.length > 0) {
      const pref = prefRows[0];
      const isChatDisabled = data.type === "chat" && !pref.chat_enabled;
      const isMeetingDisabled = data.type === "meeting" && !pref.meetings_enabled;
      const isTaskDisabled = data.type === "task" && !pref.tasks_enabled;
      const isFinanceDisabled = data.type === "finance" && !pref.finance_enabled;
      const isAnnouncementDisabled = data.type === "announcements" && !pref.announcements_enabled;
      if (isChatDisabled || isMeetingDisabled || isTaskDisabled || isFinanceDisabled || isAnnouncementDisabled) {
        console.log(`[FCM] Notification skipped for user ${data.userId} due to preference settings.`);
        await supabase4.from("notifications").update({ delivery_status: "failed", delivery_error: "Skipped by preferences" }).eq("id", data.id);
        return;
      }
    }
    let query2 = supabase4.from("user_push_tokens").select("token, device_id, platform").eq("user_id", data.userId).eq("is_enabled", true);
    if (data.senderId && data.senderId !== data.userId) {
      const { data: senderTokens } = await supabase4.from("user_push_tokens").select("token").eq("user_id", data.senderId);
      if (senderTokens && senderTokens.length > 0) {
        const excludeTokens = senderTokens.map((t2) => t2.token);
        query2 = query2.not("token", "in", excludeTokens);
      }
    }
    const { data: deviceTokens } = await query2;
    const tokens = (deviceTokens || []).map((t2) => t2.token);
    if (!tokens || tokens.length === 0) {
      console.log(`[FCM] No devices found for user ${data.userId}`);
      await supabase4.from("notifications").update({ delivery_status: "failed", delivery_error: "No active device tokens found" }).eq("id", data.id);
      return;
    }
    const { data: nData } = await supabase4.from("notifications").select("delivery_attempts").eq("id", data.id).single();
    const attempts = (nData?.delivery_attempts || 0) + 1;
    await supabase4.from("notifications").update({ delivery_status: "sending", delivery_attempts: attempts }).eq("id", data.id);
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
      await supabase4.from("user_push_tokens").delete().in("token", tokensToDelete);
    }
    const successCount = response.successCount;
    if (successCount > 0) {
      await supabase4.from("notifications").update({ delivery_status: "delivered", delivery_error: null }).eq("id", data.id);
    } else {
      await supabase4.from("notifications").update({ delivery_status: "failed", delivery_error: "All token dispatches failed" }).eq("id", data.id);
    }
  } catch (err) {
    console.error("[FCM] Critical push dispatch failure:", err);
    await supabase4.from("notifications").update({ delivery_status: "failed", delivery_error: err.message || "Unknown error" }).eq("id", data.id);
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
import crypto2 from "crypto";
function getSupabase() {
  return supabaseAdmin;
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
      admission_status: "admitted",
      status: "invited",
      can_share_screen: true,
      can_record: true,
      can_present: true,
      can_invite: true
    });
    return meeting;
  }
  static async getMeetingById(id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query2 = getSupabase().from("meetings").select("*, meeting_settings(*)");
    if (isUuid) {
      query2 = query2.or(`id.eq.${id},room_name.eq.${id}`);
    } else {
      query2 = query2.eq("room_name", id);
    }
    const { data, error } = await query2.maybeSingle();
    if (error) throw error;
    return data;
  }
  static async trackParticipant(meetingId, userId, hostId) {
    const isHost = userId === hostId;
    const { data } = await getSupabase().from("meeting_participants").select("*").eq("meeting_id", meetingId).eq("user_id", userId).maybeSingle();
    if (!data) {
      const { data: newParticipant } = await getSupabase().from("meeting_participants").insert({
        meeting_id: meetingId,
        user_id: userId,
        status: "joined",
        role: isHost ? "host" : "attendee",
        admission_status: isHost ? "admitted" : "waiting",
        // host doesn't wait
        joined_at: (/* @__PURE__ */ new Date()).toISOString()
      }).select().single();
      return newParticipant;
    } else {
      let updates = {
        status: "joined",
        joined_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (isHost) {
        updates.role = "host";
        updates.admission_status = "admitted";
      } else if (!data.admission_status || data.admission_status === "none") {
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
        if (!hostParticipant || hostParticipant.status !== "joined" || hostParticipant.admission_status !== "admitted") {
          await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
          return res.status(400).json({ error: "waiting_room", details: "Waiting for the host to join the meeting" });
        }
      }
      const participant = await MeetingsService.trackParticipant(meeting.id, user.id, meeting.host_id);
      if (!isHost && participant && participant.admission_status === "waiting") {
        return res.status(400).json({ error: "waiting_room", details: "Waiting for host approval to enter the room" });
      }
      const participantName = user.user_metadata?.full_name || user.user_metadata?.org_name || user.email || "Guest";
      const safeRoomName = meeting.room_name || `coreflow-${meeting.id}`;
      const token = await LiveKitService.generateToken(
        safeRoomName,
        user.id,
        participantName,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true
        }
      );
      let roomUrl = process.env.LIVEKIT_URL || "wss://coreflow-eo6z5wme.livekit.cloud";
      roomUrl = roomUrl.replace(/^["']|["']$/g, "").trim();
      res.json({ token, roomUrl });
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
  static async endMeeting(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: "Only the host can end the meeting" });
      }
      await MeetingsService.getSupabase().from("meetings").update({ status: "completed" }).eq("id", meeting.id);
      await LiveKitService.endRoom(meeting.room_name);
      res.json({ message: "Meeting ended successfully" });
    } catch (error) {
      console.error("Error ending meeting:", error);
      res.status(500).json({ error: "Failed to end meeting" });
    }
  }
  static async admitParticipant(req, res) {
    try {
      const { user } = req;
      const { id, userId } = req.params;
      const meeting = await MeetingsService.getMeetingById(id);
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.host_id !== user.id) {
        return res.status(403).json({ error: "Only the host can admit participants" });
      }
      await MeetingsService.getSupabase().from("meeting_participants").update({ admission_status: "admitted" }).eq("meeting_id", meeting.id).eq("user_id", userId);
      res.json({ message: "Participant admitted successfully" });
    } catch (error) {
      console.error("Error admitting participant:", error);
      res.status(500).json({ error: "Failed to admit participant" });
    }
  }
  static async liveKitWebhook(req, res) {
    try {
      const event = await LiveKitService.verifyWebhook(req.body, req.headers.authorization);
      console.log("Received LiveKit event:", event);
      if (event.event === "participant_left") {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;
        if (roomName && identity) {
          const { data: meeting } = await MeetingsService.getSupabase().from("meetings").select("id, host_id").eq("room_name", roomName).maybeSingle();
          if (meeting) {
            if (meeting.host_id === identity) {
              await MeetingsService.getSupabase().from("meetings").update({ status: "completed" }).eq("id", meeting.id);
              console.log(`Host left, marked meeting ${meeting.id} as completed.`);
            }
            await MeetingsService.getSupabase().from("meeting_participants").update({ status: "left" }).eq("meeting_id", meeting.id).eq("user_id", identity);
          }
        }
      } else if (event.event === "room_finished") {
        const roomName = event.room?.name;
        if (roomName) {
          const { data: meeting } = await MeetingsService.getSupabase().from("meetings").select("id").eq("room_name", roomName).maybeSingle();
          if (meeting) {
            await MeetingsService.getSupabase().from("meetings").update({ status: "completed" }).eq("id", meeting.id);
            console.log(`Room finished, marked meeting ${meeting.id} as completed.`);
          }
        }
      } else if (event.event === "egress_ended") {
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
import { createClient as createClient4 } from "@supabase/supabase-js";
import ws3 from "ws";
var router2 = Router();
var supabaseUrl3 = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey3 = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
var supabase2 = createClient4(supabaseUrl3, supabaseAnonKey3, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: ws3
  }
});
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
router2.post("/:id/end", requireAuth, MeetingsController.endMeeting);
router2.post("/:id/participants/:userId/admit", requireAuth, MeetingsController.admitParticipant);
router2.post("/:id/record/start", requireAuth, MeetingsController.startRecording);
router2.post("/:id/record/stop", requireAuth, MeetingsController.stopRecording);
router2.get("/:id/notes", requireAuth, MeetingsController.getNotes);
router2.post("/:id/notes", requireAuth, MeetingsController.saveNotes);
router2.post("/webhook/livekit", MeetingsController.liveKitWebhook);
var meetings_routes_default = router2;

// server/causality/causality.routes.ts
import { Router as Router2 } from "express";

// server/causality/causality.service.ts
var CausalityService = class {
  /**
   * Helper: Ensure baseline commitment V1 exists for a project. If not, auto-seed from project properties.
   */
  static async ensureBaselineCommitment(projectId, userId) {
    const { data: existing } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true }).limit(1);
    if (existing && existing.length > 0) return existing[0];
    const { data: project } = await supabaseAdmin.from("projects").select("*").eq("id", projectId).single();
    if (!project) throw new Error("Project not found");
    const defaultDelivery = project.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    let dynamicCost = Number(project.budget || 0);
    if (dynamicCost === 0) {
      const { data: inv } = await supabaseAdmin.from("invoices").select("total_amount").eq("project_id", projectId).limit(1);
      if (inv && inv.length > 0 && inv[0].total_amount) {
        dynamicCost = Number(inv[0].total_amount);
      }
    }
    const { data: tasks } = await supabaseAdmin.from("tasks").select("id, title").eq("project_id", projectId);
    const initialScopeCount = tasks ? tasks.length : 0;
    const { data: baseline, error } = await supabaseAdmin.from("project_commitments").insert({
      project_id: projectId,
      version_number: 1,
      total_cost: dynamicCost,
      currency: "INR",
      delivery_date: defaultDelivery,
      scope_count: initialScopeCount,
      change_reason: "Initial Baseline Commitment Agreement",
      requested_by: project.created_by || userId,
      approved_by: project.owner_id || userId,
      approved_at: project.created_at || (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) {
      console.error("Error creating baseline commitment:", error);
    }
    await supabaseAdmin.from("project_events").insert({
      project_id: projectId,
      event_type: "PROJECT_CREATED",
      actor_id: userId,
      title: "Project Initialized & Baseline Sealed",
      description: `Baseline V1 established with ${initialScopeCount} deliverables and delivery date of ${defaultDelivery}`,
      visibility: "CLIENT_VISIBLE",
      impact_summary: { cost: dynamicCost, deliveryDate: defaultDelivery, scope: initialScopeCount }
    });
    return baseline;
  }
  /**
   * 1. WHY DELIVERY (Deterministic Schedule Causality)
   */
  static async explainDelivery(projectId, userId) {
    await this.ensureBaselineCommitment(projectId, userId);
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true });
    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;
    const { data: acceptedCRs } = await supabaseAdmin.from("project_change_requests").select("*").eq("project_id", projectId).eq("status", "accepted").order("decided_at", { ascending: true });
    const { data: events2 } = await supabaseAdmin.from("project_events").select("*").eq("project_id", projectId).in("visibility", ["CLIENT_VISIBLE", "CLIENT_ACTION_REQUIRED"]).order("occurred_at", { ascending: true });
    const adjustments = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      daysDelta: cr.schedule_impact_days,
      reason: cr.description,
      requestedBy: cr.requester_type,
      approvedAt: cr.decided_at,
      impact: `+${cr.schedule_impact_days} Days`
    }));
    return {
      projectId,
      baselineDate: baseline?.delivery_date,
      currentDeliveryDate: latest?.delivery_date,
      totalScheduleDeltaDays: (acceptedCRs || []).reduce((sum, cr) => sum + (cr.schedule_impact_days || 0), 0),
      adjustments,
      hasSufficientData: !!baseline,
      events: events2 || []
    };
  }
  /**
   * 2. WHY COST (Deterministic Project Value Causality)
   */
  static async explainCost(projectId, userId) {
    await this.ensureBaselineCommitment(projectId, userId);
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true });
    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;
    const { data: acceptedCRs } = await supabaseAdmin.from("project_change_requests").select("*").eq("project_id", projectId).eq("status", "accepted").order("decided_at", { ascending: true });
    const costSteps = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      costDelta: cr.cost_impact,
      formattedDelta: `${cr.cost_impact >= 0 ? "+" : "-"}\u20B9${Math.abs(Number(cr.cost_impact)).toLocaleString("en-IN")}`,
      approvedAt: cr.decided_at,
      reason: cr.description
    }));
    return {
      projectId,
      currency: baseline?.currency || "INR",
      baselineCost: Number(baseline?.total_cost || 0),
      currentCost: Number(latest?.total_cost || 0),
      totalCostDelta: Number(latest?.total_cost || 0) - Number(baseline?.total_cost || 0),
      costSteps,
      commitmentVersions: commitments || [],
      hasSufficientData: !!baseline
    };
  }
  /**
   * 3. WHY PROGRESS (Deterministic Weighted Calculation)
   */
  static async explainProgress(projectId, userId) {
    const { data: milestones } = await supabaseAdmin.from("project_milestones").select("*").eq("project_id", projectId).order("order_index", { ascending: true });
    const { data: tasks } = await supabaseAdmin.from("tasks").select("id, title, status, milestone_id, estimated_hours, actual_hours").eq("project_id", projectId);
    const taskList = tasks || [];
    const milestoneList = milestones || [];
    if (taskList.length === 0 && milestoneList.length === 0) {
      return {
        projectId,
        overallProgress: 0,
        hasSufficientData: false,
        breakdown: [],
        message: "Insufficient recorded project data to explain this value."
      };
    }
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let breakdown = [];
    if (milestoneList.length > 0) {
      const perMilestoneWeight = 100 / milestoneList.length;
      breakdown = milestoneList.map((m) => {
        const mTasks = taskList.filter((t2) => t2.milestone_id === m.id);
        const doneCount = mTasks.filter((t2) => t2.status === "done").length;
        const milestoneProgress = m.completed ? 100 : mTasks.length > 0 ? Math.round(doneCount / mTasks.length * 100) : 0;
        const weightedContrib = milestoneProgress * perMilestoneWeight / 100;
        totalWeightedScore += weightedContrib;
        totalWeight += perMilestoneWeight;
        return {
          id: m.id,
          title: m.title,
          weight: Math.round(perMilestoneWeight),
          progress: milestoneProgress,
          completed: m.completed || milestoneProgress === 100,
          tasksCount: mTasks.length,
          tasksCompleted: doneCount,
          tasks: mTasks.map((t2) => ({ id: t2.id, title: t2.title, status: t2.status }))
        };
      });
    } else {
      const doneCount = taskList.filter((t2) => t2.status === "done").length;
      const progress = Math.round(doneCount / taskList.length * 100);
      totalWeightedScore = progress;
      breakdown = [
        {
          id: "general-work",
          title: "Project Deliverables & Execution",
          weight: 100,
          progress,
          completed: progress === 100,
          tasksCount: taskList.length,
          tasksCompleted: doneCount,
          tasks: taskList.map((t2) => ({ id: t2.id, title: t2.title, status: t2.status }))
        }
      ];
    }
    const overallProgress = Math.min(100, Math.round(totalWeightedScore));
    return {
      projectId,
      overallProgress,
      breakdown,
      totalTasks: taskList.length,
      completedTasks: taskList.filter((t2) => t2.status === "done").length,
      hasSufficientData: true
    };
  }
  /**
   * 4. WHY SCOPE (Deterministic Scope Traceability)
   */
  static async explainScope(projectId, userId) {
    await this.ensureBaselineCommitment(projectId, userId);
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true });
    const baseline = commitments?.[0];
    const latest = commitments?.[commitments.length - 1] || baseline;
    const { data: acceptedCRs } = await supabaseAdmin.from("project_change_requests").select("*").eq("project_id", projectId).eq("status", "accepted").order("decided_at", { ascending: true });
    const { data: tasks } = await supabaseAdmin.from("tasks").select("id, title, status").eq("project_id", projectId);
    const scopeChanges = (acceptedCRs || []).map((cr) => ({
      id: cr.id,
      code: cr.cr_code,
      title: cr.title,
      scopeImpact: cr.scope_impact_count,
      formattedScope: `${cr.scope_impact_count >= 0 ? "+" : "-"}${Math.abs(cr.scope_impact_count)} Deliverable${Math.abs(cr.scope_impact_count) > 1 ? "s" : ""}`,
      approvedAt: cr.decided_at
    }));
    return {
      projectId,
      baselineScopeCount: baseline?.scope_count || (tasks ? tasks.length : 0),
      currentScopeCount: latest?.scope_count || (tasks ? tasks.length : 0),
      scopeChanges,
      activeDeliverables: tasks || [],
      hasSufficientData: !!baseline
    };
  }
  /**
   * 5. PROJECT DNA (Causality Graph Nodes & Edges)
   */
  static async getProjectDNA(projectId, userId) {
    const { data: events2 } = await supabaseAdmin.from("project_events").select("*").eq("project_id", projectId).order("occurred_at", { ascending: true });
    const { data: relationships } = await supabaseAdmin.from("project_event_relationships").select("*").eq("project_id", projectId);
    const nodes = (events2 || []).map((e) => ({
      id: e.id,
      type: e.event_type,
      title: e.title,
      description: e.description,
      occurredAt: e.occurred_at,
      visibility: e.visibility,
      impact: e.impact_summary
    }));
    const edges = (relationships || []).map((r) => ({
      id: r.id,
      source: r.source_event_id,
      target: r.target_event_id,
      type: r.relationship_type
    }));
    return { projectId, nodes, edges };
  }
  /**
   * 6. PROOF MODE DATA
   */
  static async getProjectProof(projectId, userId) {
    const { data: evidence } = await supabaseAdmin.from("project_evidence").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    const { data: receipts } = await supabaseAdmin.from("project_receipts").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    const { data: tasks } = await supabaseAdmin.from("tasks").select("id, status").eq("project_id", projectId);
    const { data: milestones } = await supabaseAdmin.from("project_milestones").select("id, completed").eq("project_id", projectId);
    const doneTasks = tasks?.filter((t2) => t2.status === "done").length || 0;
    const completedMilestones = milestones?.filter((m) => m.completed).length || 0;
    return {
      projectId,
      stats: {
        tasksTotal: tasks?.length || 0,
        tasksDone: doneTasks,
        milestonesTotal: milestones?.length || 0,
        milestonesCompleted: completedMilestones,
        evidenceCount: evidence?.length || 0,
        receiptsCount: receipts?.length || 0,
        lastVerifiedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      evidence: evidence || [],
      receipts: receipts || []
    };
  }
  /**
   * 7. COMMITMENT HISTORY & VERSIONS
   */
  static async getCommitmentHistory(projectId, userId) {
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true });
    return { projectId, commitments: commitments || [] };
  }
  /**
   * 8. CREATE CHANGE REQUEST
   */
  static async createChangeRequest(payload, userId) {
    const {
      projectId,
      title,
      description,
      requesterType = "client",
      costImpact = 0,
      scheduleImpactDays = 0,
      scopeImpactCount = 0,
      engineeringHoursImpact = 0
    } = payload;
    if (!projectId || !title) throw new Error("projectId and title are required");
    const { data: existingCRs } = await supabaseAdmin.from("project_change_requests").select("id").eq("project_id", projectId);
    const crIndex = (existingCRs?.length || 0) + 1;
    const crCode = `CR-${String(crIndex).padStart(3, "0")}`;
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
    const currentCommitment = commitments?.[0];
    const currentCost = Number(currentCommitment?.total_cost || 45e3);
    const currentDate = currentCommitment?.delivery_date ? new Date(currentCommitment.delivery_date) : /* @__PURE__ */ new Date();
    const currentScope = currentCommitment?.scope_count || 8;
    const resultingCost = currentCost + Number(costImpact);
    const resultingDate = new Date(currentDate.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    const resultingScope = currentScope + Number(scopeImpactCount);
    const { data: cr, error } = await supabaseAdmin.from("project_change_requests").insert({
      cr_code: crCode,
      project_id: projectId,
      title,
      description,
      requester_type: requesterType,
      requested_by: userId,
      status: "pending",
      cost_impact: costImpact,
      schedule_impact_days: scheduleImpactDays,
      scope_impact_count: scopeImpactCount,
      engineering_hours_impact: engineeringHoursImpact,
      resulting_cost: resultingCost,
      resulting_delivery_date: resultingDate,
      resulting_scope_count: resultingScope
    }).select().single();
    if (error) throw error;
    await supabaseAdmin.from("project_events").insert({
      project_id: projectId,
      event_type: "CHANGE_REQUEST_CREATED",
      actor_id: userId,
      title: `${crCode} Submitted: ${title}`,
      description: `Impact: ${costImpact >= 0 ? "+" : ""}\u20B9${costImpact}, ${scheduleImpactDays >= 0 ? "+" : ""}${scheduleImpactDays} days, ${scopeImpactCount >= 0 ? "+" : ""}${scopeImpactCount} scope items`,
      visibility: "CLIENT_ACTION_REQUIRED",
      impact_summary: {
        costDelta: costImpact,
        daysDelta: scheduleImpactDays,
        scopeDelta: scopeImpactCount
      }
    });
    return cr;
  }
  /**
   * 9. DECIDE CHANGE REQUEST (Accept / Reject)
   */
  static async decideChangeRequest(crId, decision, notes, userId) {
    const { data: cr, error: fetchErr } = await supabaseAdmin.from("project_change_requests").select("*").eq("id", crId).single();
    if (fetchErr || !cr) throw new Error("Change request not found");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: updatedCR, error: updateErr } = await supabaseAdmin.from("project_change_requests").update({
      status: decision,
      client_decision_notes: notes,
      decided_at: now,
      decided_by: userId
    }).eq("id", crId).select().single();
    if (updateErr) throw updateErr;
    if (decision === "accepted") {
      const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", cr.project_id).order("version_number", { ascending: false }).limit(1);
      const latestVer = commitments?.[0]?.version_number || 1;
      const newVersionNum = latestVer + 1;
      await supabaseAdmin.from("project_commitments").insert({
        project_id: cr.project_id,
        version_number: newVersionNum,
        total_cost: cr.resulting_cost,
        currency: "INR",
        delivery_date: cr.resulting_delivery_date,
        scope_count: cr.resulting_scope_count,
        change_reason: `Accepted ${cr.cr_code}: ${cr.title}`,
        change_request_id: cr.id,
        requested_by: cr.requested_by,
        approved_by: userId,
        approved_at: now
      });
      await supabaseAdmin.from("projects").update({ due_date: cr.resulting_delivery_date }).eq("id", cr.project_id);
      const { data: acceptEvent } = await supabaseAdmin.from("project_events").insert({
        project_id: cr.project_id,
        event_type: "CHANGE_REQUEST_ACCEPTED",
        actor_id: userId,
        title: `${cr.cr_code} Approved: Commitment V${newVersionNum} Established`,
        description: notes || `Approved ${cr.title}. New delivery date: ${cr.resulting_delivery_date}, value: \u20B9${Number(cr.resulting_cost).toLocaleString("en-IN")}`,
        visibility: "CLIENT_VISIBLE",
        impact_summary: {
          costDelta: cr.cost_impact,
          daysDelta: cr.schedule_impact_days,
          scopeDelta: cr.scope_impact_count,
          newVersion: newVersionNum
        }
      }).select().single();
      const receiptCode = `CF-PR-${Math.floor(1e4 + Math.random() * 9e4)}`;
      await supabaseAdmin.from("project_receipts").insert({
        receipt_code: receiptCode,
        project_id: cr.project_id,
        receipt_type: "scope_change",
        title: `${cr.cr_code} Acceptance Receipt`,
        summary: {
          crCode: cr.cr_code,
          title: cr.title,
          impact: {
            cost: cr.cost_impact,
            scheduleDays: cr.schedule_impact_days,
            scope: cr.scope_impact_count
          },
          newCommitmentVersion: newVersionNum
        },
        signer_id: userId,
        signed_at: now
      });
    } else {
      await supabaseAdmin.from("project_events").insert({
        project_id: cr.project_id,
        event_type: "CHANGE_REQUEST_REJECTED",
        actor_id: userId,
        title: `${cr.cr_code} ${decision.toUpperCase()}`,
        description: notes || `The change request ${cr.title} was ${decision}.`,
        visibility: "CLIENT_VISIBLE"
      });
    }
    return updatedCR;
  }
  /**
   * 10. GET RECEIPT BY CODE
   */
  static async getReceiptByCode(receiptCode) {
    const { data: receipt } = await supabaseAdmin.from("project_receipts").select("*, project:project_id(title, status)").eq("receipt_code", receiptCode).single();
    return receipt;
  }
  /**
   * 11. RESPONSIBILITY STATE
   */
  static async getResponsibilityState(projectId, userId) {
    const { data: activePeriod } = await supabaseAdmin.from("project_responsibility_periods").select("*").eq("project_id", projectId).eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (!activePeriod) {
      return {
        heldBy: "PROJECT_OWNER",
        actionItem: "Active Sprint Execution & Development",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        durationFormatted: "18h 42m"
      };
    }
    const elapsedMs = Date.now() - new Date(activePeriod.started_at).getTime();
    const hours = Math.floor(elapsedMs / (1e3 * 60 * 60));
    const minutes = Math.floor(elapsedMs % (1e3 * 60 * 60) / (1e3 * 60));
    return {
      ...activePeriod,
      durationFormatted: `${hours}h ${minutes}m`
    };
  }
  /**
   * 12. PROJECT SEAL & PASSPORT TRANSITION
   */
  static async sealProject(projectId, sealNotes, userId) {
    const sealCode = `CF-P-${Math.floor(1e5 + Math.random() * 9e5)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await supabaseAdmin.from("projects").update({ status: "completed" }).eq("id", projectId);
    const { data: receipt } = await supabaseAdmin.from("project_receipts").insert({
      receipt_code: sealCode,
      project_id: projectId,
      receipt_type: "project_seal",
      title: "Project Delivery Record & Official Seal",
      summary: {
        sealCode,
        sealedAt: now,
        notes: sealNotes || "All deliverables accepted and confirmed by project stakeholders."
      },
      signer_id: userId,
      signed_at: now
    }).select().single();
    await supabaseAdmin.from("project_events").insert({
      project_id: projectId,
      event_type: "PROJECT_SEALED",
      actor_id: userId,
      title: `Project Officially Sealed (${sealCode})`,
      description: "The project delivery is officially accepted and sealed into permanent passport state.",
      visibility: "CLIENT_VISIBLE"
    });
    return receipt;
  }
  /**
   * 13. PROJECT HISTORICAL PLAYBACK
   */
  static async getPlaybackState(projectId, targetDateStr, userId) {
    await this.ensureBaselineCommitment(projectId, userId);
    const targetDate = new Date(targetDateStr).getTime();
    const { data: commitments } = await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).lte("approved_at", new Date(targetDate).toISOString()).order("version_number", { ascending: false });
    const activeCommitment = commitments?.[0] || await supabaseAdmin.from("project_commitments").select("*").eq("project_id", projectId).order("version_number", { ascending: true }).limit(1).then((r) => r.data?.[0]);
    const { data: events2 } = await supabaseAdmin.from("project_events").select("*").eq("project_id", projectId).lte("occurred_at", new Date(targetDate).toISOString()).order("occurred_at", { ascending: true });
    const { data: milestones } = await supabaseAdmin.from("project_milestones").select("id, title, completed, completed_at").eq("project_id", projectId);
    const completedCountAtTime = (milestones || []).filter(
      (m) => m.completed && m.completed_at && new Date(m.completed_at).getTime() <= targetDate
    ).length;
    const totalMilestones = milestones?.length || 1;
    const progressAtTime = Math.round(completedCountAtTime / totalMilestones * 100);
    return {
      projectId,
      targetDate: targetDateStr,
      progress: progressAtTime,
      committedCost: activeCommitment?.total_cost || 0,
      committedDelivery: activeCommitment?.delivery_date || "Open",
      scopeCount: activeCommitment?.scope_count || 0,
      activeCommitmentVersion: activeCommitment?.version_number || 1,
      milestonesCompleted: completedCountAtTime,
      milestonesTotal: totalMilestones,
      eventsCount: events2?.length || 0
    };
  }
  /**
   * 14. COMPARE STATES
   */
  static async compareStates(projectId, dateA, dateB, userId) {
    const stateA = await this.getPlaybackState(projectId, dateA, userId);
    const stateB = await this.getPlaybackState(projectId, dateB, userId);
    const { data: crsBetween } = await supabaseAdmin.from("project_change_requests").select("*").eq("project_id", projectId).eq("status", "accepted").gte("decided_at", new Date(dateA).toISOString()).lte("decided_at", new Date(dateB).toISOString()).order("decided_at", { ascending: true });
    return {
      projectId,
      stateA,
      stateB,
      delta: {
        progressDiff: stateB.progress - stateA.progress,
        costDiff: stateB.committedCost - stateA.committedCost,
        scopeDiff: stateB.scopeCount - stateA.scopeCount,
        deliveryDiffDays: stateA.committedDelivery !== stateB.committedDelivery ? Math.round(
          (new Date(stateB.committedDelivery).getTime() - new Date(stateA.committedDelivery).getTime()) / (1e3 * 60 * 60 * 24)
        ) : 0
      },
      causalExplanations: (crsBetween || []).map((cr) => ({
        crCode: cr.cr_code,
        title: cr.title,
        costImpact: cr.cost_impact,
        scheduleImpactDays: cr.schedule_impact_days,
        scopeImpactCount: cr.scope_impact_count,
        decidedAt: cr.decided_at
      }))
    };
  }
  /**
   * 15. PROVISION CLIENT ACCOUNT & GRANT PERMISSIONS
   */
  static async provisionClientUser(payload, actorId) {
    const {
      projectId,
      email,
      password,
      fullName = "Client Contact",
      canApprove = true,
      canRequestChanges = true,
      canViewFinancials = true
    } = payload;
    if (!projectId || !email || !password) {
      throw new Error("Project ID, email, and password are required");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }
    let targetUserId = null;
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (existingUser) {
      targetUserId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          role: "client"
        }
      });
      if (createErr || !newUser.user) {
        throw new Error(createErr?.message || "Failed to create client user in auth");
      }
      targetUserId = newUser.user.id;
      await supabaseAdmin.from("users").upsert({
        id: targetUserId,
        email: email.trim(),
        full_name: fullName.trim(),
        role: "client",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const { data: accessRecord, error: accessErr } = await supabaseAdmin.from("project_client_access").upsert(
      {
        project_id: projectId,
        user_id: targetUserId,
        can_view: true,
        can_approve: Boolean(canApprove),
        can_request_changes: Boolean(canRequestChanges),
        can_view_financials: Boolean(canViewFinancials),
        status: "active",
        invited_by: actorId,
        invited_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "project_id,user_id" }
    ).select().single();
    if (accessErr) {
      throw new Error(accessErr.message || "Failed to grant project client access");
    }
    await supabaseAdmin.from("project_events").insert({
      project_id: projectId,
      event_type: "CLIENT_ACCESS_GRANTED",
      actor_id: actorId,
      title: `Client Account Configured (${email})`,
      description: `Client contact ${fullName} was granted direct project access.`,
      visibility: "CLIENT_VISIBLE"
    });
    return {
      success: true,
      userId: targetUserId,
      email: email.trim(),
      fullName: fullName.trim(),
      access: accessRecord
    };
  }
  /**
   * 16. INITIALIZE PROJECT (Backend Service Authority)
   */
  static async createProject(payload, userId) {
    const {
      title,
      description,
      priority = "medium",
      cover_color = "#FF6B4A",
      status = "active",
      due_date = null,
      department_id = null,
      org_id = null,
      budget = 0
    } = payload;
    if (!title || !title.trim()) {
      throw new Error("Project title is required");
    }
    const { data: newProj, error: projErr } = await supabaseAdmin.from("projects").insert({
      title: title.trim(),
      description: description?.trim() || null,
      priority,
      cover_color,
      status,
      owner_id: userId,
      created_by: userId,
      due_date,
      department_id: department_id || null,
      org_id: org_id || null,
      budget: Number(budget || 0)
    }).select().single();
    if (projErr || !newProj) {
      throw new Error(projErr?.message || "Failed to create project record");
    }
    await supabaseAdmin.from("project_members").upsert(
      {
        project_id: newProj.id,
        user_id: userId,
        role: "owner",
        is_active: true,
        added_by: userId,
        assigned_by: userId
      },
      { onConflict: "project_id,user_id" }
    );
    await this.ensureBaselineCommitment(newProj.id, userId);
    return newProj;
  }
};

// server/causality/causality.controller.ts
var CausalityController = class {
  static async getWhyDelivery(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.explainDelivery(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to trace delivery causality" });
    }
  }
  static async getWhyCost(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.explainCost(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to trace cost causality" });
    }
  }
  static async getWhyProgress(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.explainProgress(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to trace progress causality" });
    }
  }
  static async getWhyScope(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.explainScope(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to trace scope causality" });
    }
  }
  static async getProjectDNA(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.getProjectDNA(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch Project DNA graph" });
    }
  }
  static async getProjectProof(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.getProjectProof(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch Proof data" });
    }
  }
  static async getCommitmentHistory(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.getCommitmentHistory(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch commitment history" });
    }
  }
  static async createChangeRequest(req, res) {
    try {
      const payload = req.body;
      const data = await CausalityService.createChangeRequest(payload, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create change request" });
    }
  }
  static async decideChangeRequest(req, res) {
    try {
      const { id } = req.params;
      const { decision, notes } = req.body;
      if (!["accepted", "rejected", "withdrawn"].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision" });
      }
      const data = await CausalityService.decideChangeRequest(id, decision, notes, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to decide change request" });
    }
  }
  static async getReceiptByCode(req, res) {
    try {
      const { code } = req.params;
      const data = await CausalityService.getReceiptByCode(code);
      if (!data) return res.status(404).json({ error: "Project receipt not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch receipt" });
    }
  }
  static async getResponsibilityState(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.getResponsibilityState(projectId, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch responsibility status" });
    }
  }
  static async sealProject(req, res) {
    try {
      const { projectId, sealNotes } = req.body;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const data = await CausalityService.sealProject(projectId, sealNotes, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to seal project" });
    }
  }
  static async getPlaybackState(req, res) {
    try {
      const projectId = req.query.projectId;
      const targetDate = req.query.targetDate;
      if (!projectId || !targetDate) {
        return res.status(400).json({ error: "projectId and targetDate are required" });
      }
      const data = await CausalityService.getPlaybackState(projectId, targetDate, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch historical playback state" });
    }
  }
  static async compareStates(req, res) {
    try {
      const projectId = req.query.projectId;
      const dateA = req.query.dateA;
      const dateB = req.query.dateB;
      if (!projectId || !dateA || !dateB) {
        return res.status(400).json({ error: "projectId, dateA, and dateB are required" });
      }
      const data = await CausalityService.compareStates(projectId, dateA, dateB, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to compare historical project states" });
    }
  }
  static async provisionClientUser(req, res) {
    try {
      const data = await CausalityService.provisionClientUser(req.body, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to create client user account" });
    }
  }
  static async createProject(req, res) {
    try {
      const data = await CausalityService.createProject(req.body, req.user.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to initialize project" });
    }
  }
};

// server/causality/causality.routes.ts
import { createClient as createClient5 } from "@supabase/supabase-js";
import ws4 from "ws";
var router3 = Router2();
var supabaseUrl4 = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey4 = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
var supabase3 = createClient5(supabaseUrl4, supabaseAnonKey4, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: ws4
  }
});
var requireAuth2 = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    if (!token) throw new Error("No token provided");
    const { data: { user }, error } = await supabase3.auth.getUser(token);
    if (error || !user) throw new Error("Invalid token");
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
router3.get("/why/delivery", requireAuth2, CausalityController.getWhyDelivery);
router3.get("/why/cost", requireAuth2, CausalityController.getWhyCost);
router3.get("/why/progress", requireAuth2, CausalityController.getWhyProgress);
router3.get("/why/scope", requireAuth2, CausalityController.getWhyScope);
router3.get("/dna", requireAuth2, CausalityController.getProjectDNA);
router3.get("/proof", requireAuth2, CausalityController.getProjectProof);
router3.get("/commitments", requireAuth2, CausalityController.getCommitmentHistory);
router3.post("/change-requests", requireAuth2, CausalityController.createChangeRequest);
router3.post("/change-requests/:id/decide", requireAuth2, CausalityController.decideChangeRequest);
router3.get("/receipts/:code", CausalityController.getReceiptByCode);
router3.get("/responsibility", requireAuth2, CausalityController.getResponsibilityState);
router3.post("/seal", requireAuth2, CausalityController.sealProject);
router3.get("/playback", requireAuth2, CausalityController.getPlaybackState);
router3.get("/compare", requireAuth2, CausalityController.compareStates);
router3.post("/provision-client", requireAuth2, CausalityController.provisionClientUser);
router3.post("/projects", requireAuth2, CausalityController.createProject);
var causality_routes_default = router3;

// server/_core/cron.ts
import { createClient as createClient6 } from "@supabase/supabase-js";
import ws5 from "ws";
function startCronJobs() {
  console.log("[Cron] Background jobs initialized. Automated meeting termination is disabled; meetings end only when host ends the call.");
}

// server/security/rateLimit.ts
var LIMIT_WINDOW_S = parseInt(process.env.RATE_LIMIT_WINDOW_S || "60", 10);
var MAX_GLOBAL_REQ = parseInt(process.env.RATE_LIMIT_API_MAX || "10000", 10);
var MAX_AI_REQ = parseInt(process.env.RATE_LIMIT_AI_MAX || "10", 10);
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

// server/_core/app.ts
var { Client } = pg;
function createPgClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  return new Client({
    connectionString: dbUrl
  });
}
function createExpressApp() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  if (process.env.DATABASE_URL) {
    let cleanUrl = process.env.DATABASE_URL;
    cleanUrl = cleanUrl.replace(/sslcert=[^&]*/g, "");
    cleanUrl = cleanUrl.replace(/&&+/g, "&").replace(/\?&/, "?").replace(/&\?/, "?").replace(/\?$/, "").replace(/&$/, "");
    process.env.DATABASE_URL = cleanUrl;
    console.log("[DB Info] Sanitized DATABASE_URL:", process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//$1:[PASSWORD_HIDDEN]@"));
  }
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
  const client = createPgClient();
  if (client) {
    client.connect().then(async () => {
      console.log("[Migration] Applying create_project_with_member RPC database function...");
      await client.query(`
          -- Drop the old strict signature first to avoid duplicates
          DROP FUNCTION IF EXISTS public.create_project_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID);
          DROP FUNCTION IF EXISTS public.create_project_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

          CREATE OR REPLACE FUNCTION public.create_project_with_member(
            p_title        TEXT,
            p_description  TEXT       DEFAULT NULL,
            p_priority     TEXT       DEFAULT 'medium',
            p_cover_color  TEXT       DEFAULT '#1F6FEB',
            p_status       TEXT       DEFAULT 'active',
            p_due_date     TEXT       DEFAULT NULL,
            p_department_id TEXT      DEFAULT NULL,
            p_org_id       TEXT       DEFAULT NULL
          )
          RETURNS JSONB
          LANGUAGE plpgsql
          SECURITY DEFINER
          SET search_path = public
          AS $$
          DECLARE
            v_user_id UUID;
            v_project_id UUID;
            v_result JSONB;
            v_due_date DATE;
            v_department_id UUID;
            v_org_id UUID;
          BEGIN
            -- 1. Resolve the calling user
            v_user_id := auth.uid();
            IF v_user_id IS NULL THEN
              RAISE EXCEPTION 'Not authenticated';
            END IF;

            -- Convert and cast TEXT parameters safely to target types
            v_due_date := NULLIF(p_due_date, '')::DATE;
            v_department_id := NULLIF(p_department_id, '')::UUID;
            v_org_id := NULLIF(p_org_id, '')::UUID;

            -- 2. Authorization: user must belong to the org (if org-scoped)
            IF v_org_id IS NOT NULL THEN
              IF NOT EXISTS (
                SELECT 1 FROM public.user_organizations
                WHERE org_id = v_org_id AND user_id = v_user_id
              ) THEN
                RAISE EXCEPTION 'You are not a member of this organization';
              END IF;
            END IF;

            -- 3. Insert the project
            INSERT INTO public.projects (
              title, description, priority, cover_color, status,
              owner_id, created_by, due_date, department_id, org_id
            ) VALUES (
              p_title, p_description, p_priority, p_cover_color, p_status,
              v_user_id, v_user_id, v_due_date, v_department_id, v_org_id
            )
            RETURNING id INTO v_project_id;

            -- 4. Add creator as project owner member
            INSERT INTO public.project_members (project_id, user_id, role, is_active, added_by)
            VALUES (v_project_id, v_user_id, 'owner', true, v_user_id)
            ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner', is_active = true;

            -- 5. Return the created project as JSON
            SELECT jsonb_build_object(
              'id', p.id,
              'title', p.title,
              'description', p.description,
              'priority', p.priority,
              'cover_color', p.cover_color,
              'status', p.status,
              'owner_id', p.owner_id,
              'created_by', p.created_by,
              'due_date', p.due_date,
              'department_id', p.department_id,
              'org_id', p.org_id,
              'created_at', p.created_at
            ) INTO v_result
            FROM public.projects p
            WHERE p.id = v_project_id;

            RETURN v_result;
          END;
          $$;

          GRANT EXECUTE ON FUNCTION public.create_project_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

          NOTIFY pgrst, 'reload schema';
        `);
      console.log("[Migration] \u2713 create_project_with_member database RPC applied successfully");
      await client.end();
    }).catch((err) => {
      console.error("[Migration] Error executing startup database migration:", err);
    });
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
  app.use(sanitizationMiddleware);
  app.use(globalRateLimiter);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthProxyRoutes(app);
  app.use("/api/meetings", meetings_routes_default);
  app.use("/api/causality", causality_routes_default);
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
    await dispatchFCMPush({
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
  app.get("/api/health", async (_req, res) => {
    try {
      const client2 = createPgClient();
      if (!client2) {
        throw new Error("DATABASE_URL not configured");
      }
      await client2.connect();
      const dbRes = await client2.query(`
        SELECT 
          p.proname as name,
          pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'create_project_with_member';
      `);
      await client2.end();
      res.json({ ok: true, timestamp: Date.now(), functions: dbRes.rows });
    } catch (e) {
      res.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  const statusPageHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CoreFlow API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0f; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 640px; width: 100%; padding: 2rem; }
    .badge { display: inline-flex; align-items: center; gap: 8px; background: #0d2a1f; border: 1px solid #16a34a44; border-radius: 999px; padding: 6px 16px; font-size: 13px; color: #4ade80; margin-bottom: 2rem; }
    .dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }
    h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 0.5rem; background: linear-gradient(135deg, #e2e8f0, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 2rem; }
    .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .card-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-bottom: 1rem; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1e1e2e; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #64748b; }
    .row .value { color: #e2e8f0; font-family: monospace; font-size: 13px; }
    .green { color: #4ade80 !important; }
    .endpoints { display: flex; flex-direction: column; gap: 6px; }
    .ep { display: flex; align-items: center; gap: 10px; font-size: 13px; font-family: monospace; }
    .method { background: #1e293b; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #7dd3fc; }
    .path { color: #94a3b8; }
    footer { text-align: center; font-size: 12px; color: #334155; margin-top: 1.5rem; }
  </style>
</head>
<body>
<div class="container">
  <div class="badge"><span class="dot"></span> All Systems Operational</div>
  <h1>CoreFlow API</h1>
  <p class="subtitle">Backend server is running. Use <code style="color:#7dd3fc">/api/*</code> routes to interact.</p>
  <div class="card">
    <div class="card-title">System Info</div>
    <div class="row"><span class="label">Status</span><span class="value green">&#9679; Operational</span></div>
    <div class="row"><span class="label">Environment</span><span class="value">${process.env.NODE_ENV || "production"}</span></div>
    <div class="row"><span class="label">Platform</span><span class="value">${process.env.VERCEL ? "Vercel Serverless" : "Self-hosted"}</span></div>
    <div class="row"><span class="label">Node.js</span><span class="value">${process.version}</span></div>
    <div class="row"><span class="label">Timestamp</span><span class="value">${(/* @__PURE__ */ new Date()).toISOString()}</span></div>
  </div>
  <div class="card">
    <div class="card-title">Available Endpoints</div>
    <div class="endpoints">
      <div class="ep"><span class="method">GET</span><span class="path">/api/health</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/trpc/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/meetings/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/causality/*</span></div>
      <div class="ep"><span class="method">POST</span><span class="path">/api/notifications/send-push</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/auth/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/storage/*</span></div>
    </div>
  </div>
  <footer>CoreFlow &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} &mdash; Powered by Express + tRPC</footer>
</div>
</body>
</html>`;
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    if (__require("fs").existsSync(path.join(distPath, "index.html"))) {
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.use((req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        if (req.method === "GET" && (req.path === "/" || req.path === "")) {
          res.setHeader("Content-Type", "text/html");
          return res.send(statusPageHtml());
        }
        res.status(404).json({ error: "Not found", hint: "This is an API server. Use /api/* routes." });
      });
    }
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
