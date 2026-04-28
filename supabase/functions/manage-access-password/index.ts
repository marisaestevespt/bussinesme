import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// ────────────────────────────────────────────────────────────────────────────
// Encryption (AES-GCM) — key MUST come from secret ACCESS_ENCRYPTION_KEY
// ────────────────────────────────────────────────────────────────────────────
async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("ACCESS_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error("ACCESS_ENCRYPTION_KEY secret not configured");
  }
  const keyBytes = new TextEncoder().encode(raw.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}:${ctB64}`;
}

async function decrypt(stored: string): Promise<string> {
  const key = await getKey();
  const [ivB64, ctB64] = stored.split(":");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ────────────────────────────────────────────────────────────────────────────
// Rate-limit / blocking config
// ────────────────────────────────────────────────────────────────────────────
const RATE_LIMIT_PER_HOUR = 20;
const FAILED_ATTEMPTS_THRESHOLD = 5;
const FAILED_BLOCK_MINUTES = 30;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function getClientMeta(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null;
  const ua = req.headers.get("user-agent") ?? null;
  return { ip, ua };
}

async function logAudit(
  admin: any,
  params: {
    user_id: string;
    action: "read" | "write" | "rotate" | "denied";
    access_id?: string | null;
    ip?: string | null;
    user_agent?: string | null;
    reason?: string | null;
  },
) {
  try {
    await admin.from("access_password_audit").insert({
      user_id: params.user_id,
      action: params.action,
      access_id: params.access_id ?? null,
      ip: params.ip ?? null,
      user_agent: params.user_agent ?? null,
      reason: params.reason ?? null,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const { ip, ua } = getClientMeta(req);

  // Service-role admin client (used for audit + rate-limit reads)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── 1. JWT presence ───────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json(401, { error: "Unauthorized" });
    }

    const userId = claimsData.claims.sub as string;

    // ── 2. Check if user is currently blocked (5 failures in last 30 min) ─
    const blockSince = new Date(Date.now() - FAILED_BLOCK_MINUTES * 60_000).toISOString();
    const { count: recentDenied } = await admin
      .from("access_password_audit")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", "denied")
      .gte("created_at", blockSince);

    if ((recentDenied ?? 0) >= FAILED_ATTEMPTS_THRESHOLD) {
      await logAudit(admin, {
        user_id: userId,
        action: "denied",
        ip,
        user_agent: ua,
        reason: "blocked_too_many_failures",
      });
      return json(403, {
        error: `Bloqueado por ${FAILED_BLOCK_MINUTES} minutos após ${FAILED_ATTEMPTS_THRESHOLD} tentativas falhadas.`,
      });
    }

    // ── 3. Role check (owner / admin / manager) ──────────────────────────
    const [ownerRes, adminRes, managerRes] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "owner" }),
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "manager" }),
    ]);
    const hasRole = Boolean(ownerRes.data || adminRes.data || managerRes.data);

    if (!hasRole) {
      await logAudit(admin, {
        user_id: userId,
        action: "denied",
        ip,
        user_agent: ua,
        reason: "insufficient_role",
      });
      return json(403, { error: "Permissão insuficiente. Requer owner, admin ou manager." });
    }

    // ── 4. Rate limit: 20 calls / hour / user ─────────────────────────────
    const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count: recentCalls } = await admin
      .from("access_password_audit")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("action", ["read", "write", "rotate"])
      .gte("created_at", hourAgo);

    if ((recentCalls ?? 0) >= RATE_LIMIT_PER_HOUR) {
      await logAudit(admin, {
        user_id: userId,
        action: "denied",
        ip,
        user_agent: ua,
        reason: "rate_limit_exceeded",
      });
      return json(429, {
        error: `Limite de ${RATE_LIMIT_PER_HOUR} chamadas por hora excedido. Tenta novamente mais tarde.`,
      });
    }

    // ── 5. Process action ─────────────────────────────────────────────────
    const { action, ...body } = await req.json();

    if (action === "encrypt") {
      const encrypted = await encrypt(body.password);
      const { data, error } = await supabase
        .from("platform_accesses")
        .insert({
          platform_name: body.platform_name,
          username_email: body.username_email,
          encrypted_password: encrypted,
          platform_type: body.platform_type || "outros",
          direct_link: body.direct_link || null,
          notes: body.notes || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      await logAudit(admin, {
        user_id: userId,
        action: "write",
        access_id: data.id,
        ip,
        user_agent: ua,
        reason: "create",
      });
      return json(200, { data });
    }

    if (action === "update") {
      const updateData: Record<string, unknown> = {
        platform_name: body.platform_name,
        username_email: body.username_email,
        platform_type: body.platform_type,
        direct_link: body.direct_link || null,
        notes: body.notes || null,
      };
      const isRotate = Boolean(body.password);
      if (isRotate) {
        updateData.encrypted_password = await encrypt(body.password);
      }
      const { data, error } = await supabase
        .from("platform_accesses")
        .update(updateData)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;

      await logAudit(admin, {
        user_id: userId,
        action: isRotate ? "rotate" : "write",
        access_id: body.id,
        ip,
        user_agent: ua,
        reason: isRotate ? "password_rotated" : "metadata_updated",
      });
      return json(200, { data });
    }

    if (action === "decrypt") {
      const { data: record, error } = await supabase
        .from("platform_accesses")
        .select("encrypted_password")
        .eq("id", body.id)
        .single();
      if (error) throw error;

      try {
        const password = await decrypt(record.encrypted_password);
        await logAudit(admin, {
          user_id: userId,
          action: "read",
          access_id: body.id,
          ip,
          user_agent: ua,
        });
        return json(200, { password });
      } catch (decErr) {
        await logAudit(admin, {
          user_id: userId,
          action: "denied",
          access_id: body.id,
          ip,
          user_agent: ua,
          reason: "decrypt_failed",
        });
        throw decErr;
      }
    }

    return json(400, { error: "Invalid action" });
  } catch (err) {
    console.error("manage-access-password error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
