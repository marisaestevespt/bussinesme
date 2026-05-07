import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Supplier {
  id: string;
  name: string;
  default_vat_rate: number | null;
  category: string | null;
  location: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  member_id: string | null;
  expense_description_template: string | null;
  department: string | null;
}

interface MemberContract {
  monthly_value: number | null;
  payment_day: number | null;
  value_includes_vat: boolean | null;
  status: string | null;
  end_date: string | null;
}

function vatBreakdown(value: number, vatRate: number, includesVat: boolean) {
  const rate = vatRate || 0;
  if (includesVat && rate > 0) {
    const base = +(value / (1 + rate / 100)).toFixed(2);
    return { baseValue: base, vatRate: rate, totalWithVat: +value.toFixed(2) };
  }
  const total = +(value * (1 + rate / 100)).toFixed(2);
  return { baseValue: +value.toFixed(2), vatRate: rate, totalWithVat: total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const targetSupplierId: string | undefined = body?.supplier_id;
    const monthsAhead: number = Number(body?.months_ahead ?? 12);

    let query = supabase
      .from("suppliers")
      .select(
        "id,name,default_vat_rate,category,location,contract_start_date,contract_end_date,member_id,expense_description_template,department",
      )
      .eq("is_active", true);
    if (targetSupplierId) query = query.eq("id", targetSupplierId);
    const { data: suppliers, error: supErr } = await query;
    if (supErr) throw supErr;

    const today = new Date();
    const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let inserted = 0;
    let skipped = 0;

    for (const s of (suppliers || []) as Supplier[]) {
      // Buscar contrato de membro associado (se existir) para extrair valor/IVA/dia
      let monthlyValue = 0;
      let includesVat = false;
      let paymentDay = 1;
      let endDate: string | null = s.contract_end_date;

      if (s.member_id) {
        const { data: contracts } = await supabase
          .from("member_contracts")
          .select("monthly_value,payment_day,value_includes_vat,status,end_date,contract_type")
          .eq("member_id", s.member_id)
          .in("contract_type", ["prestacao_servicos", "contrato_prestacao"])
          .order("created_at", { ascending: false })
          .limit(1);
        const c = (contracts || [])[0] as MemberContract | undefined;
        if (c) {
          monthlyValue = Number(c.monthly_value) || 0;
          includesVat = !!c.value_includes_vat;
          paymentDay = Number(c.payment_day) || 1;
          if (c.status !== "ativo") {
            skipped++;
            continue;
          }
          endDate = c.end_date || endDate;
        }
      }

      if (monthlyValue <= 0) {
        skipped++;
        continue;
      }

      const vatRate = Number(s.default_vat_rate) || 0;
      const v = vatBreakdown(monthlyValue, vatRate, includesVat);

      for (let i = 0; i < monthsAhead; i++) {
        const d = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        // Respeitar contract_end_date
        if (endDate) {
          const end = new Date(endDate);
          if (d > new Date(end.getFullYear(), end.getMonth(), 1)) break;
        }

        // Skip se já existe
        const { data: exists } = await supabase
          .from("financial_expenses")
          .select("id")
          .eq("supplier_id", s.id)
          .eq("expense_year", year)
          .eq("expense_month", month)
          .eq("source_type", "contractor")
          .maybeSingle();
        if (exists) {
          skipped++;
          continue;
        }

        const day = Math.min(paymentDay, 28);
        const expDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const description =
          s.expense_description_template ||
          `Pagamento — ${s.name} — ${String(month).padStart(2, "0")}/${year}`;

        const { data: expData, error: expErr } = await supabase
          .from("financial_expenses")
          .insert({
            description,
            category: s.category === "freelancer" ? "prestadores" : "fornecedores",
            base_value: v.baseValue,
            vat_rate: v.vatRate,
            total_with_vat: v.totalWithVat,
            expense_date: expDate,
            status: "por_pagar",
            source_type: "contractor",
            expense_month: month,
            expense_quarter: Math.ceil(month / 3),
            expense_year: year,
            location: s.location || "portugal",
            supplier_id: s.id,
            member_id: s.member_id,
            department: s.department,
          })
          .select("id")
          .single();

        if (!expErr && expData) {
          inserted++;
          await supabase.from("financial_contractors").insert({
            contractor_name: s.name,
            month,
            year,
            value: v.totalWithVat,
            service: "Prestação de serviços",
            location: s.location || "portugal",
            status: "por_pagar",
            expense_id: expData.id,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, skipped, suppliers: suppliers?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});