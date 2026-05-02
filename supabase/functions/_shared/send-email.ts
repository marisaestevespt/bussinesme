// Helper to invoke send-transactional-email from another edge function.
//
// We don't put the service role key in `Authorization: Bearer ...` because
// the Supabase gateway's strict JWT-format parsing has been observed to
// reject it intermittently with UNAUTHORIZED_INVALID_JWT_FORMAT (likely a
// header normalisation issue on certain runtime versions).
//
// Instead, send-transactional-email is configured with verify_jwt = false
// and accepts an `x-internal-secret` header equal to the project's
// service role key — validated in-function. This bypasses the gateway's
// JWT parser while staying just as secure (only code holding the service
// role key can call this path).

export interface SendTransactionalEmailArgs {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}

export async function sendTransactionalEmail(
  args: SendTransactionalEmailArgs,
): Promise<{ ok: true } | { ok: false; status: number; details: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[send-email] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    return { ok: false, status: 500, details: "Missing service role config" };
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // apikey must be a valid project key for the gateway to accept the request.
      apikey: anonKey || serviceRoleKey,
      // Internal secret is validated inside send-transactional-email.
      "x-internal-secret": serviceRoleKey,
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => res.statusText);
    console.error("[send-email] non-2xx", res.status, details);
    return { ok: false, status: res.status, details };
  }
  return { ok: true };
}
