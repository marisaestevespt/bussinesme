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

    // ── 3. Get owner for notifications ──
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (ownerRole) {
      const ownerId = ownerRole.user_id;

      // ── 4. Clients: renewal check ──
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
        const diffDays = Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= advanceDays && diffDays >= 0) {
          await supabase
            .from("clients")
            .update({ status: "altura_renovacao" })
            .eq("id", client.id)
            .eq("status", "ativo");

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

      // ── 5. Contract expiry check ──
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

      // ── 6. Capacity alert: check team members at 90%+ this week ──
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const { data: activeMembers } = await supabase
        .from("team_members")
        .select("id, full_name, expected_weekly_hours")
        .eq("status", "ativo");

      if (activeMembers && activeMembers.length > 0) {
        const { data: weekEntries } = await supabase
          .from("time_entries")
          .select("member_id, duration")
          .gte("entry_date", weekStartStr)
          .lte("entry_date", weekEndStr);

        const hoursPerMember = new Map<string, number>();
        for (const entry of weekEntries || []) {
          if (!entry.member_id) continue;
          hoursPerMember.set(
            entry.member_id,
            (hoursPerMember.get(entry.member_id) || 0) + Number(entry.duration || 0)
          );
        }

        let capacityAlerts = 0;
        for (const member of activeMembers) {
          const weeklyCapacity = member.expected_weekly_hours || 40;
          const hoursUsed = hoursPerMember.get(member.id) || 0;
          const occupancy = weeklyCapacity > 0 ? (hoursUsed / weeklyCapacity) * 100 : 0;

          if (occupancy >= 90) {
            const weekKey = `capacity-alert-${member.id}-${weekStartStr}`;
            const { data: existingAlert } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", ownerId)
              .eq("type", "capacity_alert")
              .eq("message", weekKey)
              .limit(1);

            if (!existingAlert || existingAlert.length === 0) {
              await supabase.from("notifications").insert({
                user_id: ownerId,
                type: "capacity_alert",
                title: `🔴 ${member.full_name} está a ${Math.round(occupancy)}% de capacidade esta semana. Considera realocar tarefas.`,
                message: weekKey,
                link: "/executive/gestao-equipa",
              });
              capacityAlerts++;
            }
          }
        }
        results.push(`Capacity alerts: ${capacityAlerts}`);
      }

      // ── 7. Payroll → Financial sync ──
      const { data: paidPayroll } = await supabase
        .from("financial_payroll")
        .select("id, collaborator_name, gross_salary, net_salary, total_cost, ss_employer, month, year, status, expense_id")
        .eq("status", "pago")
        .is("expense_id", null);

      let payrollSynced = 0;
      for (const pr of paidPayroll || []) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthLabel = monthNames[(pr.month || 1) - 1] || String(pr.month);
        const payDate = `${pr.year}-${String(pr.month).padStart(2, "0")}-15`;

        const { data: newExpense, error: expErr } = await supabase
          .from("financial_expenses")
          .insert({
            description: `Pagamento — ${pr.collaborator_name} — ${monthLabel} ${pr.year}`,
            category: "ordenados",
            base_value: pr.total_cost || pr.gross_salary || 0,
            vat_rate: 0,
            total_with_vat: pr.total_cost || pr.gross_salary || 0,
            location: "portugal",
            expense_date: payDate,
            expense_month: pr.month,
            expense_quarter: Math.ceil(pr.month / 3),
            expense_year: pr.year,
            status: "pago",
            source_type: "payroll",
            source_id: pr.id,
          })
          .select("id")
          .single();

        if (!expErr && newExpense) {
          await supabase
            .from("financial_payroll")
            .update({ expense_id: newExpense.id })
            .eq("id", pr.id);
          payrollSynced++;
        }
      }

      // Also sync paid member_payments (contractor payments) without a linked expense
      const { data: paidMemberPayments } = await supabase
        .from("member_payments")
        .select("id, member_id, gross_value, net_value, month, year, payment_type, status")
        .eq("status", "pago");

      if (paidMemberPayments && paidMemberPayments.length > 0) {
        const memberIds = [...new Set(paidMemberPayments.map(p => p.member_id))];
        const { data: memberNames } = await supabase
          .from("team_members")
          .select("id, full_name")
          .in("id", memberIds);
        const nameMap = new Map<string, string>();
        (memberNames || []).forEach((m: { id: string; full_name: string }) => nameMap.set(m.id, m.full_name));

        for (const mp of paidMemberPayments) {
          const { data: existingExp } = await supabase
            .from("financial_expenses")
            .select("id")
            .eq("source_type", "contract")
            .eq("source_id", mp.id)
            .limit(1);

          const { data: existingExp2 } = await supabase
            .from("financial_expenses")
            .select("id")
            .eq("source_type", "member_payment")
            .eq("source_id", mp.id)
            .limit(1);

          if (
            (!existingExp || existingExp.length === 0) &&
            (!existingExp2 || existingExp2.length === 0)
          ) {
            const memberFullName = nameMap.get(mp.member_id) || "Membro";
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
              "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const monthLabel = monthNames[(mp.month || 1) - 1] || String(mp.month);

            const descPattern = `%${memberFullName}%${monthLabel}%${mp.year}%`;
            const { data: descMatch } = await supabase
              .from("financial_expenses")
              .select("id")
              .like("description", descPattern)
              .eq("expense_month", mp.month)
              .eq("expense_year", mp.year)
              .limit(1);

            if (!descMatch || descMatch.length === 0) {
              const category = mp.payment_type === "contrato_trabalho" ? "ordenados" : "prestadores";
              const payDate = `${mp.year}-${String(mp.month).padStart(2, "0")}-15`;

              await supabase.from("financial_expenses").insert({
                description: `Pagamento — ${memberFullName} — ${monthLabel} ${mp.year}`,
                category,
                base_value: mp.gross_value || 0,
                vat_rate: 0,
                total_with_vat: mp.gross_value || 0,
                location: "portugal",
                expense_date: payDate,
                expense_month: mp.month,
                expense_quarter: Math.ceil(mp.month / 3),
                expense_year: mp.year,
                status: "pago",
                source_type: "member_payment",
                source_id: mp.id,
              });
              payrollSynced++;
            }
          }
        }
      }

      results.push(`Payroll synced: ${payrollSynced}`);
    }

    // ── 8. Auto-generate monthly payroll from active contrato_trabalho contracts ──
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const { data: activeContracts } = await supabase
      .from("member_contracts")
      .select("id, member_id, monthly_value, contract_type, team_members(full_name)")
      .eq("status", "ativo")
      .eq("contract_type", "contrato_trabalho");

    let payrollAutoGenerated = 0;
    for (const contract of activeContracts || []) {
      const memberName = (contract.team_members as any)?.full_name || "Membro";
      // Check if payroll entry already exists for this month
      const { data: existingPayroll } = await supabase
        .from("financial_payroll")
        .select("id")
        .eq("collaborator_name", memberName)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .limit(1);

      if (!existingPayroll || existingPayroll.length === 0) {
        const gross = contract.monthly_value || 0;
        const whRate = 0; // default, user can adjust
        const ssEmp = Math.round(gross * 0.11 * 100) / 100;
        const ssEr = Math.round(gross * 0.2375 * 100) / 100;
        const net = Math.round((gross - ssEmp) * 100) / 100;
        const totalCost = Math.round((gross + ssEr) * 100) / 100;

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthLabel = monthNames[currentMonth - 1];

        // Create expense
        const { data: expData } = await supabase
          .from("financial_expenses")
          .insert({
            description: `Salário — ${memberName} — ${monthLabel} ${currentYear}`,
            category: "pessoal",
            base_value: totalCost,
            vat_rate: 0,
            total_with_vat: totalCost,
            location: "portugal",
            expense_date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
            expense_month: currentMonth,
            expense_quarter: Math.ceil(currentMonth / 3),
            expense_year: currentYear,
            status: "por_pagar",
            source_type: "payroll",
          })
          .select("id")
          .single();

        if (expData) {
          await supabase.from("financial_payroll").insert({
            collaborator_name: memberName,
            gross_salary: gross,
            withholding_rate: whRate,
            withholding_value: 0,
            ss_employee: ssEmp,
            ss_employer: ssEr,
            net_salary: net,
            total_cost: totalCost,
            month: currentMonth,
            year: currentYear,
            status: "por_pagar",
            expense_id: expData.id,
          });
          payrollAutoGenerated++;
        }
      }
    }
    results.push(`Payroll auto-generated: ${payrollAutoGenerated}`);

    // ── 9. Portal auto-deactivation (30 days after terminado) ──
    const { data: expiredPortals } = await supabase
      .from("clients")
      .select("id")
      .eq("status", "terminado")
      .not("portal_deactivation_date", "is", null)
      .lte("portal_deactivation_date", todayStr);

    let portalsDeactivated = 0;
    for (const client of expiredPortals || []) {
      const { error: portalErr } = await supabase
        .from("client_portals")
        .update({ is_active: false })
        .eq("client_id", client.id);
      if (!portalErr) portalsDeactivated++;
    }
    results.push(`Portals deactivated: ${portalsDeactivated}`);

    // ── 9. Auto-generate NPS records for active clients missing them ──
    const { data: activeClients } = await supabase
      .from("clients")
      .select("id, current_product, start_date, status")
      .in("status", ["ativo", "em_onboarding"])
      .not("current_product", "is", null)
      .not("start_date", "is", null);

    let npsGenerated = 0;
    if (activeClients && activeClients.length > 0) {
      // Get all products with NPS config
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name");
      const prodNameToId = new Map<string, string>();
      (allProducts || []).forEach((p: any) => prodNameToId.set(p.name, p.id));

      const productIds = [...new Set([...prodNameToId.values()])];
      const { data: npsConfigs } = await supabase
        .from("product_nps_config")
        .select("product_id, cadence_days")
        .in("product_id", productIds);
      const configMap = new Map<string, number>();
      (npsConfigs || []).forEach((c: any) => configMap.set(c.product_id, c.cadence_days));

      for (const client of activeClients) {
        const productId = prodNameToId.get(client.current_product || "");
        if (!productId) continue;
        const cadence = configMap.get(productId);
        if (!cadence) continue;

        // Check if records already exist
        const { data: existingNps } = await supabase
          .from("client_nps_records")
          .select("id")
          .eq("client_id", client.id)
          .limit(1);

        if (existingNps && existingNps.length > 0) continue;

        // Generate NPS records
        const start = new Date(client.start_date + "T00:00:00");
        const records = [];
        for (let i = 1; i <= Math.floor(730 / cadence); i++) {
          const expectedDate = new Date(start);
          expectedDate.setDate(expectedDate.getDate() + cadence * i);
          records.push({
            client_id: client.id,
            product_id: productId,
            expected_date: expectedDate.toISOString().slice(0, 10),
            status: "por_fazer",
            is_manual: false,
          });
        }
        if (records.length > 0) {
          const { error: npsErr } = await supabase.from("client_nps_records").insert(records);
          if (!npsErr) npsGenerated++;
        }
      }
    }
    results.push(`NPS auto-generated: ${npsGenerated}`);

    // ── 9. Meeting reminders — notify about meetings happening today ──
    {
      const tomorrowStr = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
      const { data: todayMeetings } = await supabase
        .from("meetings")
        .select("id, title, date_time, client_name, project_name, status")
        .gte("date_time", todayStr + "T00:00:00")
        .lt("date_time", tomorrowStr + "T00:00:00")
        .not("status", "eq", "terminada");

      let meetingNotifs = 0;
      if (todayMeetings && todayMeetings.length > 0) {
        // Get owner user_id for notifications
        const { data: ownerRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner")
          .limit(1)
          .single();
        const ownerId = ownerRole?.user_id;

        // Also get all participant user_ids per meeting
        const meetingIds = todayMeetings.map((m: any) => m.id);
        const { data: participants } = await supabase
          .from("meeting_participants")
          .select("meeting_id, profile_id")
          .in("meeting_id", meetingIds);

        // Get profile→user_id mapping
        const profileIds = [...new Set((participants || []).map((p: any) => p.profile_id))];
        const { data: profileUsers } = profileIds.length > 0
          ? await supabase.from("profiles").select("id, user_id").in("id", profileIds)
          : { data: [] };
        const profileToUser = new Map((profileUsers || []).map((p: any) => [p.id, p.user_id]));

        for (const meeting of todayMeetings) {
          const meetingTime = new Date(meeting.date_time);
          const timeStr = meetingTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
          const notifKey = `meeting-reminder-${meeting.id}-${todayStr}`;
          const title = `📅 Reunião às ${timeStr}: ${meeting.title}`;
          const extra = meeting.client_name ? ` — ${meeting.client_name}` : meeting.project_name ? ` — ${meeting.project_name}` : "";

          // Collect unique user_ids to notify
          const userIds = new Set<string>();
          if (ownerId) userIds.add(ownerId);
          (participants || [])
            .filter((p: any) => p.meeting_id === meeting.id)
            .forEach((p: any) => {
              const uid = profileToUser.get(p.profile_id);
              if (uid) userIds.add(uid);
            });

          for (const uid of userIds) {
            // Dedup
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("type", "meeting_reminder")
              .eq("message", notifKey)
              .limit(1);
            if (existing && existing.length > 0) continue;

            await supabase.from("notifications").insert({
              user_id: uid,
              type: "meeting_reminder",
              title: title + extra,
              message: notifKey,
              link: `/hub/reunioes/${meeting.id}`,
            });
            meetingNotifs++;
          }
        }
      }
      results.push(`Meeting reminders: ${meetingNotifs}`);
    }

    // ── 10. Project deadline overdue notifications ──
    {
      const { data: overdueProjects } = await supabase
        .from("projects")
        .select("id, name, deadline, client_name")
        .lt("deadline", todayStr)
        .not("status", "in", '("concluido","cancelado")');

      let deadlineNotifs = 0;
      if (overdueProjects && overdueProjects.length > 0) {
        const { data: ownerRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner")
          .limit(1)
          .single();

        if (ownerRole) {
          for (const proj of overdueProjects) {
            const notifKey = `project-deadline-${proj.id}-${todayStr}`;
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", ownerRole.user_id)
              .eq("type", "project_deadline")
              .eq("message", notifKey)
              .limit(1);
            if (existing && existing.length > 0) continue;

            await supabase.from("notifications").insert({
              user_id: ownerRole.user_id,
              type: "project_deadline",
              title: `⚠️ Projeto "${proj.name}" está com deadline em atraso${proj.client_name ? ` (${proj.client_name})` : ""}`,
              message: notifKey,
              link: `/hub/projetos/${proj.id}`,
            });
            deadlineNotifs++;
          }
        }
      }
      results.push(`Project deadline alerts: ${deadlineNotifs}`);
    }

    // ── Overdue task alerts ──
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, name, assigned_to, deadline")
      .lt("deadline", todayStr)
      .not("status", "in", '("done","cancelada")');

    if (overdueTasks && overdueTasks.length > 0) {
      let taskAlerts = 0;
      for (const t of overdueTasks) {
        const recipients = [ownerId, t.assigned_to].filter(Boolean);
        for (const uid of new Set(recipients)) {
          if (!uid) continue;
          const dedupKey = `task-overdue-${t.id}-${todayStr}`;
          const { count: existing } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .eq("message", dedupKey);
          if ((existing || 0) > 0) continue;

          await supabase.from("notifications").insert({
            user_id: uid,
            type: "task",
            title: `Tarefa em atraso: ${t.name}`,
            message: dedupKey,
            link: "/tarefas",
          });
          taskAlerts++;
        }
      }
      results.push(`Overdue task alerts: ${taskAlerts}`);
    }

    // ── CRM Follow-up overdue alerts ──
    {
      const { data: overdueLeads } = await supabase
        .from("crm_leads")
        .select("id, name, next_followup, responsible_id")
        .lt("next_followup", todayStr)
        .not("status", "in", '("ganho","perdido")');

      let followUpAlerts = 0;
      if (overdueLeads && overdueLeads.length > 0) {
        for (const lead of overdueLeads) {
          const recipients = [ownerRole?.user_id, lead.responsible_id].filter(Boolean);
          for (const uid of new Set(recipients)) {
            if (!uid) continue;
            const dedupKey = `followup-overdue-${lead.id}-${todayStr}`;
            const { count: existing } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", uid)
              .eq("message", dedupKey);
            if ((existing || 0) > 0) continue;

            await supabase.from("notifications").insert({
              user_id: uid,
              type: "crm",
              title: `📞 Follow-up em atraso: ${lead.name}`,
              message: dedupKey,
              link: "/comercial/crm",
            });
            followUpAlerts++;
          }
        }
      }
      results.push(`CRM follow-up alerts: ${followUpAlerts}`);
    }

    // ── Routine missed alerts ──
    {
      const { data: missedRoutineTasks } = await supabase
        .from("tasks")
        .select("id, name, routine_id, assigned_to, deadline")
        .eq("tag", "Rotina")
        .eq("deadline", todayStr)
        .not("status", "in", '("done","concluida","cancelada")');

      let routineAlerts = 0;
      if (missedRoutineTasks && missedRoutineTasks.length > 0) {
        // Get routine details for role_function lookup
        const routineIds = [...new Set(missedRoutineTasks.map((t: any) => t.routine_id).filter(Boolean))];
        const { data: routines } = routineIds.length > 0
          ? await supabase.from("planning_routines").select("id, title, role_function, created_by").in("id", routineIds)
          : { data: [] };
        const routineMap = new Map((routines || []).map((r: any) => [r.id, r]));

        for (const t of missedRoutineTasks) {
          const routine = routineMap.get(t.routine_id);
          const recipients = [ownerRole?.user_id, t.assigned_to, routine?.created_by].filter(Boolean);
          for (const uid of new Set(recipients)) {
            if (!uid) continue;
            const dedupKey = `routine-missed-${t.id}-${todayStr}`;
            const { count: existing } = await supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", uid)
              .eq("message", dedupKey);
            if ((existing || 0) > 0) continue;

            const roleLabel = routine?.role_function ? ` (${routine.role_function})` : "";
            await supabase.from("notifications").insert({
              user_id: uid,
              type: "task",
              title: `⚠️ Rotina não concluída: ${t.name}${roleLabel}`,
              message: dedupKey,
              link: "/tarefas",
            });
            routineAlerts++;
          }
        }
      }
      results.push(`Routine missed alerts: ${routineAlerts}`);
    }

    const dayOfMonth = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const { data: recurringExpenses } = await supabase
      .from("financial_expenses")
      .select("*")
      .eq("is_recurring", true)
      .is("parent_expense_id", null);

    if (recurringExpenses && recurringExpenses.length > 0) {
      let generatedCount = 0;
      for (const re of recurringExpenses) {
        if ((re.recurrence_day || 1) !== dayOfMonth) continue;
        // Check end date
        if (re.recurrence_end_date && todayStr > re.recurrence_end_date) continue;
        // Check if already generated for this month
        const { count } = await supabase
          .from("financial_expenses")
          .select("id", { count: "exact", head: true })
          .eq("parent_expense_id", re.id)
          .eq("expense_month", currentMonth)
          .eq("expense_year", currentYear);
        if ((count || 0) > 0) continue;
        // Generate
        const expDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
        await supabase.from("financial_expenses").insert({
          description: re.description,
          category: re.category,
          base_value: re.base_value,
          vat_rate: re.vat_rate,
          total_with_vat: re.total_with_vat,
          location: re.location,
          supplier_id: re.supplier_id,
          status: "por_pagar",
          expense_date: expDate,
          expense_month: currentMonth,
          expense_quarter: Math.ceil(currentMonth / 3),
          expense_year: currentYear,
          parent_expense_id: re.id,
          is_recurring: false,
        });
        generatedCount++;
      }
      if (generatedCount > 0) {
        results.push(`Generated ${generatedCount} recurring expenses`);
      }
    }

    // ── 15. Auto-revoke access for inactive members (1 week after inactivation) ──
    {
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: toRevoke } = await supabase
        .from("team_members")
        .select("id, full_name, profile_id")
        .eq("status", "inativo")
        .eq("access_revoked", false)
        .not("inactivated_at", "is", null)
        .lte("inactivated_at", oneWeekAgo);

      if (toRevoke && toRevoke.length > 0) {
        for (const member of toRevoke) {
          // Mark access as revoked
          await supabase
            .from("team_members")
            .update({ access_revoked: true })
            .eq("id", member.id);

          // Remove from members table (removes role/permissions)
          if (member.profile_id) {
            await supabase
              .from("members")
              .delete()
              .eq("user_id", member.profile_id);
          }

          // Get owner for notification
          const { data: owners } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "owner");
          const ownerIds = (owners || []).map((o: any) => o.user_id);
          const dedupKey = `access-revoked-${member.id}`;
          for (const ownerId of ownerIds) {
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", ownerId)
              .eq("message", dedupKey)
              .maybeSingle();
            if (!existing) {
              await supabase.from("notifications").insert({
                user_id: ownerId,
                message: dedupKey,
                type: "team",
              });
            }
          }
          results.push(`Access revoked for: ${member.full_name}`);
        }
      }
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
