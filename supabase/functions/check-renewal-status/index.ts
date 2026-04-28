import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { runWithMonitoring } from "../_shared/resilience.ts";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Active clients with an end-of-cycle defined. We include clients whose
    // cycle has already passed (overdue) so they don't fall through the cracks.
    // We exclude those who already have a renewal scheduled
    // (pending_renewal_project_id) to avoid re-flagging.
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, full_name, end_of_cycle, status, current_product, current_product_id, renewal_count, pending_renewal_project_id")
      .eq("status", "ativo")
      .is("pending_renewal_project_id", null)
      .not("end_of_cycle", "is", null);

    if (fetchError) throw fetchError;

    // Index products by id (primary) and by name (fallback for legacy rows
    // that never got current_product_id populated).
    const { data: products } = await supabase
      .from("products")
      .select("id, name, renewal_advance_days");

    const productById: Record<string, number> = {};
    const productByName: Record<string, number> = {};
    for (const p of products || []) {
      const days = p.renewal_advance_days ?? 30;
      if (p.id) productById[p.id] = days;
      if (p.name) productByName[p.name] = days;
    }

    // Get all owner user_ids — gap #4: notify every owner, not just the first.
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");

    const ownerIds = (ownerRoles || []).map((r: any) => r.user_id);

    const { data: ownerProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .in("user_id", ownerIds);

    // Task gets assigned to the first owner profile (one task per cycle is enough);
    // notifications fan out to all owners.
    const ownerProfileId = ownerProfiles?.[0]?.id || null;
    const ownerUserIds: string[] = (ownerProfiles || []).map((p: any) => p.user_id).filter(Boolean);

    let updated = 0;
    let tasksCreated = 0;
    let notificationsCreated = 0;

    for (const client of clients || []) {
      const endOfCycle = new Date(client.end_of_cycle);
      const daysUntilEnd = Math.ceil(
        (endOfCycle.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Resolve advance days: prefer product_id (stable), fall back to name (legacy).
      let advanceDays = 30;
      if (client.current_product_id && productById[client.current_product_id] !== undefined) {
        advanceDays = productById[client.current_product_id];
      } else if (client.current_product && productByName[client.current_product] !== undefined) {
        advanceDays = productByName[client.current_product];
      }

      // Process clients within the advance window OR already overdue (negative days)
      if (daysUntilEnd > advanceDays) continue;

      // 1. Update client status to "altura_renovacao"
      const { error: updateError } = await supabase
        .from("clients")
        .update({ status: "altura_renovacao" })
        .eq("id", client.id);

      if (updateError) continue;
      updated++;

      // Tag tasks/notifications with the upcoming cycle so each renewal cycle
      // gets its own task even if the previous one was never closed.
      const nextCycle = (client.renewal_count || 0) + 1;
      const taskTitle = `Renovação ciclo #${nextCycle} — ${client.full_name}`;

      // 2. Create task if none exists for this specific cycle
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("name", taskTitle)
        .limit(1);

      if (!existingTasks?.length && ownerProfileId) {
        const { error: taskError } = await supabase.from("tasks").insert({
          name: taskTitle,
          status: "por_comecar",
          priority: "alta",
          deadline: client.end_of_cycle,
          assigned_to: ownerProfileId,
          tag: "Renovação",
          notes: `Fim de ciclo: ${client.end_of_cycle}. Link: /hub/clientes/${client.id}`,
        });
        if (!taskError) tasksCreated++;
      }

      // 3. Notification: fan out to ALL owners (gap #4), one per cycle per owner
      for (const uid of ownerUserIds) {
        const { data: existingNotifs } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", uid)
          .eq("title", taskTitle)
          .limit(1);
        if (existingNotifs?.length) continue;
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: uid,
          title: taskTitle,
          message: `O ciclo do cliente ${client.full_name} termina em ${client.end_of_cycle}. É altura de iniciar o processo de renovação.`,
          type: "renovacao",
          link: `/hub/clientes/${client.id}`,
        });
        if (!notifError) notificationsCreated++;
      }

      // 4. Gap #5: write a history entry on transition (idempotent per cycle)
      const historyMilestone = `Entrou em altura de renovação (ciclo #${nextCycle})`;
      const { data: existingHist } = await supabase
        .from("client_history")
        .select("id")
        .eq("client_id", client.id)
        .eq("milestone", historyMilestone)
        .limit(1);
      if (!existingHist?.length) {
        await supabase.from("client_history").insert({
          client_id: client.id,
          entry_date: todayStr,
          milestone: historyMilestone,
          observations: `Fim de ciclo previsto: ${client.end_of_cycle}.`,
        });
      }
    }

      return {
        checked: clients?.length || 0,
        updated,
        tasksCreated,
        notificationsCreated,
      };
    }, { functionName: "check-renewal-status", maxAttempts: 2 });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
