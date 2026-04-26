// Shared resilience utilities for Edge Functions:
// - withRetry: exponential backoff retry wrapper
// - logRun: persists execution telemetry to edge_function_runs
// - runWithMonitoring: wraps a job with timing + logging + retry

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RunStatus = "success" | "failed" | "warning" | "running";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<{ result: T; attempts: number }> {
  const max = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  const cap = opts.maxDelayMs ?? 8000;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < max) {
    attempt++;
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt >= max || !shouldRetry(err)) break;
      const delay = Math.min(cap, base * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }
  throw lastErr;
}

function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function logRun(params: {
  functionName: string;
  startedAt: Date;
  status: RunStatus;
  attempts?: number;
  errorMessage?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - params.startedAt.getTime();
    await supabase.from("edge_function_runs").insert({
      function_name: params.functionName,
      started_at: params.startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      status: params.status,
      attempts: params.attempts ?? 1,
      error_message: params.errorMessage ?? null,
      context: params.context ?? {},
    });
  } catch (e) {
    // Logging failures must never break the function
    console.error("[logRun] failed to persist run log", e);
  }
}

export interface MonitorOptions extends RetryOptions {
  functionName: string;
  context?: Record<string, unknown>;
}

export async function runWithMonitoring<T>(
  fn: () => Promise<T>,
  opts: MonitorOptions,
): Promise<T> {
  const startedAt = new Date();
  try {
    const { result, attempts } = await withRetry(fn, opts);
    await logRun({
      functionName: opts.functionName,
      startedAt,
      status: attempts > 1 ? "warning" : "success",
      attempts,
      context: { ...(opts.context ?? {}), retried: attempts > 1 },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun({
      functionName: opts.functionName,
      startedAt,
      status: "failed",
      attempts: opts.maxAttempts ?? 3,
      errorMessage: message,
      context: opts.context,
    });
    throw err;
  }
}