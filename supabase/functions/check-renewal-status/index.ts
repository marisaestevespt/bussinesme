import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Get all active clients with end_of_cycle set and their associated product's renewal_advance_days
    const { data: clients, error: fetchError } = await supabase
      .from("clients")
      .select("id, full_name, end_of_cycle, status, current_product")
      .eq("status", "ativo")
      .not("end_of_cycle", "is", null)
      .gte("end_of_cycle", todayStr);

    if (fetchError) throw fetchError;

    // Get all products with their renewal_advance_days
    const { data: products } = await supabase
      .from("products")
      .select("name, renewal_advance_days");

    const productMap: Record<string, number> = {};
    for (const p of products || []) {
      productMap[p.name] = p.renewal_advance_days ?? 30;
    }

    // Get owner user_id(s) from user_roles
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");

    const ownerIds = (ownerRoles || []).map((r: any) => r.user_id);

    // Get owner profile ids (for task assignment)
    const { data: ownerProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .in("user_id", ownerIds);

    const ownerProfileId = ownerProfiles?.[0]?.id || null;
    const ownerUserId = ownerProfiles?.[0]?.user_id || null;

    let updated = 0;
    let tasksCreated = 0;
    let notificationsCreated = 0;

    for (const client of clients || []) {
      const endOfCycle = new Date(client.end_of_cycle);
      const daysUntilEnd = Math.ceil(
        (endOfCycle.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get advance days from product or default 30
      const advanceDays = client.current_product
        ? productMap[client.current_product] ?? 30
        : 30;

      // Only process clients within the advance window
      if (daysUntilEnd > advanceDays) continue;

      // 1. Update client status to "altura_renovacao"
      const { error: updateError } = await supabase
        .from("clients")
        .update({ status: "altura_renovacao" })
        .eq("id", client.id);

      if (updateError) continue;
      updated++;

      // 2. Check if a renewal task already exists for this client
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .ilike("name", `Renovação — ${client.full_name}%`)
        .neq("status", "done")
        .neq("status", "concluida")
        .limit(1);

      if (!existingTasks?.length && ownerProfileId) {
        // Create task
        const { error: taskError } = await supabase.from("tasks").insert({
          name: `Renovação — ${client.full_name}`,
          status: "por_comecar",
          priority: "alta",
          deadline: client.end_of_cycle,
          assigned_to: ownerProfileId,
          tag: "Renovação",
          notes: `Fim de ciclo: ${client.end_of_cycle}. Link: /hub/clientes/${client.id}`,
        });

        if (!taskError) tasksCreated++;
      }

      // 3. Check if notification already exists (avoid duplicates)
      if (ownerUserId) {
        const { data: existingNotifs } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", ownerUserId)
          .ilike("title", `Renovação — ${client.full_name}%`)
          .limit(1);

        if (!existingNotifs?.length) {
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: ownerUserId,
              title: `Renovação — ${client.full_name}`,
              message: `O ciclo do cliente ${client.full_name} termina em ${client.end_of_cycle}. É altura de iniciar o processo de renovação.`,
              type: "renovacao",
              link: `/hub/clientes/${client.id}`,
            });

          if (!notifError) notificationsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: clients?.length || 0,
        updated,
        tasksCreated,
        notificationsCreated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
