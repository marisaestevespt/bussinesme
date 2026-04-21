/**
 * Shared helper to verify that an edge function is being invoked by:
 *  - the project's service_role key (e.g. via pg_cron + vault), OR
 *  - any valid Supabase-issued JWT (anon/user) when called from inside the platform.
 *
 * Returns true if authorized.
 */
export function isAuthorizedCronCall(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  // Decode JWT payload (no signature check — Supabase's gateway already validated it
  // when verify_jwt is true; here we just confirm role).
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const padded = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const payload = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.iss !== "supabase") return false;
    // Accept service_role for cron, plus anon/authenticated for in-app callers.
    return ["service_role", "anon", "authenticated"].includes(payload.role);
  } catch {
    return false;
  }
}