// Edge function: admin-stats
// Devolve métricas resumidas desta instância para o painel de administração central.
// Autenticação: header `x-admin-key` deve corresponder ao secret ADMIN_STATS_KEY.
// NÃO devolve dados pessoais — apenas contagens e timestamps.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const APP_VERSION = "1.0.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expected = Deno.env.get("ADMIN_STATS_KEY");
    const provided = req.headers.get("x-admin-key");

    if (!expected) {
      return new Response(
        JSON.stringify({ error: "ADMIN_STATS_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!provided || provided !== expected) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Helper para contagens seguras (não falha o pedido todo se uma contagem rebentar).
    const safeCount = async (
      table: string,
      filter?: (q: ReturnType<typeof supabase.from>) => unknown,
    ): Promise<number | null> => {
      try {
        const base = supabase.from(table).select("*", { count: "exact", head: true });
        const q = filter ? (filter(base) as typeof base) : base;
        const { count, error } = await q;
        if (error) return null;
        return count ?? 0;
      } catch {
        return null;
      }
    };

    const [
      members,
      clients,
      activeClients,
      projects,
      tasks,
      meetingsLast30,
      businessSettings,
    ] = await Promise.all([
      safeCount("members"),
      safeCount("clients"),
      safeCount("clients", (q) => q.eq("status", "active")),
      safeCount("projects"),
      safeCount("tasks"),
      safeCount("meetings", (q) =>
        q.gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ),
      supabase.from("business_settings").select("business_name, created_at").limit(1).maybeSingle(),
    ]);

    // Última atividade (timestamp mais recente entre tabelas comuns)
    let lastActivity: string | null = null;
    try {
      const { data } = await supabase
        .from("audit_logs")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastActivity = data?.created_at ?? null;
    } catch {
      lastActivity = null;
    }

    const payload = {
      ok: true,
      version: APP_VERSION,
      checked_at: new Date().toISOString(),
      business_name: businessSettings.data?.business_name ?? null,
      installed_at: businessSettings.data?.created_at ?? null,
      counts: {
        members,
        clients,
        active_clients: activeClients,
        projects,
        tasks,
        meetings_last_30d: meetingsLast30,
      },
      last_activity_at: lastActivity,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
