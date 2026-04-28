// ────────────────────────────────────────────────────────────────────────────
// Shared CORS helper for sensitive edge functions.
//
// Use ONLY in functions that do not need to be reachable from arbitrary
// origins. Public/portal/health endpoints should keep
// `Access-Control-Allow-Origin: *` instead.
//
// The allowlist contains:
//   - Production domains (Lovable + custom)
//   - Localhost (dev)
//   - Any *.lovable.app subdomain (preview environments)
//
// You can extend the list at deploy time by setting the ALLOWED_ORIGIN env
// var (comma-separated). Whatever you put there is appended to the defaults.
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED: readonly string[] = [
  "https://bussinesme.lovable.app",
  "https://id-preview--c24284e3-0c07-4f6e-ba4d-f58463326a8d.lovable.app",
  "https://lyrata.pt",
  "https://www.lyrata.pt",
  "http://localhost:8080",
];

const ALLOWED_LIST: readonly string[] = (() => {
  const extra = (Deno.env.get("ALLOWED_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED, ...extra]));
})();

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version";

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_LIST.includes(origin)) return true;
  try {
    const url = new URL(origin);
    // Lovable preview subdomains rotate per project / per branch.
    if (url.hostname === "lovable.app" || url.hostname.endsWith(".lovable.app")) {
      return true;
    }
    // Lovable sandbox preview environments
    if (url.hostname === "lovableproject.com" || url.hostname.endsWith(".lovableproject.com")) {
      return true;
    }
  } catch {
    // not a valid URL — fall through
  }
  return false;
}

/**
 * Returns the CORS headers for a given request.
 *
 * - If the request origin is in the allowlist → echoes it back (browser-trusted).
 * - Otherwise → echoes the first allowed origin so the browser blocks the
 *   response (no `*` here, or credentials would leak).
 *
 * Always include the result in EVERY response (success and error), and
 * remember to `Vary: Origin` so caches don't cross-serve.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_LIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Convenience wrapper for OPTIONS preflight responses.
 * Usage:
 *   if (req.method === "OPTIONS") return preflight(req);
 */
export function preflight(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}

export const ALLOWED_ORIGINS: readonly string[] = ALLOWED_LIST;
