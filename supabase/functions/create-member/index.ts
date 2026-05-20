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
    let { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    let reused_existing_user = false;

    // If the user already exists in auth (e.g. previously offboarded member
    // re-added with the same email), reuse the existing auth user instead of
    // failing. We then re-attach role/profile and send a fresh welcome email.
    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (alreadyExists) {
        const { data: existingList } = await supabase.auth.admin.listUsers();
        const existing = existingList?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          // Check if this user is still actively a member (has user_role + non-offboarded team_member)
          const { data: activeRole } = await supabase
            .from("user_roles")
            .select("id")
            .eq("user_id", existing.id)
            .maybeSingle();
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", existing.id)
            .maybeSingle();
          const { data: activeTm } = existingProfile
            ? await supabase
                .from("team_members")
                .select("id, status")
                .eq("profile_id", existingProfile.id)
                .neq("status", "ex_membro")
                .neq("id", team_member_id || "00000000-0000-0000-0000-000000000000")
                .limit(1)
                .maybeSingle()
            : { data: null };
          if (activeRole && activeTm) {
            return new Response(
              JSON.stringify({
                error: `Já existe um membro ativo com o email ${email}. Verifica em "Equipa" antes de re-adicionar.`,
              }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // Reuse: pretend createUser returned this user
          newUser = { user: existing } as any;
          createError = null as any;
          reused_existing_user = true;
        }
      }
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

      // Assign member role (idempotent: skip if already exists)
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", newUser.user.id)
        .eq("role", "member")
        .maybeSingle();
      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "member",
        });
      }


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
          // Pull real sop_steps from each matching SOP and create one
          // member_onboarding row per step, linked back via sop_step_id so
          // the UI can surface the step's documents/templates/emails.
          const todayDate = new Date();
          const onboardingRows: any[] = [];
          let runningOrder = 0;

          for (const onbSop of onboardingSops) {
            const { data: steps } = await supabase
              .from("sop_steps")
              .select("id, description, deadline_days, deadline_unit")
              .eq("sop_id", onbSop.id)
              .order("sort_order", { ascending: true });

            if (!steps || steps.length === 0) continue;

            for (const step of steps) {
              const desc = (step as any).description?.trim();
              if (!desc) continue;
              const days = Number((step as any).deadline_days ?? 7);
              const unit = (step as any).deadline_unit || "dias";
              const multiplier = unit === "semanas" ? 7 : unit === "meses" ? 30 : 1;
              const deadlineDate = new Date(todayDate);
              deadlineDate.setDate(deadlineDate.getDate() + (Number.isFinite(days) ? days * multiplier : 7));
              onboardingRows.push({
                member_id: team_member_id,
                task: desc,
                sort_order: runningOrder++,
                completed: false,
                deadline_date: deadlineDate.toISOString().split("T")[0],
                sop_id: onbSop.id,
                sop_step_id: (step as any).id,
              });
            }
          }

          if (onboardingRows.length > 0) {
            await supabase.from("member_onboarding").insert(onboardingRows);
            onboarding_created = true;
          } else {
            onboarding_warning = `Os SOPs de onboarding para "${role_title}" existem mas não têm passos definidos.`;
          }
        } else {
          onboarding_warning = `Não existe SOP de onboarding para a função "${role_title}". Cria um SOP com tipo "Onboarding" e função "${role_title}" para automatizar.`;
        }
      }

      // Generate a direct recovery/invite link for the welcome email.
      // IMPORTANT: do NOT call resetPasswordForEmail here — it would trigger
      // the auth-email-hook and send a generic "recovery" email, duplicating
      // the welcome-member transactional email below. The welcome-member
      // template already includes the inviteUrl as its primary CTA, so the
      // member only needs that one branded email.
      const appOrigin = req.headers.get("origin") || new URL(req.url).origin;
      const resetRedirectTo = `${appOrigin}/reset-password`;

      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        // The user was just created above with email_confirm:true, so "invite"
        // would fail ("user already registered"). "recovery" generates a
        // single-use action link that lets them set their initial password.
        // generateLink does NOT send an email — we email it ourselves via
        // the welcome-member template.
        type: "recovery",
        email,
        options: {
          redirectTo: resetRedirectTo,
        },
      });

      const invite_url = resetData?.properties?.action_link ?? null;
      const email_sent = false; // generateLink only creates the link; it does not send an email

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

      // Welcome email intentionally not sent — onboarding is handled in person.
      const welcome_email_sent = false;

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          profile_id: profile?.id || null,
          invite_url,
          email_sent,
          welcome_email_sent,
          invite_error: resetError?.message ?? null,
          onboarding_created,
          onboarding_warning,
          whatsapp_team_url,
          whatsapp_dept_url,
          department_name,
          reused_existing_user,
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
