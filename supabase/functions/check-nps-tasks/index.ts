import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { runWithMonitoring } from "../_shared/resilience.ts";

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
    const created = await runWithMonitoring(async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const today = new Date().toISOString().split("T")[0];

  // Find NPS records due today or past that have no task yet
  const { data: dueRecords, error: fetchErr } = await supabase
    .from("client_nps_records")
    .select("id, client_id, product_id, expected_date, task_id")
    .lte("expected_date", today)
    .neq("status", "feito")
    .is("task_id", null);

      if (fetchErr) throw new Error(`fetch NPS: ${fetchErr.message}`);

      if (!dueRecords || dueRecords.length === 0) return 0;

  // Gather unique product IDs to get NPS config (responsible_id)
  const productIds = [...new Set(dueRecords.filter(r => r.product_id).map(r => r.product_id))];
  const { data: configs } = await supabase
    .from("product_nps_config")
    .select("product_id, responsible_id")
    .in("product_id", productIds);

  const configMap: Record<string, string | null> = {};
  for (const c of configs || []) {
    configMap[c.product_id] = c.responsible_id;
  }

  // Get team_members to map team_member_id -> profile_id
  const responsibleIds = [...new Set(Object.values(configMap).filter(Boolean))] as string[];
      const memberToProfile: Record<string, string> = {};
  if (responsibleIds.length > 0) {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, profile_id")
      .in("id", responsibleIds);
    for (const m of members || []) {
      if (m.profile_id) memberToProfile[m.id] = m.profile_id;
    }
  }

  // Get client names
  const clientIds = [...new Set(dueRecords.map(r => r.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name")
    .in("id", clientIds);
  const clientNameMap: Record<string, string> = {};
  for (const c of clients || []) {
    clientNameMap[c.id] = c.full_name;
  }

  let created = 0;

  for (const record of dueRecords) {
    const responsibleTeamMemberId = record.product_id ? configMap[record.product_id] : null;
    const assignedTo = responsibleTeamMemberId ? memberToProfile[responsibleTeamMemberId] || null : null;
    const clientName = clientNameMap[record.client_id] || "Cliente";

    // Create the task
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        name: `Recolha de NPS — ${clientName}`,
        status: "pendente",
        priority: "media",
        deadline: record.expected_date,
        assigned_to: assignedTo,
        notes: `NPS automático. Cliente: ${clientName}\nLink: /hub/clientes/${record.client_id}`,
      })
      .select("id")
      .single();

    if (taskErr) {
      console.error("Error creating task for NPS record:", record.id, taskErr);
      continue;
    }

    // Update the NPS record with the task_id
    await supabase
      .from("client_nps_records")
      .update({ task_id: task.id })
      .eq("id", record.id);

    created++;
  }

      return created;
    }, { functionName: "check-nps-tasks", maxAttempts: 2 });

    return new Response(JSON.stringify({ created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
