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

  // Guard: only allow service-role or cron invocations
  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const results: string[] = [];

  // ── Load automation settings ──
  const enabledMap = new Map<string, boolean>();
  try {
    const { data: settings } = await supabase
      .from("automation_settings")
      .select("automation_key, enabled");
    for (const s of settings || []) {
      enabledMap.set(s.automation_key, s.enabled);
    }
  } catch {
    // If table doesn't exist yet, run everything (backwards compat)
  }

  function isEnabled(key: string): boolean {
    return enabledMap.get(key) ?? true; // default enabled
  }

  // Helper: run a section safely, log errors but continue
  async function runSection(name: string, key: string, fn: () => Promise<string | null>) {
    if (!isEnabled(key)) {
      results.push(`[SKIP] ${name}: disabled`);
      return;
    }
    try {
      const result = await fn();
      if (result) results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`[ERROR] ${name}: ${msg}`);
      console.error(`Section "${name}" failed:`, msg);
    }
  }

  // ── Get owner for notifications (used by multiple sections) ──
  let ownerId: string | null = null;
  try {
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    ownerId = ownerRole?.user_id || null;
  } catch { /* no owner */ }

  // ── 1. Sales: mark overdue ──
  await runSection("sales-overdue", "sales_overdue", async () => {
    const { data: overdueSales } = await supabase
      .from("commercial_sales")
      .select("id")
      .lt("payment_date", todayStr)
      .not("status", "in", '("pagamento_ok","recibo_enviado","contabilidade_ok","cancelada","em_atraso")');
    if (!overdueSales || overdueSales.length === 0) return null;
    const ids = overdueSales.map((s: { id: string }) => s.id);
    await supabase.from("commercial_sales").update({ status: "em_atraso" }).in("id", ids);
    return `Sales overdue: ${ids.length}`;
  });

  // ── 2. Sales: mark awaiting payment ──
  await runSection("sales-awaiting", "sales_awaiting", async () => {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);
    const { data: awaitingSales } = await supabase
      .from("commercial_sales")
      .select("id")
      .gte("payment_date", todayStr)
      .lt("payment_date", monthEnd)
      .eq("status", "na");
    if (!awaitingSales || awaitingSales.length === 0) return null;
    const ids = awaitingSales.map((s: { id: string }) => s.id);
    await supabase.from("commercial_sales").update({ status: "aguarda_pagamento" }).in("id", ids);
    return `Sales awaiting: ${ids.length}`;
  });

  // ── 3. Client renewal check ──
  await runSection("client-renewal", "client_renewal", async () => {
    if (!ownerId) return null;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, end_of_cycle, current_product, status")
      .eq("status", "ativo")
      .not("end_of_cycle", "is", null);
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
      const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= advanceDays && diffDays >= 0) {
        await supabase.from("clients").update({ status: "altura_renovacao" }).eq("id", client.id).eq("status", "ativo");
        const notifKey = `renewal-auto-${client.id}-${todayStr}`;
        const { data: existingNotif } = await supabase.from("notifications").select("id").eq("user_id", ownerId).eq("message", notifKey).limit(1);
        if (!existingNotif || existingNotif.length === 0) {
          await supabase.from("notifications").insert({
            user_id: ownerId, type: "client_renewal",
            title: `📅 Renovação — ${client.full_name} (${diffDays} dias)`,
            message: notifKey, link: `/hub/clientes/${client.id}`,
          });
        }
        const { data: existingTask } = await supabase.from("tasks").select("id").eq("name", `Renovação — ${client.full_name}`).limit(1);
        if (!existingTask || existingTask.length === 0) {
          await supabase.from("tasks").insert({
            name: `Renovação — ${client.full_name}`, status: "por_comecar", priority: "alta",
            deadline: client.end_of_cycle, department: "clientes",
            created_by: ownerId, assigned_to: ownerId, tag: "Renovação",
          });
        }
        renewalCount++;
      }
    }
    return `Clients renewal: ${renewalCount}`;
  });

  // ── 4. Contract expiry check ──
  await runSection("contract-expiry", "contract_expiry", async () => {
    if (!ownerId) return null;
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
      const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const memberName = (contract.team_members as any)?.full_name || "Membro";
      const notifKey = `contract-expiry-${contract.id}-${todayStr}`;
      const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", ownerId).eq("type", "contract_expiry").eq("message", notifKey).limit(1);
      if (!existing || existing.length === 0) {
        const emoji = daysLeft <= 0 ? "⚠️" : daysLeft <= 7 ? "🔴" : "🟡";
        const title = daysLeft <= 0
          ? `${emoji} Contrato de ${memberName} expirou`
          : `${emoji} Contrato de ${memberName} expira em ${daysLeft} dias`;
        await supabase.from("notifications").insert({
          user_id: ownerId, type: "contract_expiry", title, message: notifKey, link: "/hub/pessoas",
        });
        contractCount++;
      }
    }
    return `Contracts expiring: ${contractCount}`;
  });

  // ── 5. Capacity alert ──
  await runSection("capacity-alert", "capacity_alert", async () => {
    if (!ownerId) return null;
    const weekStart = getWeekStart(today);
    const weekEnd = getWeekEnd(today);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const { data: activeMembers } = await supabase
      .from("team_members")
      .select("id, full_name, expected_weekly_hours")
      .eq("status", "ativo");
    if (!activeMembers || activeMembers.length === 0) return null;
    const { data: weekEntries } = await supabase
      .from("time_entries")
      .select("member_id, duration")
      .gte("entry_date", weekStartStr)
      .lte("entry_date", weekEndStr);
    const hoursPerMember = new Map<string, number>();
    for (const entry of weekEntries || []) {
      if (!entry.member_id) continue;
      hoursPerMember.set(entry.member_id, (hoursPerMember.get(entry.member_id) || 0) + Number(entry.duration || 0));
    }
    let capacityAlerts = 0;
    for (const member of activeMembers) {
      const weeklyCapacity = member.expected_weekly_hours || 40;
      const hoursUsed = hoursPerMember.get(member.id) || 0;
      const occupancy = weeklyCapacity > 0 ? (hoursUsed / weeklyCapacity) * 100 : 0;
      if (occupancy >= 90) {
        const weekKey = `capacity-alert-${member.id}-${weekStartStr}`;
        const { data: existingAlert } = await supabase.from("notifications").select("id").eq("user_id", ownerId).eq("type", "capacity_alert").eq("message", weekKey).limit(1);
        if (!existingAlert || existingAlert.length === 0) {
          await supabase.from("notifications").insert({
            user_id: ownerId, type: "capacity_alert",
            title: `🔴 ${member.full_name} está a ${Math.round(occupancy)}% de capacidade esta semana. Considera realocar tarefas.`,
            message: weekKey, link: "/executive/gestao-equipa",
          });
          capacityAlerts++;
        }
      }
    }
    return `Capacity alerts: ${capacityAlerts}`;
  });

  // ── 6. Payroll → Financial sync ──
  await runSection("payroll-sync", "payroll_sync", async () => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const { data: paidPayroll } = await supabase
      .from("financial_payroll")
      .select("id, collaborator_name, gross_salary, total_cost, month, year, status, expense_id")
      .eq("status", "pago")
      .is("expense_id", null);
    let payrollSynced = 0;
    for (const pr of paidPayroll || []) {
      const monthLabel = monthNames[(pr.month || 1) - 1] || String(pr.month);
      const payDate = `${pr.year}-${String(pr.month).padStart(2, "0")}-15`;
      const { data: newExpense, error: expErr } = await supabase
        .from("financial_expenses")
        .insert({
          description: `Pagamento — ${pr.collaborator_name} — ${monthLabel} ${pr.year}`,
          category: "ordenados", base_value: pr.total_cost || pr.gross_salary || 0,
          vat_rate: 0, total_with_vat: pr.total_cost || pr.gross_salary || 0,
          location: "portugal", expense_date: payDate, expense_month: pr.month,
          expense_quarter: Math.ceil(pr.month / 3), expense_year: pr.year,
          status: "pago", source_type: "payroll", source_id: pr.id,
        })
        .select("id").single();
      if (!expErr && newExpense) {
        await supabase.from("financial_payroll").update({ expense_id: newExpense.id }).eq("id", pr.id);
        payrollSynced++;
      }
    }
    // Sync paid member_payments without linked expense
    const { data: paidMemberPayments } = await supabase
      .from("member_payments")
      .select("id, member_id, gross_value, month, year, payment_type, status")
      .eq("status", "pago");
    if (paidMemberPayments && paidMemberPayments.length > 0) {
      const memberIds = [...new Set(paidMemberPayments.map(p => p.member_id))];
      const { data: memberNameData } = await supabase.from("team_members").select("id, full_name").in("id", memberIds);
      const nameMap = new Map<string, string>();
      (memberNameData || []).forEach((m: { id: string; full_name: string }) => nameMap.set(m.id, m.full_name));
      for (const mp of paidMemberPayments) {
        const memberFullName = nameMap.get(mp.member_id) || "Membro";
        const monthLabel = monthNames[(mp.month || 1) - 1] || String(mp.month);
        const descPattern = `%${memberFullName}%${monthLabel}%${mp.year}%`;
        const [{ data: e1 }, { data: e2 }, { data: e3 }] = await Promise.all([
          supabase.from("financial_expenses").select("id").eq("source_type", "contract").eq("source_id", mp.id).limit(1),
          supabase.from("financial_expenses").select("id").eq("source_type", "member_payment").eq("source_id", mp.id).limit(1),
          supabase.from("financial_expenses").select("id").like("description", descPattern).eq("expense_month", mp.month).eq("expense_year", mp.year).limit(1),
        ]);
        if ((!e1 || e1.length === 0) && (!e2 || e2.length === 0) && (!e3 || e3.length === 0)) {
          const category = mp.payment_type === "contrato_trabalho" ? "ordenados" : "prestadores";
          const payDate = `${mp.year}-${String(mp.month).padStart(2, "0")}-15`;
          await supabase.from("financial_expenses").insert({
            description: `Pagamento — ${memberFullName} — ${monthLabel} ${mp.year}`,
            category, base_value: mp.gross_value || 0, vat_rate: 0, total_with_vat: mp.gross_value || 0,
            location: "portugal", expense_date: payDate, expense_month: mp.month,
            expense_quarter: Math.ceil(mp.month / 3), expense_year: mp.year,
            status: "pago", source_type: "member_payment", source_id: mp.id,
          });
          payrollSynced++;
        }
      }
    }
    return `Payroll synced: ${payrollSynced}`;
  });

  // ── 7. Auto-generate monthly payroll ──
  await runSection("payroll-autogen", "payroll_autogen", async () => {
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const { data: activeContracts } = await supabase
      .from("member_contracts")
      .select("id, member_id, monthly_value, contract_type, team_members(full_name)")
      .eq("status", "ativo")
      .eq("contract_type", "contrato_trabalho");
    let payrollAutoGenerated = 0;
    for (const contract of activeContracts || []) {
      const memberName = (contract.team_members as any)?.full_name || "Membro";
      const { data: existingPayroll } = await supabase
        .from("financial_payroll")
        .select("id")
        .eq("collaborator_name", memberName)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .limit(1);
      if (!existingPayroll || existingPayroll.length === 0) {
        const gross = contract.monthly_value || 0;
        const ssEmp = Math.round(gross * 0.11 * 100) / 100;
        const ssEr = Math.round(gross * 0.2375 * 100) / 100;
        const net = Math.round((gross - ssEmp) * 100) / 100;
        const totalCost = Math.round((gross + ssEr) * 100) / 100;
        const { data: expData } = await supabase
          .from("financial_expenses")
          .insert({
            description: `Salário — ${memberName} — ${monthNames[currentMonth - 1]} ${currentYear}`,
            category: "pessoal", base_value: totalCost, vat_rate: 0, total_with_vat: totalCost,
            location: "portugal", expense_date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
            expense_month: currentMonth, expense_quarter: Math.ceil(currentMonth / 3),
            expense_year: currentYear, status: "por_pagar", source_type: "payroll",
          })
          .select("id").single();
        if (expData) {
          await supabase.from("financial_payroll").insert({
            collaborator_name: memberName, gross_salary: gross,
            withholding_rate: 0, withholding_value: 0,
            ss_employee: ssEmp, ss_employer: ssEr,
            net_salary: net, total_cost: totalCost,
            month: currentMonth, year: currentYear,
            status: "por_pagar", expense_id: expData.id,
          });
          payrollAutoGenerated++;
        }
      }
    }
    return `Payroll auto-generated: ${payrollAutoGenerated}`;
  });

  // ── 8. Portal auto-deactivation ──
  await runSection("portal-deactivation", "portal_deactivation", async () => {
    const { data: expiredPortals } = await supabase
      .from("clients")
      .select("id")
      .eq("status", "terminado")
      .not("portal_deactivation_date", "is", null)
      .lte("portal_deactivation_date", todayStr);
    let portalsDeactivated = 0;
    for (const client of expiredPortals || []) {
      const { error: portalErr } = await supabase.from("client_portals").update({ is_active: false }).eq("client_id", client.id);
      if (!portalErr) portalsDeactivated++;
    }
    return portalsDeactivated > 0 ? `Portals deactivated: ${portalsDeactivated}` : null;
  });

  // ── 9. Auto-generate NPS records ──
  await runSection("nps-autogen", "nps_autogen", async () => {
    const { data: activeClients } = await supabase
      .from("clients")
      .select("id, current_product, start_date, status")
      .in("status", ["ativo", "em_onboarding"])
      .not("current_product", "is", null)
      .not("start_date", "is", null);
    let npsGenerated = 0;
    if (activeClients && activeClients.length > 0) {
      const { data: allProducts } = await supabase.from("products").select("id, name");
      const prodNameToId = new Map<string, string>();
      (allProducts || []).forEach((p: any) => prodNameToId.set(p.name, p.id));
      const productIds = [...new Set([...prodNameToId.values()])];
      const { data: npsConfigs } = await supabase.from("product_nps_config").select("product_id, cadence_days").in("product_id", productIds);
      const configMap = new Map<string, number>();
      (npsConfigs || []).forEach((c: any) => configMap.set(c.product_id, c.cadence_days));
      for (const client of activeClients) {
        const productId = prodNameToId.get(client.current_product || "");
        if (!productId) continue;
        const cadence = configMap.get(productId);
        if (!cadence) continue;
        const { data: existingNps } = await supabase.from("client_nps_records").select("id").eq("client_id", client.id).limit(1);
        if (existingNps && existingNps.length > 0) continue;
        const start = new Date(client.start_date + "T00:00:00");
        const records = [];
        for (let i = 1; i <= Math.floor(730 / cadence); i++) {
          const expectedDate = new Date(start);
          expectedDate.setDate(expectedDate.getDate() + cadence * i);
          records.push({ client_id: client.id, product_id: productId, expected_date: expectedDate.toISOString().slice(0, 10), status: "por_fazer", is_manual: false });
        }
        if (records.length > 0) {
          const { error: npsErr } = await supabase.from("client_nps_records").insert(records);
          if (!npsErr) npsGenerated++;
        }
      }
    }
    return npsGenerated > 0 ? `NPS auto-generated: ${npsGenerated}` : null;
  });

  // ── 10. Meeting reminders ──
  await runSection("meeting-reminders", "meeting_reminders", async () => {
    const tomorrowStr = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
    const { data: todayMeetings } = await supabase
      .from("meetings")
      .select("id, title, date_time, client_name, project_name, status")
      .gte("date_time", todayStr + "T00:00:00")
      .lt("date_time", tomorrowStr + "T00:00:00")
      .not("status", "eq", "terminada");
    if (!todayMeetings || todayMeetings.length === 0) return null;
    const meetingIds = todayMeetings.map((m: any) => m.id);
    const { data: participants } = await supabase.from("meeting_participants").select("meeting_id, profile_id").in("meeting_id", meetingIds);
    const profileIds = [...new Set((participants || []).map((p: any) => p.profile_id))];
    const { data: profileUsers } = profileIds.length > 0
      ? await supabase.from("profiles").select("id, user_id").in("id", profileIds)
      : { data: [] };
    const profileToUser = new Map((profileUsers || []).map((p: any) => [p.id, p.user_id]));
    let meetingNotifs = 0;
    for (const meeting of todayMeetings) {
      const meetingTime = new Date(meeting.date_time);
      const timeStr = meetingTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
      const notifKey = `meeting-reminder-${meeting.id}-${todayStr}`;
      const title = `📅 Reunião às ${timeStr}: ${meeting.title}`;
      const extra = meeting.client_name ? ` — ${meeting.client_name}` : meeting.project_name ? ` — ${meeting.project_name}` : "";
      const userIds = new Set<string>();
      if (ownerId) userIds.add(ownerId);
      (participants || []).filter((p: any) => p.meeting_id === meeting.id).forEach((p: any) => {
        const uid = profileToUser.get(p.profile_id);
        if (uid) userIds.add(uid);
      });
      for (const uid of userIds) {
        const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", uid).eq("type", "meeting_reminder").eq("message", notifKey).limit(1);
        if (existing && existing.length > 0) continue;
        await supabase.from("notifications").insert({
          user_id: uid, type: "meeting_reminder", title: title + extra, message: notifKey, link: `/hub/reunioes/${meeting.id}`,
        });
        meetingNotifs++;
      }
    }
    return `Meeting reminders: ${meetingNotifs}`;
  });

  // ── 11. Project deadline overdue ──
  await runSection("project-deadlines", "project_deadlines", async () => {
    if (!ownerId) return null;
    const { data: overdueProjects } = await supabase
      .from("projects")
      .select("id, name, deadline, client_name")
      .lt("deadline", todayStr)
      .not("status", "in", '("concluido","cancelado")');
    let deadlineNotifs = 0;
    for (const proj of overdueProjects || []) {
      const notifKey = `project-deadline-${proj.id}-${todayStr}`;
      const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", ownerId).eq("type", "project_deadline").eq("message", notifKey).limit(1);
      if (existing && existing.length > 0) continue;
      await supabase.from("notifications").insert({
        user_id: ownerId, type: "project_deadline",
        title: `⚠️ Projeto "${proj.name}" está com deadline em atraso${proj.client_name ? ` (${proj.client_name})` : ""}`,
        message: notifKey, link: `/hub/projetos/${proj.id}`,
      });
      deadlineNotifs++;
    }
    return deadlineNotifs > 0 ? `Project deadline alerts: ${deadlineNotifs}` : null;
  });

  // ── 12. Overdue task alerts ──
  await runSection("overdue-tasks", "overdue_tasks", async () => {
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, name, assigned_to, deadline")
      .lt("deadline", todayStr)
      .not("status", "in", '("done","cancelada")');
    let taskAlerts = 0;
    for (const t of overdueTasks || []) {
      const recipients = [ownerId, t.assigned_to].filter(Boolean);
      for (const uid of new Set(recipients)) {
        if (!uid) continue;
        const dedupKey = `task-overdue-${t.id}-${todayStr}`;
        const { count: existing } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("message", dedupKey);
        if ((existing || 0) > 0) continue;
        await supabase.from("notifications").insert({
          user_id: uid, type: "task", title: `Tarefa em atraso: ${t.name}`, message: dedupKey, link: "/tarefas",
        });
        taskAlerts++;
      }
    }
    return taskAlerts > 0 ? `Overdue task alerts: ${taskAlerts}` : null;
  });

  // ── 13. CRM Follow-up overdue ──
  await runSection("crm-followup", "crm_followup", async () => {
    const { data: overdueLeads } = await supabase
      .from("crm_leads")
      .select("id, name, next_followup, responsible_id")
      .lt("next_followup", todayStr)
      .not("status", "in", '("ganho","perdido")');
    let followUpAlerts = 0;
    for (const lead of overdueLeads || []) {
      const recipients = [ownerId, lead.responsible_id].filter(Boolean);
      for (const uid of new Set(recipients)) {
        if (!uid) continue;
        const dedupKey = `followup-overdue-${lead.id}-${todayStr}`;
        const { count: existing } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("message", dedupKey);
        if ((existing || 0) > 0) continue;
        await supabase.from("notifications").insert({
          user_id: uid, type: "crm", title: `📞 Follow-up em atraso: ${lead.name}`, message: dedupKey, link: "/comercial/crm",
        });
        followUpAlerts++;
      }
    }
    return followUpAlerts > 0 ? `CRM follow-up alerts: ${followUpAlerts}` : null;
  });

  // ── 14. Routine missed alerts ──
  await runSection("routine-missed", "routine_missed", async () => {
    const { data: missedRoutineTasks } = await supabase
      .from("tasks")
      .select("id, name, routine_id, assigned_to, deadline")
      .eq("tag", "Rotina")
      .eq("deadline", todayStr)
      .not("status", "in", '("done","concluida","cancelada")');
    if (!missedRoutineTasks || missedRoutineTasks.length === 0) return null;
    const routineIds = [...new Set(missedRoutineTasks.map((t: any) => t.routine_id).filter(Boolean))];
    const { data: routines } = routineIds.length > 0
      ? await supabase.from("planning_routines").select("id, title, role_function, created_by").in("id", routineIds)
      : { data: [] };
    const routineMap = new Map((routines || []).map((r: any) => [r.id, r]));
    let routineAlerts = 0;
    for (const t of missedRoutineTasks) {
      const routine = routineMap.get(t.routine_id);
      const recipients = [ownerId, t.assigned_to, routine?.created_by].filter(Boolean);
      for (const uid of new Set(recipients)) {
        if (!uid) continue;
        const dedupKey = `routine-missed-${t.id}-${todayStr}`;
        const { count: existing } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("message", dedupKey);
        if ((existing || 0) > 0) continue;
        const roleLabel = routine?.role_function ? ` (${routine.role_function})` : "";
        await supabase.from("notifications").insert({
          user_id: uid, type: "task", title: `⚠️ Rotina não concluída: ${t.name}${roleLabel}`, message: dedupKey, link: "/tarefas",
        });
        routineAlerts++;
      }
    }
    return `Routine missed alerts: ${routineAlerts}`;
  });

  // ── 15. Recurring expenses ──
  await runSection("recurring-expenses", "recurring_expenses", async () => {
    const dayOfMonth = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const { data: recurringExpenses } = await supabase
      .from("financial_expenses")
      .select("*")
      .eq("is_recurring", true)
      .is("parent_expense_id", null);
    let generatedCount = 0;
    for (const re of recurringExpenses || []) {
      if ((re.recurrence_day || 1) !== dayOfMonth) continue;
      if (re.recurrence_end_date && todayStr > re.recurrence_end_date) continue;
      const { count } = await supabase.from("financial_expenses").select("id", { count: "exact", head: true }).eq("parent_expense_id", re.id).eq("expense_month", currentMonth).eq("expense_year", currentYear);
      if ((count || 0) > 0) continue;
      const expDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
      await supabase.from("financial_expenses").insert({
        description: re.description, category: re.category,
        base_value: re.base_value, vat_rate: re.vat_rate, total_with_vat: re.total_with_vat,
        location: re.location, supplier_id: re.supplier_id,
        status: "por_pagar", expense_date: expDate,
        expense_month: currentMonth, expense_quarter: Math.ceil(currentMonth / 3),
        expense_year: currentYear, parent_expense_id: re.id, is_recurring: false,
      });
      generatedCount++;
    }
    return generatedCount > 0 ? `Generated ${generatedCount} recurring expenses` : null;
  });

  // ── 16. Fiscal tasks ──
  await runSection("fiscal-tasks", "fiscal_tasks", async () => {
    if (!ownerId) return null;
    const currentMonth2 = today.getMonth() + 1;
    const currentYear2 = today.getFullYear();
    const { data: bsData } = await supabase.from("business_settings").select("tax_iva_regime, tax_irs_regime, ss_exempt, iva_exempt").limit(1).maybeSingle();
    if (!bsData) return null;
    const fiscalConfig = {
      taxIvaRegime: (bsData as any).tax_iva_regime || "trimestral",
      taxIrsRegime: (bsData as any).tax_irs_regime || "simplificado",
      ssExempt: (bsData as any).ss_exempt ?? false,
      ivaExempt: (bsData as any).iva_exempt ?? false,
    };
    const deadlines = computeFiscalDeadlinesEdge(currentYear2, fiscalConfig);
    let fiscalTasksCreated = 0;
    for (const dl of deadlines) {
      const dlDate = new Date(dl.date + "T00:00:00");
      const diffDays = Math.ceil((dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30 || diffDays < 0) continue;
      const { data: existingTask } = await supabase.from("tasks").select("id").eq("name", dl.name).limit(1);
      if (existingTask && existingTask.length > 0) continue;
      await supabase.from("tasks").insert({
        name: dl.name, status: "por_comecar", priority: "alta",
        deadline: dl.date, department: "contabilidade",
        created_by: ownerId, assigned_to: ownerId, tag: "Fiscal",
      });
      fiscalTasksCreated++;
    }
    return fiscalTasksCreated > 0 ? `Fiscal tasks created: ${fiscalTasksCreated}` : null;
  });

  // ── 17. Auto-revoke access for inactive members ──
  await runSection("access-revoke", "access_revoke", async () => {
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: toRevoke } = await supabase
      .from("team_members")
      .select("id, full_name, profile_id")
      .eq("status", "inativo")
      .eq("access_revoked", false)
      .not("inactivated_at", "is", null)
      .lte("inactivated_at", oneWeekAgo);
    if (!toRevoke || toRevoke.length === 0) return null;
    for (const member of toRevoke) {
      await supabase.from("team_members").update({ access_revoked: true }).eq("id", member.id);
      if (member.profile_id) {
        await supabase.from("members").delete().eq("user_id", member.profile_id);
      }
      if (ownerId) {
        const dedupKey = `access-revoked-${member.id}`;
        const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", ownerId).eq("message", dedupKey).maybeSingle();
        if (!existing) {
          await supabase.from("notifications").insert({ user_id: ownerId, message: dedupKey, type: "team" });
        }
      }
      results.push(`Access revoked for: ${member.full_name}`);
    }
    return null;
  });

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ── Helper: get Monday of current week ──
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

// ── Fiscal deadline helpers ──
const PT_FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], [4, 25], [5, 1], [6, 10], [8, 15], [10, 5], [11, 1], [12, 1], [12, 8], [12, 25],
];

function isFiscalNonBusiness(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  const m = d.getMonth() + 1, dd = d.getDate();
  return PT_FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === dd);
}

function adjustFiscalDate(d: Date): Date {
  const result = new Date(d);
  while (isFiscalNonBusiness(result)) result.setDate(result.getDate() - 1);
  return result;
}

function fmtFiscal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FiscalDl { name: string; date: string; }

const ML_EDGE = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function computeFiscalDeadlinesEdge(year: number, config: { taxIvaRegime: string; taxIrsRegime: string; ssExempt: boolean; ivaExempt: boolean }): FiscalDl[] {
  const deadlines: FiscalDl[] = [];
  if (!config.ssExempt && config.taxIrsRegime !== "contabilidade_organizada") {
    for (let m = 1; m <= 12; m++) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? year + 1 : year;
      const raw = new Date(ny, nm - 1, 20);
      deadlines.push({ name: `Pagamento SS — ${ML_EDGE[m - 1]} ${year}`, date: fmtFiscal(adjustFiscalDate(raw)) });
    }
  }
  if (!config.ivaExempt && config.taxIvaRegime === "trimestral" && config.taxIrsRegime !== "contabilidade_organizada") {
    const qs = [
      { q: 1, label: "1º Trim (Jan-Mar)", dm: 5, dy: year },
      { q: 2, label: "2º Trim (Abr-Jun)", dm: 8, dy: year },
      { q: 3, label: "3º Trim (Jul-Set)", dm: 11, dy: year },
      { q: 4, label: "4º Trim (Out-Dez)", dm: 2, dy: year + 1 },
    ];
    for (const q of qs) {
      const raw = new Date(q.dy, q.dm, 0);
      deadlines.push({ name: `IVA ${q.label} ${year}`, date: fmtFiscal(adjustFiscalDate(raw)) });
    }
  }
  if (!config.ivaExempt && config.taxIvaRegime === "mensal" && config.taxIrsRegime !== "contabilidade_organizada") {
    for (let m = 1; m <= 12; m++) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? year + 1 : year;
      const raw = new Date(ny, nm - 1, 20);
      deadlines.push({ name: `IVA — ${ML_EDGE[m - 1]} ${year}`, date: fmtFiscal(adjustFiscalDate(raw)) });
    }
  }
  if (config.taxIrsRegime === "simplificado") {
    const raw = new Date(year + 1, 5, 30);
    deadlines.push({ name: `Entrega IRS — Ano ${year}`, date: fmtFiscal(adjustFiscalDate(raw)) });
  }
  return deadlines;
}
