import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { runWithMonitoring } from "../_shared/resilience.ts";

// Counts business days between today and target (exclusive of weekends).
// Returns 0 if target is today, negative if target is in the past.
function businessDaysUntil(target: Date, today: Date): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  if (e.getTime() === t.getTime()) return 0;
  const sign = e > t ? 1 : -1;
  let count = 0;
  const cur = new Date(t);
  while (cur.getTime() !== e.getTime()) {
    cur.setDate(cur.getDate() + sign);
    const dow = cur.getDay(); // 0 Sun, 6 Sat
    if (dow !== 0 && dow !== 6) count += sign;
  }
  return count;
}

function calendarDaysUntil(target: Date, today: Date): number {
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const result = await runWithMonitoring(async () => {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name, end_of_cycle, status, current_product, current_product_id")
        .eq("status", "ativo")
        .not("end_of_cycle", "is", null);

      const { data: products } = await supabase
        .from("products")
        .select("id, name, product_type, sales_type");

      const isOneOff = (p: any) =>
        !(p.product_type === "servico_mensal" || p.sales_type === "avenca_mensal");

      const oneOffById = new Set<string>();
      const oneOffByName = new Set<string>();
      for (const p of products || []) {
        if (isOneOff(p)) {
          if (p.id) oneOffById.add(p.id);
          if (p.name) oneOffByName.add(p.name);
        }
      }

      const { data: ownerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "owner");
      const ownerIds = (ownerRoles || []).map((r: any) => r.user_id);
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .in("user_id", ownerIds);
      const ownerProfileId = ownerProfiles?.[0]?.id || null;
      const ownerUserIds: string[] = (ownerProfiles || [])
        .map((p: any) => p.user_id)
        .filter(Boolean);

      let earlyAlerts = 0;
      let farewellAlerts = 0;
      let tasksCreated = 0;

      for (const client of clients || []) {
        const isPontual =
          (client.current_product_id && oneOffById.has(client.current_product_id)) ||
          (!client.current_product_id &&
            client.current_product &&
            oneOffByName.has(client.current_product));
        if (!isPontual) continue;

        const endOfCycle = new Date(client.end_of_cycle);
        const calDays = calendarDaysUntil(endOfCycle, today);
        const bizDays = businessDaysUntil(endOfCycle, today);

        // === Early alert: ~5 business days before end ===
        if (bizDays > 0 && bizDays <= 5 && calDays > 1) {
          const taskTitle = `Acompanhamento final — ${client.full_name}`;
          const { data: existingTasks } = await supabase
            .from("tasks")
            .select("id")
            .eq("name", taskTitle)
            .limit(1);
          if (!existingTasks?.length && ownerProfileId) {
            const { error } = await supabase.from("tasks").insert({
              name: taskTitle,
              status: "por_comecar",
              priority: "alta",
              deadline: client.end_of_cycle,
              assigned_to: ownerProfileId,
              tag: "Fim de projeto",
              notes:
                `Projeto pontual termina em ${client.end_of_cycle} (~${bizDays} dias úteis). ` +
                `Validar entregas finais e estado de acompanhamento. Link: /hub/clientes/${client.id}`,
            });
            if (!error) tasksCreated++;
          }

          for (const uid of ownerUserIds) {
            const { data: existingNotifs } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("title", taskTitle)
              .limit(1);
            if (existingNotifs?.length) continue;
            await supabase.from("notifications").insert({
              user_id: uid,
              title: taskTitle,
              message: `O projeto pontual de ${client.full_name} termina em ${client.end_of_cycle}. Faltam cerca de ${bizDays} dias úteis — confirma entregas e acompanhamento.`,
              type: "fim_projeto",
              link: `/hub/clientes/${client.id}`,
            });
            earlyAlerts++;
          }
        }

        // === Farewell alert: 1 calendar day before end ===
        if (calDays === 1) {
          const farewellTitle = `Mensagem de despedida — ${client.full_name}`;
          const { data: existingFarewell } = await supabase
            .from("tasks")
            .select("id")
            .eq("name", farewellTitle)
            .limit(1);
          if (!existingFarewell?.length && ownerProfileId) {
            const { error } = await supabase.from("tasks").insert({
              name: farewellTitle,
              status: "por_comecar",
              priority: "alta",
              deadline: client.end_of_cycle,
              assigned_to: ownerProfileId,
              tag: "Fim de projeto",
              notes: `Enviar mensagem de fecho/despedida ao cliente ${client.full_name}. Link: /hub/clientes/${client.id}`,
            });
            if (!error) tasksCreated++;
          }
          for (const uid of ownerUserIds) {
            const { data: existingNotifs } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("title", farewellTitle)
              .limit(1);
            if (existingNotifs?.length) continue;
            await supabase.from("notifications").insert({
              user_id: uid,
              title: farewellTitle,
              message: `O projeto de ${client.full_name} termina amanhã. Envia a mensagem de despedida.`,
              type: "fim_projeto",
              link: `/hub/clientes/${client.id}`,
            });
            farewellAlerts++;
          }
        }
      }

      return {
        checked: clients?.length || 0,
        earlyAlerts,
        farewellAlerts,
        tasksCreated,
      };
    }, { functionName: "check-project-ending", maxAttempts: 2 });

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});