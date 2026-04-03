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
      name: "query_clients",
      description: "Search or count clients. Can filter by status (ativo/inativo/lead/ex-cliente/pausa).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status. Leave empty for all." },
          search: { type: "string", description: "Search by name or email" },
          count_only: { type: "boolean", description: "If true, only return the count" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_tasks",
      description: "List tasks. Can filter by status (pendente/em_progresso/concluida/cancelada) or by assignee.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          assigned_to_name: { type: "string", description: "Filter by assignee name" },
          limit: { type: "number", description: "Max results (default 10)" },
          overdue_only: { type: "boolean", description: "Only show overdue tasks" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_financials",
      description: "Get financial summary: income, expenses, balance for a given month/year.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "Month (1-12)" },
          year: { type: "number", description: "Year (e.g. 2026)" },
        },
        required: ["month", "year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_sales",
      description: "Get sales data for a period. Returns total revenue, count, and recent sales.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number" },
          year: { type: "number" },
          quarter: { type: "number", description: "Quarter (1-4), alternative to month" },
        },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_meetings",
      description: "List upcoming or recent meetings.",
      parameters: {
        type: "object",
        properties: {
          upcoming: { type: "boolean", description: "If true, show future meetings. If false, show past." },
          limit: { type: "number", description: "Max results (default 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_team",
      description: "List team members with their roles, work areas, and work schedules.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by name" },
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
  {
    type: "function",
    function: {
      name: "query_projects",
      description: "List active projects with their status and client.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          client_name: { type: "string", description: "Filter by client name" },
          limit: { type: "number" },
        },
      },
    },
  },
];

async function executeTool(toolName: string, args: Record<string, unknown>, supabaseAdmin: ReturnType<typeof createClient>) {
  switch (toolName) {
    case "query_clients": {
      let query = supabaseAdmin.from("clients").select(args.count_only ? "id" : "id, full_name, email, status, current_product, start_date, whatsapp", { count: "exact" });
      if (args.status) query = query.eq("status", args.status);
      if (args.search) query = query.or(`full_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
      query = query.order("created_at", { ascending: false }).limit(args.count_only ? 0 : 20);
      const { data, count, error } = await query;
      if (error) return { error: error.message };
      if (args.count_only) return { total: count };
      return { clients: data, total: count };
    }
    case "query_tasks": {
      let query = supabaseAdmin.from("tasks").select("id, title, status, priority, due_date, assigned_to, created_at");
      if (args.status) query = query.eq("status", args.status);
      if (args.overdue_only) query = query.lt("due_date", new Date().toISOString().split("T")[0]).neq("status", "concluida").neq("status", "cancelada");
      if (args.assigned_to_name) {
        const { data: members } = await supabaseAdmin.from("team_members").select("id, name").ilike("name", `%${args.assigned_to_name}%`);
        if (members && members.length > 0) {
          query = query.in("assigned_to", members.map((m: { id: string }) => m.id));
        }
      }
      query = query.order("due_date", { ascending: true }).limit(Number(args.limit) || 10);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { tasks: data, count: data?.length };
    }
    case "query_financials": {
      const month = Number(args.month);
      const year = Number(args.year);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const { data: income } = await supabaseAdmin.from("financial_entries").select("amount").eq("type", "entrada").gte("date", startDate).lt("date", endDate);
      const { data: expenses } = await supabaseAdmin.from("financial_entries").select("amount").eq("type", "saida").gte("date", startDate).lt("date", endDate);

      const totalIncome = (income || []).reduce((s: number, e: { amount: number }) => s + (e.amount || 0), 0);
      const totalExpenses = (expenses || []).reduce((s: number, e: { amount: number }) => s + (e.amount || 0), 0);
      return { month, year, income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses };
    }
    case "query_sales": {
      let query = supabaseAdmin.from("commercial_sales").select("id, sale_id, client, product, base_value, invoice_total, status, payment_date, created_at");
      if (args.month) {
        query = query.eq("sale_month", args.month).eq("sale_year", args.year);
      } else if (args.quarter) {
        query = query.eq("sale_quarter", args.quarter).eq("sale_year", args.year);
      } else {
        query = query.eq("sale_year", args.year);
      }
      query = query.order("created_at", { ascending: false }).limit(20);
      const { data, error } = await query;
      if (error) return { error: error.message };
      const total = (data || []).reduce((s: number, sale: { invoice_total: number }) => s + (sale.invoice_total || 0), 0);
      return { sales: data, count: data?.length, total_revenue: total };
    }
    case "query_meetings": {
      const now = new Date().toISOString();
      let query = supabaseAdmin.from("meetings").select("id, title, meeting_type, date, time, duration, location, status");
      if (args.upcoming) {
        query = query.gte("date", now.split("T")[0]).order("date", { ascending: true });
      } else {
        query = query.lte("date", now.split("T")[0]).order("date", { ascending: false });
      }
      query = query.limit(Number(args.limit) || 5);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { meetings: data };
    }
    case "query_team": {
      let query = supabaseAdmin.from("team_members").select("id, full_name, email, role_title, work_areas, status, whatsapp, work_schedule, expected_weekly_hours");
      if (args.search) query = query.ilike("full_name", `%${args.search}%`);
      query = query.eq("status", "active").order("full_name");
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { members: data, count: data?.length };
    }
    case "create_task": {
      let assignedTo = null;
      if (args.assigned_to_name) {
        const { data: members } = await supabaseAdmin.from("team_members").select("id, name").ilike("name", `%${args.assigned_to_name}%`).limit(1);
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
    case "query_projects": {
      let query = supabaseAdmin.from("projects").select("id, name, status, client_id, start_date, end_date, progress");
      if (args.status) query = query.eq("status", args.status);
      if (args.client_name) {
        const { data: clients } = await supabaseAdmin.from("clients").select("id").ilike("full_name", `%${args.client_name}%`);
        if (clients && clients.length > 0) {
          query = query.in("client_id", clients.map((c: { id: string }) => c.id));
        }
      }
      query = query.order("created_at", { ascending: false }).limit(Number(args.limit) || 10);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { projects: data, count: data?.length };
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

Tens acesso a ferramentas para consultar dados do sistema: clientes, tarefas, finanças, vendas, reuniões, equipa e projetos.

Regras:
- Sê conciso mas simpático. Usa emojis com moderação.
- Quando o utilizador pede dados, usa as ferramentas disponíveis para ir buscar informação real.
- NUNCA inventes dados. Se não conseguires encontrar, diz que não encontraste.
- Para ações como criar tarefas, confirma sempre os detalhes com o utilizador antes de executar.
- Formata respostas com markdown quando apropriado (listas, negrito, tabelas simples).
- Se o utilizador perguntar algo fora do âmbito do sistema, responde de forma útil mas menciona que a tua especialidade é ajudar com a gestão do negócio.
- Data de hoje: ${new Date().toISOString().split("T")[0]}`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Loop for tool calling
    let currentMessages = [...allMessages];
    let maxIterations = 5;

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
