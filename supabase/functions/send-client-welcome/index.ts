import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/send-email.ts";

const DEFAULT_PUBLIC_APP_ORIGIN = "https://businessme.lyrata.pt";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { project_id } = body as { project_id?: string };
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, name, client_id, product_id, product_name, start_date")
      .eq("id", project_id)
      .maybeSingle();
    if (pErr || !project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!project.client_id) {
      return new Response(JSON.stringify({ error: "Projeto sem cliente associado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .eq("id", project.client_id)
      .maybeSingle();
    if (!client?.email) {
      return new Response(JSON.stringify({ error: "Cliente sem email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch product (for cycle_duration + per-product email customization)
    let cycleDuration: number | null = null;
    let productBannerUrl: string | null = null;
    let productPrimaryColor: string | null = null;
    if (project.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("cycle_duration, welcome_email_banner_url, branding")
        .eq("id", project.product_id)
        .maybeSingle();
      cycleDuration = product?.cycle_duration ?? null;
      productBannerUrl = product?.welcome_email_banner_url ?? null;
      const brandColor = (product?.branding as Record<string, unknown> | null)?.primary_color as string | undefined;
      // Only use HSL triplets ("351 56% 28%"); ignore raw hex stored in branding.
      productPrimaryColor = brandColor && !brandColor.startsWith("#") ? brandColor : null;
    }

    // Compute end date
    let endDate: string | null = null;
    if (project.start_date && cycleDuration && cycleDuration > 0) {
      const d = new Date(project.start_date);
      d.setMonth(d.getMonth() + cycleDuration);
      endDate = d.toISOString().slice(0, 10);
    }

    // Fetch portal
    const { data: portal } = await supabase
      .from("client_portals")
      .select("id, token, slug, is_active")
      .eq("client_id", project.client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!portal) {
      return new Response(JSON.stringify({ error: "Cliente não tem Portal (produto sem portal?)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch business_settings (theme + welcome settings)
    const { data: settings } = await supabase
      .from("business_settings")
      .select("business_name, logo_url, primary_color, primary_color, font_display, font_body, welcome_client_email_settings")
      .limit(1)
      .maybeSingle();
    const ws = (settings?.welcome_client_email_settings ?? {}) as Record<string, any>;

    const appOrigin =
      normalizeOrigin(Deno.env.get("PUBLIC_APP_URL")) ||
      DEFAULT_PUBLIC_APP_ORIGIN ||
      normalizeOrigin(req.headers.get("origin")) ||
      new URL(req.url).origin;
    const portalSlugOrToken = (portal as any).slug || portal.token;
    const portalUrl = `${appOrigin}/portal/${portalSlugOrToken}`;
    console.log("send-client-welcome portalUrl", { project_id, portal_id: portal.id, portalUrl });

    // Compute primary_foreground heuristic (white on dark, dark on light)
    const primaryFg = "0 0% 100%";

    const templateData = {
      clientName: client.full_name?.split(" ")[0] || client.full_name || "cliente",
      productName: project.product_name || null,
      projectName: project.name || null,
      startDate: project.start_date || null,
      endDate,
      portalUrl,
      introText: ws.intro_text || undefined,
      nextSteps: Array.isArray(ws.next_steps) ? ws.next_steps : undefined,
      supportHours: ws.support_hours || undefined,
      whatsappNumber: ws.whatsapp_number || undefined,
      whatsappMessage: ws.whatsapp_message || undefined,
      businessName: settings?.business_name || undefined,
      primaryColor: productPrimaryColor || settings?.primary_color || undefined,
      primaryForeground: primaryFg,
      fontDisplay: settings?.font_display || undefined,
      fontBody: settings?.font_body || undefined,
      logoUrl: settings?.logo_url || undefined,
      bannerUrl: productBannerUrl || undefined,
    };

    const idempotencyKey = `welcome-client-${portal.id}-${Date.now()}`;

    const sendRes = await sendTransactionalEmail({
      templateName: "welcome-client",
      recipientEmail: client.email,
      idempotencyKey,
      templateData,
    });
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: "Falha ao enviar email", details: sendRes.details }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark sent
    await supabase
      .from("client_portals")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", portal.id);

    return new Response(JSON.stringify({ success: true, recipient: client.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-client-welcome error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
