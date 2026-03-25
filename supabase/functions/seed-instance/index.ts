import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Seeds default data for a new instance after onboarding.
 * Idempotent — checks if data already exists before inserting.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get caller from auth header
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Verify user is owner
    const { data: ownerCheck } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const results: Record<string, string> = {};

    // ─── 1. Custom Roles (Owner role) ───
    const { data: existingOwnerRole } = await supabase
      .from("custom_roles")
      .select("id")
      .eq("is_owner", true)
      .maybeSingle();

    if (!existingOwnerRole) {
      const { data: newRole, error } = await supabase
        .from("custom_roles")
        .insert({ name: "Owner", description: "Dono do negócio — acesso total", is_owner: true })
        .select("id")
        .single();
      if (error) {
        results.custom_roles = `error: ${error.message}`;
      } else {
        results.custom_roles = "created";
        // Link the current user as member with this role
        const { data: existingMember } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!existingMember && newRole) {
          await supabase.from("members").insert({
            user_id: user.id,
            custom_role_id: newRole.id,
          });
          results.member_link = "created";
        }
      }
    } else {
      results.custom_roles = "exists";
      // Ensure member link exists
      const { data: existingMember } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existingMember) {
        await supabase.from("members").insert({
          user_id: user.id,
          custom_role_id: existingOwnerRole.id,
        });
        results.member_link = "created";
      }
    }

    // ─── 2. Event Types ───
    const { count: eventCount } = await supabase
      .from("event_types")
      .select("id", { count: "exact", head: true });

    if (!eventCount || eventCount === 0) {
      const eventTypes = [
        { name: "Lançamento", color: "#6366f1", slug: "lancamento" },
        { name: "Férias", color: "#10b981", slug: "ferias" },
        { name: "Campanha de Vendas", color: "#f59e0b", slug: "campanha_vendas" },
        { name: "Data Especial", color: "#8b5cf6", slug: "data_especial" },
        { name: "Abertura de Vagas", color: "#06b6d4", slug: "abertura_vagas" },
        { name: "Formação/Evento Externo", color: "#ec4899", slug: "formacao_evento" },
        { name: "Reunião Importante", color: "#ef4444", slug: "reuniao_importante" },
        { name: "Deadline", color: "#f97316", slug: "deadline" },
        { name: "Parceria/Colaboração", color: "#14b8a6", slug: "parceria_colaboracao" },
        { name: "Reunião Interna", color: "#3b82f6", slug: "reuniao_interna" },
        { name: "Feedback", color: "#a855f7", slug: "feedback" },
      ];
      const { error } = await supabase.from("event_types").insert(eventTypes);
      results.event_types = error ? `error: ${error.message}` : "created";
    } else {
      // Ensure feedback type exists
      const { data: feedbackType } = await supabase
        .from("event_types")
        .select("id")
        .eq("slug", "feedback")
        .maybeSingle();
      if (!feedbackType) {
        await supabase.from("event_types").insert({
          name: "Feedback", color: "#a855f7", slug: "feedback",
        });
        results.event_types = "feedback_added";
      } else {
        results.event_types = "exists";
      }
    }

    // ─── 3. Financial Categories ───
    const { count: catCount } = await supabase
      .from("financial_categories")
      .select("id", { count: "exact", head: true });

    if (!catCount || catCount === 0) {
      const expenseCategories = [
        { category_type: "expense", value: "pessoal", label: "Pessoal", sort_order: 0 },
        { category_type: "expense", value: "freelancer", label: "Freelancer", sort_order: 1 },
        { category_type: "expense", value: "campanha", label: "Campanha", sort_order: 2 },
        { category_type: "expense", value: "ferramenta", label: "Ferramenta", sort_order: 3 },
        { category_type: "expense", value: "formacao", label: "Formação", sort_order: 4 },
        { category_type: "expense", value: "servico_contratado", label: "Serviço Contratado", sort_order: 5 },
        { category_type: "expense", value: "plataformas", label: "Plataformas", sort_order: 6 },
        { category_type: "expense", value: "impostos", label: "Impostos", sort_order: 7 },
        { category_type: "expense", value: "seguranca_social", label: "Segurança Social", sort_order: 8 },
        { category_type: "expense", value: "ordenados", label: "Ordenados", sort_order: 9 },
        { category_type: "expense", value: "prestadores", label: "Prestadores", sort_order: 10 },
        { category_type: "expense", value: "outro", label: "Outro", sort_order: 11 },
        { category_type: "subscription", value: "marketing", label: "Marketing", sort_order: 0 },
        { category_type: "subscription", value: "operacao", label: "Operação", sort_order: 1 },
        { category_type: "subscription", value: "comunicacao", label: "Comunicação", sort_order: 2 },
        { category_type: "subscription", value: "financeiro", label: "Financeiro", sort_order: 3 },
        { category_type: "subscription", value: "design", label: "Design", sort_order: 4 },
        { category_type: "subscription", value: "outro", label: "Outro", sort_order: 5 },
      ];
      const { error } = await supabase.from("financial_categories").insert(expenseCategories);
      results.financial_categories = error ? `error: ${error.message}` : "created";
    } else {
      results.financial_categories = "exists";
    }

    // ─── 4. Marketing Channels ───
    const { count: channelCount } = await supabase
      .from("marketing_channels")
      .select("id", { count: "exact", head: true });

    if (!channelCount || channelCount === 0) {
      const channels = [
        { name: "Instagram", is_active: true, sort_order: 0 },
        { name: "Youtube", is_active: false, sort_order: 1 },
        { name: "Facebook", is_active: false, sort_order: 2 },
        { name: "TikTok", is_active: false, sort_order: 3 },
        { name: "LinkedIn", is_active: false, sort_order: 4 },
        { name: "Pinterest", is_active: false, sort_order: 5 },
        { name: "Website", is_active: false, sort_order: 6 },
        { name: "Email Marketing", is_active: false, sort_order: 7 },
      ];
      const { error } = await supabase.from("marketing_channels").insert(channels);
      results.marketing_channels = error ? `error: ${error.message}` : "created";
    } else {
      results.marketing_channels = "exists";
    }

    // ─── 5. Default CRM Pipeline ───
    const { count: pipelineCount } = await supabase
      .from("crm_pipelines")
      .select("id", { count: "exact", head: true });

    if (!pipelineCount || pipelineCount === 0) {
      const { data: pipeline, error: pErr } = await supabase
        .from("crm_pipelines")
        .insert({ name: "Pipeline Principal", sort_order: 0 })
        .select("id")
        .single();
      if (pErr || !pipeline) {
        results.crm_pipeline = `error: ${pErr?.message}`;
      } else {
        const stages = [
          { pipeline_id: pipeline.id, name: "Entrada", color: "#6366f1", sort_order: 0 },
          { pipeline_id: pipeline.id, name: "Em Contacto", color: "#f59e0b", sort_order: 1 },
          { pipeline_id: pipeline.id, name: "Proposta Enviada", color: "#3b82f6", sort_order: 2 },
          { pipeline_id: pipeline.id, name: "Negociação", color: "#8b5cf6", sort_order: 3 },
          { pipeline_id: pipeline.id, name: "Ganho", color: "#22c55e", sort_order: 4 },
          { pipeline_id: pipeline.id, name: "Perdido", color: "#ef4444", sort_order: 5 },
        ];
        const { error: sErr } = await supabase.from("crm_pipeline_stages").insert(stages);
        results.crm_pipeline = sErr ? `error: ${sErr.message}` : "created";
      }
    } else {
      results.crm_pipeline = "exists";
    }

    // ─── 6. Business Plan Settings ───
    const { count: bpCount } = await supabase
      .from("business_plan_settings")
      .select("id", { count: "exact", head: true });

    if (!bpCount || bpCount === 0) {
      await supabase.from("business_plan_settings").insert({ value_proposition: "" });
      results.business_plan = "created";
    } else {
      results.business_plan = "exists";
    }

    // ─── 7. Digest Settings ───
    const { count: digestCount } = await supabase
      .from("digest_settings")
      .select("id", { count: "exact", head: true });

    if (!digestCount || digestCount === 0) {
      await supabase.from("digest_settings").insert({});
      results.digest_settings = "created";
    } else {
      results.digest_settings = "exists";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
