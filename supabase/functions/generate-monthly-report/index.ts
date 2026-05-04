import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify owner role via user JWT, or allow scheduled calls via the private
    // service_role key. Never treat the anon key as a shared secret: it is
    // intentionally public in client apps.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let userId: string | null = null;

    // If token is the service_role key, it's a trusted scheduled call.
    if (token !== serviceKey) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Sessão inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isOwner } = await supabase.rpc("has_role", { _user_id: user.id, _role: "owner" });
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Apenas o owner pode gerar relatórios" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }


    // Parse body for month/year or use previous month
    let { month, year } = await req.json().catch(() => ({}));
    if (!month || !year) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      month = prev.getMonth() + 1;
      year = prev.getFullYear();
    }

    // Check if report already exists
    const { data: existing } = await supabase
      .from("monthly_reports")
      .select("id")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    // Upsert report record
    const reportId = existing?.id || crypto.randomUUID();
    if (existing) {
      await supabase.from("monthly_reports").update({
        status: "running",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      }).eq("id", reportId);
    } else {
      await supabase.from("monthly_reports").insert({
        id: reportId,
        year,
        month,
        status: "running",
        trigger_type: userId ? "manual" : "cron",
      });
    }

    const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // ──── Gather data from all modules ────

    // 1. Financial — entries (revenue)
    const { data: entries } = await supabase
      .from("financial_expenses")
      .select("amount, category, status, expense_type")
      .gte("expense_date", monthStart)
      .lt("expense_date", nextMonth);

    const revenue = (entries || [])
      .filter((e: any) => e.expense_type === "entrada")
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const expenses = (entries || [])
      .filter((e: any) => e.expense_type !== "entrada")
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    // 2. Commercial — sales
    const { data: sales } = await supabase
      .from("commercial_sales")
      .select("invoice_total, base_value, product, client, sale_month")
      .eq("sale_year", year)
      .eq("sale_month", month);

    const totalSales = (sales || []).reduce((s: number, e: any) => s + Number(e.invoice_total || 0), 0);
    const salesCount = (sales || []).length;

    // Annual goal
    const { data: annualGoal } = await supabase
      .from("commercial_annual_goals")
      .select("amount")
      .eq("year", year)
      .maybeSingle();

    // Total invoiced YTD
    const { data: ytdSales } = await supabase
      .from("commercial_sales")
      .select("invoice_total")
      .eq("sale_year", year)
      .lte("sale_month", month);
    const totalYtd = (ytdSales || []).reduce((s: number, e: any) => s + Number(e.invoice_total || 0), 0);

    // 3. Clients
    const { data: newClients } = await supabase
      .from("clients")
      .select("id")
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth)
      .eq("status", "ativo");

    const { count: activeClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");

    // NPS
    const { data: npsRecords } = await supabase
      .from("client_nps_records")
      .select("nps_score")
      .gte("actual_date", monthStart)
      .lt("actual_date", nextMonth)
      .not("nps_score", "is", null);

    const avgNps = npsRecords && npsRecords.length > 0
      ? npsRecords.reduce((s: number, r: any) => s + Number(r.nps_score), 0) / npsRecords.length
      : null;

    // 4. Tasks
    const { count: tasksCompleted } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "concluida")
      .gte("completed_at", monthStart)
      .lt("completed_at", nextMonth);

    const { count: tasksPending } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "concluida")
      .neq("status", "cancelada");

    // 5. Meetings
    const { count: meetingsHeld } = await supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .gte("date_time", monthStart)
      .lt("date_time", nextMonth);

    // 6. Team — time entries
    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("hours, member_id")
      .eq("entry_month", month)
      .eq("entry_year", year);

    const totalHours = (timeEntries || []).reduce((s: number, e: any) => s + Number(e.hours || 0), 0);
    const uniqueMembers = new Set((timeEntries || []).map((e: any) => e.member_id)).size;

    // 7. Leads
    const { data: leadsConverted } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("status", "ganho")
      .gte("updated_at", monthStart)
      .lt("updated_at", nextMonth);

    const { data: leadsLost } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("status", "perdido")
      .gte("updated_at", monthStart)
      .lt("updated_at", nextMonth);

    // 8. Project deliverables completed
    const { count: deliverablesCompleted } = await supabase
      .from("project_deliverables")
      .select("*", { count: "exact", head: true })
      .eq("status", "concluido")
      .gte("updated_at", monthStart)
      .lt("updated_at", nextMonth);

    // ──── Compile report data ────
    const reportData = {
      period: { year, month, label: `${MONTH_NAMES[month - 1]} ${year}` },
      financial: {
        revenue,
        expenses,
        margin: revenue - expenses,
        marginPct: revenue > 0 ? ((revenue - expenses) / revenue * 100) : 0,
      },
      commercial: {
        salesCount,
        totalSales,
        annualGoal: Number(annualGoal?.amount || 0),
        totalYtd,
        progressPct: annualGoal?.amount ? (totalYtd / Number(annualGoal.amount) * 100) : 0,
        topProducts: Object.entries(
          (sales || []).reduce((acc: Record<string, number>, s: any) => {
            acc[s.product || "Sem produto"] = (acc[s.product || "Sem produto"] || 0) + Number(s.invoice_total || 0);
            return acc;
          }, {})
        ).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5),
      },
      clients: {
        activeCount: activeClients || 0,
        newCount: (newClients || []).length,
        avgNps,
      },
      operations: {
        tasksCompleted: tasksCompleted || 0,
        tasksPending: tasksPending || 0,
        meetingsHeld: meetingsHeld || 0,
        deliverablesCompleted: deliverablesCompleted || 0,
      },
      team: {
        totalHours,
        activeMembers: uniqueMembers,
        avgHoursPerMember: uniqueMembers > 0 ? Math.round(totalHours / uniqueMembers * 10) / 10 : 0,
      },
      crm: {
        leadsConverted: (leadsConverted || []).length,
        leadsLost: (leadsLost || []).length,
      },
      generatedAt: new Date().toISOString(),
    };

    // ──── Store as JSON (PDF generation would require external service) ────
    const fileName = `report-${year}-${String(month).padStart(2, "0")}.json`;
    const fileContent = JSON.stringify(reportData, null, 2);
    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(fileContent);

    const { error: uploadError } = await supabase.storage
      .from("monthly-reports")
      .upload(fileName, fileBytes, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw new Error(`Erro ao guardar relatório: ${uploadError.message}`);

    // Update report record
    await supabase.from("monthly_reports").update({
      status: "completed",
      file_path: fileName,
      file_size_bytes: fileBytes.length,
      report_data: reportData,
      completed_at: new Date().toISOString(),
    }).eq("id", reportId);

    // ──── Notify owner(s) ────
    const notifyUserId = userId;
    if (notifyUserId) {
      await supabase.from("notifications").insert({
        user_id: notifyUserId,
        type: "monthly_report",
        title: "📊 Relatório mensal gerado",
        message: `O relatório de ${MONTH_NAMES[month - 1]} ${year} está pronto para consulta.`,
        link: "/executive",
      });
    } else {
      // Cron: notify all owners
      const { data: owners } = await supabase.from("user_roles").select("user_id").eq("role", "owner");
      for (const o of (owners || [])) {
        await supabase.from("notifications").insert({
          user_id: o.user_id,
          type: "monthly_report",
          title: "📊 Relatório mensal gerado",
          message: `O relatório de ${MONTH_NAMES[month - 1]} ${year} foi gerado automaticamente.`,
          link: "/executive",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, reportId, period: reportData.period }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
