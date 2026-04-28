import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, preflight } from "../_shared/cors.ts";

// ─── Portuguese holidays (inline for edge function) ───
function computeEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getHolidaySet(year: number): Set<string> {
  const easter = computeEaster(year);
  const addD = (base: Date, n: number) => { const r = new Date(base); r.setDate(r.getDate() + n); return r; };
  const dates = [
    new Date(year,0,1), new Date(year,3,25), new Date(year,4,1), new Date(year,5,10),
    new Date(year,7,15), new Date(year,9,5), new Date(year,10,1), new Date(year,11,1),
    new Date(year,11,8), new Date(year,11,25),
    addD(easter, -47), addD(easter, -2), easter, addD(easter, 60),
  ];
  return new Set(dates.map(fmtDate));
}
function isPortugueseHoliday(d: Date): boolean {
  return getHolidaySet(d.getFullYear()).has(fmtDate(d));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const corsHeaders = getCorsHeaders(req);

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

    // Check owner role
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "owner",
    });
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Apenas o owner pode criar membros" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, role_title, phone, work_schedule, team_member_id, department } = await req.json();

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "Email e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with a random password (they'll set their own via invite link)
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newUser.user) {
      // Update profile with extra fields
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", newUser.user.id)
        .maybeSingle();

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            role_title: role_title || null,
            phone: phone || null,
            work_schedule: work_schedule || null,
          })
          .eq("id", profile.id);

        // Link team_member to profile if team_member_id was provided
        if (team_member_id) {
          await supabase
            .from("team_members")
            .update({ profile_id: profile.id })
            .eq("id", team_member_id);
        }
      }

      // Assign member role
      await supabase.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "member",
      });


      // ── Onboarding checklist from SOPs with sop_type='onboarding' ──
      let onboarding_created = false;
      let onboarding_warning: string | null = null;

      if (role_title && team_member_id) {
        // Find SOPs with sop_type='onboarding' matching role_title (case-insensitive)
        const { data: onboardingSops } = await supabase
          .from("sops")
          .select("id, name, role_title")
          .eq("sop_type", "onboarding")
          .ilike("role_title", role_title.trim());

        if (onboardingSops && onboardingSops.length > 0) {
          // For each onboarding SOP, check if there's a linked template with items
          for (const onbSop of onboardingSops) {
            // Try getting items from sop_onboarding_templates linked via sop_id
            const { data: template } = await supabase
              .from("sop_onboarding_templates")
              .select("id")
              .eq("sop_id", onbSop.id)
              .maybeSingle();

            if (template) {
              const { data: items } = await supabase
                .from("sop_onboarding_items")
                .select("task, deadline_days, sort_order")
                .eq("template_id", template.id)
                .order("sort_order");

              if (items && items.length > 0) {
                const todayDate = new Date();
                const onboardingRows = items.map((item) => {
                  // Add business days (skip weekends + Portuguese holidays)
                  let deadlineDate = new Date(todayDate);
                  let remaining = item.deadline_days;
                  while (remaining > 0) {
                    deadlineDate.setDate(deadlineDate.getDate() + 1);
                    const dow = deadlineDate.getDay();
                    if (dow !== 0 && dow !== 6 && !isPortugueseHoliday(deadlineDate)) {
                      remaining--;
                    }
                  }
                  return {
                    member_id: team_member_id,
                    task: item.task,
                    sort_order: item.sort_order,
                    completed: false,
                    deadline_date: deadlineDate.toISOString().split("T")[0],
                    source_template_id: template.id,
                  };
                });
                await supabase.from("member_onboarding").insert(onboardingRows);
                onboarding_created = true;
              }
            }

            // Also use the SOP's own checklist (inputs field) as onboarding items if no template items
            if (!onboarding_created) {
              const checklist = Array.isArray((onbSop as any).inputs) ? (onbSop as any).inputs : [];
              if (checklist.length > 0) {
                const todayDate = new Date();
                const onboardingRows = checklist.map((item: any, idx: number) => {
                  const text = typeof item === 'string' ? item : item.text || '';
                  const deadlineDate = new Date(todayDate);
                  deadlineDate.setDate(deadlineDate.getDate() + 7); // default 7 days
                  return {
                    member_id: team_member_id,
                    task: text,
                    sort_order: idx,
                    completed: false,
                    deadline_date: deadlineDate.toISOString().split("T")[0],
                  };
                }).filter((r: any) => r.task);
                if (onboardingRows.length > 0) {
                  await supabase.from("member_onboarding").insert(onboardingRows);
                  onboarding_created = true;
                }
              }
            }
          }

          if (!onboarding_created) {
            onboarding_warning = `Os SOPs de onboarding para "${role_title}" existem mas não têm itens de checklist.`;
          }
        } else {
          onboarding_warning = `Não existe SOP de onboarding para a função "${role_title}". Cria um SOP com tipo "Onboarding" e função "${role_title}" para automatizar.`;
        }
      }

      // Send real password setup email and also generate a direct recovery link
      const appOrigin = req.headers.get("origin") || new URL(req.url).origin;
      const resetRedirectTo = `${appOrigin}/reset-password`;
      const publicClient = createClient(supabaseUrl, anonKey);

      const { error: inviteEmailError } = await publicClient.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectTo,
      });

      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: resetRedirectTo,
        },
      });

      const invite_url = resetData?.properties?.action_link ?? null;
      const email_sent = !inviteEmailError;

      // Fetch WhatsApp group links for the welcome email
      let whatsapp_team_url: string | null = null;
      let whatsapp_dept_url: string | null = null;
      let department_name: string | null = null;

      // Get team-wide WhatsApp link from business_settings
      const { data: bizSettings } = await supabase
        .from("business_settings")
        .select("whatsapp_team_url")
        .limit(1)
        .maybeSingle();
      if (bizSettings?.whatsapp_team_url) {
        whatsapp_team_url = bizSettings.whatsapp_team_url;
      }

      // Get department WhatsApp link if member has a department
      const memberDept = department || null;
      if (memberDept) {
        const { data: deptLink } = await supabase
          .from("department_whatsapp_links")
          .select("whatsapp_url")
          .eq("department", memberDept)
          .maybeSingle();
        if (deptLink?.whatsapp_url) {
          whatsapp_dept_url = deptLink.whatsapp_url;
          // Map department key to label
          const deptLabels: Record<string, string> = {
            marketing: 'Marketing', comercial: 'Comercial', clientes: 'Clientes',
            financeiro: 'Contabilidade', operacao: 'Operação', produtos: 'Produtos',
            'recursos-humanos': 'Pessoas',
          };
          department_name = deptLabels[memberDept] || memberDept;
        }
      }

      // ── Send welcome-member transactional email ──
      let welcome_email_sent = false;
      try {
        // Fetch brand settings for the email template
        const { data: brandSettings } = await supabase
          .from("business_settings")
          .select("business_name, primary_color, primary_foreground, text_color, accent_color, font_display, font_body, logo_url")
          .limit(1)
          .maybeSingle();

        // Fetch custom overrides from email_template_settings
        const { data: emailOverrides } = await supabase
          .from("email_template_settings")
          .select("*")
          .eq("template_key", "welcome-member")
          .maybeSingle();

        const ownerProfile = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", caller.id)
          .maybeSingle();

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-member",
            recipientEmail: email,
            idempotencyKey: `welcome-member-${newUser.user.id}`,
            templateData: {
              memberName: full_name.split(" ")[0],
              inviteUrl: invite_url,
              ownerName: ownerProfile?.data?.full_name?.split(" ")[0] || "a equipa",
              businessName: brandSettings?.business_name || undefined,
              whatsappTeamUrl: whatsapp_team_url || undefined,
              whatsappDeptUrl: whatsapp_dept_url || undefined,
              departmentName: department_name || undefined,
              primaryColor: emailOverrides?.primary_color || brandSettings?.primary_color || undefined,
              primaryForeground: emailOverrides?.primary_foreground || brandSettings?.primary_foreground || undefined,
              textColor: emailOverrides?.text_color || brandSettings?.text_color || undefined,
              accentColor: emailOverrides?.muted_color || brandSettings?.accent_color || undefined,
              fontDisplay: emailOverrides?.font_display || brandSettings?.font_display || undefined,
              fontBody: emailOverrides?.font_body || brandSettings?.font_body || undefined,
              logoUrl: brandSettings?.logo_url || undefined,
              // Custom text overrides
              customTitle: emailOverrides?.title_text || undefined,
              customSubtitle: emailOverrides?.subtitle_text || undefined,
              customCta: emailOverrides?.cta_text || undefined,
              customFooter: emailOverrides?.footer_text || undefined,
              customEmoji: emailOverrides?.emoji || undefined,
            },
          },
        });
        welcome_email_sent = true;
      } catch (welcomeErr) {
        console.error("Failed to send welcome-member email:", welcomeErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          profile_id: profile?.id || null,
          invite_url,
          email_sent,
          welcome_email_sent,
          invite_error: inviteEmailError?.message ?? resetError?.message ?? null,
          onboarding_created,
          onboarding_warning,
          whatsapp_team_url,
          whatsapp_dept_url,
          department_name,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: null }),
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
