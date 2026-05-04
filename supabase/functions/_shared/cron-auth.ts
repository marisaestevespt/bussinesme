/**
 * Shared helper to verify that an edge function is being invoked by:
 *  - the project's service_role key (e.g. via pg_cron + vault), OR
 *  - any valid Supabase-issued JWT (anon/user) when called from inside the platform.
 *
 * Returns true if authorized (role is one of service_role / anon / authenticated).
 *
 * Behaviour:
 *  1. Decodes the JWT payload and checks `iss === "supabase"` and the role.
 *  2. If `SUPABASE_JWT_SECRET` is available, ALSO verifies the signature
 *     cryptographically using HS256. A failure here is logged as a warning
 *     but does NOT block the call — the Supabase gateway has already
 *     validated the token when `verify_jwt = true`, and we want to remain
 *     backwards-compatible with cron jobs that may use slightly different
 *     token shapes.
 */
import { jwtVerify } from "https://deno.land/x/jose@v5.9.6/index.ts";

// Only the service_role is allowed to invoke cron-protected functions.
// pg_cron always uses the service_role key when calling edge functions, so
// legitimate scheduled invocations continue to work. Authenticated end users
// (anon / authenticated JWTs) must NOT be able to trigger these jobs.
const ACCEPTED_ROLES = new Set(["service_role"]);

function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    return JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

async function verifySignature(token: string): Promise<boolean> {
  const secret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "supabase",
    });
    return true;
  } catch (err) {
    console.warn("[cron-auth] JWT signature verification failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Synchronous (legacy) check — payload-only, no signature verification.
 * Kept for callers that cannot await.
 */
export function isAuthorizedCronCall(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const payload = decodePayload(token);
  if (!payload || payload.iss !== "supabase") return false;
  return ACCEPTED_ROLES.has(String(payload.role));
}

/**
 * Async check that ALSO performs cryptographic verification of the JWT signature
 * when `SUPABASE_JWT_SECRET` is configured. The signature outcome is logged
 * but does not change the authorization decision (gateway-level verify_jwt
 * already enforces validity for most call paths).
 */
export async function isAuthorizedCronCallVerified(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const payload = decodePayload(token);
  if (!payload || payload.iss !== "supabase") return false;
  if (!ACCEPTED_ROLES.has(String(payload.role))) return false;

  // Best-effort signature check (non-blocking).
  await verifySignature(token);

  return true;
}