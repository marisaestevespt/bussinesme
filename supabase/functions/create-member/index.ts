import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
                  const deadlineDate = new Date(todayDate);
                  deadlineDate.setDate(deadlineDate.getDate() + item.deadline_days);
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

      // Generate invite link (recovery link so user can set password)
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      let invite_url = null;
      if (!resetError && resetData?.properties?.hashed_token) {
        const siteUrl = req.headers.get("origin") || supabaseUrl;
        invite_url = `${siteUrl}#access_token=${resetData.properties.hashed_token}&type=recovery`;
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          profile_id: profile?.id || null,
          invite_url,
          onboarding_created,
          onboarding_warning,
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
