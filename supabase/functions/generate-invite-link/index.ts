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

    const { user_id, email, send_welcome } = await req.json();
    
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

    // Optionally re-send the branded welcome-member email
    let welcome_email_sent = false;
    if (send_welcome) {
      try {
        // Find auth user by email to look up profile/team_member info
        const targetUser = existing?.users?.find(
          (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
        );
        const { data: profileRow } = targetUser
          ? await supabase
              .from("profiles")
              .select("id, user_id, full_name")
              .eq("user_id", targetUser.id)
              .maybeSingle()
          : { data: null };

        const { data: tmRow } = profileRow
          ? await supabase
              .from("team_members")
              .select("full_name, department")
              .eq("profile_id", profileRow.id)
              .maybeSingle()
          : { data: null };

        const memberFullName = tmRow?.full_name || profileRow?.full_name || targetEmail.split("@")[0];
        const department = tmRow?.department || null;

        // Brand + overrides
        const { data: brandSettings } = await supabase
          .from("business_settings")
          .select("business_name, primary_color, primary_foreground, text_color, accent_color, font_display, font_body, logo_url, whatsapp_team_url")
          .limit(1)
          .maybeSingle();

        const { data: emailOverrides } = await supabase
          .from("email_template_settings")
          .select("*")
          .eq("template_key", "welcome-member")
          .maybeSingle();

        // WhatsApp dept link
        let whatsappDeptUrl: string | null = null;
        let departmentName: string | null = null;
        if (department) {
          const { data: deptLink } = await supabase
            .from("department_whatsapp_links")
            .select("whatsapp_url")
            .eq("department", department)
            .maybeSingle();
          if (deptLink?.whatsapp_url) {
            whatsappDeptUrl = deptLink.whatsapp_url;
            const labels: Record<string, string> = {
              marketing: 'Marketing', comercial: 'Comercial', clientes: 'Clientes',
              financeiro: 'Contabilidade', operacao: 'Operação', produtos: 'Produtos',
              'recursos-humanos': 'Pessoas',
            };
            departmentName = labels[department] || department;
          }
        }

        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", caller.id)
          .maybeSingle();

        await sendTransactionalEmail({
          templateName: "welcome-member",
          recipientEmail: targetEmail,
          // Use a time-bucketed key so resends are not blocked by idempotency
          idempotencyKey: `welcome-member-resend-${targetEmail}-${Date.now()}`,
          templateData: {
            memberName: memberFullName.split(" ")[0],
            inviteUrl,
            ownerName: ownerProfile?.full_name?.split(" ")[0] || "a equipa",
            businessName: brandSettings?.business_name || undefined,
            whatsappTeamUrl: brandSettings?.whatsapp_team_url || undefined,
            whatsappDeptUrl: whatsappDeptUrl || undefined,
            departmentName: departmentName || undefined,
            primaryColor: emailOverrides?.primary_color || brandSettings?.primary_color || undefined,
            primaryForeground: emailOverrides?.primary_foreground || brandSettings?.primary_foreground || undefined,
            textColor: emailOverrides?.text_color || brandSettings?.text_color || undefined,
            accentColor: emailOverrides?.muted_color || brandSettings?.accent_color || undefined,
            fontDisplay: emailOverrides?.font_display || brandSettings?.font_display || undefined,
            fontBody: emailOverrides?.font_body || brandSettings?.font_body || undefined,
            logoUrl: brandSettings?.logo_url || undefined,
            customTitle: emailOverrides?.title_text || undefined,
            customSubtitle: emailOverrides?.subtitle_text || undefined,
            customCta: emailOverrides?.cta_text || undefined,
            customFooter: emailOverrides?.footer_text || undefined,
            customEmoji: emailOverrides?.emoji || undefined,
          },
        });
        welcome_email_sent = true;
      } catch (welcomeErr) {
        console.error("Failed to resend welcome-member email:", welcomeErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_url: inviteUrl,
        email: targetEmail,
        link_type: linkType,
        expires_in_hours: 24,
        invite_error: null,
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
