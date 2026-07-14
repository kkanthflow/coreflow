import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Recursive input sanitization helper
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove null bytes, trim whitespace, normalize unicode
    return input.trim().replace(/\0/g, "").normalize("NFC");
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const key of Object.keys(input)) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

// Global Sanitization Middleware
export function sanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
}

// Strict body validation middleware helper
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map((e: z.ZodIssue) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        res.status(400).json({
          error: "Validation failed: Invalid request payload.",
          details,
        });
        return;
      }
      res.status(400).json({ error: "Invalid request payload." });
    }
  };
}

// Shared Validation Schemas
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  deviceId: z.string().max(255).optional(),
  platform: z.string().max(100).optional(),
  fingerprint: z.string().max(255).optional(),
  captchaToken: z.string().max(255).optional(),
}).strict(); // strictly reject unknown fields

export const mfaVerifySchema = z.object({
  code: z.string().length(6),
  challengeId: z.string().uuid().nullable().optional(),
  factorId: z.string().max(255).optional(),
  tempAccessToken: z.string().max(2048),
}).strict();

export const refreshTokenSchema = z.object({
  refresh_token: z.string().max(2048),
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
}).strict();
