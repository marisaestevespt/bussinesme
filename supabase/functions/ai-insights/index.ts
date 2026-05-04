import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientId, rateLimitResponse } from "../_shared/rate-limit.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;


const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Rate limit: 20 calls / minute per IP (LLM cost protection)
  const rl = checkRateLimit(`ai-insights:${getClientId(req)}`, 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Sem autorização" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The insights engine reads sensitive operational data with the service-role
    // client, so it must be restricted to users who already have broad business
    // visibility.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowedRoles = new Set(["owner", "admin"]);
    const hasAccess = (roleRows || []).some((row: Row) => allowedRoles.has(String(row.role)));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao Owner/Admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, context } = await req.json();

    // Gather data based on type
    const data = await gatherData(supabase, type);

    // Build system prompt based on type
    const systemPrompt = getSystemPrompt(type);

    const userMessage = context
      ? `Contexto adicional: ${context}\n\nDados:\n${JSON.stringify(data, null, 2)}`
      : `Dados:\n${JSON.stringify(data, null, 2)}`;

    // Call AI with streaming
    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de pedidos excedido. Tenta novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos AI esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway AI");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Data Gathering ────────────────────────────────────────────────

async function gatherData(supabase: SupabaseAdmin, type: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  switch (type) {
    case "executive": {
      const [clients, sales, tasks, expenses] = await Promise.all([
        supabase.from("clients").select("id, status, full_name, start_date, end_of_cycle").limit(500),
        supabase.from("commercial_sales").select("id, base_value, invoice_total, status, sale_month, sale_year, client, product").eq("sale_year", year).limit(500),
        supabase.from("tasks").select("id, status, deadline, name").limit(500),
        supabase.from("financial_expenses").select("id, base_value, total_with_vat, expense_date, category, status").gte("expense_date", monthStart).lt("expense_date", monthEnd).limit(500),
      ]);

      const activeClients = (clients.data || []).filter((c: Row) => c.status === "ativo").length;
      const totalClients = (clients.data || []).length;
      const monthSales = (sales.data || []).filter((s: Row) => Number(s.sale_month) === month);
      const totalRevenue = monthSales.reduce((sum: number, s: Row) => sum + (Number(s.invoice_total) || Number(s.base_value) || 0), 0);
      const pendingTasks = (tasks.data || []).filter((t: Row) => t.status !== "concluida" && t.status !== "cancelada");
      const overdueTasks = pendingTasks.filter((t: Row) => t.deadline && new Date(t.deadline) < now);
      const totalExpenses = (expenses.data || []).reduce((sum: number, e: Row) => sum + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0);

      return {
        periodo: `${String(month).padStart(2, "0")}/${year}`,
        clientes: { ativos: activeClients, total: totalClients },
        vendas_mes: { total: monthSales.length, receita: totalRevenue },
        tarefas: { pendentes: pendingTasks.length, atrasadas: overdueTasks.length },
        financeiro: { receita: totalRevenue, despesas: totalExpenses, margem: totalRevenue - totalExpenses },
      };
    }

    case "alerts": {
      const [clients, tasks, sales, nps] = await Promise.all([
        supabase.from("clients").select("id, full_name, status, end_of_cycle, start_date, email").eq("status", "ativo").limit(500),
        supabase.from("tasks").select("id, name, status, deadline, assigned_to").not("status", "in", '("concluida","cancelada")').limit(500),
        supabase.from("commercial_sales").select("id, client, base_value, invoice_total, status, payment_date").in("status", ["aguarda_pagamento", "em_atraso"]).limit(200),
        supabase.from("client_nps_records").select("id, client_id, status, expected_date").eq("status", "pending").limit(200),
      ]);

      const overdueTasks = (tasks.data || []).filter((t: Row) => t.deadline && new Date(t.deadline) < now);
      const nearEndClients = (clients.data || []).filter((c: Row) => {
        if (!c.end_of_cycle) return false;
        const days = Math.ceil((new Date(c.end_of_cycle).getTime() - now.getTime()) / 86400000);
        return days >= 0 && days <= 30;
      });
      const pendingPayments = (sales.data || []).filter((s: Row) => {
        if (!s.payment_date) return false;
        return new Date(s.payment_date) < now;
      });
      const overdueNps = (nps.data || []).filter((n: Row) => new Date(n.expected_date) < now);

      return {
        tarefas_atrasadas: overdueTasks.map((t: Row) => ({ titulo: t.name, vencimento: t.deadline })).slice(0, 10),
        clientes_fim_ciclo: nearEndClients.map((c: Row) => ({ nome: c.full_name, fim: c.end_of_cycle })),
        pagamentos_pendentes: pendingPayments.map((s: Row) => ({ cliente: s.client, valor: s.invoice_total || s.base_value, data: s.payment_date })).slice(0, 10),
        nps_pendentes: overdueNps.length,
        total_tarefas_atrasadas: overdueTasks.length,
      };
    }

    case "financial": {
      const [expenses, sales] = await Promise.all([
        supabase.from("financial_expenses").select("id, base_value, total_with_vat, expense_date, category, description, status").gte("expense_date", `${year}-01-01`).lt("expense_date", `${year + 1}-01-01`).order("expense_date", { ascending: false }).limit(500),
        supabase.from("commercial_sales").select("id, invoice_total, base_value, payment_date, client, product, status, sale_month").eq("sale_year", year).order("payment_date", { ascending: false }).limit(500),
      ]);

      const byMonth = (items: Row[], dateField: string, amountField: string) => {
        const grouped: Record<number, number> = {};
        for (const item of items) {
          const m = new Date(item[dateField]).getMonth() + 1;
          grouped[m] = (grouped[m] || 0) + (Number(item[amountField]) || 0);
        }
        return grouped;
      };

      return {
        ano: year,
        receitas_por_mes: byMonth(sales.data || [], "payment_date", "invoice_total"),
        saidas_por_mes: byMonth(expenses.data || [], "expense_date", "total_with_vat"),
        top_categorias_despesa: groupByCategory(expenses.data || []),
      };
    }

    case "commercial": {
      const [sales, leads] = await Promise.all([
        supabase.from("commercial_sales").select("id, base_value, invoice_total, status, sale_month, sale_year, client, product, source").eq("sale_year", year).limit(500),
        supabase.from("crm_leads").select("id, name, status, potential_product, estimated_value, created_at").limit(300),
      ]);

      const monthSales: Record<number, { count: number; revenue: number }> = {};
      for (const s of sales.data || []) {
        const m = s.sale_month;
        if (!monthSales[m]) monthSales[m] = { count: 0, revenue: 0 };
        monthSales[m].count++;
        monthSales[m].revenue += Number(s.invoice_total) || Number(s.base_value) || 0;
      }

      const leadsByStatus: Record<string, number> = {};
      for (const l of leads.data || []) {
        leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1;
      }

      return {
        ano: year,
        vendas_por_mes: monthSales,
        leads_por_status: leadsByStatus,
        total_leads: (leads.data || []).length,
        total_vendas: (sales.data || []).length,
      };
    }

    case "marketing": {
      const [content, channels] = await Promise.all([
        supabase.from("content_items").select("id, title, status, format, scheduled_at").gte("scheduled_at", `${year}-01-01`).limit(500),
        supabase.from("channel_monthly_metrics").select("*").eq("year", year).limit(200),
      ]);

      const statusCount: Record<string, number> = {};
      for (const c of content.data || []) {
        statusCount[c.status] = (statusCount[c.status] || 0) + 1;
      }

      return {
        ano: year,
        conteudos_por_status: statusCount,
        total_conteudos: (content.data || []).length,
        metricas_canais: (channels.data || []).slice(0, 50),
      };
    }

    default:
      return {};
  }
}

function groupByCategory(items: Row[]) {
  const grouped: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category || "Sem categoria";
    grouped[cat] = (grouped[cat] || 0) + (Number(item.total_with_vat) || Number(item.base_value) || 0);
  }
  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat, total]) => ({ categoria: cat, total }));
}

// ─── System Prompts ────────────────────────────────────────────────

function getSystemPrompt(type: string): string {
  const base = `És um assistente de negócios especializado em análise e estratégia. Responde SEMPRE em português de Portugal. Sê direto, prático e orientado a ações. Usa emojis com moderação para tornar o texto mais visual. Formata com markdown.`;

  switch (type) {
    case "executive":
      return `${base}

Gera um BRIEFING EXECUTIVO conciso. Estrutura:

## 🎯 Estado Geral
Um parágrafo com avaliação geral (usa 🟢 🟡 🔴 para semáforo).

## ✅ Top 3 Vitórias
Pontos positivos do período.

## ⚠️ Top 3 Riscos
Problemas ou tendências negativas.

## 🚀 Ações Recomendadas
3-5 ações concretas e específicas com prioridade.

Sê específico com números. Não inventes dados — usa apenas o que receberes.`;

    case "alerts":
      return `${base}

Analisa os dados e gera ALERTAS PROATIVOS. Para cada alerta:
- **Prioridade**: 🔴 Crítico / 🟡 Atenção / 🟢 Info
- **Descrição**: O que está a acontecer
- **Impacto**: Porque é importante
- **Ação**: O que fazer concretamente

Ordena por prioridade (críticos primeiro). Máximo 8 alertas. Não inventes problemas — se os dados estão bem, diz isso.`;

    case "financial":
      return `${base}

Analisa os dados financeiros e fornece:

## 📊 Resumo Financeiro
Visão geral de entradas vs saídas e margem.

## 📈 Tendências
Identifica padrões mensais (crescimento, sazonalidade, anomalias).

## 💡 Insights
Observações sobre categorias de despesa, oportunidades de redução de custos, etc.

## 🎯 Recomendações
Ações concretas para melhorar a saúde financeira.`;

    case "commercial":
      return `${base}

Analisa os dados comerciais e fornece:

## 📊 Performance Comercial
Resumo de vendas e pipeline.

## 📈 Tendências
Evolução mensal, taxa de conversão de leads, produtos mais vendidos.

## 💡 Insights
Padrões identificados, oportunidades de crescimento.

## 🎯 Recomendações
Ações para aumentar vendas e melhorar conversão.`;

    case "marketing":
      return `${base}

Analisa os dados de marketing e fornece:

## 📊 Visão Geral
Estado da produção de conteúdos e presença digital.

## 📈 Performance
Análise de métricas por canal e formato.

## 💡 Insights
O que está a funcionar, o que pode melhorar.

## 🎯 Recomendações
Ações para otimizar a estratégia de conteúdos.`;

    default:
      return base;
  }
}
