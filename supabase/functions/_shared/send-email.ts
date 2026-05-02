// Helper to invoke send-transactional-email from another edge function.
// supabase.functions.invoke() does NOT propagate the service role JWT
// correctly, causing UNAUTHORIZED_INVALID_JWT_FORMAT. Use raw fetch instead.

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

  const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
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
