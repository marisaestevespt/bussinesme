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
      name: "period_summary",
      description: `Generate a comprehensive business summary for a date range. Use when the user asks things like "o que aconteceu de X a Y", "resumo da semana", "resumo das férias", "o que foi feito ontem", etc.
Gathers data from: audit_logs (all actions), tasks (completed), meetings (held/confirmed), sales, expenses, notifications (portal activity from clients), client_onboarding changes, and more.`,
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
        },
        required: ["start_date", "end_date"],
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
const BLOCKED_TABLES = new Set(["member_sensitive_access", "backups", "user_roles", "profiles"]);
const READONLY_TABLES = new Set(["business_settings", "business_setup", "automation_settings", "system_config", "audit_logs"]);
const PRODUCT_MUTABLE_FIELDS = new Set([
  "name",
  "description",
  "status",
  "sales_page_url",
  "ticket",
  "escada",
  "product_type",
  "sales_type",
  "drive_url",
  "important_dates",
  "about_content",
  "included_items",
  "faqs",
  "client_profile",
  "competitors",
  "improvements_content",
  "brainstorming_content",
  "logo_url",
  "cover_url",
  "vat_rate",
  "invoice_denomination",
  "accounting_notes",
  "cycle_duration",
  "monthly_hours_per_client",
  "renewal_advance_days",
  "archive_notes",
  "max_simultaneous_clients",
  "ticket_type",
]);

function inferProductType(text: string): string | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("subscri") || normalized.includes("mensal")) return "servico_mensal";
  if (normalized.includes("grupo")) {
    if (normalized.includes("consult")) return "consultoria_grupo";
    if (normalized.includes("mentoria")) return "mentoria_grupo";
  }
  if (normalized.includes("mentoria")) return "mentoria_individual";
  if (normalized.includes("consult")) return "consultoria_individual";
  if (normalized.includes("curso")) return "curso";
  if (normalized.includes("template")) return "template";
  if (normalized.includes("projeto")) return "projeto_1_1";
  return null;
}

function inferSalesType(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("subscri")) return "subscricao";
  if (normalized.includes("avenca") || normalized.includes("avença") || normalized.includes("mensal")) return "avenca_mensal";
  if (normalized.includes("candidatura") || normalized.includes("aplicação") || normalized.includes("aplicacao")) return "candidatura";
  if (normalized.includes("lançamento") || normalized.includes("lancamento")) return "lancamento";
  if (normalized.includes("gratuito") || normalized.includes("grátis") || normalized.includes("gratis")) return "gratuito";
  return "perpetuo";
}

function normalizeProductData(rawData: Record<string, unknown>, isCreate = false): Record<string, unknown> {
  const data = { ...rawData };
  const textForInference = [
    data.name,
    data.description,
    data.category,
    data.product_type,
    data.sales_type,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (data.base_price !== undefined && (data.ticket === undefined || data.ticket === null || data.ticket === "")) {
    data.ticket = String(data.base_price);
  }
  delete data.base_price;

  if (typeof data.ticket === "number") data.ticket = String(data.ticket);
  if (typeof data.ticket === "string") data.ticket = data.ticket.trim();

  const inferredProductType = inferProductType(
    typeof data.category === "string" && data.category.trim().length > 0
      ? data.category
      : textForInference
  );

  if (!data.product_type && inferredProductType) {
    data.product_type = inferredProductType;
  }

  if (!data.sales_type && textForInference) {
    data.sales_type = inferSalesType(textForInference);
  }

  if (isCreate) {
    if (!data.status) data.status = "em_ideia";
    if (!data.ticket_type) data.ticket_type = "fixo";
  }

  delete data.category;

  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => PRODUCT_MUTABLE_FIELDS.has(key) && value !== undefined)
  );
}

function parseConfirmedAction(content: unknown): Record<string, unknown> | null {
  if (typeof content !== "string" || !content.includes("[AÇÃO CONFIRMADA]")) return null;
  const marker = "Detalhes da ação a executar:";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPayload = content.slice(markerIndex + marker.length).trim();
  try {
    return JSON.parse(rawPayload);
  } catch (error) {
    console.warn("Could not parse confirmed action payload", error);
    return null;
  }
}

function formatExecutionSummary(confirmedAction: Record<string, unknown>, result: Record<string, unknown>): string {
  if (confirmedAction.workflow) {
    const completed = result.completed_steps ?? result.total_steps ?? 0;
    const total = result.total_steps ?? completed;
    return `✅ Feito! Executei o workflow com sucesso.\n- Passos concluídos: ${completed}/${total}`;
  }

  const actionType = confirmedAction.action_type;
  const details = (confirmedAction.details as Record<string, unknown> | undefined) || {};
  const tableName = typeof details.table === "string" ? details.table : "o registo";
  const created = (result.created as Record<string, unknown> | undefined) || {};
  const recordName = typeof created.name === "string" ? created.name : typeof result.name === "string" ? result.name : null;

  switch (actionType) {
    case "create":
      return recordName
        ? `✅ Feito! Criei "${recordName}" com sucesso.`
        : `✅ Feito! Criei um novo registo em ${tableName}.`;
    case "update":
      return `✅ Feito! Atualizei ${tableName} com sucesso.`;
    case "delete":
      return `✅ Feito! Eliminei o registo em ${tableName}.`;
    case "send_email":
      return typeof result.message === "string" ? `✅ ${result.message}` : "✅ Email enviado com sucesso.";
    default:
      return "✅ A ação foi executada com sucesso.";
  }
}

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
  let data = details.data as Record<string, unknown> || {};

  if (tableName === "products" && (actionType === "create" || actionType === "update")) {
    data = normalizeProductData(data, actionType === "create");
    if (actionType === "create" && !data.name) {
      return { error: "Criar produto requer pelo menos o nome." };
    }
  }

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
          sistema: ["audit_logs (somente leitura)", "notifications"],
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

    case "period_summary": {
      const startDate = args.start_date as string;
      const endDate = args.end_date as string;
      // Add one day to end_date to make it inclusive
      const endDateExclusive = new Date(endDate);
      endDateExclusive.setDate(endDateExclusive.getDate() + 1);
      const endExcl = endDateExclusive.toISOString().split("T")[0];

      const [auditRes, tasksRes, tasksOverdueRes, meetingsRes, salesRes, expensesRes, notifRes, clientsRes, leadsRes, contentRes, portalVisitsRes, portalQuestionsRes, meetingsUpdatedRes, onboardingRes, routinesRes] = await Promise.all([
        // Audit logs - all actions in the period
        supabaseAdmin.from("audit_logs").select("action, entity_type, entity_id, user_name, created_at, metadata")
          .gte("created_at", startDate).lt("created_at", endExcl).order("created_at", { ascending: false }).limit(200),
        // Tasks completed in period
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department, updated_at")
          .eq("status", "concluida").gte("updated_at", startDate).lt("updated_at", endExcl).limit(100),
        // Overdue tasks (deadline passed and not done)
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department")
          .not("status", "in", '("concluida","cancelada")').lt("deadline", endExcl).limit(100),
        // Meetings in period (by date_time)
        supabaseAdmin.from("meetings").select("title, date_time, status, client_name, department, portal_notes, duration_minutes")
          .gte("date_time", startDate).lt("date_time", endExcl).order("date_time").limit(100),
        // Sales created/updated in period
        supabaseAdmin.from("commercial_sales").select("sale_id, client, product, invoice_total, base_value, status, payment_date, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Expenses in period
        supabaseAdmin.from("financial_expenses").select("expense_id, description, total_with_vat, base_value, category, status, expense_date")
          .gte("expense_date", startDate).lt("expense_date", endExcl).limit(50),
        // Notifications (includes portal activity)
        supabaseAdmin.from("notifications").select("type, title, message, link, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).order("created_at", { ascending: false }).limit(100),
        // New clients in period
        supabaseAdmin.from("clients").select("full_name, status, created_at, start_date, current_product")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // New leads in period
        supabaseAdmin.from("crm_leads").select("name, status, source, potential_product, estimated_value, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Content published in period
        supabaseAdmin.from("content_items").select("title, status, format, scheduled_at")
          .gte("scheduled_at", startDate).lt("scheduled_at", endExcl).limit(50),
        // Portal visits in period
        supabaseAdmin.from("client_portals").select("client_id, last_visit_at")
          .gte("last_visit_at", startDate).lt("last_visit_at", endExcl).limit(50),
        // Portal initial questions answered in period
        supabaseAdmin.from("portal_initial_questions").select("portal_id, question, answer, file_urls, answered_at")
          .not("answered_at", "is", null).gte("answered_at", startDate).lt("answered_at", endExcl).limit(200),
        // Meetings whose status changed in the period (updated_at within range)
        supabaseAdmin.from("meetings").select("title, date_time, status, client_name, updated_at, portal_notes")
          .gte("updated_at", startDate).lt("updated_at", endExcl)
          .limit(100),
        // Client onboarding steps completed in period
        supabaseAdmin.from("client_onboarding").select("client_id, activity, completed, created_at")
          .eq("completed", true).gte("created_at", startDate).lt("created_at", endExcl).limit(100),
        // Routines/tasks created in period
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(100),
      ]);

      // Group audit logs by entity_type and action
      const auditSummary: Record<string, number> = {};
      for (const log of auditRes.data || []) {
        const key = `${log.action}:${log.entity_type}`;
        auditSummary[key] = (auditSummary[key] || 0) + 1;
      }

      // Portal-specific activity from notifications
      const portalActivity = (notifRes.data || []).filter((n: any) =>
        n.type?.includes("portal") ||
        n.title?.includes("portal") || n.title?.includes("Portal") ||
        n.title?.includes("submeteu") || n.title?.includes("Respostas") ||
        n.title?.includes("confirmou") || n.title?.includes("horário alternativo") ||
        n.message?.includes("portal") || n.message?.includes("submeteu")
      );

      // Meeting status breakdown
      const meetingsByStatus: Record<string, number> = {};
      for (const m of meetingsRes.data || []) {
        meetingsByStatus[m.status] = (meetingsByStatus[m.status] || 0) + 1;
      }

      // Meetings with portal notes (client requested changes)
      const meetingsWithPortalNotes = (meetingsRes.data || []).filter((m: any) => m.portal_notes);

      // Meetings confirmed/changed during the period (from updated_at query)
      const meetingStatusChanges = (meetingsUpdatedRes.data || []).map((m: any) => ({
        titulo: m.title,
        status: m.status,
        cliente: m.client_name,
        atualizado_em: m.updated_at,
        notas_portal: m.portal_notes || null,
      }));

      // Portal questions answered - group by portal_id
      const portalQuestionsData = portalQuestionsRes.data || [];
      const questionsByPortal: Record<string, { total: number; answered: number }> = {};
      for (const q of portalQuestionsData) {
        const pid = q.portal_id;
        if (!questionsByPortal[pid]) questionsByPortal[pid] = { total: 0, answered: 0 };
        questionsByPortal[pid].total++;
        if ((q.answer && q.answer.trim()) || (q.file_urls && Array.isArray(q.file_urls) && q.file_urls.length > 0)) {
          questionsByPortal[pid].answered++;
        }
      }

      // Enrich portal questions with client names
      const portalIds = Object.keys(questionsByPortal);
      let portalQuestionsSummary: Array<{ portal_id: string; cliente: string; respondidas: number; total: number }> = [];
      if (portalIds.length > 0) {
        const { data: portalClients } = await supabaseAdmin
          .from("client_portals")
          .select("id, client_id")
          .in("id", portalIds);
        if (portalClients && portalClients.length > 0) {
          const clientIds = portalClients.map((p: any) => p.client_id);
          const { data: clients } = await supabaseAdmin
            .from("clients")
            .select("id, full_name")
            .in("id", clientIds);
          const clientMap = Object.fromEntries((clients || []).map((c: any) => [c.id, c.full_name]));
          const portalClientMap = Object.fromEntries((portalClients || []).map((p: any) => [p.id, p.client_id]));
          portalQuestionsSummary = portalIds.map(pid => ({
            portal_id: pid,
            cliente: clientMap[portalClientMap[pid]] || "Desconhecido",
            respondidas: questionsByPortal[pid].answered,
            total: questionsByPortal[pid].total,
          }));
        }
      }

      // Portal visits enriched with client names
      const portalVisits = portalVisitsRes.data || [];
      let portalVisitsSummary: Array<{ cliente: string; ultima_visita: string }> = [];
      if (portalVisits.length > 0) {
        const visitClientIds = portalVisits.map((v: any) => v.client_id);
        const { data: visitClients } = await supabaseAdmin
          .from("clients")
          .select("id, full_name")
          .in("id", visitClientIds);
        const visitClientMap = Object.fromEntries((visitClients || []).map((c: any) => [c.id, c.full_name]));
        portalVisitsSummary = portalVisits.map((v: any) => ({
          cliente: visitClientMap[v.client_id] || "Desconhecido",
          ultima_visita: v.last_visit_at,
        }));
      }

      // Overdue tasks with deadline before end of period
      const overdueTasks = (tasksOverdueRes.data || []).filter((t: any) => t.deadline && new Date(t.deadline) < new Date(endExcl));
      const newTasksCreated = routinesRes.data || [];

      // ═══════════════════════════════════════════════════════════════
      // DESTAQUES — resumo numérico explícito que o AI DEVE reportar
      // ═══════════════════════════════════════════════════════════════
      const destaques = {
        _instrucao: "OBRIGATÓRIO: Menciona TODOS estes pontos no resumo. Se o valor for 0, diz que não houve atividade nessa área.",
        tarefas_concluidas: (tasksRes.data || []).length,
        tarefas_criadas: newTasksCreated.length,
        tarefas_atrasadas: overdueTasks.length,
        reunioes_no_periodo: (meetingsRes.data || []).length,
        reunioes_confirmadas: (meetingsRes.data || []).filter((m: any) => m.status === "confirmada").length,
        reunioes_por_confirmar: (meetingsRes.data || []).filter((m: any) => m.status === "por_confirmar").length,
        reunioes_com_pedido_alteracao: meetingsWithPortalNotes.length,
        vendas_novas: (salesRes.data || []).length,
        vendas_valor_total: (salesRes.data || []).reduce((s: number, v: any) => s + (Number(v.invoice_total) || Number(v.base_value) || 0), 0),
        despesas_total: (expensesRes.data || []).length,
        despesas_valor_total: (expensesRes.data || []).reduce((s: number, e: any) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
        clientes_novos: (clientsRes.data || []).length,
        leads_novos: (leadsRes.data || []).length,
        conteudos_publicados: (contentRes.data || []).filter((c: any) => c.status === "publicado").length,
        conteudos_agendados: (contentRes.data || []).filter((c: any) => c.status === "agendado").length,
        portais_visitados: portalVisitsSummary.length,
        clientes_que_visitaram_portal: portalVisitsSummary.map((v) => v.cliente),
        clientes_que_responderam_perguntas: portalQuestionsSummary.filter(q => q.respondidas > 0).map(q => `${q.cliente} (${q.respondidas}/${q.total})`),
        notificacoes_portal: portalActivity.length,
        onboarding_steps_concluidos: (onboardingRes.data || []).length,
      };

      return {
        periodo: `${startDate} a ${endDate}`,
        DESTAQUES_OBRIGATORIOS: destaques,
        resumo_acoes: auditSummary,
        acoes_detalhadas: (auditRes.data || []).slice(0, 50).map((l: any) => ({
          acao: l.action, tipo: l.entity_type, por: l.user_name, quando: l.created_at, detalhes: l.metadata,
        })),
        tarefas_concluidas: {
          total: (tasksRes.data || []).length,
          lista: (tasksRes.data || []).map((t: any) => ({ nome: t.name, responsavel: t.assigned_to, departamento: t.department })),
        },
        tarefas_criadas: {
          total: newTasksCreated.length,
          lista: newTasksCreated.map((t: any) => ({ nome: t.name, status: t.status, responsavel: t.assigned_to, prazo: t.deadline })),
        },
        tarefas_atrasadas: {
          total: overdueTasks.length,
          lista: overdueTasks.slice(0, 20).map((t: any) => ({ nome: t.name, prazo: t.deadline, responsavel: t.assigned_to, departamento: t.department })),
        },
        reunioes: {
          total: (meetingsRes.data || []).length,
          por_status: meetingsByStatus,
          lista: (meetingsRes.data || []).map((m: any) => ({ titulo: m.title, data: m.date_time, status: m.status, cliente: m.client_name, notas_portal: m.portal_notes || null })),
          com_notas_portal: meetingsWithPortalNotes.map((m: any) => ({ titulo: m.title, cliente: m.client_name, notas_cliente: m.portal_notes })),
          mudancas_status_no_periodo: meetingStatusChanges,
        },
        vendas: {
          total: (salesRes.data || []).length,
          valor_total: (salesRes.data || []).reduce((s: number, v: any) => s + (Number(v.invoice_total) || Number(v.base_value) || 0), 0),
          lista: (salesRes.data || []).map((s: any) => ({ id: s.sale_id, cliente: s.client, produto: s.product, valor: Number(s.invoice_total) || Number(s.base_value) || 0, status: s.status, data_pagamento: s.payment_date })),
        },
        despesas: {
          total: (expensesRes.data || []).length,
          valor_total: (expensesRes.data || []).reduce((s: number, e: any) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
          lista: (expensesRes.data || []).map((e: any) => ({ id: e.expense_id, descricao: e.description, valor: Number(e.total_with_vat) || Number(e.base_value) || 0, categoria: e.category, status: e.status })),
        },
        atividade_portal_clientes: {
          _instrucao: "IMPORTANTE: Reporta TODA a atividade dos portais. Se um cliente visitou o portal, menciona-o. Se respondeu a perguntas, menciona quantas.",
          notificacoes: portalActivity.map((n: any) => ({
            titulo: n.title, mensagem: n.message, quando: n.created_at,
          })),
          visitas: portalVisitsSummary,
          respostas_diagnostico: portalQuestionsSummary,
        },
        novos_clientes: (clientsRes.data || []).map((c: any) => ({ nome: c.full_name, status: c.status, produto: c.current_product, inicio: c.start_date })),
        novos_leads: (leadsRes.data || []).map((l: any) => ({ nome: l.name, status: l.status, fonte: l.source, produto: l.potential_product, valor: l.estimated_value })),
        conteudos: (contentRes.data || []).map((c: any) => ({ titulo: c.title, status: c.status, formato: c.format })),
      };
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
- **Gerar resumos de período** com period_summary — ideal para quando o utilizador esteve de férias ou quer saber o que aconteceu num período

⚠️ REGRAS CRÍTICAS:

1. **Ações simples** (1 operação): usa propose_action → utilizador confirma → execute_confirmed_action
2. **Workflows multi-passo** (2+ operações encadeadas): usa propose_workflow → utilizador confirma → execute_confirmed_workflow
3. NUNCA executes sem propor primeiro.
4. SEMPRE usa as ferramentas propose_action ou propose_workflow para confirmar. NUNCA peças confirmação apenas por texto — o frontend precisa do tool call para mostrar os botões de confirmação.
5. Antes de propor criar/editar em tabelas que não conheces bem, usa list_tables para verificar colunas. Mas para tabelas listadas acima (tasks, clients, projects, etc.) já tens a informação — não precisas de verificar.
6. NÃO faças perguntas desnecessárias. Se o utilizador não mencionou assigned_to, client_id, project_id, etc., deixa-os como null. Propõe a ação imediatamente com os dados fornecidos.

📅 RESUMO DE PERÍODO:
Quando o utilizador pedir "o que aconteceu de X a Y", "resumo das férias", "o que foi feito na última semana", etc.:
- Usa a ferramenta **period_summary** com as datas
- O resultado inclui um campo **DESTAQUES_OBRIGATORIOS** com contadores numéricos explícitos — DEVES mencionar TODOS no resumo, mesmo que o valor seja 0
- Estrutura OBRIGATÓRIA do resumo:
  1. **Tarefas**: concluídas, criadas, atrasadas (com nomes se houver)
  2. **Reuniões**: total, confirmadas, por confirmar, com pedidos de alteração do portal
  3. **Vendas**: total e valor
  4. **Despesas**: total e valor
  5. **Portal dos Clientes**: quem visitou, quem respondeu a perguntas (com contagem X/Y), pedidos de alteração
  6. **Novos clientes e leads**
  7. **Conteúdos**: publicados e agendados
- NUNCA omitas uma secção. Se não houve atividade, escreve "Sem atividade neste período."
- Se houver muitos dados dentro de cada secção, agrupa e resume em vez de listar tudo

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
- **period_summary**: Gera resumo completo de um período (auditoria, tarefas, reuniões, vendas, portal, etc.).
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

    // Build messages array, handling file content
    const allMessages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // If this is the last user message and there's a file, include the file content
      if (i === messages.length - 1 && msg.role === "user" && file) {
        if (file.extractedText) {
          // Pre-extracted text (from PDF parsed client-side)
          const enrichedContent = `${msg.content}\n\n📎 **Conteúdo do ficheiro "${file.name}":**\n\`\`\`\n${file.extractedText.slice(0, 30000)}\n\`\`\``;
          allMessages.push({ role: "user", content: enrichedContent });
        } else if (file.type?.startsWith("image/") && file.base64) {
          // Images: send as multimodal content
          allMessages.push({
            role: "user",
            content: [
              { type: "text", text: msg.content },
              { type: "image_url", image_url: { url: `data:${file.type};base64,${file.base64}` } },
            ],
          });
        } else if (file.base64) {
          // Text, CSV: decode base64 to text
          let fileContent = "";
          try {
            const binaryStr = atob(file.base64);
            fileContent = binaryStr.slice(0, 15000);
          } catch {
            fileContent = "[Erro ao ler o conteúdo do ficheiro]";
          }
          const enrichedContent = `${msg.content}\n\n📎 **Conteúdo do ficheiro "${file.name}":**\n\`\`\`\n${fileContent}\n\`\`\``;
          allMessages.push({ role: "user", content: enrichedContent });
        } else {
          allMessages.push({ role: msg.role, content: msg.content });
        }
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
