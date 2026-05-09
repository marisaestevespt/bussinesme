import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { logRun } from "../_shared/resilience.ts";

/** Map JS getDay() (0=Sun) to ISO weekday (1=Mon..7=Sun) */
function jsToIso(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Check if a date is a business day (Mon-Fri) */
function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

/** Move to previous business day */
function prevBusinessDay(d: Date): Date {
  const result = new Date(d);
  do {
    result.setDate(result.getDate() - 1);
  } while (!isBusinessDay(result));
  return result;
}

/** Move to next business day */
function nextBusinessDay(d: Date): Date {
  const result = new Date(d);
  do {
    result.setDate(result.getDate() + 1);
  } while (!isBusinessDay(result));
  return result;
}

/** Get last day of the month */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/** Get first business day of the month */
function firstBusinessDayOfMonth(year: number, month: number): Date {
  let d = new Date(year, month, 1);
  while (!isBusinessDay(d)) d = nextBusinessDay(d);
  return d;
}

/** Get last business day of the month */
function lastBusinessDayOfMonth(year: number, month: number): Date {
  let d = lastDayOfMonth(year, month);
  while (!isBusinessDay(d)) d = prevBusinessDay(d);
  return d;
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

  const startedAt = new Date();
  try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const todayIsoWeekday = jsToIso(today.getDay());
  const todayMonthDay = today.getDate();

  // Look ahead window: generate tasks for today + next 7 days
  const lookAheadDays = 7;
  const dates: Date[] = [];
  for (let i = 0; i <= lookAheadDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  // Fetch active routines
  const { data: routines, error: rErr } = await supabase
    .from("planning_routines")
    .select("*")
    .eq("active", true);

  if (rErr) {
    console.error("Error fetching routines:", rErr);
    await logRun({ functionName: "generate-routine-tasks", startedAt, status: "failed", errorMessage: rErr.message });
    return new Response(JSON.stringify({ error: rErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!routines || routines.length === 0) {
    await logRun({ functionName: "generate-routine-tasks", startedAt, status: "success", context: { created: 0, routines: 0 } });
    return new Response(JSON.stringify({ message: "No active routines", created: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch team members to resolve role_function → profile_id
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, profile_id, role_title, status")
    .eq("status", "ativo");

  let createdCount = 0;

  for (const routine of routines) {
    // Determine which dates this routine should fire
    const targetDates: string[] = [];

    for (const date of dates) {
      const dateStr = date.toISOString().split("T")[0];
      const isoWeekday = jsToIso(date.getDay());
      const monthDay = date.getDate();
      let shouldFire = false;

      switch (routine.recurrence_type) {
        case "diario":
          shouldFire = true;
          break;
        case "semanal":
          shouldFire = routine.weekday != null && isoWeekday === routine.weekday;
          break;
        case "quinzenal":
          // Fire on the weekday, every other week (use week number parity)
          if (routine.weekday != null && isoWeekday === routine.weekday) {
            const weekNum = Math.floor(
              (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
                (7 * 24 * 60 * 60 * 1000)
            );
            shouldFire = weekNum % 2 === 0;
          }
          break;
        case "mensal":
          shouldFire = routine.month_day != null && monthDay === routine.month_day;
          break;
        case "mensal_primeiro":
          shouldFire = monthDay === 1;
          break;
        case "mensal_ultimo": {
          const last = lastDayOfMonth(date.getFullYear(), date.getMonth());
          shouldFire = date.getDate() === last.getDate();
          break;
        }
        case "primeiro_dia_util": {
          const firstBiz = firstBusinessDayOfMonth(date.getFullYear(), date.getMonth());
          shouldFire = date.getDate() === firstBiz.getDate() && date.getMonth() === firstBiz.getMonth();
          break;
        }
        case "ultimo_dia_util": {
          const lastBiz = lastBusinessDayOfMonth(date.getFullYear(), date.getMonth());
          shouldFire = date.getDate() === lastBiz.getDate() && date.getMonth() === lastBiz.getMonth();
          break;
        }
      }

      // Adjust to business day if needed
      if (shouldFire && routine.adjust_to_business_day && !isBusinessDay(date)) {
        const adjusted = prevBusinessDay(date);
        const adjustedStr = adjusted.toISOString().split("T")[0];
        // Only add if adjusted date is within our window
        if (adjusted >= today) {
          targetDates.push(adjustedStr);
        }
      } else if (shouldFire) {
        targetDates.push(dateStr);
      }
    }

    if (targetDates.length === 0) continue;

    // Resolve responsible: by role_function or direct responsible
    let assignedTo: string | null = routine.responsible || null;

    if (!assignedTo && routine.role_function && teamMembers) {
      const match = teamMembers.find(
        (m) =>
          m.role_title &&
          m.role_title.toLowerCase() === routine.role_function.toLowerCase() &&
          m.profile_id
      );
      if (match) {
        assignedTo = match.profile_id;
      }
    }

    // For each target date, check if task already exists (avoid duplicates)
    for (const dateStr of targetDates) {
      const isMeeting = (routine as any).format === 'reuniao';

      if (isMeeting) {
        // Avoid duplicate meeting for the same routine + date
        const { data: existingMeeting } = await supabase
          .from('meetings')
          .select('id')
          .eq('routine_id', routine.id)
          .gte('date_time', `${dateStr}T00:00:00`)
          .lte('date_time', `${dateStr}T23:59:59`)
          .limit(1);
        if (existingMeeting && existingMeeting.length > 0) continue;

        const startTime = (routine.hour_time && String(routine.hour_time).slice(0, 5)) || '09:00';
        const dt = `${dateStr}T${startTime}:00`;
        const planned =
          (routine as any).estimated_minutes ??
          (routine.estimated_time != null ? Math.round(Number(routine.estimated_time) * 60) : null);

        const { error: meetErr } = await supabase.from('meetings').insert({
          title: routine.title,
          date_time: new Date(dt).toISOString(),
          status: 'por_confirmar',
          meeting_type: 'recorrente',
          department: routine.department || null,
          project_id: routine.project_id || null,
          routine_id: routine.id,
          planned_duration_minutes: planned,
          duration_minutes: planned,
          created_by: routine.created_by || null,
        });
        if (meetErr) {
          console.error(`Error creating meeting for routine ${routine.id} on ${dateStr}:`, meetErr);
        } else {
          createdCount++;
        }
        continue;
      }

      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("routine_id", routine.id)
        .eq("deadline", dateStr)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create the task
      const { error: insertErr } = await supabase.from("tasks").insert({
        name: routine.title,
        status: "por_comecar",
        priority: "media",
        deadline: dateStr,
        assigned_to: assignedTo,
        department: routine.department || null,
        project_id: routine.project_id || null,
        routine_id: routine.id,
        recurrence_type: routine.recurrence_type,
        tag: "Rotina",
        estimated_time: routine.estimated_time || null,
        created_by: routine.created_by || null,
        // Carry the routine's planned time onto each generated task (HH:MM).
        scheduled_time: routine.hour_time
          ? String(routine.hour_time).slice(0, 5)
          : null,
      });

      if (insertErr) {
        console.error(`Error creating task for routine ${routine.id} on ${dateStr}:`, insertErr);
      } else {
        createdCount++;
      }
    }
  }

  await logRun({ functionName: "generate-routine-tasks", startedAt, status: "success", context: { created: createdCount, routines: routines.length } });
  return new Response(
    JSON.stringify({ message: "Routine tasks generated", created: createdCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun({ functionName: "generate-routine-tasks", startedAt, status: "failed", errorMessage: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
