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
      description: `Propose a SINGLE write action (create, update, delete, send_email) that requires user confirmation.
Use this for simple, single-step operations. For multi-step operations, use propose_workflow instead.
The action will NOT be executed yet — the user will see a confirmation prompt.`,
      parameters: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: ["create", "update", "delete", "send_email"], description: "Type of action" },
          description: { type: "string", description: "Human-readable description in Portuguese of what will be done" },
          details: {
            type: "object",
            description: "Action details. For create/update/delete: {table, filters, data}. For send_email: {to, subject, body}.",
            properties: {
              table: { type: "string" },
              filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } } },
              data: { type: "object", description: "Key-value pairs for insert/update" },
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
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
      name: "propose_workflow",
      description: `Propose a MULTI-STEP workflow that chains multiple actions together with a single confirmation.
Use this when the user's request requires multiple sequential database operations (e.g. convert lead to client, create project, apply template).
Each step can reference results from previous steps using {{step_N.field}} syntax in its data values.
For example: step 1 creates a client, step 2 creates a project with client_id = "{{step_1.id}}".
The workflow will NOT execute yet — the user sees a summary and confirms once.`,
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Overall description in Portuguese of what the workflow does" },
          steps: {
            type: "array",
            description: "Ordered list of steps to execute sequentially",
            items: {
              type: "object",
              properties: {
                step_label: { type: "string", description: "Short label for this step (e.g. 'Criar cliente')" },
                action_type: { type: "string", enum: ["create", "update", "delete", "send_email"] },
                details: {
                  type: "object",
                  properties: {
                    table: { type: "string" },
                    filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } } },
                    data: { type: "object", description: "Key-value pairs. Use {{step_N.field}} to reference a field from step N's result." },
                    to: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                },
              },
              required: ["step_label", "action_type", "details"],
            },
          },
        },
        required: ["description", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_confirmed_action",
      description: "Execute a previously proposed single action that the user has confirmed. Only call after '[AÇÃO CONFIRMADA]'.",
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
  {
    type: "function",
    function: {
      name: "execute_confirmed_workflow",
      description: "Execute a previously proposed multi-step workflow that the user has confirmed. Only call after '[AÇÃO CONFIRMADA]'. Runs all steps sequentially, chaining results.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step_label: { type: "string" },
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
              required: ["step_label", "action_type", "details"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
];

const BLOCKED_TABLES = new Set(["audit_logs", "member_sensitive_access", "backups", "user_roles", "profiles"]);
const READONLY_TABLES = new Set(["business_settings", "business_setup", "automation_settings", "system_config"]);

// Resolve {{step_N.field}} references in a value using previous step results
function resolveRefs(value: unknown, stepResults: Record<number, Record<string, unknown>>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{step_(\d+)\.(\w+)\}\}/g, (_match, stepNum, field) => {
      const result = stepResults[parseInt(stepNum)];
      if (result && field in result) return String(result[field]);
      return _match; // leave unresolved if not found
    });
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) return value.map(v => resolveRefs(v, stepResults));
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveRefs(v, stepResults);
    }
    return resolved;
  }
  return value;
}

async function executeSingleAction(
  actionType: string,
  details: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> {
  const tableName = details.table as string;

  if (actionType === "send_email") {
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
      return { success: true, created: result, ...result };
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
      return { success: true, updated: result, count: result?.length || 0, ...(result?.[0] || {}) };
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
      return {
        pending_confirmation: true,
        workflow: false,
        action_type: args.action_type,
        description: args.description,
        details: args.details,
      };
    }

    case "propose_workflow": {
      return {
        pending_confirmation: true,
        workflow: true,
        description: args.description,
        steps: args.steps,
      };
    }

    case "execute_confirmed_action": {
      return await executeSingleAction(
        args.action_type as string,
        args.details as Record<string, unknown>,
        supabaseAdmin
      );
    }

    case "execute_confirmed_workflow": {
      const steps = args.steps as Array<{
        step_label: string;
        action_type: string;
        details: Record<string, unknown>;
      }>;

      const stepResults: Record<number, Record<string, unknown>> = {};
      const results: Array<{ step: number; label: string; success: boolean; result: Record<string, unknown> }> = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // Resolve references from previous steps
        const resolvedDetails = resolveRefs(step.details, stepResults) as Record<string, unknown>;

        console.log(`Workflow step ${i + 1}/${steps.length}: ${step.step_label}`, resolvedDetails);

        const result = await executeSingleAction(step.action_type, resolvedDetails, supabaseAdmin);

        if (result.error) {
          return {
            success: false,
            completed_steps: i,
            total_steps: steps.length,
            failed_step: step.step_label,
            error: result.error,
            results,
          };
        }

        stepResults[i + 1] = result;
        results.push({ step: i + 1, label: step.step_label, success: true, result });
      }

      return {
        success: true,
        completed_steps: steps.length,
        total_steps: steps.length,
        results,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, file } = await req.json();
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
        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("user_id", user.id).single();
        userName = profile?.full_name || user.email?.split("@")[0] || "";
      }
    }

    const { data: settings } = await supabaseAdmin.from("business_settings").select("business_name, business_type, team_type").limit(1).single();
    const businessName = settings?.business_name || "o negócio";

    const systemPrompt = `Tu és a Lirah AI, a assistente inteligente de ${businessName}. Falas em português de Portugal.
${userName ? `O utilizador chama-se **${userName}**. Trata-o pelo primeiro nome.` : ""}

Tens acesso TOTAL à base de dados do sistema. Podes:
- **Consultar** qualquer tabela (query_table, list_tables)
- **Criar, editar, eliminar** registos
- **Enviar emails**
- **Executar workflows completos** com múltiplos passos encadeados
- **Analisar ficheiros** (PDF, imagens, CSV) enviados pelo utilizador

⚠️ REGRAS CRÍTICAS:

1. **Ações simples** (1 operação): usa propose_action → utilizador confirma → execute_confirmed_action
2. **Workflows multi-passo** (2+ operações encadeadas): usa propose_workflow → utilizador confirma → execute_confirmed_workflow
3. NUNCA executes sem propor primeiro.
4. SEMPRE usa as ferramentas propose_action ou propose_workflow para confirmar. NUNCA peças confirmação apenas por texto — o frontend precisa do tool call para mostrar os botões de confirmação.
5. Antes de propor criar/editar em tabelas que não conheces bem, usa list_tables para verificar colunas. Mas para tabelas listadas acima (tasks, clients, projects, etc.) já tens a informação — não precisas de verificar.
6. NÃO faças perguntas desnecessárias. Se o utilizador não mencionou assigned_to, client_id, project_id, etc., deixa-os como null. Propõe a ação imediatamente com os dados fornecidos.

📎 FICHEIROS:
Quando o utilizador envia um ficheiro (PDF, imagem, etc.):
- Analisa o conteúdo cuidadosamente
- Extrai informações relevantes (nomes, preços, descrições, datas, etc.)
- Se o utilizador pedir para criar um registo (produto, cliente, etc.) a partir do ficheiro, propõe a ação com os dados extraídos
- Para produtos, preenche: name, category, base_price, status, description, e qualquer outro campo relevante
- Para clientes, preenche: full_name, email, nif, etc.
- Sê inteligente: mapeia a informação do documento para os campos corretos da tabela

🔗 WORKFLOWS MULTI-PASSO:
Quando o utilizador pede algo complexo (converter lead em cliente, criar produto com projeto, etc.), usa propose_workflow.
Cada passo pode referenciar resultados de passos anteriores com a sintaxe {{step_N.campo}}.
Exemplo: step 1 cria cliente → step 2 cria projeto com client_id = "{{step_1.id}}"

Ferramentas:
- **list_tables**: Descobre tabelas e colunas disponíveis. Usa SEMPRE antes de criar/editar para verificar a estrutura.
- **query_table**: Consulta qualquer tabela com filtros.
- **propose_action**: Propõe 1 ação para confirmação.
- **propose_workflow**: Propõe múltiplas ações encadeadas para confirmação única.
- **execute_confirmed_action**: Executa 1 ação confirmada.
- **execute_confirmed_workflow**: Executa workflow confirmado (todos os passos sequencialmente).

Fluxo:
1. Utilizador pede algo
2. Tu investigas os dados (query_table, list_tables) para entender o contexto
3. Propões a ação/workflow com descrição clara
4. Utilizador confirma → mensagem com "[AÇÃO CONFIRMADA]"
5. Executas

Para propose_workflow, steps deve ter:
- step_label: descrição curta do passo
- action_type: create / update / delete / send_email
- details: { table, data, filters } — usa {{step_N.campo}} para encadear

Tabelas principais (COLUNAS EXATAS — usa estes nomes):
- team_members: equipa (full_name, email, role_title, work_areas, work_schedule, expected_weekly_hours, status)
- clients: clientes (full_name, email, status, current_product, start_date, nif, whatsapp, payment_method)
- tasks: tarefas (name, status, priority, deadline, assigned_to, department, project_id, client_id, notes, tag, scheduled_time)
- projects: projetos (name, status, client_id, product_id, start_date, deadline, progress)
- financial_entries: entradas | financial_expenses: despesas
- commercial_sales: vendas (sale_id, client, product, base_value, invoice_total, status, payment_date)
- meetings: reuniões (title, date_time, status, client_id, project_id, department)
- products: produtos (name, category, base_price, status, description)
- product_deliverable_templates: templates de entregáveis do produto
- project_deliverables: entregáveis do projeto (project_id, name, status, deadline)
- content_items: conteúdos | crm_leads: leads CRM (name, email, phone, status, source, potential_product)
- crm_pipeline_leads: leads nos pipelines
- client_onboarding: checklist onboarding do cliente
- client_portals: portal do cliente
- planning_goals: objetivos de planeamento

⚠️ ATENÇÃO: A tabela tasks usa "name" (não "title") e "deadline" (não "due_date").

Regras:
- Sê conciso mas simpática. Usa emojis com moderação.
- NUNCA inventes dados. Se não encontrares, diz.
- Formata com markdown (listas, negrito).
- Quando o utilizador pede algo complexo, investiga PRIMEIRO (list_tables para ver colunas) e depois propõe o workflow completo.
- Sê proativa: quando o utilizador dá informação suficiente, propõe a ação imediatamente. Não faças perguntas desnecessárias. Campos opcionais que não foram mencionados podem ficar null.
- Se o utilizador diz "amanhã", calcula a data. Se diz "para hoje", usa a data de hoje. NÃO perguntes "qual é a data específica de amanhã".
- Data de hoje: ${new Date().toISOString().split("T")[0]}`;

    // Build messages array, handling multimodal file content
    const allMessages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // If this is the last user message and there's a file, make it multimodal
      if (i === messages.length - 1 && msg.role === "user" && file) {
        const parts: Array<Record<string, unknown>> = [
          { type: "text", text: msg.content },
        ];
        
        if (file.type.startsWith("image/")) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${file.type};base64,${file.base64}` },
          });
        } else {
          // For PDFs and other documents, send as inline data
          parts.push({
            type: "image_url",
            image_url: { url: `data:${file.type};base64,${file.base64}` },
          });
        }
        
        allMessages.push({ role: "user", content: parts });
      } else {
        allMessages.push({ role: msg.role, content: msg.content });
      }
    }
    
    let currentMessages = [...allMessages];
    let maxIterations = 12;

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
        return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      currentMessages.push(choice.message);

      let hasProposal = false;
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try { fnArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* empty */ }

        console.log(`Executing tool: ${fnName}`, JSON.stringify(fnArgs).slice(0, 500));
        const toolResult = await executeTool(fnName, fnArgs, supabaseAdmin);

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });

        if (fnName === "propose_action" || fnName === "propose_workflow") hasProposal = true;
      }

      currentMessages.push(...toolResults);

      if (hasProposal) {
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

          // Find the proposal from tool results
          let actionProposal = null;
          for (const tr of toolResults) {
            try {
              const parsed = JSON.parse(tr.content);
              if (parsed.pending_confirmation) {
                if (parsed.workflow) {
                  // Workflow proposal
                  actionProposal = {
                    action_type: "workflow",
                    description: parsed.description,
                    steps: parsed.steps,
                    pending_confirmation: true,
                    workflow: true,
                  };
                } else {
                  actionProposal = parsed;
                }
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
