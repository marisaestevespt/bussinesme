import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const results: string[] = [];

    // ── 1. Sales: mark overdue ──
    const { data: overdueSales, error: e1 } = await supabase
      .from("commercial_sales")
      .select("id")
      .lt("payment_date", todayStr)
      .not("status", "in", '("pagamento_ok","recibo_enviado","contabilidade_ok","cancelada","em_atraso")');

    if (!e1 && overdueSales && overdueSales.length > 0) {
      const ids = overdueSales.map((s: { id: string }) => s.id);
      await supabase
        .from("commercial_sales")
        .update({ status: "em_atraso" })
        .in("id", ids);
      results.push(`Sales overdue: ${ids.length}`);
    }

    // ── 2. Sales: mark awaiting payment (current month, status = na) ──
    const monthStart = todayStr.slice(0, 7) + "-01";
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    const { data: awaitingSales, error: e2 } = await supabase
      .from("commercial_sales")
      .select("id")
      .gte("payment_date", todayStr)
      .lt("payment_date", monthEnd)
      .eq("status", "na");

    if (!e2 && awaitingSales && awaitingSales.length > 0) {
      const ids = awaitingSales.map((s: { id: string }) => s.id);
      await supabase
        .from("commercial_sales")
        .update({ status: "aguarda_pagamento" })
        .in("id", ids);
      results.push(`Sales awaiting: ${ids.length}`);
    }

    // ── 3. Clients: renewal check ──
    // Get owner
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (ownerRole) {
      const ownerId = ownerRole.user_id;

      // Get active clients with end_of_cycle
      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name, end_of_cycle, current_product, status")
        .eq("status", "ativo")
        .not("end_of_cycle", "is", null);

      // Get products with renewal_advance_days
      const { data: products } = await supabase
        .from("products")
        .select("name, renewal_advance_days");

      const productMap = new Map<string, number>();
      (products || []).forEach((p: { name: string; renewal_advance_days: number | null }) => {
        productMap.set(p.name, p.renewal_advance_days ?? 30);
      });

      let renewalCount = 0;

      for (const client of clients || []) {
        if (!client.end_of_cycle) continue;

        const advanceDays = productMap.get(client.current_product || "") ?? 30;
        const endDate = new Date(client.end_of_cycle + "T00:00:00");
        const diffDays = Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= advanceDays && diffDays >= 0) {
          // Update client status
          await supabase
            .from("clients")
            .update({ status: "altura_renovacao" })
            .eq("id", client.id)
            .eq("status", "ativo"); // only if still active

          // Create notification (dedup)
          const notifKey = `renewal-auto-${client.id}-${todayStr}`;
          const { data: existingNotif } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", ownerId)
            .eq("message", notifKey)
            .limit(1);

          if (!existingNotif || existingNotif.length === 0) {
            await supabase.from("notifications").insert({
              user_id: ownerId,
              type: "client_renewal",
              title: `📅 Renovação — ${client.full_name} (${diffDays} dias)`,
              message: notifKey,
              link: `/hub/clientes/${client.id}`,
            });
          }

          // Create task (dedup by message)
          const taskKey = `renewal-task-${client.id}-${client.end_of_cycle}`;
          const { data: existingTask } = await supabase
            .from("tasks")
            .select("id")
            .eq("name", `Renovação — ${client.full_name}`)
            .limit(1);

          if (!existingTask || existingTask.length === 0) {
            await supabase.from("tasks").insert({
              name: `Renovação — ${client.full_name}`,
              status: "por_comecar",
              priority: "alta",
              deadline: client.end_of_cycle,
              department: "clientes",
              created_by: ownerId,
              assigned_to: ownerId,
              tag: "Renovação",
            });
          }

          renewalCount++;
        }
      }

      results.push(`Clients renewal: ${renewalCount}`);

      // ── 4. Contract expiry check ──
      const thirtyDaysAhead = new Date(today);
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      const thirtyDaysStr = thirtyDaysAhead.toISOString().slice(0, 10);

      const { data: expiringContracts } = await supabase
        .from("member_contracts")
        .select("id, end_date, team_members(full_name)")
        .eq("status", "ativo")
        .not("end_date", "is", null)
        .lte("end_date", thirtyDaysStr);

      let contractCount = 0;
      for (const contract of expiringContracts || []) {
        const daysLeft = Math.ceil(
          (new Date(contract.end_date).getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const memberName =
          (contract.team_members as any)?.full_name || "Membro";
        const notifKey = `contract-expiry-${contract.id}-${todayStr}`;

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", ownerId)
          .eq("type", "contract_expiry")
          .eq("message", notifKey)
          .limit(1);

        if (!existing || existing.length === 0) {
          const emoji =
            daysLeft <= 0 ? "⚠️" : daysLeft <= 7 ? "🔴" : "🟡";
          const title =
            daysLeft <= 0
              ? `${emoji} Contrato de ${memberName} expirou`
              : `${emoji} Contrato de ${memberName} expira em ${daysLeft} dias`;

          await supabase.from("notifications").insert({
            user_id: ownerId,
            type: "contract_expiry",
            title,
            message: notifKey,
            link: "/hub/pessoas",
          });
          contractCount++;
        }
      }
      results.push(`Contracts expiring: ${contractCount}`);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
