import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientId, rateLimitResponse } from "../_shared/rate-limit.ts";
import { sendTransactionalEmail } from "../_shared/send-email.ts";
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: 10 invites / minute per IP (anti-invite-spam)
  const rl = checkRateLimit(`invite:${getClientId(req)}`, 10, 60);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "owner",
    });
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Apenas o owner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, email, send_welcome, full_name } = await req.json();
    
    let targetEmail = email;
    
    if (user_id) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Utilizador não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetEmail = userData.user.email;
    }

    if (!targetEmail) {
      return new Response(JSON.stringify({ error: "email ou user_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appOrigin = req.headers.get("origin") || new URL(req.url).origin;
    const resetRedirectTo = `${appOrigin}/reset-password`;

    // Verifica se o utilizador já existe — define se é convite (24h) ou recovery
    const { data: existing } = await supabase.auth.admin.listUsers();
    const userExists = existing?.users?.some(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );

    // Para utilizadores novos: 'invite' (link válido 24h, single-use mas mais tolerante)
    // Para utilizadores existentes: 'recovery' (única opção viável para reset de password)
    const linkType = userExists ? "recovery" : "invite";

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: linkType,
      email: targetEmail,
      options: {
        redirectTo: resetRedirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkError?.message || "Falha ao gerar link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteUrl = linkData.properties.action_link;

    let welcome_email_sent = false;
    let invite_error: string | null = null;

    if (send_welcome !== false) {
      const [{ data: profile }, { data: settings }] = await Promise.all([
        user_id
          ? supabase.from("profiles").select("full_name, role_title").eq("user_id", user_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("business_settings")
          .select("business_name, whatsapp_team_url, primary_color, text_color, accent_color, font_display, font_body, logo_url")
          .limit(1)
          .maybeSingle(),
      ]);

      const resolvedName = full_name || profile?.full_name || targetEmail;
      const firstName = String(resolvedName).trim().split(/\s+/)[0] || String(resolvedName);
      const sendRes = await sendTransactionalEmail({
        templateName: "welcome-member",
        recipientEmail: targetEmail,
        idempotencyKey: `welcome-member-resend-${targetEmail.toLowerCase()}-${Date.now()}`,
        templateData: {
          memberName: firstName,
          fullName: resolvedName,
          roleTitle: profile?.role_title || undefined,
          inviteUrl,
          businessName: settings?.business_name || undefined,
          whatsappTeamUrl: settings?.whatsapp_team_url || undefined,
          primaryColor: settings?.primary_color || undefined,
          primaryForeground: "0 0% 100%",
          textColor: settings?.text_color || undefined,
          accentColor: settings?.accent_color || undefined,
          fontDisplay: settings?.font_display || undefined,
          fontBody: settings?.font_body || undefined,
          logoUrl: settings?.logo_url || undefined,
        },
      });
      welcome_email_sent = sendRes.ok;
      invite_error = sendRes.ok ? null : sendRes.details;
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_url: inviteUrl,
        email: targetEmail,
        link_type: linkType,
        expires_in_hours: 24,
        invite_error,
        email_sent: welcome_email_sent,
        welcome_email_sent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
