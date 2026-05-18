import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { logRun } from "../_shared/resilience.ts";

// Calculate the next occurrence of a recurring deliverable in a given month
function getOccurrenceInMonth(year: number, month: number, week: number, weekday: number): string | null {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  if (week > 0) {
    let count = 0;
    const d = new Date(firstDay);
    while (d <= lastDay) {
      if (d.getDay() === weekday) {
        count++;
        if (count === week) return d.toISOString().split('T')[0];
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  } else {
    // From end: -1 = last, -2 = second-to-last
    const occurrences: string[] = [];
    const d = new Date(firstDay);
    while (d <= lastDay) {
      if (d.getDay() === weekday) occurrences.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    const idx = occurrences.length + week;
    return idx >= 0 ? occurrences[idx] : null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = new Date();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get all recurring deliverables with week/weekday rules
    const { data: deliverables, error: delError } = await supabase
      .from("project_deliverables")
      .select("*, projects!inner(id, name, department, project_mode, status)")
      .eq("is_recurring", true)
      .not("recurrence_week", "is", null)
      .not("recurrence_weekday", "is", null);

    if (delError) throw delError;

    let created = 0;

    for (const d of deliverables || []) {
      const project = (d as any).projects;
      if (!project || project.status === 'concluido' || project.status === 'cancelado' || project.status === 'arquivo') continue;

      const deadline = getOccurrenceInMonth(currentYear, currentMonth, d.recurrence_week, d.recurrence_weekday);
      if (!deadline) continue;

      // Check if task already exists for this deliverable + month
      const monthLabel = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const taskName = `${d.name} — ${monthLabel}`;

      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", project.id)
        .eq("name", taskName)
        .maybeSingle();

      if (existing) continue;

      // Create the task
      const { error: taskError } = await supabase.from("tasks").insert({
        name: taskName,
        project_id: project.id,
        department: project.department,
        deadline,
        assigned_to: d.assigned_to,
        priority: "media",
        status: "por_comecar",
      });

      if (!taskError) {
        created++;
        // Update the deliverable deadline to this month's occurrence
        await supabase
          .from("project_deliverables")
          .update({ deadline, status: "pendente" })
          .eq("id", d.id);
      }
    }

    await logRun({ functionName: "generate-deliverable-tasks", startedAt, status: "success", context: { tasks_created: created } });
    return new Response(JSON.stringify({ success: true, tasks_created: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await logRun({ functionName: "generate-deliverable-tasks", startedAt, status: "failed", errorMessage: error?.message ?? String(error) });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
