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
      description: "Query any database table. Use this to fetch data from any table in the system. You can select specific columns, filter, order, and limit results. Use list_tables first if you don't know which table or columns to query.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name (e.g. clients, tasks, team_members, financial_entries, financial_expenses, meetings, projects, commercial_sales, products, sops, content_items, marketing_channels, crm_leads, planning_goals, etc.)" },
          select: { type: "string", description: "Columns to select, comma-separated. Use * for all columns. Default: *" },
          filters: {
            type: "array",
            description: "Array of filter objects to apply. Each filter has column, operator, and value.",
            items: {
              type: "object",
              properties: {
                column: { type: "string", description: "Column name" },
                operator: { type: "string", description: "One of: eq, neq, gt, gte, lt, lte, like, ilike, is, in, not.eq, not.is" },
                value: { type: "string", description: "Value to filter by. For 'is' use 'null' or 'true'/'false'. For 'in' use comma-separated values." },
              },
            },
          },
          order_by: { type: "string", description: "Column to order by. Prefix with - for descending (e.g. '-created_at' for newest first)" },
          limit: { type: "number", description: "Max results to return (default 20, max 100)" },
          count_only: { type: "boolean", description: "If true, only return the total count matching the filters" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "List available database tables, or show columns for a specific table. Use this to discover what data exists before querying.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "If provided, returns column names and types for this table. Otherwise lists all table names." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task in the system. Always confirm with the user before using this.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
          assigned_to_name: { type: "string", description: "Name of the person to assign to" },
          priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
        },
        required: ["title"],
      },
    },
  },
];

// Tables that should not be queryable for security
const BLOCKED_TABLES = new Set(["audit_logs", "member_sensitive_access", "backups"]);

async function executeTool(toolName: string, args: Record<string, unknown>, supabaseAdmin: ReturnType<typeof createClient>) {
  switch (toolName) {
    case "list_tables": {
      if (args.table) {
        const { data, error } = await supabaseAdmin.rpc("", {}).maybeSingle();
        // Use information_schema to get columns
        const { data: cols, error: colErr } = await supabaseAdmin
          .from("information_schema.columns" as any)
          .select("column_name, data_type, is_nullable")
          .eq("table_schema", "public")
          .eq("table_name", args.table as string)
          .order("ordinal_position");
        
        if (colErr) {
          // Fallback: try selecting one row to see the shape
          const { data: sample, error: sampleErr } = await supabaseAdmin
            .from(args.table as string)
            .select("*")
            .limit(1);
          if (sampleErr) return { error: sampleErr.message };
          if (sample && sample.length > 0) {
            return { table: args.table, columns: Object.keys(sample[0]) };
          }
          return { table: args.table, columns: [] };
        }
        return { table: args.table, columns: cols };
      }
      // List all tables - hardcoded list of the most useful ones grouped by area
      return {
        tables: {
          clientes: ["clients", "client_contacts", "client_feedback", "client_history", "client_milestones", "client_nps_records", "client_onboarding", "client_offboarding", "client_portals"],
          equipa: ["team_members", "profiles", "members", "member_contracts", "member_payments", "member_onboarding", "absence_coverage", "hiring_simulations"],
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
      if (BLOCKED_TABLES.has(tableName)) {
        return { error: "Acesso a esta tabela não é permitido." };
      }

      const selectCols = (args.select as string) || "*";
      const limit = Math.min(Number(args.limit) || 20, 100);
      const countOnly = args.count_only as boolean;

      let query = supabaseAdmin.from(tableName).select(
        countOnly ? "id" : selectCols,
        countOnly ? { count: "exact", head: true } : { count: "exact" }
      );

      // Apply filters
      const filters = (args.filters as Array<{ column: string; operator: string; value: string }>) || [];
      for (const f of filters) {
        const col = f.column;
        const val = f.value;
        switch (f.operator) {
          case "eq": query = query.eq(col, val); break;
          case "neq": query = query.neq(col, val); break;
          case "gt": query = query.gt(col, val); break;
          case "gte": query = query.gte(col, val); break;
          case "lt": query = query.lt(col, val); break;
          case "lte": query = query.lte(col, val); break;
          case "like": query = query.like(col, val); break;
          case "ilike": query = query.ilike(col, val); break;
          case "is": query = query.is(col, val === "null" ? null : val === "true"); break;
          case "in": query = query.in(col, val.split(",")); break;
          case "not.eq": query = query.neq(col, val); break;
          case "not.is": query = query.not(col, "is", val === "null" ? null : val); break;
        }
      }

      // Apply ordering
      if (args.order_by) {
        const orderStr = args.order_by as string;
        const desc = orderStr.startsWith("-");
        const col = desc ? orderStr.slice(1) : orderStr;
        query = query.order(col, { ascending: !desc });
      }

      if (!countOnly) {
        query = query.limit(limit);
      }

      const { data, count, error } = await query;
      if (error) return { error: error.message };
      if (countOnly) return { total: count };
      return { data, total: count };
    }

    case "create_task": {
      let assignedTo = null;
      if (args.assigned_to_name) {
        const { data: members } = await supabaseAdmin.from("team_members").select("id, full_name").ilike("full_name", `%${args.assigned_to_name}%`).limit(1);
        if (members && members.length > 0) assignedTo = members[0].id;
      }
      const { data, error } = await supabaseAdmin.from("tasks").insert({
        title: args.title,
        description: args.description || "",
        due_date: args.due_date || null,
        assigned_to: assignedTo,
        priority: args.priority || "media",
        status: "pendente",
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, task: data };
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

    // Get user name from auth token
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

    // Get business context
    const { data: settings } = await supabaseAdmin.from("business_settings").select("business_name, business_type, team_type").limit(1).single();
    const businessName = settings?.business_name || "o negócio";

    const systemPrompt = `Tu és a Lirah AI, a assistente inteligente de ${businessName}. Falas em português de Portugal.
${userName ? `O utilizador com quem estás a falar chama-se **${userName}**. Trata-o pelo primeiro nome de forma natural e simpática.` : ""}

Tens acesso total à base de dados do sistema. Podes consultar QUALQUER tabela — clientes, equipa, tarefas, finanças, vendas, reuniões, projetos, produtos, conteúdos, marketing, CRM, planeamento, marca, e muito mais.

Ferramentas disponíveis:
- **list_tables**: Descobre que tabelas existem e que colunas têm. Usa SEMPRE antes de consultar uma tabela que não conheces.
- **query_table**: Consulta qualquer tabela com filtros, ordenação e limite.
- **create_task**: Cria tarefas (pede sempre confirmação primeiro).

Estratégia de consulta:
1. Se não tens a certeza da estrutura de uma tabela, usa list_tables(table="nome") primeiro para ver as colunas.
2. Depois usa query_table com os filtros adequados.
3. Para perguntas que envolvem relações entre tabelas (ex: "clientes do projeto X"), faz múltiplas consultas e cruza os dados.

Tabelas principais que deves conhecer:
- team_members: equipa (full_name, email, role_title, work_areas, work_schedule, expected_weekly_hours, status)
- clients: clientes (full_name, email, status, current_product, start_date)
- tasks: tarefas (title, status, priority, due_date/deadline, assigned_to)
- projects: projetos (name, status, client_id, start_date, end_date, progress)
- financial_entries: entradas financeiras (amount, type, date)
- financial_expenses: despesas (description, amount, expense_date, status)
- commercial_sales: vendas (client, product, base_value, invoice_total, status, payment_date)
- meetings: reuniões (title, date/date_time, status, meeting_type)
- products: produtos/serviços (name, price, status)
- content_items: conteúdos de marketing (title, status, scheduled_at)
- crm_leads: leads do CRM (name, status, potential_product)
- planning_goals: objetivos de planeamento

Regras:
- Sê conciso mas simpático. Usa emojis com moderação.
- Quando o utilizador pede dados, usa as ferramentas para ir buscar informação REAL.
- NUNCA inventes dados. Se não encontrares, diz que não encontraste.
- Para criar tarefas, confirma sempre os detalhes com o utilizador antes.
- Formata respostas com markdown quando apropriado (listas, negrito, tabelas simples).
- Se o utilizador perguntar algo fora do âmbito do sistema, responde de forma útil mas menciona que a tua especialidade é ajudar com a gestão do negócio.
- Data de hoje: ${new Date().toISOString().split("T")[0]}`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Loop for tool calling
    let currentMessages = [...allMessages];
    let maxIterations = 8;

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
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Limite de pedidos excedido. Tenta novamente em breve." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await aiResponse.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "Sem resposta da IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no tool calls, return the final text response
      if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
        const content = choice.message?.content || "";
        return new Response(JSON.stringify({ content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process tool calls
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch { /* empty args */ }

        console.log(`Executing tool: ${fnName}`, fnArgs);
        const toolResult = await executeTool(fnName, fnArgs, supabaseAdmin);

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
      // Loop back to get AI's response after tool results
    }

    return new Response(JSON.stringify({ content: "Desculpa, não consegui completar o pedido. Tenta reformular a pergunta." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
