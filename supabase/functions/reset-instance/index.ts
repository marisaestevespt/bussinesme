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

    // Operational tables to delete — order: children first for FK constraints
    // PRESERVED: business_settings, kpi_settings, profiles, user_roles, members,
    // custom_roles, role_permissions, team_members, marketing_channels, channel_pages,
    // routines, product_kpis, marketing_automations, marketing_funnels, sops,
    // strategy_channel_details, strategy_channel_formats, strategy_channel_frames,
    // strategy_editorial_lines, strategy_distribution_cards, strategy_settings,
    // marketing_pages, internal_documents, business_plan_settings, business_plan_cards,
    // business_plan_custom_columns, platform_accesses, brand_*, custom_fonts
    const tablesToDelete = [
      // Content children
      "content_attachments",
      "content_channels",
      "content_metrics",
      // CRM children
      "crm_interactions",
      "crm_lead_actions",
      // Client children
      "client_activities",
      "client_history",
      "client_milestones",
      "client_nps_records",
      "client_offboarding",
      "client_onboarding",
      // Event children
      "event_attachments",
      "event_members",
      // Meeting children
      "meeting_participants",
      // Project children
      "project_members",
      // Task children
      "task_dependencies",
      "task_time_entries",
      // Product children (values only, not definitions)
      "product_automations",
      "product_costs",
      "product_feedbacks",
      "product_funnels",
      "product_kpi_values",
      "product_kpi_reports",
      "product_metrics_analysis",
      "product_milestones",
      "product_nps_config",
      "product_nps_records",
      "product_offboarding_templates",
      "product_onboarding_templates",
      "product_project_templates",
      "product_traffic_ads",
      "product_useful_links",
      // Objective children
      "objective_actions",
      "objective_criteria",
      "objective_metrics",
      // Channel metrics (not channel config)
      "channel_monthly_metrics",
      "channel_reports",
      // Traffic
      "traffic_report_cards",
      "traffic_report_files",
      "traffic_creatives",
      // Financial children
      "financial_documents",
      // Planning children
      "planning_routines",
      // Commercial children
      "commercial_library_entries",
      "commercial_sales_actions",
      // Main operational tables
      "content_items",
      "crm_leads",
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
      "marketing_monthly_analysis",
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
      "mural_comments",
      "mural_reactions",
      "mural_posts",
      "feedback_sessions",
      "performance_monthly",
      "performance_weekly",
      "innovation_docs",
      "innovation_ideas",
      "metric_history",
      "absence_coverage",
      "financial_expenses",
      "financial_payroll",
      "financial_subscriptions",
      "financial_contractors",
      "member_payments",
      "member_personal_images",
      "member_personal_links",
      "member_personal_notes",
      "training_courses",
      "training_doubts",
      "website_page_files",
      "website_pages",
      "marketing_ideas",
      "marketing_resource_links",
    ];

    const errors: string[] = [];

    for (const table of tablesToDelete) {
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
      JSON.stringify({ success: true, errors_count: errors.length, errors }),
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
