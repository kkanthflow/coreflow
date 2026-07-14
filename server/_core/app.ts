import express from "express";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerAuthProxyRoutes } from "../security/authProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createExpressApp() {
  // Validate mandatory secrets on startup
  const mandatorySecrets = [
    "DATABASE_URL",
    "JWT_SECRET",
    "BUILT_IN_FORGE_API_URL",
    "BUILT_IN_FORGE_API_KEY",
  ];
  
  for (const secret of mandatorySecrets) {
    if (!process.env[secret]) {
      throw new Error(`[CRITICAL] Server startup failed: Missing mandatory environment variable "${secret}".`);
    }
  }

  const app = express();
  app.disable("x-powered-by");

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
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
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global input sanitization layer
  const { sanitizationMiddleware } = require("../security/validation");
  app.use(sanitizationMiddleware);

  // Global abuse prevention & rate limiting layer
  const { globalRateLimiter } = require("../security/rateLimit");
  app.use(globalRateLimiter);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthProxyRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
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
