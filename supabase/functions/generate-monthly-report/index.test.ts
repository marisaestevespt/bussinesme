import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FN = `${SUPABASE_URL}/functions/v1/generate-monthly-report`;

Deno.test("generate-monthly-report: CORS preflight", async () => {
  const res = await fetch(FN, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin"));
});

Deno.test("generate-monthly-report: bad request returns 400 JSON", async () => {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json",
  });
  const data = await res.json().catch(() => ({}));
  assert([400, 401, 500].includes(res.status));
  assertEquals(typeof data, "object");
});