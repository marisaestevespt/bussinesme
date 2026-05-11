import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// All tables to backup (operational + config)
const TABLES_TO_BACKUP = [
  "business_settings", "business_setup", "business_plan_settings",
  "business_plan_cards", "business_plan_custom_columns",
  "brand_competitors", "brand_differentials", "brand_kanban_items",
  "brand_links", "brand_swot_items", "brand_visual_cards", "brand_visual_files",
  "automation_settings", "custom_fields", "custom_field_values", "custom_fonts",
  "custom_roles", "custom_views", "departments", "department_whatsapp_links",
  "digest_settings", "event_types", "financial_categories", "kpi_settings",
  "marketing_channels", "channel_pages", "marketing_automations", "marketing_funnels",
  "marketing_pages", "internal_documents", "members", "member_sensitive_access",
  "platform_accesses", "profiles", "role_permissions", "routines",
  "sop_categories", "sops",
  "strategy_channel_details", "strategy_channel_formats", "strategy_channel_frames",
  "strategy_editorial_lines", "strategy_distribution_cards", "strategy_settings",
  "team_members", "user_roles",
  // Operational data
  "clients", "client_activities", "client_contacts", "client_feedback",
  "client_history", "client_nps_records",
  "client_offboarding", "client_onboarding", "client_portals",
  "clients_monthly_analysis",
  "commercial_sales", "commercial_strategy", "commercial_annual_goals",
  "commercial_monthly_goals", "commercial_quarterly_goals", "commercial_product_goals",
  "commercial_monthly_analysis", "commercial_library_entries", "commercial_sales_actions",
  "commercial_strategy_projects",
  "content_items", "content_attachments", "content_channels", "content_metrics",
  "crm_pipelines", "crm_pipeline_stages", "crm_pipeline_leads", "crm_leads",
  "crm_interactions", "crm_lead_actions", "crm_saved_views",
  "events", "event_attachments", "event_members",
  "meetings", "meeting_participants", "meeting_projects",
  "projects", "project_deliverables", "project_members",
  "tasks", "task_dependencies", "task_time_entries",
  "products", "product_automations", "product_costs", "product_deliverable_templates",
  "product_documents", "product_feedbacks", "product_funnels",
  "product_improvements", "product_kpi_values", "product_kpi_reports",
  "product_metrics_analysis", "product_nps_config",
  "product_nps_records", "product_offboarding_templates", "product_onboarding_templates",
  "product_payment_methods", "product_project_templates", "product_team_members",
  "product_traffic_ads", "product_useful_links",
  "planning_goals", "planning_routines",
  "objective_actions", "objective_criteria", "objective_metrics",
  "channel_monthly_metrics", "channel_reports",
  "traffic_report_cards", "traffic_report_files", "traffic_creatives",
  "financial_expenses", "financial_documents", "financial_goals",
  "financial_payroll", "financial_subscriptions", "financial_contractors",
  "launch_tasks", "launch_data",
  "capacity_scenarios", "capacity_scenario_products",
  "member_contracts", "member_onboarding", "member_payments",
  "member_personal_images", "member_personal_links", "member_personal_notes",
  "team_member_vacations",
  "hiring_simulations", "training_courses", "training_doubts",
  "feedback_sessions", "performance_monthly", "performance_weekly",
  "innovation_docs", "innovation_ideas",
  "mural_posts", "mural_comments", "mural_reactions",
  "website_pages", "website_page_files",
  "marketing_ideas", "marketing_resource_links", "marketing_monthly_analysis",
  "executive_brain_dump", "executive_monthly_checklists",
  "executive_objectives", "executive_quarterly_analysis", "executive_weekly_routines",
  "time_entries", "notifications", "user_favorites", "recommendations",
  "absence_coverage", "suppliers", "audit_logs",
  "portal_comments", "portal_monthly_summaries",
  "portal_initial_questions", "portal_materials", "portal_feedback",
  "portal_faqs", "portal_project_history",
  "weekly_align_notes", "metric_history",
  "page_access_grants", "user_views",
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let triggerType = "scheduled";

  // Require authentication for every invocation. Scheduled jobs must use the
  // private service_role key; manual calls must be made by the owner.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  if (token === serviceKey) {
    triggerType = "scheduled";
  } else {
    triggerType = "manual";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: ownerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRole) {
      return new Response(JSON.stringify({ error: "Apenas o owner pode executar backups" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "");
  const filePath = `backup-${dateStr}-${timeStr}.json`;

  // Create backup record
  const { data: backupRecord, error: insertErr } = await admin
    .from("backups")
    .insert({ file_path: filePath, trigger_type: triggerType, status: "running" })
    .select("id")
    .single();

  if (insertErr || !backupRecord) {
    console.error("Failed to create backup record:", insertErr);
    return new Response(JSON.stringify({ error: "Erro ao criar registo de backup" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const backupData: Record<string, unknown[]> = {};
    let tablesCount = 0;

    for (const table of TABLES_TO_BACKUP) {
      const allRows: unknown[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await admin
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) {
          console.warn(`Skipping ${table}: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allRows.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        } else {
          break;
        }
      }

      if (allRows.length > 0) {
        backupData[table] = allRows;
        tablesCount++;
      }
    }

    const jsonContent = JSON.stringify({
      backup_date: now.toISOString(),
      tables_count: tablesCount,
      data: backupData,
    });

    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonContent);

    // Upload to storage
    const { error: uploadErr } = await admin.storage
      .from("backups")
      .upload(filePath, bytes, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Update backup record
    await admin
      .from("backups")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        file_size_bytes: bytes.length,
        tables_count: tablesCount,
      })
      .eq("id", backupRecord.id);

    return new Response(
      JSON.stringify({ success: true, file_path: filePath, tables_count: tablesCount, size_bytes: bytes.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Backup error:", err);

    await admin
      .from("backups")
      .update({
        status: "failed",
        error_message: err.message || "Erro desconhecido",
        completed_at: new Date().toISOString(),
      })
      .eq("id", backupRecord.id);

    return new Response(
      JSON.stringify({ error: err.message || "Erro ao executar backup" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
