import { cache } from "./redis";
import * as db from "./db";

export interface SecurityConfig {
  IP_LIMIT_WINDOW_S: number;
  IP_LIMIT_MAX_ATTEMPTS: number;
  IP_LOCK_1_DURATION_S: number;
  IP_LOCK_2_DURATION_S: number;
  
  ACCOUNT_LOCK_MAX_ATTEMPTS: number;
  ACCOUNT_LOCK_DURATION_S: number;
  
  ORG_SPRAY_WINDOW_S: number;
  ORG_SPRAY_MAX_ATTEMPTS: number;
  ORG_SPRAY_LOCK_DURATION_S: number;
  
  CAPTCHA_SCORE_THRESHOLD: number;
  MFA_SCORE_THRESHOLD: number;
}

export const SECURITY_CONFIG: SecurityConfig = {
  IP_LIMIT_WINDOW_S: 60,         // 1 minute
  IP_LIMIT_MAX_ATTEMPTS: 5,      // 5 attempts within 1 minute
  IP_LOCK_1_DURATION_S: 900,     // 15 minutes
  IP_LOCK_2_DURATION_S: 3600,    // 1 hour
  
  ACCOUNT_LOCK_MAX_ATTEMPTS: 8,  // Lock account on 8th failure
  ACCOUNT_LOCK_DURATION_S: 900,  // 15 minutes
  
  ORG_SPRAY_WINDOW_S: 600,       // 10 minutes
  ORG_SPRAY_MAX_ATTEMPTS: 50,    // 50 failures across org
  ORG_SPRAY_LOCK_DURATION_S: 1800, // 30 minutes
  
  CAPTCHA_SCORE_THRESHOLD: 50,   // Triggers CAPTCHA if risk >= 50
  MFA_SCORE_THRESHOLD: 70,       // Triggers MFA if risk >= 70
};

export interface AttemptDetails {
  email: string;
  ip: string;
  deviceId?: string;
  userAgent?: string;
  platform?: string;
  browserFingerprint?: string;
  country?: string;
  city?: string;
  organizationId?: string;
}

export class AuthProtectionService {
  
  // 1. IP rate limit and lockout verification
  static async checkIpLimit(ip: string): Promise<{ allowed: boolean; lockTimeRemaining?: number }> {
    const lockKey = `lock:ip:${ip}`;
    const lockedUntilStr = await cache.get(lockKey);
    
    if (lockedUntilStr) {
      const lockedUntil = parseInt(lockedUntilStr, 10);
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      if (remaining > 0) {
        return { allowed: false, lockTimeRemaining: remaining };
      }
    }
    
    // Evaluate IP failures in window
    const windowKey = `attempts:ip:${ip}`;
    const count = await cache.incr(windowKey, SECURITY_CONFIG.IP_LIMIT_WINDOW_S);
    
    if (count >= 25) {
      // High severity lockout: 1 hour
      const lockDuration = SECURITY_CONFIG.IP_LOCK_2_DURATION_S;
      await cache.set(lockKey, (Date.now() + lockDuration * 1000).toString(), lockDuration);
      
      // Log high severity security event
      await db.query(
        "INSERT INTO public.security_events (event_type, severity, details) VALUES ($1, $2, $3)",
        ["brute_force_ip", "high", JSON.stringify({ ip, attempts: count, duration: "1h" })]
      );
      
      return { allowed: false, lockTimeRemaining: lockDuration };
    } else if (count >= 10) {
      // Medium severity lockout: 15 minutes
      const lockDuration = SECURITY_CONFIG.IP_LOCK_1_DURATION_S;
      await cache.set(lockKey, (Date.now() + lockDuration * 1000).toString(), lockDuration);
      return { allowed: false, lockTimeRemaining: lockDuration };
    }
    
    return { allowed: true };
  }

  // 2. User account lockout and progressive backoff delay evaluation
  static async checkAccountLimit(email: string): Promise<{
    allowed: boolean;
    lockTimeRemaining?: number;
    delayMs?: number;
    requiresEmailVerify?: boolean;
  }> {
    const lockKey = `lock:account:${email}`;
    const lockedUntilStr = await cache.get(lockKey);
    
    if (lockedUntilStr) {
      const lockedUntil = parseInt(lockedUntilStr, 10);
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
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
      await cache.set(lockKey, (Date.now() + lockDuration * 1000).toString(), lockDuration);
      return { allowed: false, lockTimeRemaining: lockDuration };
    }
    
    // Progressive backoff delay
    let delayMs = 0;
    if (count === 5) delayMs = 2000;
    else if (count === 6) delayMs = 4000;
    else if (count === 7) delayMs = 8000;
    else if (count === 8) delayMs = 16000;
    
    return { allowed: true, delayMs };
  }

  // 3. Device protection evaluation
  static async checkDeviceLimit(deviceId: string): Promise<{ allowed: boolean; captchaRequired: boolean }> {
    if (!deviceId) return { allowed: true, captchaRequired: false };
    
    const deviceKey = `attempts:device:${deviceId}`;
    const count = await cache.incr(deviceKey, 86400); // 24 hour window
    
    if (count >= 10) {
      return { allowed: true, captchaRequired: true };
    }
    
    // Also query device security table to see if it was flagged as suspicious
    try {
      const res = await db.query("SELECT captcha_required FROM public.device_security WHERE device_id = $1", [deviceId]);
      if (res.rows.length > 0 && res.rows[0].captcha_required) {
        return { allowed: true, captchaRequired: true };
      }
    } catch (e) {
      // Silent error
    }
    
    return { allowed: true, captchaRequired: false };
  }

  // 4. Organization protection (failed logins monitoring across organization to prevent password spray)
  static async checkOrganizationLimit(orgId: string): Promise<{ allowed: boolean }> {
    if (!orgId) return { allowed: true };
    
    const orgKey = `attempts:org:${orgId}`;
    const count = await cache.incr(orgKey, SECURITY_CONFIG.ORG_SPRAY_WINDOW_S);
    
    if (count >= SECURITY_CONFIG.ORG_SPRAY_MAX_ATTEMPTS) {
      // Trigger Org alert
      await db.query(
        "INSERT INTO public.security_events (event_type, severity, details) VALUES ($1, $2, $3)",
        ["password_spray_org", "critical", JSON.stringify({ orgId, attempts: count })]
      );
      
      return { allowed: false };
    }
    
    return { allowed: true };
  }

  // 5. Dynamic risk scoring engine (0-100 scale)
  static async calculateRiskScore(details: AttemptDetails, isPasswordCorrect: boolean): Promise<{ score: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];
    
    // check VPN/Tor via headers
    const ua = details.userAgent || "";
    if (ua.includes("TorBrowser") || ua.includes("Tor/")) {
      score += 30;
      reasons.push("Tor Browser detected (+30)");
    }
    
    // Failed password checks
    if (!isPasswordCorrect) {
      score += 10;
      reasons.push("Incorrect password (+10)");
    }
    
    // check Disposable email
    const disposableDomains = ["mailinator.com", "trashmail.com", "yopmail.com", "tempmail.com"];
    const emailDomain = details.email.split("@")[1]?.toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      score += 30;
      reasons.push("Disposable email address domain detected (+30)");
    }
    
    // check Location / Impossible travel detection
    try {
      const res = await db.query(
        "SELECT country, city, created_at FROM public.login_attempts WHERE email = $1 AND success = true ORDER BY created_at DESC LIMIT 1",
        [details.email]
      );
      if (res.rows.length > 0) {
        const lastLogin = res.rows[0];
        if (lastLogin.country && details.country && lastLogin.country !== details.country) {
          const timeDiffHours = (Date.now() - new Date(lastLogin.created_at).getTime()) / (1000 * 60 * 60);
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
      // Silent
    }
    
    return { score: Math.min(100, score), reasons };
  }

  // 6. Security Logging (excluding sensitive data)
  static async logAttempt(
    details: AttemptDetails,
    success: boolean,
    failureReason?: string,
    riskScore: number = 0
  ): Promise<void> {
    try {
      // 1. Log to PostgreSQL
      await db.query(
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
      
      // 2. Increment user failed attempts counter on failure
      const countKey = `attempts:account:${details.email}`;
      if (!success) {
        await cache.incr(countKey, 86400); // 24 hour expiry
      } else {
        // Reset counters on successful login
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
  static getClientIp(req: any): string {
    const trustedProxies = ["127.0.0.1", "::1"];
    let ip = req.ip || req.connection.remoteAddress || "";
    
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor && typeof xForwardedFor === "string") {
      const parts = xForwardedFor.split(",");
      // Only trust x-forwarded-for if remote IP is from localhost/trusted proxy
      const remoteIp = req.connection.remoteAddress || "";
      const isTrusted = trustedProxies.some(p => remoteIp.includes(p));
      if (isTrusted || process.env.NODE_ENV !== "production") {
        ip = parts[0].trim();
      }
    }
    
    return ip;
  }
}
