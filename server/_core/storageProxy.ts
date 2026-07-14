import type { Express } from "express";
import { ENV } from "./env";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    // ── AUTHENTICATION & AUTHORIZATION ──
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      res.status(401).send("Unauthorized: Bearer token is required in Authorization header.");
      return;
    }

    try {
      // 1. Initialize user-scoped Supabase client using their JWT
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      // 2. Resolve user's identity
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        res.status(401).send("Unauthorized: Invalid session token.");
        return;
      }

      // 3. Perform ownership/tenant authorization check
      // We look up the file in public.files table. If it exists, Supabase RLS policies
      // will naturally permit or block the user from reading it based on org/project scope!
      const { data: fileRecord, error: fileError } = await userClient
        .from("files")
        .select("id, org_id")
        .eq("storage_path", key)
        .maybeSingle();

      if (fileError) {
        console.error("[StorageProxy] Auth DB error:", fileError);
        res.status(403).send("Forbidden: Authorization check failed.");
        return;
      }

      // If the file is registered in our database, but the user is not allowed to read it by RLS,
      // fileRecord will be null (due to RLS select constraint!).
      // We check if the path starts with public prefixes (like 'avatars/', 'public/'),
      // or if not, deny access to ensure strict closed-by-default security!
      const isPublicPath = key.startsWith("avatars/") || key.startsWith("public/") || key.startsWith("temp/");
      if (!fileRecord && !isPublicPath) {
        res.status(403).send("Forbidden: You do not have access to this resource.");
        // Log access failure
        try {
          await userClient.from("activity_logs").insert({
            org_id: user.user_metadata?.org_id || null,
            actor_id: user.id,
            action: "unauthorized_file_access",
            entity_type: "file",
            entity_id: null,
            new_value: { key, ip: req.ip },
          });
        } catch (e) {
          // Silent
        }
        return;
      }

      // 4. Authorized - redirect to presigned S3/Forge URL
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
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
