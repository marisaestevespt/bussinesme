import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const corsHeaders = getCorsHeaders(req);

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
      "portal_monthly_summaries",
      "portal_initial_questions",
      "portal_feedback",
      "portal_faqs",
      "portal_project_history",
      "portal_visits",
      "portal_timeline_phases",

      // ── Content children ──
      "content_attachments",
      "content_channels",
      "content_metrics",

      // ── CRM children ──
      "crm_interactions",
      "crm_lead_actions",
      "crm_pipeline_leads",
      "crm_lead_labels",

      // ── Client children ──
      "client_activities",
      "client_contacts",
      "client_feedback",
      "client_history",
      "client_nps_records",
      "client_offboarding",
      "client_onboarding",
      "client_portals",
      "client_assignments",
      "client_renewals",

      // ── Event children ──
      "event_attachments",
      "event_members",

      // ── Meeting children ──
      "meeting_participants",
      "meeting_projects",

      // ── Project children ──
      "project_deliverables",
      "project_members",
      "project_assets",
      "project_phases",
      "project_responsibilities",

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
      "product_nps_config",
      "product_nps_records",
      "product_offboarding_templates",
      "product_onboarding_templates",
      "product_payment_methods",
      "product_project_templates",
      "product_team_members",
      "product_traffic_ads",
      "product_useful_links",
      "product_diagnostic_questions",
      "product_offer_scenarios",
      "product_phases",
      "product_price_tiers",
      "product_renewal_templates",

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
      "fiscal_deadline_completions",

      // ── Launch children ──
      "launch_tasks",
      "launch_data",

      // ── Planning children ──
      "planning_routines",
      "routines",

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
      "member_quick_links",
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
      "marketing_goals",

      // ── Custom field values ──
      "custom_field_values",

      // ── Misc operational ──
      "audit_logs",
      "backups",
      "fiscal_monthly_checks",
      "page_access_grants",
      "user_views",
      "user_task_views",
      "secretaria_custom_views",
      "weekly_align_notes",
      "metric_history",
      "suppliers",
      "monthly_reports",
      "dismissed_ceo_alerts",
      "business_legal_documents",

      // ── CRM parents (after children) ──
      "crm_pipeline_stages",
      "crm_pipelines",
      "crm_saved_views",
      "crm_leads",
      "crm_custom_stages",
      "crm_pipeline_labels",
      "crm_labels",

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
      "executive_brain_dump_categories",
      "executive_monthly_checklists",
      "executive_objectives",
      "executive_quarterly_analysis",
      "executive_weekly_routines",
      "planning_goals",
      "strategic_directives",
      "publico_alvo_sections",
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
      "sop_step_documents",
      "sop_steps",
      "sop_categories",
      "sops",

      // Marketing config
      "channel_pages",
      "marketing_automations",
      "marketing_funnels",
      "marketing_pages",
      "marketing_channels",
      "marketing_channel_accounts",

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
      "department_links",
      "department_covers",
      "department_colors",
      "departments",

      // Digest / KPI settings
      "digest_settings",
      "kpi_settings",

      // Automation settings
      "automation_settings",

      // Permissions & roles (children first) — preserve user_roles (owner stays)
      "role_permissions",
      "member_sensitive_access",
      "custom_roles",
      "team_role_presets",

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
