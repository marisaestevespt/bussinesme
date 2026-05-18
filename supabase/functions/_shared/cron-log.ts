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

/**
 * Lower-friction API: call `startCronRun` at the top of the handler, then
 * `finishCronRun(run, ...)` once (in try/catch/finally style).
 */
export interface CronRunHandle {
  id: string | null;
  startedAt: number;
}

export async function startCronRun(functionName: string): Promise<CronRunHandle> {
  const startedAt = Date.now();
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("cron_runs")
      .insert({ function_name: functionName, status: "running" })
      .select("id")
      .single();
    if (error) {
      console.warn("[cron-log] start insert error:", error.message);
      return { id: null, startedAt };
    }
    return { id: data?.id ?? null, startedAt };
  } catch (e) {
    console.warn("[cron-log] start exception:", e);
    return { id: null, startedAt };
  }
}

export async function finishCronRun(
  run: CronRunHandle,
  outcome: { status: "success" | "error"; error?: unknown; itemsProcessed?: number; metadata?: Record<string, unknown> },
): Promise<void> {
  if (!run.id) return;
  try {
    const sb = getServiceClient();
    const duration = Date.now() - run.startedAt;
    const errMsg = outcome.error
      ? (outcome.error instanceof Error ? outcome.error.message : String(outcome.error)).slice(0, 2000)
      : null;
    await sb
      .from("cron_runs")
      .update({
        status: outcome.status,
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: errMsg,
        items_processed: outcome.itemsProcessed ?? null,
        metadata: outcome.metadata && Object.keys(outcome.metadata).length ? outcome.metadata : null,
      })
      .eq("id", run.id);
  } catch (e) {
    console.warn("[cron-log] finish exception:", e);
  }
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