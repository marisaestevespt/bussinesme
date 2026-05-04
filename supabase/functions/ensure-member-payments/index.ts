// Garante que cada contrato ativo sem data de fim tem sempre N meses
// (default 12) de pagamentos futuros gerados em member_payments e financial_payroll.
// Idempotente: usa upsert lógico (verifica antes de inserir).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS_AHEAD = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Active contracts (no end_date OR end_date in the future) attached to active members
    const { data: contracts, error } = await supabase
      .from("member_contracts")
      .select("member_id, monthly_value, contract_type, start_date, end_date, status, team_members!inner(full_name, status)")
      .eq("status", "ativo");
    if (error) throw error;

    const today = new Date();
    const targetEnd = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 1);

    let createdPayments = 0;
    let createdPayroll = 0;

    for (const c of contracts ?? []) {
      const tm: any = (c as any).team_members;
      if (!tm || tm.status !== "ativo") continue;
      const monthly = Number(c.monthly_value) || 0;
      if (monthly <= 0 || !c.start_date) continue;

      const start = new Date(c.start_date);
      const hardEnd = c.end_date ? new Date(c.end_date) : null;
      // Window: from current month to MONTHS_AHEAD ahead, capped by hardEnd
      const winStart = new Date(Math.max(start.getTime(), new Date(today.getFullYear(), today.getMonth(), 1).getTime()));
      const winEnd = hardEnd && hardEnd < targetEnd ? hardEnd : targetEnd;
      if (winEnd < winStart) continue;

      // Existing payments in window
      const { data: existing } = await supabase
        .from("member_payments")
        .select("month, year")
        .eq("member_id", c.member_id);
      const existingSet = new Set((existing ?? []).map((r) => `${r.year}-${r.month}`));

      const { data: existingPay } = await supabase
        .from("financial_payroll")
        .select("month, year")
        .eq("collaborator_name", tm.full_name);
      const existingPaySet = new Set((existingPay ?? []).map((r) => `${r.year}-${r.month}`));

      const paymentRows: any[] = [];
      const payrollRows: any[] = [];
      const cursor = new Date(winStart.getFullYear(), winStart.getMonth(), 1);
      while (cursor <= winEnd) {
        const m = cursor.getMonth() + 1;
        const y = cursor.getFullYear();
        const key = `${y}-${m}`;
        if (!existingSet.has(key)) {
          paymentRows.push({
            member_id: c.member_id,
            month: m,
            year: y,
            gross_value: monthly,
            net_value: monthly,
            payment_type: c.contract_type === "contrato_prestacao" ? "prestacao" : "salario",
            status: "por_pagar",
          });
        }
        if (!existingPaySet.has(key)) {
          payrollRows.push({
            collaborator_name: tm.full_name,
            month: m,
            year: y,
            gross_salary: monthly,
            net_salary: monthly,
            total_cost: monthly,
            status: "por_pagar",
            withholding_rate: 0,
            withholding_value: 0,
            ss_employee: 0,
            ss_employer: 0,
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }

      if (paymentRows.length > 0) {
        const { error: e1 } = await supabase.from("member_payments").insert(paymentRows);
        if (!e1) createdPayments += paymentRows.length;
      }
      if (payrollRows.length > 0) {
        const { error: e2 } = await supabase.from("financial_payroll").insert(payrollRows);
        if (!e2) createdPayroll += payrollRows.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, contracts: contracts?.length ?? 0, createdPayments, createdPayroll }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[ensure-member-payments]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});