import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, getClientId, rateLimitResponse } from "../_shared/rate-limit.ts";
import { sendTransactionalEmail } from "../_shared/send-email.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;


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
      name: "list_column_values",
      description: "List all distinct values for a column in a table. Use this BEFORE filtering by status, type, or any enum-like column to discover the actual values used in the database. This avoids guessing wrong values.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
          column: { type: "string", description: "Column to get distinct values from (e.g. status, type, category)" },
        },
        required: ["table", "column"],
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
          action_type: { type: "string", enum: ["create", "update", "delete", "send_email", "attach_file"], description: "Type of action. Use attach_file to attach the user-uploaded file to a record's jsonb documents column." },
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
              column: { type: "string", description: "For attach_file: jsonb column name (default: documents)" },
              document_label: { type: "string", description: "For attach_file: human-readable label (e.g. 'Fatura Systeme.io Janeiro')" },
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
          action_type: { type: "string", enum: ["create", "update", "delete", "send_email", "attach_file"] },
          details: {
            type: "object",
            properties: {
              table: { type: "string" },
              filters: { type: "array", items: { type: "object", properties: { column: { type: "string" }, operator: { type: "string" }, value: { type: "string" } } } },
              data: { type: "object" },
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
              column: { type: "string", description: "For attach_file: jsonb column name (default: documents)" },
              document_label: { type: "string", description: "For attach_file: human-readable label/category for the document (e.g. 'Fatura', 'Recibo')" },
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
const BLOCKED_TABLES = new Set([
  "member_sensitive_access",
  "backups",
  "user_roles",
  "profiles",
  // Sensitive: stores AES-GCM encrypted credentials for external platforms
  "platform_accesses",
  // Auth/role-control adjacent tables
  "role_permissions",
  "role_activity_log",
  "audit_logs",
  // Secrets / tokens
  "client_portals",
]);
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

type QueryFilter = {
  column: string;
  operator: string;
  value: string;
};

type FilterResolution = {
  from_column: string;
  to_column: string;
  original_value: string;
  resolved_value: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  action_proposal?: Record<string, unknown> | null;
  confirmed?: boolean;
};

const MEETING_STATUS_ALIASES: Record<string, "por_confirmar" | "por_organizar" | "confirmada" | "terminada"> = {
  por_confirmar: "por_confirmar",
  por_organizar: "por_organizar",
  confirmada: "confirmada",
  marcada: "confirmada",
  agendada: "confirmada",
  terminada: "terminada",
  realizada: "terminada",
  concluida: "terminada",
};

const MEETING_TEXT_FILTER_COLUMNS = new Set(["client_name", "project_name", "product_name", "title"]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function normalizeLooseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeMeetingStatusValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = normalizeLooseText(value).replace(/\s+/g, "_");
  return MEETING_STATUS_ALIASES[normalized] ?? value.trim();
}

function isTextualConfirmation(content: unknown): boolean {
  if (typeof content !== "string") return false;
  const normalized = normalizeLooseText(content)
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ");

  return /^(confirmo|sim|ok|okay|esta bem|podes avancar|pode avancar|avanca|forca|segue|pode ser)\b/.test(normalized);
}

function getLastPendingProposal(messages: ChatMessage[]): Record<string, unknown> | null {
  for (let i = messages.length - 2; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    if (!message.action_proposal || typeof message.action_proposal !== "object") continue;
    if (message.confirmed === false) continue;
    return message.action_proposal;
  }

  return null;
}

function toSearchPattern(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes("%") ? trimmed : `%${trimmed}%`;
}

async function resolveRecordIdByName(
  targetTable: "clients" | "projects" | "products",
  rawValue: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const value = rawValue.trim();
  if (!value) return null;

  if (targetTable === "clients") {
    const { data: exactClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("full_name", value)
      .limit(1);
    if (exactClient?.[0]?.id) return exactClient[0].id;

    const { data: exactClientCode } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("client_id", value)
      .limit(1);
    if (exactClientCode?.[0]?.id) return exactClientCode[0].id;

    const { data: fuzzyClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .ilike("full_name", toSearchPattern(value))
      .limit(1);
    return fuzzyClient?.[0]?.id ?? null;
  }

  if (targetTable === "projects") {
    const { data: exactProject } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("name", value)
      .limit(1);
    if (exactProject?.[0]?.id) return exactProject[0].id;

    const { data: fuzzyProject } = await supabaseAdmin
      .from("projects")
      .select("id")
      .ilike("name", toSearchPattern(value))
      .limit(1);
    return fuzzyProject?.[0]?.id ?? null;
  }

  const { data: exactProduct } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("name", value)
    .limit(1);
  if (exactProduct?.[0]?.id) return exactProduct[0].id;

  const { data: fuzzyProduct } = await supabaseAdmin
    .from("products")
    .select("id")
    .ilike("name", toSearchPattern(value))
    .limit(1);
  return fuzzyProduct?.[0]?.id ?? null;
}

async function normalizeFilters(
  tableName: string,
  filters: QueryFilter[],
  supabaseAdmin: ReturnType<typeof createClient>,
  mode: "read" | "write"
): Promise<{ filters: QueryFilter[]; resolutions: FilterResolution[] }> {
  const normalized: QueryFilter[] = [];
  const resolutions: FilterResolution[] = [];

  for (const filter of filters) {
    if (!filter?.column) continue;

    const nextFilter: QueryFilter = {
      column: filter.column,
      operator: filter.operator,
      value: String(filter.value ?? ""),
    };

    if (tableName === "meetings") {
      if (nextFilter.column === "status") {
        nextFilter.value = String(normalizeMeetingStatusValue(nextFilter.value));
      }

      if (MEETING_TEXT_FILTER_COLUMNS.has(nextFilter.column) && nextFilter.operator === "eq") {
        nextFilter.operator = "ilike";
        if (mode === "read") {
          nextFilter.value = toSearchPattern(nextFilter.value);
        }
      }
    }

    if (nextFilter.column === "client_id" && !isUuid(nextFilter.value)) {
      const resolvedId = await resolveRecordIdByName("clients", nextFilter.value, supabaseAdmin);
      if (resolvedId) {
        resolutions.push({
          from_column: "client_id",
          to_column: "client_id",
          original_value: nextFilter.value,
          resolved_value: resolvedId,
        });
        nextFilter.value = resolvedId;
      } else if (tableName === "meetings" || tableName === "projects") {
        const fallbackColumn = tableName === "meetings" ? "client_name" : "client_name";
        resolutions.push({
          from_column: "client_id",
          to_column: fallbackColumn,
          original_value: nextFilter.value,
          resolved_value: nextFilter.value,
        });
        nextFilter.column = fallbackColumn;
        if (mode === "read" && nextFilter.operator === "eq") {
          nextFilter.operator = "ilike";
          nextFilter.value = toSearchPattern(nextFilter.value);
        }
      }
    }

    if (nextFilter.column === "project_id" && !isUuid(nextFilter.value)) {
      const resolvedId = await resolveRecordIdByName("projects", nextFilter.value, supabaseAdmin);
      if (resolvedId) {
        resolutions.push({
          from_column: "project_id",
          to_column: "project_id",
          original_value: nextFilter.value,
          resolved_value: resolvedId,
        });
        nextFilter.value = resolvedId;
      } else if (tableName === "meetings") {
        resolutions.push({
          from_column: "project_id",
          to_column: "project_name",
          original_value: nextFilter.value,
          resolved_value: nextFilter.value,
        });
        nextFilter.column = "project_name";
        if (mode === "read" && nextFilter.operator === "eq") {
          nextFilter.operator = "ilike";
          nextFilter.value = toSearchPattern(nextFilter.value);
        }
      }
    }

    if (nextFilter.column === "product_id" && !isUuid(nextFilter.value)) {
      const resolvedId = await resolveRecordIdByName("products", nextFilter.value, supabaseAdmin);
      if (resolvedId) {
        resolutions.push({
          from_column: "product_id",
          to_column: "product_id",
          original_value: nextFilter.value,
          resolved_value: resolvedId,
        });
        nextFilter.value = resolvedId;
      } else if (tableName === "meetings" || tableName === "projects") {
        const fallbackColumn = "product_name";
        resolutions.push({
          from_column: "product_id",
          to_column: fallbackColumn,
          original_value: nextFilter.value,
          resolved_value: nextFilter.value,
        });
        nextFilter.column = fallbackColumn;
        if (mode === "read" && nextFilter.operator === "eq") {
          nextFilter.operator = "ilike";
          nextFilter.value = toSearchPattern(nextFilter.value);
        }
      }
    }

    normalized.push(nextFilter);
  }

  return { filters: normalized, resolutions };
}

function inferProductType(text: string): string | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("subscri") || normalized.includes("mensal")) return "servico_mensal";
  if (normalized.includes("consulta ") || normalized.includes("consultas") || /\bconsulta\b/.test(normalized)) return "consulta";
  if (normalized.includes("grupo")) {
    if (normalized.includes("consult")) return "consultoria_grupo";
    if (normalized.includes("mentoria")) return "mentoria_grupo";
  }
  if (normalized.includes("mentoria")) return "mentoria_individual";
  if (normalized.includes("consult")) return "consultoria_individual";
  if (normalized.includes("curso")) return "curso";
  if (normalized.includes("template")) return "template";
  if (normalized.includes("serviço pontual") || normalized.includes("servico pontual")) return "servico_pontual";
  if (normalized.includes("serviço mensal") || normalized.includes("servico mensal")) return "servico_mensal";
  if (normalized.includes("workshop")) return "workshop";
  if (normalized.includes("ebook") || normalized.includes("e-book")) return "ebook";
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
        ? `Feito ✅ — criei "${recordName}".`
        : `Feito ✅ — criei o registo.`;
    case "update":
      return `Feito ✅ — atualizado.`;
    case "delete":
      return `Feito ✅ — eliminado.`;
    case "send_email":
      return typeof result.message === "string" ? `✅ ${result.message}` : "Email enviado ✅";
    case "attach_file": {
      const file = result.file as Record<string, unknown> | undefined;
      const label = (file?.name as string) || (file?.file_name as string) || "ficheiro";
      return `Anexado ✅ — "${label}".`;
    }
    default:
      return "Feito ✅";
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

// Apply a single filter to a Supabase query, supporting all common operators
function applyFilter(query: any, f: { column: string; operator: string; value: string }): any {
  switch (f.operator) {
    case "eq": return query.eq(f.column, f.value);
    case "neq": case "not.eq": return query.neq(f.column, f.value);
    case "gt": return query.gt(f.column, f.value);
    case "gte": return query.gte(f.column, f.value);
    case "lt": return query.lt(f.column, f.value);
    case "lte": return query.lte(f.column, f.value);
    case "like": return query.like(f.column, `%${f.value}%`);
    case "ilike": return query.ilike(f.column, `%${f.value}%`);
    case "is": return query.is(f.column, f.value === "null" ? null : f.value);
    case "not.is": return query.not(f.column, "is", f.value === "null" ? null : f.value);
    case "in": return query.in(f.column, f.value.split(",").map((v: string) => v.trim()));
    default:
      console.warn(`Unknown filter operator: ${f.operator}, falling back to eq`);
      return query.eq(f.column, f.value);
  }
}

async function resolveMeetingWriteTarget(
  filters: QueryFilter[],
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ filters: QueryFilter[]; error?: string }> {
  if (filters.length === 0 || filters.some((filter) => filter.column === "id" && isUuid(filter.value))) {
    return { filters };
  }

  let query = supabaseAdmin.from("meetings").select("id, title, client_name, date_time").limit(2);
  for (const filter of filters) {
    query = applyFilter(query, filter);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Could not pre-resolve meeting target", error.message);
    return { filters };
  }

  if (!data || data.length === 0) {
    return { filters, error: "Não encontrei nenhuma reunião com esses critérios. Usa o nome completo do cliente, o título da reunião ou a data." };
  }

  if (data.length > 1) {
    return { filters, error: "Encontrei várias reuniões com esses critérios. Indica o cliente completo, o título completo ou a data exata." };
  }

  return {
    filters: [{ column: "id", operator: "eq", value: data[0].id }],
  };
}


async function executeSingleAction(
  actionType: string,
  details: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
  pendingFile?: { name?: string; type?: string; base64?: string } | null
): Promise<Record<string, unknown>> {
  const tableName = details.table as string;

  if (actionType === "send_email") {
    try {
      const sendRes = await sendTransactionalEmail({
        templateName: "ai-assistant-email",
        recipientEmail: details.to as string,
        idempotencyKey: `ai-email-${Date.now()}`,
        templateData: { subject: details.subject, body: details.body },
      });
      if (!sendRes.ok) return { error: `Erro ao enviar email: ${sendRes.details}` };
      return { success: true, message: `Email enviado para ${details.to}` };
    } catch (e) {
      return { error: `Email não configurado ou erro: ${e instanceof Error ? e.message : "desconhecido"}` };
    }
  }

  if (actionType === "attach_file") {
    if (!pendingFile?.base64 || !pendingFile?.name) {
      return { error: "Não vejo nenhum ficheiro anexado a esta mensagem. Anexa o ficheiro primeiro." };
    }
    if (BLOCKED_TABLES.has(tableName)) return { error: "Acesso a esta tabela não é permitido." };

    const column = (details.column as string) || "documents";
    const label = (details.document_label as string) || pendingFile.name;
    const rawFilters = (details.filters as QueryFilter[]) || [];
    const normalized = await normalizeFilters(tableName, rawFilters, supabaseAdmin, "write");
    const filters = normalized.filters;
    if (filters.length === 0) {
      return { error: "Para anexar preciso de saber a que registo. Indica um filtro." };
    }

    // Bucket selection by table
    const bucketByTable: Record<string, string> = {
      financial_expenses: "financial-files",
      financial_entries: "financial-files",
      commercial_sales: "financial-files",
      financial_subscriptions: "financial-files",
      meetings: "meeting-files",
      projects: "project-files",
      products: "product-files",
      events: "event-files",
      content_items: "content-files",
      mural_posts: "mural-files",
      clients: "commercial-files",
    };
    const bucket = bucketByTable[tableName] || "financial-files";

    // Find target row
    let findQuery = supabaseAdmin.from(tableName).select(`id, ${column}`);
    for (const f of filters) findQuery = applyFilter(findQuery, f);
    const { data: rows, error: findErr } = await findQuery.limit(2);
    if (findErr) return { error: findErr.message };
    if (!rows || rows.length === 0) return { error: "Não encontrei nenhum registo com esses critérios." };
    if (rows.length > 1) return { error: "Encontrei mais do que um registo. Sê mais específica nos filtros." };
    const target = rows[0] as Record<string, unknown>;

    // Upload to storage
    const safeName = pendingFile.name.replace(/[^\w.\-]+/g, "_");
    const path = `${tableName}/${target.id}/${Date.now()}_${safeName}`;
    let bytes: Uint8Array;
    try {
      const bin = atob(pendingFile.base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return { error: "Ficheiro inválido (base64 corrompido)." };
    }
    const { error: upErr } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
      contentType: pendingFile.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) return { error: `Não consegui guardar o ficheiro: ${upErr.message}` };
    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    // Append to jsonb array
    const existing = Array.isArray(target[column]) ? (target[column] as unknown[]) : [];
    const newDoc = {
      name: label,
      file_name: pendingFile.name,
      url: pub.publicUrl,
      bucket,
      path,
      mime_type: pendingFile.type || null,
      uploaded_at: new Date().toISOString(),
      uploaded_by: "atena",
    };
    const updated = [...existing, newDoc];
    const { error: updErr } = await supabaseAdmin.from(tableName).update({ [column]: updated }).eq("id", target.id as string);
    if (updErr) return { error: `Ficheiro guardado mas não consegui ligar ao registo: ${updErr.message}` };

    return { success: true, attached: true, file: newDoc, record_id: target.id };
  }

  if (BLOCKED_TABLES.has(tableName)) return { error: "Acesso a esta tabela não é permitido." };
  if (READONLY_TABLES.has(tableName) && actionType !== "create") return { error: "Esta tabela é apenas de leitura." };

  const rawFilters = (details.filters as QueryFilter[]) || [];
  const normalized = await normalizeFilters(tableName, rawFilters, supabaseAdmin, "write");
  let filters = normalized.filters;
  let data = details.data as Record<string, unknown> || {};

  if (tableName === "meetings" && (actionType === "create" || actionType === "update")) {
    data = {
      ...data,
      ...(data.status !== undefined ? { status: normalizeMeetingStatusValue(data.status) } : {}),
    };
  }

  if (tableName === "meetings" && (actionType === "update" || actionType === "delete")) {
    const resolvedMeetingTarget = await resolveMeetingWriteTarget(filters, supabaseAdmin);
    if (resolvedMeetingTarget.error) return { error: resolvedMeetingTarget.error };
    filters = resolvedMeetingTarget.filters;
  }

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
        query = applyFilter(query, f);
      }
      const { data: result, error } = await query.select();
      if (error) return { error: error.message };
      if (!result || result.length === 0) return { error: "Nenhum registo encontrado com os filtros especificados. Verifica se os valores estão corretos (nomes completos, IDs, etc.)." };
      return { success: true, updated: result, count: result?.length || 0, ...(result?.[0] || {}) };
    }
    case "delete": {
      if (filters.length === 0) return { error: "Delete requer pelo menos um filtro para segurança." };
      let query = supabaseAdmin.from(tableName).delete();
      for (const f of filters) {
        query = applyFilter(query, f);
      }
      const { data: result, error } = await query.select();
      if (error) return { error: error.message };
      return { success: true, deleted: result?.length || 0 };
    }
    default:
      return { error: `Tipo de ação desconhecido: ${actionType}` };
  }
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
  pendingFile?: { name?: string; type?: string; base64?: string } | null
) {
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
          equipa: ["team_members", "member_contracts", "member_payments", "member_onboarding", "absence_coverage", "hiring_simulations"],
          tarefas: ["tasks", "task_time_entries", "time_entries"],
          projetos: ["projects", "project_deliverables", "project_payments", "project_members"],
          financeiro: ["commercial_sales", "financial_expenses", "financial_categories", "financial_goals", "financial_payroll", "financial_contractors", "financial_documents"],
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

    case "list_column_values": {
      const tableName = args.table as string;
      const column = args.column as string;
      if (BLOCKED_TABLES.has(tableName)) return { error: "Acesso a esta tabela não é permitido." };
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select(column)
        .not(column, "is", null)
        .limit(1000);
      if (error) return { error: error.message };
      const unique = [...new Set((data || []).map((r: Record<string, unknown>) => r[column]).filter(Boolean))].sort();
      return { table: tableName, column, values: unique, count: unique.length };
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

      const rawFilters = (args.filters as QueryFilter[]) || [];
      const { filters, resolutions } = await normalizeFilters(tableName, rawFilters, supabaseAdmin, "read");
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
      if (countOnly) return { total: count, normalized_filters: filters, filter_resolutions: resolutions };
      return { data, total: count, normalized_filters: filters, filter_resolutions: resolutions };
    }

    case "period_summary": {
      const startDate = args.start_date as string;
      const endDate = args.end_date as string;
      // Add one day to end_date to make it inclusive
      const endDateExclusive = new Date(endDate);
      endDateExclusive.setDate(endDateExclusive.getDate() + 1);
      const endExcl = endDateExclusive.toISOString().split("T")[0];

      // ═══ BATCH 1: Core business data ═══
      const [auditRes, tasksRes, tasksOverdueRes, meetingsRes, salesRes, expensesRes, notifRes, clientsRes, leadsRes, contentRes] = await Promise.all([
        supabaseAdmin.from("audit_logs").select("action, entity_type, entity_id, user_name, created_at, metadata")
          .gte("created_at", startDate).lt("created_at", endExcl).order("created_at", { ascending: false }).limit(200),
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department, updated_at")
          .eq("status", "concluida").gte("updated_at", startDate).lt("updated_at", endExcl).limit(100),
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department")
          .not("status", "in", '("concluida","cancelada")').lt("deadline", endExcl).limit(100),
        supabaseAdmin.from("meetings").select("title, date_time, status, client_name, department, portal_notes, duration_minutes")
          .gte("date_time", startDate).lt("date_time", endExcl).order("date_time").limit(100),
        supabaseAdmin.from("commercial_sales").select("sale_id, client, product, invoice_total, base_value, status, payment_date, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        supabaseAdmin.from("financial_expenses").select("expense_id, description, total_with_vat, base_value, category, status, expense_date")
          .gte("expense_date", startDate).lt("expense_date", endExcl).limit(50),
        supabaseAdmin.from("notifications").select("type, title, message, link, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("clients").select("full_name, status, created_at, start_date, current_product")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        supabaseAdmin.from("crm_leads").select("name, status, source, potential_product, estimated_value, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        supabaseAdmin.from("content_items").select("title, status, format, scheduled_at")
          .gte("scheduled_at", startDate).lt("scheduled_at", endExcl).limit(50),
      ]);

      // ═══ BATCH 2: Portal, team, projects, financials ═══
      const [portalVisitsRes, portalQuestionsRes, meetingsUpdatedRes, onboardingRes, routinesRes,
             projectsRes, deliverableRes, memberOnbRes, memberContractsRes, financialEntriesRes,
             financialDocsRes, timeEntriesRes, absencesRes, muralRes, sopsRes, planGoalsRes,
             portalFeedbackRes, portalCommentsRes, clientOffbRes, memberPaymentsRes] = await Promise.all([
        supabaseAdmin.from("client_portals").select("client_id, last_visit_at")
          .gte("last_visit_at", startDate).lt("last_visit_at", endExcl).limit(50),
        supabaseAdmin.from("portal_initial_questions").select("portal_id, question, answer, file_urls, answered_at")
          .not("answered_at", "is", null).gte("answered_at", startDate).lt("answered_at", endExcl).limit(200),
        supabaseAdmin.from("meetings").select("title, date_time, status, client_name, updated_at, portal_notes")
          .gte("updated_at", startDate).lt("updated_at", endExcl).limit(100),
        supabaseAdmin.from("client_onboarding").select("client_id, activity, completed, created_at")
          .eq("completed", true).gte("created_at", startDate).lt("created_at", endExcl).limit(100),
        supabaseAdmin.from("tasks").select("name, status, assigned_to, deadline, department, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(100),
        // Projects created or updated
        supabaseAdmin.from("projects").select("name, status, client_id, product_id, start_date, deadline, progress, created_at, updated_at")
          .or(`created_at.gte.${startDate},updated_at.gte.${startDate}`).lt("created_at", endExcl).limit(50),
        // Deliverables completed in period
        supabaseAdmin.from("project_deliverables").select("name, status, phase_id, project_id, updated_at")
          .eq("status", "concluido").gte("updated_at", startDate).lt("updated_at", endExcl).limit(50),
        // Team member onboarding steps
        supabaseAdmin.from("member_onboarding").select("member_id, step, completed, updated_at")
          .gte("updated_at", startDate).lt("updated_at", endExcl).limit(100),
        // Member contracts uploaded
        supabaseAdmin.from("member_contracts").select("member_id, contract_type, file_name, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Financial entries (income) — sales are the source of truth
        supabaseAdmin.from("commercial_sales").select("sale_id, product, client, invoice_total, base_value, status, payment_date")
          .gte("payment_date", startDate).lt("payment_date", endExcl).limit(50),
        // Financial documents uploaded
        supabaseAdmin.from("financial_documents").select("file_name, document_type, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Time entries tracked
        supabaseAdmin.from("time_entries").select("entry_id, member_id, description, hours, entry_date, client_id, project_id")
          .gte("entry_date", startDate).lt("entry_date", endExcl).limit(100),
        // Absences created
        supabaseAdmin.from("absence_coverage").select("member_id, reason, start_date, end_date, status, substitute_id, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Mural posts
        supabaseAdmin.from("mural_posts").select("author_name, content, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(30),
        // SOPs created/updated
        supabaseAdmin.from("sops").select("sop_id, title, department, status, created_at, updated_at")
          .or(`created_at.gte.${startDate},updated_at.gte.${startDate}`).lt("created_at", endExcl).limit(30),
        // Planning goals updated
        supabaseAdmin.from("planning_goals").select("title, status, department, updated_at")
          .gte("updated_at", startDate).lt("updated_at", endExcl).limit(30),
        // Portal feedback from clients
        supabaseAdmin.from("portal_feedback").select("portal_id, rating, comment, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Portal comments from clients
        supabaseAdmin.from("portal_comments").select("portal_id, content, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Client offboarding
        supabaseAdmin.from("client_offboarding").select("client_id, activity, completed, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
        // Member payments
        supabaseAdmin.from("member_payments").select("member_id, amount, payment_date, status, created_at")
          .gte("created_at", startDate).lt("created_at", endExcl).limit(50),
      ]);

      // Group audit logs by entity_type and action
      const auditSummary: Record<string, number> = {};
      for (const log of auditRes.data || []) {
        const key = `${log.action}:${log.entity_type}`;
        auditSummary[key] = (auditSummary[key] || 0) + 1;
      }

      // Portal-specific activity from notifications
      const portalActivity = (notifRes.data || []).filter((n: Row) =>
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
      const meetingsWithPortalNotes = (meetingsRes.data || []).filter((m: Row) => m.portal_notes);

      // Meetings confirmed/changed during the period (from updated_at query)
      const meetingStatusChanges = (meetingsUpdatedRes.data || []).map((m: Row) => ({
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
          const clientIds = portalClients.map((p: Row) => p.client_id);
          const { data: clients } = await supabaseAdmin
            .from("clients")
            .select("id, full_name")
            .in("id", clientIds);
          const clientMap = Object.fromEntries((clients || []).map((c: Row) => [c.id, c.full_name]));
          const portalClientMap = Object.fromEntries((portalClients || []).map((p: Row) => [p.id, p.client_id]));
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
        const visitClientIds = portalVisits.map((v: Row) => v.client_id);
        const { data: visitClients } = await supabaseAdmin
          .from("clients")
          .select("id, full_name")
          .in("id", visitClientIds);
        const visitClientMap = Object.fromEntries((visitClients || []).map((c: Row) => [c.id, c.full_name]));
        portalVisitsSummary = portalVisits.map((v: Row) => ({
          cliente: visitClientMap[v.client_id] || "Desconhecido",
          ultima_visita: v.last_visit_at,
        }));
      }

      // Overdue tasks with deadline before end of period
      const overdueTasks = (tasksOverdueRes.data || []).filter((t: Row) => t.deadline && new Date(t.deadline) < new Date(endExcl));
      const newTasksCreated = routinesRes.data || [];

      // ═══════════════════════════════════════════════════════════════
      // DESTAQUES — resumo numérico explícito que o AI DEVE reportar
      // ═══════════════════════════════════════════════════════════════
      const destaques = {
        _instrucao: "OBRIGATÓRIO: Menciona TODOS estes pontos no resumo. Se o valor for 0, diz 'Sem atividade'. Organiza por secções.",
        // Tarefas
        tarefas_concluidas: (tasksRes.data || []).length,
        tarefas_criadas: newTasksCreated.length,
        tarefas_atrasadas: overdueTasks.length,
        // Reuniões agendadas no período (por date_time)
        reunioes_agendadas_no_periodo: (meetingsRes.data || []).length,
        // Reuniões cujo STATUS mudou no período (confirmadas, reagendadas, etc - por updated_at)
        reunioes_atualizadas_no_periodo: meetingStatusChanges.length,
        reunioes_confirmadas_no_periodo: meetingStatusChanges.filter((m: Row) => m.status === "confirmada").map((m: Row) => `${m.cliente} — "${m.titulo}" (atualizado ${m.atualizado_em})`),
        reunioes_por_confirmar: (meetingsRes.data || []).filter((m: Row) => m.status === "por_confirmar").length,
        reunioes_com_pedido_alteracao: meetingsWithPortalNotes.length,
        // Vendas & Financeiro
        vendas_novas: (salesRes.data || []).length,
        vendas_valor_total: (salesRes.data || []).reduce((s: number, v: Row) => s + (Number(v.invoice_total) || Number(v.base_value) || 0), 0),
        entradas_financeiras: (financialEntriesRes.data || []).length,
        entradas_valor_total: (financialEntriesRes.data || []).reduce((s: number, e: Row) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
        despesas_total: (expensesRes.data || []).length,
        despesas_valor_total: (expensesRes.data || []).reduce((s: number, e: Row) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
        documentos_financeiros_carregados: (financialDocsRes.data || []).length,
        pagamentos_equipa: (memberPaymentsRes.data || []).length,
        // Portal dos Clientes
        portais_visitados: portalVisitsSummary.length,
        clientes_que_visitaram_portal: portalVisitsSummary.map((v) => v.cliente),
        clientes_que_responderam_perguntas: portalQuestionsSummary.filter(q => q.respondidas > 0).map(q => `${q.cliente} (${q.respondidas}/${q.total})`),
        feedback_portal: (portalFeedbackRes.data || []).length,
        comentarios_portal: (portalCommentsRes.data || []).length,
        notificacoes_portal: portalActivity.length,
        // Clientes
        clientes_novos: (clientsRes.data || []).length,
        onboarding_cliente_steps: (onboardingRes.data || []).length,
        offboarding_cliente_steps: (clientOffbRes.data || []).length,
        // Leads & Comercial
        leads_novos: (leadsRes.data || []).length,
        // Projetos & Entregáveis
        projetos_atualizados: (projectsRes.data || []).length,
        entregaveis_concluidos: (deliverableRes.data || []).length,
        // Equipa
        onboarding_colaborador_steps: (memberOnbRes.data || []).length,
        contratos_carregados: (memberContractsRes.data || []).length,
        ausencias_registadas: (absencesRes.data || []).length,
        horas_registadas: (timeEntriesRes.data || []).reduce((s: number, t: Row) => s + (Number(t.hours) || 0), 0),
        // Conteúdos & Marketing
        conteudos_publicados: (contentRes.data || []).filter((c: Row) => c.status === "publicado").length,
        conteudos_agendados: (contentRes.data || []).filter((c: Row) => c.status === "agendado").length,
        // Mural
        publicacoes_mural: (muralRes.data || []).length,
        // SOPs & Processos
        sops_atualizados: (sopsRes.data || []).length,
        // Planeamento
        objetivos_atualizados: (planGoalsRes.data || []).length,
      };

      return {
        periodo: `${startDate} a ${endDate}`,
        DESTAQUES_OBRIGATORIOS: destaques,
        resumo_acoes: auditSummary,
        acoes_detalhadas: (auditRes.data || []).slice(0, 50).map((l: Row) => ({
          acao: l.action, tipo: l.entity_type, por: l.user_name, quando: l.created_at, detalhes: l.metadata,
        })),
        tarefas_concluidas: {
          total: (tasksRes.data || []).length,
          lista: (tasksRes.data || []).map((t: Row) => ({ nome: t.name, responsavel: t.assigned_to, departamento: t.department })),
        },
        tarefas_criadas: {
          total: newTasksCreated.length,
          lista: newTasksCreated.map((t: Row) => ({ nome: t.name, status: t.status, responsavel: t.assigned_to, prazo: t.deadline })),
        },
        tarefas_atrasadas: {
          total: overdueTasks.length,
          lista: overdueTasks.slice(0, 20).map((t: Row) => ({ nome: t.name, prazo: t.deadline, responsavel: t.assigned_to, departamento: t.department })),
        },
        reunioes: {
          total: (meetingsRes.data || []).length,
          por_status: meetingsByStatus,
          lista: (meetingsRes.data || []).map((m: Row) => ({ titulo: m.title, data: m.date_time, status: m.status, cliente: m.client_name, notas_portal: m.portal_notes || null })),
          com_notas_portal: meetingsWithPortalNotes.map((m: Row) => ({ titulo: m.title, cliente: m.client_name, notas_cliente: m.portal_notes })),
          mudancas_status_no_periodo: meetingStatusChanges,
        },
        vendas: {
          total: (salesRes.data || []).length,
          valor_total: (salesRes.data || []).reduce((s: number, v: Row) => s + (Number(v.invoice_total) || Number(v.base_value) || 0), 0),
          lista: (salesRes.data || []).map((s: Row) => ({ id: s.sale_id, cliente: s.client, produto: s.product, valor: Number(s.invoice_total) || Number(s.base_value) || 0, status: s.status, data_pagamento: s.payment_date })),
        },
        financeiro: {
          entradas: {
            total: (financialEntriesRes.data || []).length,
            valor: (financialEntriesRes.data || []).reduce((s: number, e: Row) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
            lista: (financialEntriesRes.data || []).map((e: Row) => ({ id: e.entry_id, descricao: e.description, valor: Number(e.total_with_vat) || Number(e.base_value) || 0, categoria: e.category, status: e.status })),
          },
          despesas: {
            total: (expensesRes.data || []).length,
            valor: (expensesRes.data || []).reduce((s: number, e: Row) => s + (Number(e.total_with_vat) || Number(e.base_value) || 0), 0),
            lista: (expensesRes.data || []).map((e: Row) => ({ id: e.expense_id, descricao: e.description, valor: Number(e.total_with_vat) || Number(e.base_value) || 0, categoria: e.category, status: e.status })),
          },
          documentos_carregados: (financialDocsRes.data || []).map((d: Row) => ({ ficheiro: d.file_name, tipo: d.document_type })),
          pagamentos_equipa: (memberPaymentsRes.data || []).map((p: Row) => ({ membro: p.member_id, valor: p.amount, status: p.status })),
        },
        atividade_portal_clientes: {
          _instrucao: "IMPORTANTE: Reporta TODA a atividade dos portais.",
          notificacoes: portalActivity.map((n: Row) => ({ titulo: n.title, mensagem: n.message, quando: n.created_at })),
          visitas: portalVisitsSummary,
          respostas_diagnostico: portalQuestionsSummary,
          feedback: (portalFeedbackRes.data || []).map((f: Row) => ({ rating: f.rating, comentario: f.comment })),
          comentarios: (portalCommentsRes.data || []).map((c: Row) => ({ conteudo: c.content, quando: c.created_at })),
        },
        projetos: {
          atualizados: (projectsRes.data || []).map((p: Row) => ({ nome: p.name, status: p.status, progresso: p.progress })),
          entregaveis_concluidos: (deliverableRes.data || []).map((d: Row) => ({ nome: d.name, projeto: d.project_id })),
        },
        equipa: {
          onboarding_colaborador: (memberOnbRes.data || []).map((o: Row) => ({ membro: o.member_id, passo: o.step, concluido: o.completed })),
          contratos_carregados: (memberContractsRes.data || []).map((c: Row) => ({ membro: c.member_id, tipo: c.contract_type, ficheiro: c.file_name })),
          ausencias: (absencesRes.data || []).map((a: Row) => ({ membro: a.member_id, motivo: a.reason, de: a.start_date, ate: a.end_date, status: a.status })),
          horas_registadas: {
            total_horas: (timeEntriesRes.data || []).reduce((s: number, t: Row) => s + (Number(t.hours) || 0), 0),
            total_entradas: (timeEntriesRes.data || []).length,
          },
        },
        novos_clientes: (clientsRes.data || []).map((c: Row) => ({ nome: c.full_name, status: c.status, produto: c.current_product, inicio: c.start_date })),
        onboarding_clientes: (onboardingRes.data || []).map((o: Row) => ({ cliente: o.client_id, atividade: o.activity })),
        offboarding_clientes: (clientOffbRes.data || []).map((o: Row) => ({ cliente: o.client_id, atividade: o.activity, concluido: o.completed })),
        novos_leads: (leadsRes.data || []).map((l: Row) => ({ nome: l.name, status: l.status, fonte: l.source, produto: l.potential_product, valor: l.estimated_value })),
        conteudos: (contentRes.data || []).map((c: Row) => ({ titulo: c.title, status: c.status, formato: c.format })),
        mural: (muralRes.data || []).map((m: Row) => ({ autor: m.author_name, conteudo: (m.content || "").slice(0, 200) })),
        sops: (sopsRes.data || []).map((s: Row) => ({ id: s.sop_id, titulo: s.title, departamento: s.department, status: s.status })),
        planeamento: (planGoalsRes.data || []).map((g: Row) => ({ titulo: g.title, status: g.status, departamento: g.department })),
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
        supabaseAdmin,
        pendingFile
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

        const result = await executeSingleAction(step.action_type, resolvedDetails, supabaseAdmin, pendingFile);

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
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Rate limit: 30 calls / minute per IP (LLM cost protection)
  const rl = checkRateLimit(`ai-assistant:${getClientId(req)}`, 30, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    // --- Auth gate: require a valid authenticated user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json() as { messages?: ChatMessage[]; file?: Record<string, unknown> };
    const { messages = [], file } = rawBody;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // --- Role gate: only owners/admins may use the AI assistant ---
    // The assistant uses the service-role key for queries (bypassing RLS), so
    // we MUST restrict access at the function boundary to roles that already
    // have broad visibility over sensitive data (payroll, contracts, finance).
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowedRoles = new Set(["owner", "admin"]);
    const hasAccess = (roleRows || []).some((r: Row) => allowedRoles.has(String(r.role)));
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito ao Owner/Admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userName = "";
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("user_id", user.id).single();
    userName = profile?.full_name || user.email?.split("@")[0] || "";

    const { data: settings } = await supabaseAdmin.from("business_settings").select("business_name, business_type").limit(1).single();
    const businessName = settings?.business_name || "o negócio";

    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    const systemPrompt = `És a **Atena**, assistente do Lyrata (sistema de ${businessName}). PT-PT, tratas por "tu". ${userName ? `Utilizador: **${userName}** — chama-o pelo primeiro nome.` : ""}
Hoje: ${today}. Ano atual: ${currentYear}. Datas sem ano = ${currentYear}.

## TOM (CRÍTICO)
- Direta, prática, sem rodeios. Tipo colega de equipa, não secretária.
- Frases curtas. Zero floreado, zero "vou já tratar disso para ti".
- Confirmações de sucesso: 1 linha máximo ("Feito ✅ — atualizado.").
- NUNCA mostres JSON, código, IDs longos, nomes de colunas técnicas, ou repitas os detalhes da ação que vais propor — o frontend já mostra um cartão visual com isso.
- NUNCA digas "vou propor a ação para confirmares" — a proposta aparece sozinha, fala como se já tivesses o contexto.
- Se o pedido é claro, **propõe e cala-te**. O texto que escreves antes do tool call deve ser **no máximo uma frase de contexto** (ou nenhuma).

## CONFIRMAÇÃO (CRÍTICO — 1 VEZ SÓ)
- Cada ação concreta = **uma única** \`propose_action\` (ou \`propose_workflow\` se forem 2+ passos encadeados).
- Depois de propores, **PARA**. Não voltes a propor a mesma coisa, não peças clarificações, não escrevas nada extra.
- Quando vier "[AÇÃO CONFIRMADA]" → executas com \`execute_confirmed_action\` / \`execute_confirmed_workflow\` e respondes com 1 linha de sucesso.
- Se a ação envolve um ficheiro anexado + atualizações, agrupa **tudo num único workflow** (ex: anexar fatura + mudar status = workflow de 2 passos = 1 confirmação).

## FERRAMENTAS
- **query_table** / **list_column_values** / **list_tables**: ler dados. Usa quando precisas de UUIDs ou de validar valores válidos de status/categoria.
- **propose_action**: 1 ação (create/update/delete/send_email/attach_file).
- **propose_workflow**: 2+ ações encadeadas. Refere passos anteriores com \`{{step_N.campo}}\`.
- **period_summary**: resumo de período (férias, semana passada, etc.). Usa as 12 secções em DESTAQUES_OBRIGATORIOS, sem omitir nenhuma.

## ANEXAR FICHEIROS (attach_file)
Quando o utilizador anexar um ficheiro **e** pedir para o ligar a um registo (despesa, venda, reunião, projeto, cliente…):
- Usa \`action_type: "attach_file"\` em \`propose_action\` (ou como passo do workflow).
- \`details\`: { table, filters, document_label }. Não precisas de \`data\`. \`column\` é opcional (default: "documents").
- O ficheiro vem da última mensagem — não precisas de o passar tu.
- Tabelas suportadas: financial_expenses, financial_entries, commercial_sales, meetings, projects, clients, products, events, content_items, mural_posts, financial_subscriptions.
- Exemplo: "anexa esta fatura à despesa Systeme deste mês e marca como paga" →
  - workflow com 2 passos: (1) attach_file em financial_expenses filtrando por expense_name ilike "systeme" + expense_month = X; (2) update da mesma despesa, status = "pago".

## REGRAS DE DADOS
- NUNCA inventes valores de status/tipo/categoria. Em dúvida → \`list_column_values\`.
- Em update/delete: resolve UUID via query_table e filtra por \`id eq <uuid>\`. Se filtrares por nome, usa \`ilike\`.
- Campos *_id requerem UUIDs. Para nomes, usa as colunas *_name (client_name, project_name, product_name).
- "amanhã" / "hoje" → calcula tu, NÃO perguntes a data.
- Campos opcionais não mencionados → null. Não perguntes por eles.

## TABELAS-CHAVE (colunas exatas)
- tasks: name, status (pendente|em_progresso|concluida), priority, deadline, assigned_to, project_id, client_id
- clients: full_name, email, status (ativo|em_onboarding|pausado|cancelado|concluido), current_product, nif
- projects: name, client_id, product_id, status (em_curso|concluido|cancelado|pausado), deadline
- financial_expenses: expense_name, category, base_value, total_with_vat, status, expense_month, expense_year, documents (jsonb)
- financial_entries: entradas (mesma lógica)
- commercial_sales: sale_id, client, product, base_value, invoice_total, status (pendente|pago|cancelado|atrasado), payment_date, documents
- meetings: title, date_time, status (por_organizar|por_confirmar|confirmada|terminada). "marcada"/"agendada" → "confirmada".
- team_members: full_name, email, role_title, work_areas, status
- products: name, category, base_price, status
- crm_leads: name, email, phone, status, potential_product
- planning_goals, client_onboarding, project_deliverables, content_items
`;

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

    // === AUTO-EXECUTE confirmed actions without relying on the AI model ===
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      const confirmedAction = parseConfirmedAction(lastUserMsg.content)
        ?? (isTextualConfirmation(lastUserMsg.content) ? getLastPendingProposal(messages) : null);
      if (confirmedAction) {
        console.log("Auto-executing confirmed action:", JSON.stringify(confirmedAction).slice(0, 500));
        try {
          let result: Record<string, unknown>;
          if (confirmedAction.workflow && Array.isArray(confirmedAction.steps)) {
            // Execute workflow
            const steps = confirmedAction.steps as Array<{
              step_label: string;
              action_type: string;
              details: Record<string, unknown>;
            }>;
            const stepResults: Record<number, Record<string, unknown>> = {};
            const results: Array<{ step: number; label: string; success: boolean; result: Record<string, unknown> }> = [];
            for (let i = 0; i < steps.length; i++) {
              const step = steps[i];
              const resolvedDetails = resolveRefs(step.details, stepResults) as Record<string, unknown>;
              console.log(`Auto-workflow step ${i + 1}/${steps.length}: ${step.step_label}`);
              const stepResult = await executeSingleAction(step.action_type, resolvedDetails, supabaseAdmin, file as { name?: string; type?: string; base64?: string } | undefined);
              if (stepResult.error) {
                return new Response(JSON.stringify({
                  content: `❌ Erro no passo ${i + 1} (${step.step_label}): ${stepResult.error}`,
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
              stepResults[i + 1] = stepResult;
              results.push({ step: i + 1, label: step.step_label, success: true, result: stepResult });
            }
            result = { success: true, completed_steps: steps.length, total_steps: steps.length, results };
          } else {
            // Execute single action
            result = await executeSingleAction(
              confirmedAction.action_type as string,
              (confirmedAction.details as Record<string, unknown>) || {},
              supabaseAdmin,
              file as { name?: string; type?: string; base64?: string } | undefined
            );
          }

          if (result.error) {
            return new Response(JSON.stringify({
              content: `❌ Erro ao executar: ${result.error}`,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          const summary = formatExecutionSummary(confirmedAction, result);
          return new Response(JSON.stringify({ content: summary }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("Auto-execute error:", e);
          return new Response(JSON.stringify({
            content: `❌ Erro ao executar a ação: ${e instanceof Error ? e.message : "desconhecido"}`,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
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
        const toolResult = await executeTool(fnName, fnArgs, supabaseAdmin, file as { name?: string; type?: string; base64?: string } | undefined);

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
