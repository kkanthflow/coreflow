import { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { AuthProtectionService, SECURITY_CONFIG } from "./auth-protection";
import { cache } from "./redis";
import * as db from "./db";
import crypto from "crypto";
import { validateBody, loginSchema, mfaVerifySchema, refreshTokenSchema, forgotPasswordSchema } from "./validation";

// Initialize backend Supabase client using environment credentials
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Helper for constant time responses
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Redirect/reject non-HTTPS traffic in production environments
function enforceHttps(req: Request, res: Response, next: any) {
  if (process.env.NODE_ENV === "production") {
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    if (!isHttps) {
      return res.status(403).json({ error: "HTTPS connection required." });
    }
  }
  next();
}

export function registerAuthProxyRoutes(app: Express) {
  
  // Apply HTTPS check to all auth proxy endpoints
  app.use("/api/auth/*", enforceHttps);

  // ── LOGIN PROXY ──
  app.post("/api/auth/login", validateBody(loginSchema), async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { email, password, deviceId, userAgent, platform, fingerprint, captchaToken } = req.body;

    const ip = AuthProtectionService.getClientIp(req);
    const attemptDetails = {
      email,
      ip,
      deviceId,
      userAgent: userAgent || req.headers["user-agent"],
      platform,
      browserFingerprint: fingerprint,
    };

    try {
      // 1. IP rate limit check
      const ipCheck = await AuthProtectionService.checkIpLimit(ip);
      if (!ipCheck.allowed) {
        return res.status(429).json({ 
          error: "Too many login attempts. Please try again later.",
          lockTimeRemaining: ipCheck.lockTimeRemaining 
        });
      }

      // 2. Account rate limit & lockout check
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

      // 3. Device check & CAPTCHA requirement check
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
        // Validate CAPTCHA token (mock or local slider token matching)
        if (captchaToken !== "VERIFIED_SLIDER_TOKEN") {
          return res.status(400).json({ 
            error: "Verification failed. Please try again.",
            captchaRequired: true 
          });
        }
      }

      // 4. Organization lookup and check organization limit
      let organizationId: string | undefined;
      try {
        const userRes = await db.query("SELECT id FROM public.users WHERE email = $1 LIMIT 1", [email]);
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          const orgRes = await db.query("SELECT org_id FROM public.user_organizations WHERE user_id = $1 LIMIT 1", [userId]);
          if (orgRes.rows.length > 0) {
            organizationId = orgRes.rows[0].org_id;
          }
        }
      } catch (e) {
        // Silent
      }

      if (organizationId) {
        const orgCheck = await AuthProtectionService.checkOrganizationLimit(organizationId);
        if (!orgCheck.allowed) {
          return res.status(429).json({ error: "Too many login attempts. Please try again later." });
        }
      }

      // Apply progressive delay if needed
      if (accountCheck.delayMs && accountCheck.delayMs > 0) {
        await sleep(accountCheck.delayMs);
      }

      // 5. Authenticate user credentials with Supabase (prioritizing secure raw passwords, fallback to legacy hashed)
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

      // Enforce email verification status check
      if (isSuccess && data.user && !data.user.email_confirmed_at) {
        isSuccess = false;
        authError = { message: "Please confirm your email address before logging in." } as any;
        data = { user: null, session: null };
      }

      if (isSuccess && isLegacyUser && data.session) {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          },
        });
        userClient.auth.updateUser({ password }).catch((e) => {
          console.warn('[AuthProxy] Failed to upgrade legacy password in background:', e);
        });
      }
      
      // 6. Calculate risk score
      const { score: riskScore } = await AuthProtectionService.calculateRiskScore(
        { ...attemptDetails, organizationId },
        isSuccess
      );

      // 7. Log the attempt
      await AuthProtectionService.logAttempt(
        { ...attemptDetails, organizationId },
        isSuccess,
        authError ? authError.message : undefined,
        riskScore
      );

      // Enforce constant time response (pad request duration to at least 400ms)
      const duration = Date.now() - startTime;
      if (duration < 400) {
        await sleep(400 - duration);
      }

      if (!isSuccess || !data.session) {
        return res.status(400).json({ error: "Invalid email or password." });
      }

      // Check if user has enrolled TOTP/MFA factors
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        },
      });

      const { data: mfaData } = await userClient.auth.mfa.listFactors();
      const activeFactor = mfaData?.totp?.find((f: any) => f.status === 'verified');

      if (activeFactor) {
        const { data: challenge, error: challengeError } = await userClient.auth.mfa.challenge({
          factorId: activeFactor.id,
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
              user: data.session.user,
            },
          });
        }
      }

      // Determine if MFA is required based on risk score or profile settings
      const isHighRisk = riskScore >= SECURITY_CONFIG.MFA_SCORE_THRESHOLD;

      if (isHighRisk) {
        // Return session with partial flow indicating MFA challenge
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

      // Successful response returning clean session object
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

  // ── MFA VERIFICATION PROXY ──
  app.post("/api/auth/mfa/verify", validateBody(mfaVerifySchema), async (req: Request, res: Response) => {
    const { code, challengeId, factorId, tempAccessToken } = req.body;

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${tempAccessToken}`,
          },
        },
      });

      const { data, error } = await userClient.auth.mfa.verify({
        challengeId: challengeId || undefined,
        factorId: factorId || undefined,
        code,
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
          expires_at: Math.floor(Date.now() / 1000) + 3600
        },
      });
    } catch (err) {
      console.error("[MfaProxy] MFA verification error:", err);
      return res.status(500).json({ error: "MFA verification failed." });
    }
  });

  // ── REFRESH TOKEN PROXY ──
  app.post("/api/auth/refresh", validateBody(refreshTokenSchema), async (req: Request, res: Response) => {
    const { refresh_token } = req.body;

    const ip = AuthProtectionService.getClientIp(req);
    
    // IP-based Rate limiting on refresh token endpoint
    const refreshKey = `rate:refresh:${ip}`;
    const attempts = await cache.incr(refreshKey, 60);
    if (attempts > 30) { // Max 30 refreshes per minute
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

  // ── FORGOT PASSWORD PROXY ──
  app.post("/api/auth/forgot-password", validateBody(forgotPasswordSchema), async (req: Request, res: Response) => {
    const { email } = req.body;

    const ip = AuthProtectionService.getClientIp(req);
    const key = `rate:forgot:${ip}`;
    const count = await cache.incr(key, 3600); // 1 hour window
    if (count > 3) {
      return res.status(429).json({ error: "Too many reset requests. Please try again later." });
    }

    try {
      // Direct call to Supabase auth to trigger email with mobile deep link redirect
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'manuscoreflowapp://oauth/callback',
      });
      // Constant time/Generic response to prevent account enumeration
      return res.json({ success: true, message: "If the email exists, a password reset link has been sent." });
    } catch (err) {
      return res.json({ success: true, message: "If the email exists, a password reset link has been sent." });
    }
  });
}
