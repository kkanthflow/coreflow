import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import pg from "pg";
const { Client } = pg;
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerAuthProxyRoutes } from "../security/authProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import meetingsRouter from "../meetings/meetings.routes";
import causalityRouter from "../causality/causality.routes";
import { startCronJobs } from "./cron";
import { sanitizationMiddleware } from "../security/validation";
import { globalRateLimiter } from "../security/rateLimit";
import { dispatchFCMPush } from "./notification";
import { subscriptionsRouter } from "../subscriptions/subscriptions.routes";
import { webhookRouter } from "../subscriptions/webhook.routes";
import { contactRouter } from "../contact/contact.routes";
import { razorpayStandardRouter } from "../payments/razorpay-standard.routes";
import { workflowsRouter } from "../workflows/workflows.routes.js";
import { clientsRouter } from "../clients/client.routes";
import { paymentSubmissionsRouter } from "../payments/payment-submission.routes";

function createPgClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  return new Client({
    connectionString: dbUrl
  });
}

export function createExpressApp() {
  // Globally disable certificate validation to support self-signed RDS/Supabase certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  // Sanitize the URL to prevent Vercel serverless from looking for local filesystem certs
  if (process.env.DATABASE_URL) {
    let cleanUrl = process.env.DATABASE_URL;
    cleanUrl = cleanUrl.replace(/sslcert=[^&]*/g, "");
    cleanUrl = cleanUrl.replace(/&&+/g, "&").replace(/\?&/, "?").replace(/&\?/, "?").replace(/\?$/, "").replace(/&$/, "");
    process.env.DATABASE_URL = cleanUrl;
    console.log("[DB Info] Sanitized DATABASE_URL:", process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//\$1:[PASSWORD_HIDDEN]@"));
  }

  // Start background jobs
  startCronJobs();
  // Fallback JWT_SECRET to SUPABASE_JWT_SECRET if available
  if (!process.env.JWT_SECRET && process.env.SUPABASE_JWT_SECRET) {
    process.env.JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
  }

  // Validate mandatory secrets on startup
  const mandatorySecrets = [
    "DATABASE_URL",
    "JWT_SECRET",
  ];
  
  for (const secret of mandatorySecrets) {
    if (!process.env[secret]) {
      throw new Error(`[CRITICAL] Server startup failed: Missing mandatory environment variable "${secret}".`);
    }
  }

  // Run the create_project_with_member database RPC migration on startup
  const client = createPgClient();
  if (client) {
    client.connect()
      .then(async () => {
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
            v_limits RECORD;
            v_active_count INTEGER;
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

            -- 3. Atomic Quota Verification
            SELECT * INTO v_limits FROM public.fn_get_effective_limits(v_user_id::text, p_org_id);

            IF v_limits.out_max_projects IS NOT NULL THEN
              SELECT COUNT(*) INTO v_active_count
              FROM public.projects
              WHERE ((v_org_id IS NOT NULL AND org_id = v_org_id)
                  OR (v_org_id IS NULL AND owner_id = v_user_id))
                AND status NOT IN ('completed', 'archived')
                AND deleted_at IS NULL;

              IF v_active_count >= v_limits.out_max_projects THEN
                RAISE EXCEPTION 'quota_exceeded:projects: Active project quota of % reached for % tier (% active). Upgrade at /pricing.',
                  v_limits.out_max_projects, v_limits.out_plan_tier, v_active_count
                  USING ERRCODE = 'P0001';
              END IF;
            END IF;

            -- 4. Insert the project
            INSERT INTO public.projects (
              title, description, priority, cover_color, status,
              owner_id, created_by, due_date, department_id, org_id
            ) VALUES (
              p_title, p_description, p_priority, p_cover_color, p_status,
              v_user_id, v_user_id, v_due_date, v_department_id, v_org_id
            )
            RETURNING id INTO v_project_id;

            -- 5. Add creator as project owner member
            INSERT INTO public.project_members (project_id, user_id, role, is_active, added_by)
            VALUES (v_project_id, v_user_id, 'owner', true, v_user_id)
            ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner', is_active = true;

            -- 6. Return the created project as JSON
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
        console.log("[Migration] ✓ create_project_with_member database RPC applied successfully");
        await client.end();
      })
      .catch((err: any) => {
        console.error("[Migration] Error executing startup database migration:", err);
      });
  }

  // Warn about optional AI Forge features if keys are missing
  if (!process.env.BUILT_IN_FORGE_API_URL || !process.env.BUILT_IN_FORGE_API_KEY) {
    console.warn("[WARN] Optional AI features (voice transcription, image generation) are disabled: BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY is missing.");
  }

  const app = express();
  app.disable("x-powered-by");

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-organization-id, x-workspace-id, x-account-type, x-auvryn-signature",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Enterprise Security Headers
    res.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("X-XSS-Protection", "0");
    res.header("Referrer-Policy", "no-referrer");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({
    limit: "50mb",
    verify: (req: any, _res: any, buf: any) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global input sanitization layer
  app.use(sanitizationMiddleware);

  // Global abuse prevention & rate limiting layer
  app.use(globalRateLimiter);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthProxyRoutes(app);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/causality', causalityRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/payment-submissions', paymentSubmissionsRouter);
  app.use('/api', razorpayStandardRouter);

  app.post("/api/notifications/send-push", async (req: Request, res: Response) => {
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
      senderId: sender_id || undefined,
    });

    res.json({ success: true, status: "queued" });
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const client = createPgClient();
      if (!client) {
        throw new Error("DATABASE_URL not configured");
      }
      await client.connect();
      const dbRes = await client.query(`
        SELECT 
          p.proname as name,
          pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'create_project_with_member';
      `);
      await client.end();
      res.json({ ok: true, timestamp: Date.now(), functions: dbRes.rows });
    } catch (e) {
      res.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Status page HTML for root route
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
    <div class="row"><span class="label">Environment</span><span class="value">${process.env.NODE_ENV || 'production'}</span></div>
    <div class="row"><span class="label">Platform</span><span class="value">${process.env.VERCEL ? 'Vercel Serverless' : 'Self-hosted'}</span></div>
    <div class="row"><span class="label">Node.js</span><span class="value">${process.version}</span></div>
    <div class="row"><span class="label">Timestamp</span><span class="value">${new Date().toISOString()}</span></div>
  </div>
  <div class="card">
    <div class="card-title">Available Endpoints</div>
    <div class="endpoints">
      <div class="ep"><span class="method">GET</span><span class="path">/api/health</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/trpc/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/meetings/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/causality/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/api/subscriptions/*</span></div>
      <div class="ep"><span class="method">POST</span><span class="path">/api/webhooks/razorpay</span></div>
      <div class="ep"><span class="method">POST</span><span class="path">/api/create-order</span></div>
      <div class="ep"><span class="method">POST</span><span class="path">/api/verify-payment</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/auth/*</span></div>
      <div class="ep"><span class="method">ANY</span><span class="path">/storage/*</span></div>
    </div>
  </div>
  <footer>CoreFlow &copy; ${new Date().getFullYear()} &mdash; Powered by Express + tRPC</footer>
</div>
</body>
</html>`;

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    // Only serve static frontend files if the dist folder exists (not present in API-only deployments)
    if (require("fs").existsSync(path.join(distPath, "index.html"))) {
      app.use(express.static(distPath));
      app.get("*", (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      // Backend-only: serve status page at root, 404 for everything else
      app.use((req: Request, res: Response, next: NextFunction) => {
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
