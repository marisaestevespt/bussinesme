import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
    const todayStr = toDateStr(today);
    const year = today.getFullYear();

    // Find owner
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!ownerRole) {
      return new Response(
        JSON.stringify({ success: true, message: "No owner found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownerId = ownerRole.user_id;

    // ── Clients ──
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, birthday")
      .in("status", ["ativo", "em_onboarding"])
      .not("birthday", "is", null);

    // ── Team members ──
    const { data: members } = await supabase
      .from("team_members")
      .select("id, full_name, birthday")
      .eq("status", "ativo")
      .not("birthday", "is", null);

    interface Person {
      name: string;
      birthday: string;
      link: string;
      source: string;
    }
    const people: Person[] = [];

    (clients || []).forEach((c: any) => {
      if (c.birthday)
        people.push({
          name: c.full_name,
          birthday: c.birthday,
          link: `/hub/clientes/${c.id}`,
          source: "cliente",
        });
    });
    (members || []).forEach((m: any) => {
      if (m.birthday)
        people.push({
          name: m.full_name,
          birthday: m.birthday,
          link: "/hub-equipa",
          source: "equipa",
        });
    });

    if (people.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No birthdays to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notifications: {
      user_id: string;
      type: string;
      title: string;
      link: string;
      message: string;
    }[] = [];

    for (const person of people) {
      const bd = new Date(person.birthday + "T00:00:00");
      const thisYearBd = new Date(year, bd.getMonth(), bd.getDate());
      const targetBd =
        thisYearBd < today &&
        !(
          thisYearBd.getMonth() === today.getMonth() &&
          thisYearBd.getDate() === today.getDate()
        )
          ? new Date(year + 1, bd.getMonth(), bd.getDate())
          : thisYearBd;

      const alert30 = subtractBusinessDays(targetBd, 30);
      const alert15 = subtractBusinessDays(targetBd, 15);

      const checks = [
        {
          date: alert30,
          prefix: "📅 Faltam ~30 dias úteis para o aniversário",
        },
        {
          date: alert15,
          prefix: "📅 Faltam ~15 dias úteis para o aniversário",
        },
        { date: targetBd, prefix: "🎂 Hoje é o aniversário" },
      ];

      for (const check of checks) {
        if (toDateStr(check.date) === todayStr) {
          const label =
            person.source === "cliente" ? "(cliente)" : "(equipa)";
          notifications.push({
            user_id: ownerId,
            type: "birthday",
            title: `${check.prefix} de ${person.name} ${label}`,
            link: person.link,
            message: `birthday-${person.source}-${person.birthday}-${todayStr}`,
          });
        }
      }
    }

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No birthday notifications today",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate
    const { data: existing } = await supabase
      .from("notifications")
      .select("message")
      .eq("user_id", ownerId)
      .eq("type", "birthday")
      .gte("created_at", todayStr);

    const existingMessages = new Set(
      (existing || []).map((n: { message: string }) => n.message)
    );
    const toInsert = notifications.filter(
      (n) => !existingMessages.has(n.message)
    );

    if (toInsert.length > 0) {
      await supabase.from("notifications").insert(toInsert);
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: toInsert.length,
        skipped: notifications.length - toInsert.length,
      }),
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
