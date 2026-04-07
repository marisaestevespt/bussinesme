import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ownerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRole) {
      return new Response(JSON.stringify({ error: "Apenas o owner pode fazer reset" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (body.confirmation !== "CONFIRMO") {
      return new Response(JSON.stringify({ error: "Confirmação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetType: "data" | "full" = body.reset_type === "full" ? "full" : "data";

    // ── TABLES TO DELETE — operational data (always deleted) ──
    // Order: deepest children first → parents last to respect FK constraints
    const tablesToDelete = [
      // ── Portal children (deepest) ──
      "portal_comments",
      "portal_comments",
      "portal_monthly_summaries",
      "portal_initial_questions",
      "portal_materials",
      "portal_feedback",
      "portal_faqs",
      "portal_project_history",

      // ── Content children ──
      "content_attachments",
      "content_channels",
      "content_metrics",

      // ── CRM children ──
      "crm_interactions",
      "crm_lead_actions",
      "crm_pipeline_leads",

      // ── Client children ──
      "client_activities",
      "client_contacts",
      "client_feedback",
      "client_history",
      "client_milestones",
      "client_nps_records",
      "client_offboarding",
      "client_onboarding",
      "client_portals",

      // ── Event children ──
      "event_attachments",
      "event_members",

      // ── Meeting children ──
      "meeting_participants",
      "meeting_projects",

      // ── Project children ──
      "project_deliverables",
      "project_members",

      // ── Task children ──
      "task_dependencies",
      "task_time_entries",

      // ── Product children ──
      "product_automations",
      "product_costs",
      "product_deliverable_templates",
      "product_documents",
      "product_feedbacks",
      "product_funnels",
      "product_improvements",
      "product_kpi_values",
      "product_kpi_reports",
      "product_metrics_analysis",
      "product_milestones",
      "product_nps_config",
      "product_nps_records",
      "product_offboarding_templates",
      "product_onboarding_templates",
      "product_payment_methods",
      "product_project_templates",
      "product_team_members",
      "product_traffic_ads",
      "product_useful_links",

      // ── Objective children ──
      "objective_actions",
      "objective_criteria",
      "objective_metrics",

      // ── Channel metrics ──
      "channel_monthly_metrics",
      "channel_reports",

      // ── Traffic ──
      "traffic_report_cards",
      "traffic_report_files",
      "traffic_creatives",

      // ── Financial children ──
      "financial_documents",
      "financial_goals",

      // ── Launch children ──
      "launch_tasks",
      "launch_data",

      // ── Planning children ──
      "planning_routines",

      // ── Commercial children ──
      "commercial_library_entries",
      "commercial_sales_actions",
      "commercial_strategy_projects",

      // ── Capacity scenarios ──
      "capacity_scenario_products",
      "capacity_scenarios",

      // ── Member operational data ──
      "member_contracts",
      "member_onboarding",
      "member_payments",
      "member_personal_images",
      "member_personal_links",
      "member_personal_notes",
      "team_member_vacations",

      // ── Hiring ──
      "hiring_simulations",

      // ── Training ──
      "training_courses",
      "training_doubts",

      // ── Performance ──
      "feedback_sessions",
      "performance_monthly",
      "performance_weekly",

      // ── Innovation ──
      "innovation_docs",
      "innovation_ideas",

      // ── Mural ──
      "mural_comments",
      "mural_reactions",
      "mural_posts",

      // ── Website ──
      "website_page_files",
      "website_pages",

      // ── Marketing operational ──
      "marketing_ideas",
      "marketing_resource_links",
      "marketing_monthly_analysis",

      // ── Custom field values ──
      "custom_field_values",

      // ── Misc operational ──
      "audit_logs",
      "backups",
      "fiscal_monthly_checks",
      "page_access_grants",
      "user_views",
      "weekly_align_notes",
      "metric_history",
      "suppliers",

      // ── CRM parents (after children) ──
      "crm_pipeline_stages",
      "crm_pipelines",
      "crm_saved_views",
      "crm_leads",

      // ── Main operational tables (parents — last) ──
      "content_items",
      "clients",
      "events",
      "meetings",
      "projects",
      "tasks",
      "products",
      "commercial_sales",
      "commercial_strategy",
      "commercial_annual_goals",
      "commercial_monthly_goals",
      "commercial_quarterly_goals",
      "commercial_product_goals",
      "commercial_monthly_analysis",
      "clients_monthly_analysis",
      "executive_brain_dump",
      "executive_goals",
      "executive_monthly_checklists",
      "executive_objectives",
      "executive_quarterly_analysis",
      "executive_weekly_routines",
      "planning_goals",
      "time_entries",
      "notifications",
      "user_favorites",
      "recommendations",
      "absence_coverage",
      "financial_expenses",
      "financial_payroll",
      "financial_subscriptions",
      "financial_contractors",
    ];

    // ── FULL RESET: also delete config/structure/identity tables ──
    // These are preserved in "data" reset but deleted in "full" reset
    const configTables = [
      // Brand / visual identity (children first)
      "brand_visual_files",
      "brand_visual_cards",
      "brand_swot_items",
      "brand_differentials",
      "brand_competitors",
      "brand_kanban_items",
      "brand_links",

      // Business plan
      "business_plan_cards",
      "business_plan_custom_columns",
      "business_plan_settings",

      // Strategy
      "strategy_channel_formats",
      "strategy_channel_frames",
      "strategy_channel_details",
      "strategy_editorial_lines",
      "strategy_distribution_cards",
      "strategy_settings",

      // SOPs (children first)
      "sop_onboarding_items",
      "sop_onboarding_templates",
      "sop_offboarding_items",
      "sop_offboarding_templates",
      "sop_categories",
      "sops",

      // Marketing config
      "channel_pages",
      "marketing_automations",
      "marketing_funnels",
      "marketing_pages",
      "marketing_channels",

      // Product KPI definitions
      "product_kpis",

      // Custom fields / fonts / views
      "custom_field_values",
      "custom_fields",
      "custom_fonts",
      "custom_views",

      // Internal documents / library
      "internal_documents",

      // Event types
      "event_types",

      // Financial config
      "financial_categories",

      // Platform accesses
      "platform_accesses",

      // Departments
      "department_whatsapp_links",
      "departments",

      // Digest / KPI settings
      "digest_settings",
      "kpi_settings",

      // Automation settings
      "automation_settings",

      // Routines definitions
      "routines",

      // Permissions & roles (children first) — preserve user_roles (owner stays)
      "role_permissions",
      "member_sensitive_access",
      "members",
      "custom_roles",

      // Team members (after member dependencies)
      "team_members",

      // Business settings & setup (last — these define the instance)
      "business_setup",
      "business_settings",
    ];

    const allTables = resetType === "full"
      ? [...tablesToDelete, ...configTables]
      : tablesToDelete;

    const errors: string[] = [];

    for (const table of allTables) {
      const { error } = await admin.from(table).delete().gte("created_at", "1970-01-01");
      if (error) {
        const { error: err2 } = await admin.from(table).delete().not("id", "is", null);
        if (err2) {
          errors.push(`${table}: ${err2.message}`);
        }
      }
    }

    if (errors.length > 0) {
      console.error("Reset errors:", errors);
    }

    return new Response(
      JSON.stringify({ success: true, reset_type: resetType, errors_count: errors.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reset error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
