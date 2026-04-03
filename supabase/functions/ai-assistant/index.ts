import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_table",
      description: "Query any database table. Use this to fetch data from any table in the system.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
          select: { type: "string", description: "Columns to select. Default: *" },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", description: "eq, neq, gt, gte, lt, lte, like, ilike, is, in, not.eq, not.is" },
                value: { type: "string" },
              },
            },
          },
          order_by: { type: "string", description: "Column to order by. Prefix with - for descending" },
          limit: { type: "number", description: "Max results (default 20, max 100)" },
          count_only: { type: "boolean" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "List available database tables, or show columns for a specific table.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "If provided, returns columns for this table." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_action",
      description: `Propose a write action (create, update, delete, send_email) that requires user confirmation before executing. 
ALWAYS use this tool before any write/delete/email action. The user must confirm before it runs.
The action will NOT be executed yet — the user will see a confirmation prompt.`,
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["create", "update", "delete", "send_email"], description: "Type of action" },
          description: { type: "string", description: "Human-readable description in Portuguese of what will be done (e.g. 'Criar tarefa: Enviar relatório ao João')" },
          details: {
            type: "object",
            description: "Action details. For create/update/delete: {table, filters (for update/delete), data (for create/update)}. For send_email: {to, subject, body}.",
            properties: {
              table: { type: "string" },
              filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } } },
              data: { type: "object", description: "Key-value pairs for insert/update" },
              to: { type: "string", description: "Email recipient" },
              subject: { type: "string", description: "Email subject" },
              body: { type: "string", description: "Email body (plain text)" },
            },
          },
        },
        required: ["action_type", "description", "details"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_confirmed_action",
      description: "Execute a previously proposed action that the user has confirmed. Only call this AFTER the user explicitly confirms a proposed action.",
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["create", "update", "delete", "send_email"] },
          details: {
            type: "object",
            properties: {
              table: { type: "string" },
              filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } } },
              data: { type: "object" },
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
          },
        },
        required: ["action_type", "details"],
      },
    },
  },
];

const BLOCKED_TABLES = new Set(["audit_logs", "member_sensitive_access", "backups", "user_roles", "profiles"]);
const READONLY_TABLES = new Set(["business_settings", "business_setup", "automation_settings", "system_config"]);

async function executeTool(toolName: string, args: Record<string, unknown>, supabaseAdmin: ReturnType<typeof createClient>) {
  switch (toolName) {
    case "list_tables": {
      if (args.table) {
        const { data: sample, error: sampleErr } = await supabaseAdmin
          .from(args.table as string)
          .select("*")
          .limit(1);
        if (sampleErr) return { error: sampleErr.message };
        if (sample && sample.length > 0) {
          return { table: args.table, columns: Object.keys(sample[0]).map(k => ({ name: k, sample_value: sample[0][k] })) };
        }
        return { table: args.table, columns: [] };
      }
      return {
        tables: {
          clientes: ["clients", "client_contacts", "client_feedback", "client_history", "client_milestones", "client_nps_records", "client_onboarding", "client_offboarding", "client_portals"],
          equipa: ["team_members", "members", "member_contracts", "member_payments", "member_onboarding", "absence_coverage", "hiring_simulations"],
          tarefas: ["tasks", "task_time_entries", "time_entries"],
          projetos: ["projects", "project_deliverables", "project_payments", "project_members"],
          financeiro: ["financial_entries", "financial_expenses", "financial_categories", "financial_goals", "financial_payroll", "financial_subscriptions", "financial_contractors", "financial_documents"],
          comercial: ["commercial_sales", "commercial_monthly_goals", "commercial_annual_goals", "commercial_product_goals", "commercial_library_entries", "commercial_strategy"],
          crm: ["crm_leads", "crm_pipelines", "crm_pipeline_stages", "crm_pipeline_leads", "crm_interactions", "crm_lead_actions"],
          marketing: ["marketing_channels", "channel_monthly_metrics", "content_items", "content_channels", "marketing_funnels", "marketing_automations", "marketing_ideas"],
          reunioes: ["meetings", "meeting_participants", "meeting_projects"],
          planeamento: ["planning_goals", "planning_routines", "executive_objectives", "executive_goals", "executive_weekly_routines"],
          produtos: ["products", "product_deliverable_templates", "product_kpis", "product_costs", "product_milestones"],
          marca: ["brand_competitors", "brand_differentials", "brand_swot_items", "brand_visual_cards"],
          configuracoes: ["business_settings", "business_setup", "automation_settings", "kpi_settings", "departments"],
          conteudo: ["content_items", "content_attachments", "sops", "internal_documents", "mural_posts"],
        },
      };
    }

    case "query_table": {
      const tableName = args.table as string;
      if (BLOCKED_TABLES.has(tableName)) return { error: "Acesso a esta tabela não é permitido." };

      const selectCols = (args.select as string) || "*";
      const limit = Math.min(Number(args.limit) || 20, 100);
      const countOnly = args.count_only as boolean;

      let query = supabaseAdmin.from(tableName).select(
        countOnly ? "id" : selectCols,
        countOnly ? { count: "exact", head: true } : { count: "exact" }
      );

      const filters = (args.filters as Array<{ column: string; operator: string; value: string }>) || [];
      for (const f of filters) {
        switch (f.operator) {
          case "eq": query = query.eq(f.column, f.value); break;
          case "neq": query = query.neq(f.column, f.value); break;
          case "gt": query = query.gt(f.column, f.value); break;
          case "gte": query = query.gte(f.column, f.value); break;
          case "lt": query = query.lt(f.column, f.value); break;
          case "lte": query = query.lte(f.column, f.value); break;
          case "like": query = query.like(f.column, f.value); break;
          case "ilike": query = query.ilike(f.column, f.value); break;
          case "is": query = query.is(f.column, f.value === "null" ? null : f.value === "true"); break;
          case "in": query = query.in(f.column, f.value.split(",")); break;
          case "not.eq": query = query.neq(f.column, f.value); break;
          case "not.is": query = query.not(f.column, "is", f.value === "null" ? null : f.value); break;
        }
      }

      if (args.order_by) {
        const orderStr = args.order_by as string;
        const desc = orderStr.startsWith("-");
        query = query.order(desc ? orderStr.slice(1) : orderStr, { ascending: !desc });
      }

      if (!countOnly) query = query.limit(limit);

      const { data, count, error } = await query;
      if (error) return { error: error.message };
      if (countOnly) return { total: count };
      return { data, total: count };
    }

    case "propose_action": {
      // This tool doesn't execute anything — it returns the proposal for the frontend to show
      return {
        pending_confirmation: true,
        action_type: args.action_type,
        description: args.description,
        details: args.details,
      };
    }

    case "execute_confirmed_action": {
      const actionType = args.action_type as string;
      const details = args.details as Record<string, unknown>;
      const tableName = details.table as string;

      if (actionType === "send_email") {
        // Use Supabase Edge Function for email sending
        try {
          const { error } = await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "ai-assistant-email",
              recipientEmail: details.to,
              idempotencyKey: `ai-email-${Date.now()}`,
              templateData: { subject: details.subject, body: details.body },
            },
          });
          if (error) return { error: `Erro ao enviar email: ${error.message}` };
          return { success: true, message: `Email enviado para ${details.to}` };
        } catch (e) {
          return { error: `Email não configurado ou erro: ${e instanceof Error ? e.message : "desconhecido"}` };
        }
      }

      if (BLOCKED_TABLES.has(tableName)) return { error: "Acesso a esta tabela não é permitido." };
      if (READONLY_TABLES.has(tableName) && actionType !== "create") return { error: "Esta tabela é apenas de leitura." };

      const filters = (details.filters as Array<{ column: string; operator: string; value: string }>) || [];
      const data = details.data as Record<string, unknown> || {};

      switch (actionType) {
        case "create": {
          const { data: result, error } = await supabaseAdmin.from(tableName).insert(data).select().single();
          if (error) return { error: error.message };
          return { success: true, created: result };
        }
        case "update": {
          if (filters.length === 0) return { error: "Update requer pelo menos um filtro para segurança." };
          let query = supabaseAdmin.from(tableName).update(data);
          for (const f of filters) {
            if (f.operator === "eq") query = query.eq(f.column, f.value);
            else if (f.operator === "in") query = query.in(f.column, f.value.split(","));
          }
          const { data: result, error } = await query.select();
          if (error) return { error: error.message };
          return { success: true, updated: result, count: result?.length || 0 };
        }
        case "delete": {
          if (filters.length === 0) return { error: "Delete requer pelo menos um filtro para segurança." };
          let query = supabaseAdmin.from(tableName).delete();
          for (const f of filters) {
            if (f.operator === "eq") query = query.eq(f.column, f.value);
            else if (f.operator === "in") query = query.in(f.column, f.value.split(","));
          }
          const { data: result, error } = await query.select();
          if (error) return { error: error.message };
          return { success: true, deleted: result?.length || 0 };
        }
        default:
          return { error: `Tipo de ação desconhecido: ${actionType}` };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let userName = "";
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).single();
        userName = profile?.full_name || user.email?.split("@")[0] || "";
      }
    }

    const { data: settings } = await supabaseAdmin.from("business_settings").select("business_name, business_type, team_type").limit(1).single();
    const businessName = settings?.business_name || "o negócio";

    const systemPrompt = `Tu és a Lirah AI, a assistente inteligente de ${businessName}. Falas em português de Portugal.
${userName ? `O utilizador chama-se **${userName}**. Trata-o pelo primeiro nome.` : ""}

Tens acesso TOTAL à base de dados do sistema. Podes:
- **Consultar** qualquer tabela (query_table, list_tables)
- **Criar** registos em qualquer tabela
- **Editar** registos existentes
- **Eliminar** registos
- **Enviar emails**

⚠️ REGRA CRÍTICA DE CONFIRMAÇÃO:
Para QUALQUER ação de escrita (criar, editar, eliminar, enviar email), DEVES SEMPRE usar a ferramenta "propose_action" PRIMEIRO.
Isto mostra ao utilizador exatamente o que vais fazer e pede confirmação.
SÓ depois do utilizador confirmar (mensagem com "[AÇÃO CONFIRMADA]") é que usas "execute_confirmed_action" para executar.
NUNCA executes uma ação sem propor primeiro.

Ferramentas:
- **list_tables**: Descobre tabelas e colunas disponíveis.
- **query_table**: Consulta qualquer tabela com filtros.
- **propose_action**: Propõe uma ação (create/update/delete/send_email) para confirmação do utilizador.
- **execute_confirmed_action**: Executa uma ação já confirmada pelo utilizador.

Fluxo de ações:
1. O utilizador pede algo (ex: "marca a tarefa X como concluída")
2. Tu usas query_table para encontrar os dados relevantes
3. Usas propose_action para descrever o que vais fazer
4. O utilizador confirma → tu recebes mensagem com "[AÇÃO CONFIRMADA]"  
5. Usas execute_confirmed_action para executar

Para propose_action, o campo details deve ter:
- create: { table, data: { campo1: valor1, ... } }
- update: { table, filters: [{ column, operator: "eq", value }], data: { campo: novo_valor } }
- delete: { table, filters: [{ column, operator: "eq", value }] }
- send_email: { to, subject, body }

Tabelas principais:
- team_members: equipa (full_name, email, role_title, work_areas, work_schedule, expected_weekly_hours, status)
- clients: clientes (full_name, email, status, current_product, start_date)
- tasks: tarefas (title, status, priority, due_date/deadline, assigned_to)
- projects: projetos (name, status, client_id, start_date, end_date, progress)
- financial_entries: entradas financeiras | financial_expenses: despesas
- commercial_sales: vendas | meetings: reuniões
- products: produtos | content_items: conteúdos | crm_leads: leads
- planning_goals: objetivos de planeamento

Regras:
- Sê conciso mas simpático. Usa emojis com moderação.
- NUNCA inventes dados. Se não encontrares, diz.
- Formata com markdown (listas, negrito, tabelas).
- Data de hoje: ${new Date().toISOString().split("T")[0]}`;

    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];
    let currentMessages = [...allMessages];
    let maxIterations = 10;

    while (maxIterations-- > 0) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          tools: TOOLS,
          stream: false,
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        const text = await aiResponse.text();
        console.error("AI gateway error:", status, text);
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de pedidos excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await aiResponse.json();
      const choice = result.choices?.[0];
      if (!choice) return new Response(JSON.stringify({ error: "Sem resposta da IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
        const content = choice.message?.content || "";
        // Check if any tool result had pending_confirmation
        const hasPendingAction = currentMessages.some(m => {
          if (m.role === "tool" && typeof m.content === "string") {
            try { return JSON.parse(m.content).pending_confirmation; } catch { return false; }
          }
          return false;
        });

        return new Response(JSON.stringify({
          content,
          ...(hasPendingAction ? {} : {}),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      currentMessages.push(choice.message);

      // Check if any tool call is propose_action — if so, we need to return to the user for confirmation
      let hasProposal = false;
      const toolResults: Array<{role: string; tool_call_id: string; content: string}> = [];

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try { fnArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* empty */ }

        console.log(`Executing tool: ${fnName}`, fnArgs);
        const toolResult = await executeTool(fnName, fnArgs, supabaseAdmin);

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });

        if (fnName === "propose_action") hasProposal = true;
      }

      currentMessages.push(...toolResults);

      // If there's a proposal, we need one more AI iteration to format the confirmation message
      if (hasProposal) {
        // Get the AI's confirmation message
        const confirmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: currentMessages,
            stream: false,
          }),
        });

        if (confirmResponse.ok) {
          const confirmResult = await confirmResponse.json();
          const confirmContent = confirmResult.choices?.[0]?.message?.content || "";

          // Find the proposal details from tool results
          let actionProposal = null;
          for (const tr of toolResults) {
            try {
              const parsed = JSON.parse(tr.content);
              if (parsed.pending_confirmation) {
                actionProposal = parsed;
                break;
              }
            } catch { /* skip */ }
          }

          return new Response(JSON.stringify({
            content: confirmContent,
            action_proposal: actionProposal,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    return new Response(JSON.stringify({ content: "Desculpa, não consegui completar o pedido." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
