/**
 * Shared helper to log cron function executions to `public.cron_runs`.
 * Use `withCronLog` to wrap the body of a scheduled edge function.
 *
 * Example:
 *   return await withCronLog(supabase, "daily-status-update", async (ctx) => {
 *     // ...do work...
 *     ctx.itemsProcessed = 42;
 *     return new Response("ok");
 *   });
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CronLogCtx {
  runId: string | null;
  itemsProcessed: number;
  metadata: Record<string, unknown>;
}

function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function withCronLog<T>(
  functionName: string,
  handler: (ctx: CronLogCtx) => Promise<T>,
): Promise<T> {
  const sb = getServiceClient();
  const startedAt = Date.now();
  const ctx: CronLogCtx = { runId: null, itemsProcessed: 0, metadata: {} };

  try {
    const { data: row, error } = await sb
      .from("cron_runs")
      .insert({ function_name: functionName, status: "running" })
      .select("id")
      .single();
    if (!error && row) ctx.runId = row.id;
  } catch (e) {
    console.warn("[cron-log] failed to insert start row:", e);
  }

  try {
    const result = await handler(ctx);
    if (ctx.runId) {
      const duration = Date.now() - startedAt;
      await sb
        .from("cron_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          items_processed: ctx.itemsProcessed,
          metadata: Object.keys(ctx.metadata).length ? ctx.metadata : null,
        })
        .eq("id", ctx.runId);
    }
    return result;
  } catch (err) {
    const duration = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    if (ctx.runId) {
      await sb
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: message.slice(0, 2000),
          items_processed: ctx.itemsProcessed,
          metadata: Object.keys(ctx.metadata).length ? ctx.metadata : null,
        })
        .eq("id", ctx.runId);
    }
    throw err;
  }
}