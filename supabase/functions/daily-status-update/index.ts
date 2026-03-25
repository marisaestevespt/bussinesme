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
        .select("id, full_name, weekly_hours")
        .eq("status", "ativo");

      if (activeMembers && activeMembers.length > 0) {
        // Get all time entries for this week
        const { data: weekEntries } = await supabase
          .from("time_entries")
          .select("member_id, duration")
          .gte("entry_date", weekStartStr)
          .lte("entry_date", weekEndStr);

        // Sum hours per member
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
          const weeklyCapacity = member.weekly_hours || 40;
          const hoursUsed = hoursPerMember.get(member.id) || 0;
          const occupancy = weeklyCapacity > 0 ? (hoursUsed / weeklyCapacity) * 100 : 0;

          if (occupancy >= 90) {
            // Dedup: one notification per member per week
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
      // Sync paid payroll records that don't yet have a linked expense
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

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
        // Get member names
        const memberIds = [...new Set(paidMemberPayments.map(p => p.member_id))];
        const { data: memberNames } = await supabase
          .from("team_members")
          .select("id, full_name")
          .in("id", memberIds);
        const nameMap = new Map<string, string>();
        (memberNames || []).forEach((m: { id: string; full_name: string }) => nameMap.set(m.id, m.full_name));

        for (const mp of paidMemberPayments) {
          // Check if expense already exists for this source
          const { data: existingExp } = await supabase
            .from("financial_expenses")
            .select("id")
            .eq("source_type", "contract")
            .eq("source_id", mp.id)
            .limit(1);

          // Also check by member_payment source type
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
            // Check if a matching expense exists via contract source (FinMensal creates with source_type='contract')
            // We need to avoid duplicating expenses that were already created by the frontend
            // The frontend uses member_contracts.id as source_id, not member_payments.id
            // So we check by description match as additional dedup
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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
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
