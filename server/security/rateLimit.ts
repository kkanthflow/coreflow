import { Request, Response, NextFunction } from "express";
import { cache } from "./redis";

// Configurable rate limit settings
const LIMIT_WINDOW_S = parseInt(process.env.RATE_LIMIT_WINDOW_S || "60", 10);
const MAX_GLOBAL_REQ = parseInt(process.env.RATE_LIMIT_API_MAX || "100", 10);
const MAX_AI_REQ = parseInt(process.env.RATE_LIMIT_AI_MAX || "10", 10);

export function globalRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
  const key = `rate:global:${ip}`;

  cache.incr(key, LIMIT_WINDOW_S)
    .then((attempts) => {
      if (attempts > MAX_GLOBAL_REQ) {
        res.setHeader("Retry-After", LIMIT_WINDOW_S);
        res.status(429).json({ error: "Too many requests. Please try again later." });
        return;
      }
      next();
    })
    .catch(() => {
      // Fail open to avoid blocking legitimate users if Redis is down
      next();
    });
}

export function aiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const orgId = (req.headers["x-org-id"] as string) || "anonymous";
  const key = `rate:ai:org:${orgId}`;

  cache.incr(key, LIMIT_WINDOW_S)
    .then((attempts) => {
      if (attempts > MAX_AI_REQ) {
        res.setHeader("Retry-After", LIMIT_WINDOW_S);
        res.status(429).json({ error: "Organization AI query quota exceeded. Please try again later." });
        return;
      }
      next();
    })
    .catch(() => {
      next();
    });
}
