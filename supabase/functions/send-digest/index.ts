import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SupabaseAdmin = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;

import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAuthorizedCronCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get current hour (UTC) - adjust for Portugal timezone (UTC+0/+1)
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}:00`;

    // Match digests where send_time hour matches current hour
    const hourStr = `${String(currentHour).padStart(2, "0")}:00:00`;
    const hourEnd = `${String(currentHour).padStart(2, "0")}:59:59`;

    const { data: digests, error: digestErr } = await supabase
      .from("digest_settings")
      .select("*")
      .eq("enabled", true)
      .gte("send_time", hourStr)
      .lte("send_time", hourEnd);

    if (digestErr) throw digestErr;
    if (!digests || digests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No digests to send this hour" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business settings for branding
    const { data: bizSettings } = await supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single();

    const businessName = bizSettings?.business_name || "O Negócio";
    const primaryColor = bizSettings?.primary_color
      ? hslToHex(bizSettings.primary_color)
      : "#6366f1";
    const secondaryColor = bizSettings?.secondary_color
      ? hslToHex(bizSettings.secondary_color)
      : "#e4e4e7";
    const accentColor = bizSettings?.accent_color
      ? hslToHex(bizSettings.accent_color)
      : "#6366f1";
    const logoUrl = bizSettings?.logo_url || null;
    const fontBody = bizSettings?.font_body || "Arial";
    const fontDisplay = bizSettings?.font_display || fontBody;

    const todayStr = formatDate(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun
    const dayOfMonth = now.getDate();

    const results: { userId: string; sent: boolean; error?: string }[] = [];

    for (const digest of digests) {
      try {
        // Check frequency match
        if (digest.frequency === "semanal" && digest.send_day_of_week !== dayOfWeek) continue;
        if (digest.frequency === "mensal" && digest.send_day_of_month !== dayOfMonth) continue;

        // Get user profile and email
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, user_id")
          .eq("id", digest.user_id)
          .single();

        if (!profile) continue;

        // Get user email from auth
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.user_id);
        if (!authUser?.email) continue;

        const sections = digest.sections || {};
        const isEod = digest.digest_type === "eod";
        let htmlSections = "";

        if (isEod) {
          // End-of-day wrap-up
          if (digest.is_owner_digest) {
            htmlSections = await buildOwnerEodDigest(supabase, sections, todayStr, now);
          } else {
            htmlSections = await buildMemberEodDigest(supabase, sections, digest, profile, todayStr, now);
          }
        } else {
          // Morning briefing
          if (digest.is_owner_digest) {
            htmlSections = await buildOwnerDigest(supabase, sections, todayStr, now);
          } else {
            htmlSections = await buildMemberDigest(supabase, sections, digest, profile, todayStr, now);
          }
        }

        // Build email
        const firstName = (profile.full_name || "").split(" ")[0] || "—";
        const headerTitle = isEod ? "Wrap-up do dia" : "Briefing do dia";
        const greeting = isEod
          ? `Boa noite, ${firstName}! Aqui está o resumo do que aconteceu hoje.`
          : `Bom dia, ${firstName}! Aqui está o teu briefing para hoje.`;
        const subject = digest.is_owner_digest
          ? `${isEod ? "Wrap-up" : "Briefing"} do dia — ${businessName} — ${formatDatePT(now)}`
          : `${isEod ? "Wrap-up" : "Briefing"} do dia — ${formatDatePT(now)}`;

        const html = buildEmailHtml({
          subject,
          headerTitle,
          greeting,
          dateLine: formatDatePT(now),
          businessName,
          primaryColor,
          secondaryColor,
          accentColor,
          logoUrl,
          fontBody,
          fontDisplay,
          contentHtml: htmlSections,
          isOwner: digest.is_owner_digest,
        });

        // Send via transactional email if available, otherwise log
        try {
          const templateName = digest.is_owner_digest
            ? (isEod ? "owner-eod-digest" : "owner-digest")
            : (isEod ? "member-eod-digest" : "member-digest");
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName,
              recipientEmail: authUser.email,
              idempotencyKey: `digest-${digest.id}-${todayStr}-${isEod ? "eod" : "am"}`,
              templateData: { subject, html },
            },
          });
        } catch {
          // If transactional email not set up yet, just log
          console.log(`Would send digest to ${authUser.email}: ${subject}`);
        }

        results.push({ userId: digest.user_id, sent: true });
      } catch (err: unknown) {
        results.push({ userId: digest.user_id, sent: false, error: (err instanceof Error ? err.message : String(err)) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err instanceof Error ? err.message : String(err)) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Owner Digest Builder ─────────────────────────────────
async function buildOwnerDigest(
  supabase: SupabaseAdmin,
  sections: Record<string, boolean>,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  // ── Reuniões do dia (primeiro — o que vai acontecer) ──
  if (sections.reunioes_dia) {
    const { data: meetings } = await supabase
      .from("meetings")
      .select("title, date_time, client_name")
      .gte("date_time", todayStr + "T00:00:00")
      .lte("date_time", todayStr + "T23:59:59")
      .order("date_time");

    if (meetings?.length) {
      hasContent = true;
      html += sectionHeader("📅 Reuniões do dia");
      html += "<ul>";
      for (const m of meetings) {
        const time = new Date(m.date_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        html += `<li>${time} — ${esc(m.title)}${m.client_name ? ` (${esc(m.client_name)})` : ""}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Tarefas da equipa para hoje ──
  if (sections.tarefas_equipa_hoje) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, priority, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("📋 Tarefas da equipa para hoje");
      html += "<ul>";
      for (const t of tasks) {
        const assignee = t.profiles?.full_name || "—";
        const prio = t.priority === "alta" ? " 🔴" : t.priority === "media" ? " 🟡" : "";
        html += `<li>${esc(t.name)} <span style="color:#888">(${esc(assignee)})</span>${prio}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Tarefas em atraso ──
  if (sections.tarefas_atraso) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, deadline, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .lt("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      html += "<ul>";
      for (const t of tasks) {
        const assignee = t.profiles?.full_name || "—";
        const days = daysDiff(t.deadline, todayStr);
        html += `<li>${esc(t.name)} <span style="color:#888">(${esc(assignee)} · ${days} dias)</span></li>`;
      }
      html += "</ul>";
    }
  }

  // ── Follow-ups de leads pendentes ──
  if (sections.followups_leads) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name, next_followup, potential_product")
      .lte("next_followup", todayStr)
      .not("next_followup", "is", null)
      .not("status", "in", '("ganho","perdido")');

    if (leads?.length) {
      hasContent = true;
      html += sectionHeader("📞 Follow-ups de leads pendentes");
      html += "<ul>";
      for (const l of leads) {
        const isToday = l.next_followup === todayStr;
        const label = isToday ? "hoje" : `${daysDiff(l.next_followup, todayStr)} dias em atraso`;
        html += `<li>${esc(l.name)} <span style="color:#888">(${label})</span></li>`;
      }
      html += "</ul>";
    }
  }

  // ── Aniversários (equipa e clientes) ──
  if (sections.aniversarios) {
    const upcoming7 = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      upcoming7.push(formatDate(d).substring(5));
    }
    const monthDay = todayStr.substring(5);

    const { data: members } = await supabase
      .from("team_members")
      .select("full_name, birthday")
      .eq("status", "activo")
      .not("birthday", "is", null);

    const { data: clients } = await supabase
      .from("clients")
      .select("full_name, birthday")
      .eq("status", "activo")
      .not("birthday", "is", null);

    const items: string[] = [];
    for (const m of (members || [])) {
      const bd = (m.birthday || "").substring(5);
      if (upcoming7.includes(bd)) {
        const isToday = bd === monthDay;
        items.push(`🎂 ${esc(m.full_name)} (equipa)${isToday ? " — <strong>HOJE!</strong>" : ` — ${m.birthday?.substring(8)}/${m.birthday?.substring(5, 7)}`}`);
      }
    }
    for (const c of (clients || [])) {
      const bd = (c.birthday || "").substring(5);
      if (upcoming7.includes(bd)) {
        const isToday = bd === monthDay;
        items.push(`🎂 ${esc(c.full_name)} (cliente)${isToday ? " — <strong>HOJE!</strong>" : ` — ${c.birthday?.substring(8)}/${c.birthday?.substring(5, 7)}`}`);
      }
    }

    if (items.length) {
      hasContent = true;
      html += sectionHeader("🎉 Aniversários próximos");
      html += "<ul>";
      for (const item of items) html += `<li>${item}</li>`;
      html += "</ul>";
    }
  }

  // ── Renovações de clientes ──
  if (sections.renovacoes_clientes) {
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyStr = formatDate(thirtyDaysLater);

    const { data: renewals } = await supabase
      .from("clients")
      .select("full_name, end_of_cycle")
      .eq("status", "activo")
      .not("end_of_cycle", "is", null)
      .gte("end_of_cycle", todayStr)
      .lte("end_of_cycle", thirtyStr)
      .order("end_of_cycle");

    if (renewals?.length) {
      hasContent = true;
      html += sectionHeader("🔄 Renovações próximas");
      html += "<ul>";
      for (const r of renewals) {
        const days = daysDiff(todayStr, r.end_of_cycle);
        const label = days === 0 ? "HOJE" : `em ${days} dias`;
        html += `<li>${esc(r.full_name)} — ${label}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Rotinas do dia ──
  if (sections.rotinas_dia) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .eq("tag", "Rotina")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: Row) => r.status === "done" || r.status === "concluida");
      const todo = routines.filter((r: Row) => r.status !== "done" && r.status !== "concluida");
      html += sectionHeader("🔄 Rotinas do dia");
      html += `<p>${done.length} feitas de ${routines.length}</p>`;
      if (todo.length) {
        html += "<p><em>Por fazer:</em></p><ul>";
        for (const t of todo) {
          const assignee = t.profiles?.full_name || "—";
          html += `<li>${esc(t.name)} (${esc(assignee)})</li>`;
        }
        html += "</ul>";
      }
    }
  }

  // ── Vendas hoje ──
  if (sections.vendas_hoje) {
    const { data: sales } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client, product")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (sales?.length) {
      hasContent = true;
      const total = sales.reduce((s: number, v: Row) => s + (v.invoice_total || 0), 0);
      html += sectionHeader("💰 Vendas registadas hoje");
      html += `<p><strong>${sales.length}</strong> venda(s) · Total: <strong>${formatCurrency(total)}</strong></p>`;
    }
  }

  // ── Leads novas ──
  if (sections.leads_novas) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (leads?.length) {
      hasContent = true;
      html += sectionHeader("🎯 Leads novas no CRM");
      html += `<p><strong>${leads.length}</strong> lead(s): ${leads.map((l: Row) => esc(l.name)).join(", ")}</p>`;
    }
  }

  // ── NPS recebidos ──
  if (sections.nps_recebidos) {
    const { data: nps } = await supabase
      .from("client_nps_records")
      .select("nps_score, clients(full_name)")
      .eq("status", "respondido")
      .gte("actual_date", todayStr)
      .lte("actual_date", todayStr);

    if (nps?.length) {
      hasContent = true;
      html += sectionHeader("⭐ NPS recebidos");
      html += "<ul>";
      for (const n of nps) {
        const clientName = (n as Row).clients?.full_name || "—";
        html += `<li>Score: ${n.nps_score} — ${esc(clientName)}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Pagamentos recebidos ──
  if (sections.pagamentos_recebidos) {
    const { data: payments } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client")
      .eq("status", "pago")
      .eq("payment_date", todayStr);

    if (payments?.length) {
      hasContent = true;
      const total = payments.reduce((s: number, p: Row) => s + (p.invoice_total || 0), 0);
      html += sectionHeader("💳 Pagamentos recebidos hoje");
      html += `<p>Total: <strong>${formatCurrency(total)}</strong></p>`;
      html += "<ul>";
      for (const p of payments) {
        html += `<li>${esc(p.client || "—")} — ${formatCurrency(p.invoice_total)}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Projetos fechados hoje ──
  if (sections.projetos_fechados) {
    const { data: closed } = await supabase
      .from("projects")
      .select("name, client_name")
      .eq("status", "concluido")
      .gte("updated_at", todayStr + "T00:00:00")
      .lte("updated_at", todayStr + "T23:59:59");

    if (closed?.length) {
      hasContent = true;
      html += sectionHeader("🏁 Projetos fechados hoje");
      html += "<ul>";
      for (const p of closed) {
        html += `<li>${esc(p.name)}${p.client_name ? ` <span style="color:#888">(${esc(p.client_name)})</span>` : ""}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Projetos criados hoje ──
  if (sections.projetos_novos) {
    const { data: created } = await supabase
      .from("projects")
      .select("name, client_name, department")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (created?.length) {
      hasContent = true;
      html += sectionHeader("🆕 Projetos criados hoje");
      html += "<ul>";
      for (const p of created) {
        html += `<li>${esc(p.name)}${p.client_name ? ` <span style="color:#888">(${esc(p.client_name)})</span>` : ""}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Tempo trabalhado hoje ──
  if (sections.tempo_trabalhado) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("duration, member_id, team_members(full_name)")
      .gte("entry_date", todayStr)
      .lte("entry_date", todayStr);

    if (entries?.length) {
      hasContent = true;
      const totalMin = entries.reduce((s: number, e: Row) => s + (e.duration || 0), 0);
      html += sectionHeader("⏱️ Tempo trabalhado hoje");
      html += `<p>Total equipa: <strong>${(totalMin / 60).toFixed(1)}h</strong></p>`;
      const byMember: Record<string, number> = {};
      for (const e of entries) {
        const name = e.team_members?.full_name || "—";
        byMember[name] = (byMember[name] || 0) + (e.duration || 0);
      }
      html += "<ul>";
      for (const [name, mins] of Object.entries(byMember)) {
        html += `<li>${esc(name)}: ${((mins as number) / 60).toFixed(1)}h</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Resumo por membro ──
  if (sections.resumo_membros) {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, full_name, profile_id, status")
      .eq("status", "activo");

    if (members?.length) {
      hasContent = true;
      html += sectionHeader("👥 Resumo por membro");
      for (const m of members) {
        if (!m.profile_id) continue;

        const { data: todayTasks } = await supabase
          .from("tasks")
          .select("name")
          .eq("assigned_to", m.profile_id)
          .neq("status", "done")
          .neq("status", "concluida")
          .gte("deadline", todayStr)
          .lte("deadline", todayStr);

        const { data: overdue } = await supabase
          .from("tasks")
          .select("name")
          .eq("assigned_to", m.profile_id)
          .neq("status", "done")
          .neq("status", "concluida")
          .lt("deadline", todayStr)
          .not("deadline", "is", null);

        html += `<p style="margin-top:8px"><strong>${esc(m.full_name)}</strong>: `;
        html += `${todayTasks?.length || 0} para hoje, ${overdue?.length || 0} em atraso</p>`;
      }
    }
  }

  // ── Prazos Fiscais ──
  if (sections.prazos_fiscais) {
    const fiscalHtml = await buildFiscalDeadlinesSection(supabase, todayStr);
    if (fiscalHtml) {
      hasContent = true;
      html += fiscalHtml;
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Dia tranquilo — sem registos para hoje. 🌿</p>`;
  }

  return html;
}

// ─── Member Digest Builder ────────────────────────────────
async function buildMemberDigest(
  supabase: SupabaseAdmin,
  sections: Record<string, boolean>,
  digest: Row,
  profile: Row,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  // Determine period range based on frequency
  const periodStart = getPeriodStart(digest.frequency, now);
  const periodEnd = todayStr;

  // Get team member for this profile (needed by several sections)
  const { data: tm } = await supabase
    .from("team_members")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // ── Tarefas para hoje ──
  if (sections.tarefas_hoje) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, deadline, priority")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "concluida")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("📋 Tarefas para hoje");
      html += "<ul>";
      for (const t of tasks) {
        const prio = t.priority === "alta" ? " 🔴" : t.priority === "media" ? " 🟡" : "";
        html += `<li>${esc(t.name)}${prio}</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Tarefas em atraso ──
  if (sections.tarefas_atraso) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, deadline")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "concluida")
      .lt("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      html += "<ul>";
      for (const t of tasks) {
        const days = daysDiff(t.deadline, todayStr);
        html += `<li>${esc(t.name)} <span style="color:#888">(${days} dias)</span></li>`;
      }
      html += "</ul>";
    }
  }

  // ── Reuniões de hoje ──
  if (sections.reunioes_hoje) {
    const { data: partRows } = await supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("profile_id", profile.id);

    if (partRows?.length) {
      const ids = partRows.map((r: Row) => r.meeting_id);
      const { data: meetings } = await supabase
        .from("meetings")
        .select("title, date_time, client_name, meeting_url")
        .in("id", ids)
        .gte("date_time", todayStr + "T00:00:00")
        .lte("date_time", todayStr + "T23:59:59")
        .order("date_time");

      if (meetings?.length) {
        hasContent = true;
        html += sectionHeader("📅 Reuniões de hoje");
        html += "<ul>";
        for (const m of meetings) {
          const time = new Date(m.date_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
          let line = `${time} — ${esc(m.title)}`;
          if (m.client_name) line += ` <span style="color:#888">(${esc(m.client_name)})</span>`;
          html += `<li>${line}</li>`;
        }
        html += "</ul>";
      }
    }
  }

  // ── Follow-ups de leads pendentes ──
  if (sections.followups_leads) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name, next_followup, potential_product")
      .lte("next_followup", todayStr)
      .not("next_followup", "is", null)
      .not("status", "in", '("ganho","perdido")');

    if (leads?.length) {
      hasContent = true;
      html += sectionHeader("📞 Follow-ups de leads pendentes");
      html += "<ul>";
      for (const l of leads) {
        const isToday = l.next_followup === todayStr;
        const label = isToday ? "hoje" : `${daysDiff(l.next_followup, todayStr)} dias em atraso`;
        html += `<li>${esc(l.name)} <span style="color:#888">(${label})</span></li>`;
      }
      html += "</ul>";
    }
  }

  // ── Aniversários (equipa e clientes) ──
  if (sections.aniversarios) {
    const monthDay = todayStr.substring(5); // MM-DD
    const upcoming7 = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      upcoming7.push(formatDate(d).substring(5));
    }

    // Team birthdays
    const { data: members } = await supabase
      .from("team_members")
      .select("full_name, birthday")
      .eq("status", "activo")
      .not("birthday", "is", null);

    // Client birthdays
    const { data: clients } = await supabase
      .from("clients")
      .select("full_name, birthday")
      .eq("status", "activo")
      .not("birthday", "is", null);

    const birthdayItems: string[] = [];
    for (const m of (members || [])) {
      const bd = (m.birthday || "").substring(5);
      if (upcoming7.includes(bd)) {
        const isToday = bd === monthDay;
        birthdayItems.push(`🎂 ${esc(m.full_name)} (equipa)${isToday ? " — <strong>HOJE!</strong>" : ` — ${m.birthday?.substring(8)}/${m.birthday?.substring(5, 7)}`}`);
      }
    }
    for (const c of (clients || [])) {
      const bd = (c.birthday || "").substring(5);
      if (upcoming7.includes(bd)) {
        const isToday = bd === monthDay;
        birthdayItems.push(`🎂 ${esc(c.full_name)} (cliente)${isToday ? " — <strong>HOJE!</strong>" : ` — ${c.birthday?.substring(8)}/${c.birthday?.substring(5, 7)}`}`);
      }
    }

    if (birthdayItems.length) {
      hasContent = true;
      html += sectionHeader("🎉 Aniversários próximos");
      html += "<ul>";
      for (const item of birthdayItems) html += `<li>${item}</li>`;
      html += "</ul>";
    }
  }

  // ── Renovações de clientes ──
  if (sections.renovacoes_clientes) {
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyStr = formatDate(thirtyDaysLater);

    const { data: renewals } = await supabase
      .from("clients")
      .select("full_name, end_of_cycle")
      .eq("status", "activo")
      .not("end_of_cycle", "is", null)
      .gte("end_of_cycle", todayStr)
      .lte("end_of_cycle", thirtyStr)
      .order("end_of_cycle");

    if (renewals?.length) {
      hasContent = true;
      html += sectionHeader("🔄 Renovações próximas");
      html += "<ul>";
      for (const r of renewals) {
        const days = daysDiff(todayStr, r.end_of_cycle);
        const label = days === 0 ? "HOJE" : `em ${days} dias`;
        html += `<li>${esc(r.full_name)} — ${label} (${r.end_of_cycle?.substring(8)}/${r.end_of_cycle?.substring(5, 7)})</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Rotinas do dia ──
  if (sections.rotinas) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status")
      .eq("assigned_to", profile.id)
      .eq("tag", "Rotina")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: Row) => r.status === "done" || r.status === "concluida");
      const todo = routines.filter((r: Row) => r.status !== "done" && r.status !== "concluida");
      html += sectionHeader("🔄 Rotinas do dia");
      html += `<p>${done.length} feitas de ${routines.length}</p>`;
      if (todo.length) {
        html += "<ul>";
        for (const t of todo) html += `<li>${esc(t.name)}</li>`;
        html += "</ul>";
      }
    }
  }

  // ── Tarefas concluídas no período ──
  if (sections.tarefas_concluidas) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name")
      .eq("assigned_to", profile.id)
      .eq("status", "done")
      .gte("updated_at", periodStart + "T00:00:00")
      .lte("updated_at", periodEnd + "T23:59:59");

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("✅ Tarefas concluídas");
      html += "<ul>";
      for (const t of tasks) html += `<li>${esc(t.name)}</li>`;
      html += "</ul>";
    }
  }

  // ── Tempo registado ──
  if (sections.tempo_registado) {
    if (tm) {
      const { data: entries } = await supabase
        .from("time_entries")
        .select("duration, project_id, client_name")
        .eq("member_id", tm.id)
        .gte("entry_date", periodStart)
        .lte("entry_date", periodEnd);

      if (entries?.length) {
        hasContent = true;
        const totalHours = entries.reduce((s: number, e: Row) => s + (e.duration || 0), 0);
        html += sectionHeader("⏱️ Tempo registado");
        html += `<p>Total: <strong>${(totalHours / 60).toFixed(1)}h</strong></p>`;
      }
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Dia tranquilo — sem registos para hoje. 🌿</p>`;
  }

  return html;
}

// ─── Owner EOD Digest Builder ─────────────────────────────
async function buildOwnerEodDigest(
  supabase: SupabaseAdmin,
  sections: Record<string, boolean>,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  // ── Tarefas concluídas hoje (equipa) ──
  if (sections.tarefas_concluidas_equipa !== false) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .in("status", ["done", "concluida"])
      .gte("updated_at", todayStr + "T00:00:00")
      .lte("updated_at", todayStr + "T23:59:59");

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("✅ Tarefas concluídas hoje");
      html += `<p><strong>${tasks.length}</strong> tarefa(s) concluída(s)</p><ul>`;
      for (const t of tasks) {
        const assignee = t.profiles?.full_name || "—";
        html += `<li>${esc(t.name)} <span style="color:#888">(${esc(assignee)})</span></li>`;
      }
      html += "</ul>";
    }
  }

  // ── Rotinas: progresso do dia ──
  if (sections.rotinas_progresso !== false) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .eq("tag", "Rotina")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: Row) => r.status === "done" || r.status === "concluida");
      const todo = routines.filter((r: Row) => r.status !== "done" && r.status !== "concluida");
      const pct = Math.round((done.length / routines.length) * 100);
      html += sectionHeader("🔄 Rotinas do dia");
      html += `<p><strong>${done.length}/${routines.length}</strong> concluídas (${pct}%)</p>`;
      if (todo.length) {
        html += "<p><em>Ficaram por fazer:</em></p><ul>";
        for (const t of todo) {
          const assignee = t.profiles?.full_name || "—";
          html += `<li>${esc(t.name)} (${esc(assignee)})</li>`;
        }
        html += "</ul>";
      }
    }
  }

  // ── Tempo trabalhado hoje ──
  if (sections.tempo_trabalhado !== false) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("duration, member_id, team_members(full_name)")
      .gte("entry_date", todayStr)
      .lte("entry_date", todayStr);

    if (entries?.length) {
      hasContent = true;
      const totalMin = entries.reduce((s: number, e: Row) => s + (e.duration || 0), 0);
      html += sectionHeader("⏱️ Tempo trabalhado hoje");
      html += `<p>Total equipa: <strong>${(totalMin / 60).toFixed(1)}h</strong></p>`;
      const byMember: Record<string, number> = {};
      for (const e of entries) {
        const name = e.team_members?.full_name || "—";
        byMember[name] = (byMember[name] || 0) + (e.duration || 0);
      }
      html += "<ul>";
      for (const [name, mins] of Object.entries(byMember)) {
        html += `<li>${esc(name)}: ${((mins as number) / 60).toFixed(1)}h</li>`;
      }
      html += "</ul>";
    }
  }

  // ── Vendas do dia ──
  if (sections.vendas_hoje !== false) {
    const { data: sales } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client, product")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (sales?.length) {
      hasContent = true;
      const total = sales.reduce((s: number, v: Row) => s + (v.invoice_total || 0), 0);
      html += sectionHeader("💰 Vendas do dia");
      html += `<p><strong>${sales.length}</strong> venda(s) · Total: <strong>${formatCurrency(total)}</strong></p>`;
    }
  }

  // ── Pagamentos recebidos ──
  if (sections.pagamentos_recebidos !== false) {
    const { data: payments } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client")
      .eq("status", "pago")
      .eq("payment_date", todayStr);

    if (payments?.length) {
      hasContent = true;
      const total = payments.reduce((s: number, p: Row) => s + (p.invoice_total || 0), 0);
      html += sectionHeader("💳 Pagamentos recebidos");
      html += `<p>Total: <strong>${formatCurrency(total)}</strong> (${payments.length} pagamento(s))</p>`;
    }
  }

  // ── Projetos fechados ──
  if (sections.projetos_fechados !== false) {
    const { data: closed } = await supabase
      .from("projects")
      .select("name, client_name")
      .eq("status", "concluido")
      .gte("updated_at", todayStr + "T00:00:00")
      .lte("updated_at", todayStr + "T23:59:59");

    if (closed?.length) {
      hasContent = true;
      html += sectionHeader("🏁 Projetos fechados hoje");
      html += "<ul>";
      for (const p of closed) html += `<li>${esc(p.name)}${p.client_name ? ` (${esc(p.client_name)})` : ""}</li>`;
      html += "</ul>";
    }
  }

  // ── Tarefas que ficaram em atraso ──
  if (sections.tarefas_atraso !== false) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, deadline, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .lte("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      html += `<p><strong>${tasks.length}</strong> tarefa(s) por resolver</p><ul>`;
      for (const t of tasks.slice(0, 10)) {
        const assignee = t.profiles?.full_name || "—";
        html += `<li>${esc(t.name)} <span style="color:#888">(${esc(assignee)})</span></li>`;
      }
      if (tasks.length > 10) html += `<li style="color:#888">… e mais ${tasks.length - 10}</li>`;
      html += "</ul>";
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Dia tranquilo — sem actividade registada. 🌙</p>`;
  }

  return html;
}

// ─── Member EOD Digest Builder ────────────────────────────
async function buildMemberEodDigest(
  supabase: SupabaseAdmin,
  sections: Record<string, boolean>,
  digest: Row,
  profile: Row,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  const { data: tm } = await supabase
    .from("team_members")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // ── Tarefas concluídas hoje ──
  if (sections.tarefas_concluidas !== false) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name")
      .eq("assigned_to", profile.id)
      .in("status", ["done", "concluida"])
      .gte("updated_at", todayStr + "T00:00:00")
      .lte("updated_at", todayStr + "T23:59:59");

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("✅ Tarefas concluídas hoje");
      html += `<p><strong>${tasks.length}</strong> tarefa(s)</p><ul>`;
      for (const t of tasks) html += `<li>${esc(t.name)}</li>`;
      html += "</ul>";
    }
  }

  // ── Rotinas: progresso ──
  if (sections.rotinas_progresso !== false) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status")
      .eq("assigned_to", profile.id)
      .eq("tag", "Rotina")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: Row) => r.status === "done" || r.status === "concluida");
      const pct = Math.round((done.length / routines.length) * 100);
      html += sectionHeader("🔄 Rotinas do dia");
      html += `<p><strong>${done.length}/${routines.length}</strong> concluídas (${pct}%)</p>`;
    }
  }

  // ── Tempo registado hoje ──
  if (sections.tempo_registado !== false && tm) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("duration")
      .eq("member_id", tm.id)
      .gte("entry_date", todayStr)
      .lte("entry_date", todayStr);

    if (entries?.length) {
      hasContent = true;
      const totalMin = entries.reduce((s: number, e: Row) => s + (e.duration || 0), 0);
      html += sectionHeader("⏱️ Tempo registado hoje");
      html += `<p>Total: <strong>${(totalMin / 60).toFixed(1)}h</strong></p>`;
    }
  }

  // ── Tarefas que ficaram em atraso ──
  if (sections.tarefas_atraso !== false) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, deadline")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "concluida")
      .lte("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      html += "<ul>";
      for (const t of tasks) html += `<li>${esc(t.name)}</li>`;
      html += "</ul>";
    }
  }

  // ── Preview de amanhã ──
  if (sections.preview_amanha !== false) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, priority")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "concluida")
      .gte("deadline", tomorrowStr)
      .lte("deadline", tomorrowStr);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("📅 Preview de amanhã");
      html += "<ul>";
      for (const t of tasks) {
        const prio = t.priority === "alta" ? " 🔴" : t.priority === "media" ? " 🟡" : "";
        html += `<li>${esc(t.name)}${prio}</li>`;
      }
      html += "</ul>";
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Dia tranquilo — sem actividade registada. 🌙</p>`;
  }

  return html;
}

// ─── Email HTML Builder ───────────────────────────────────
function buildEmailHtml(opts: {
  subject: string;
  headerTitle: string;
  greeting: string;
  dateLine: string;
  businessName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  fontBody: string;
  fontDisplay: string;
  contentHtml: string;
  isOwner: boolean;
}) {
  const content = opts.contentHtml.replace(/%%SECONDARY%%/g, opts.secondaryColor).replace(/%%ACCENT%%/g, opts.accentColor).replace(/%%PRIMARY%%/g, opts.primaryColor).replace(/%%DISPLAY_FONT%%/g, displayFont);
  const bodyFont = `'${opts.fontBody}', Arial, Helvetica, sans-serif`;
  const displayFont = `'${opts.fontDisplay}', '${opts.fontBody}', Arial, sans-serif`;
  // Build Google Fonts import for web-safe fonts
  const fontsToImport = [opts.fontBody, opts.fontDisplay].filter(f => f && f !== "Arial" && f !== "Helvetica");
  const googleFontsLink = fontsToImport.length
    ? `<link href="https://fonts.googleapis.com/css2?${fontsToImport.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap" rel="stylesheet">`
    : "";
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${googleFontsLink}</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${bodyFont};font-size:11px;color:#333">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="padding:0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="height:4px;background:${opts.primaryColor};border-radius:12px 12px 0 0"></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px;font-family:${bodyFont}">
    ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="" style="height:28px;margin:0 0 14px;display:block">` : ""}
    <p style="font-size:13px;color:${opts.primaryColor};margin:0 0 4px;font-family:${displayFont};font-weight:600">${esc(opts.greeting)}</p>
    <p style="font-size:10px;color:#888;margin:0 0 18px">${esc(opts.dateLine)}</p>
    ${content}
  </td></tr>
  <tr><td style="padding:12px 32px 16px;border-top:2px solid ${opts.secondaryColor};text-align:center">
    <p style="font-size:10px;color:#a1a1aa;margin:0;font-family:${bodyFont}">${esc(opts.businessName)}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Helpers ──────────────────────────────────────────────

// ── Fiscal Deadlines (inline computation for edge function) ──
const PT_FIXED_HOLIDAYS = [
  [1, 1], [4, 25], [5, 1], [6, 10], [8, 15], [10, 5], [11, 1], [12, 1], [12, 8], [12, 25],
];

function isNonBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return PT_FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === dd);
}

function adjustToPrevBiz(d: Date): Date {
  const result = new Date(d);
  while (isNonBusinessDay(result)) result.setDate(result.getDate() - 1);
  return result;
}

function fmtDeadline(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FiscalDl { name: string; date: string; category: string; }

function computeDigestFiscalDeadlines(year: number, config: { taxIvaRegime: string; taxIrsRegime: string; ssExempt: boolean; ivaExempt: boolean }): FiscalDl[] {
  const dls: FiscalDl[] = [];
  const ML = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  if (!config.ssExempt && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? year + 1 : year;
      const raw = new Date(ny, nm - 1, 20);
      dls.push({ name: `Pagamento SS — ${ML[m-1]} ${year}`, date: fmtDeadline(adjustToPrevBiz(raw)), category: 'ss' });
    }
  }

  if (!config.ivaExempt && config.taxIvaRegime === 'trimestral' && config.taxIrsRegime !== 'contabilidade_organizada') {
    const qs = [
      { q: 1, label: '1º Trim', dm: 5 }, { q: 2, label: '2º Trim', dm: 8 },
      { q: 3, label: '3º Trim', dm: 11 }, { q: 4, label: '4º Trim', dm: 2 },
    ];
    for (const q of qs) {
      const dy = q.q === 4 ? year + 1 : year;
      const raw = new Date(dy, q.dm, 0); // last day of month
      dls.push({ name: `IVA ${q.label} ${year}`, date: fmtDeadline(adjustToPrevBiz(raw)), category: 'iva' });
    }
  }

  if (!config.ivaExempt && config.taxIvaRegime === 'mensal' && config.taxIrsRegime !== 'contabilidade_organizada') {
    for (let m = 1; m <= 12; m++) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? year + 1 : year;
      const raw = new Date(ny, nm - 1, 20);
      dls.push({ name: `IVA — ${ML[m-1]} ${year}`, date: fmtDeadline(adjustToPrevBiz(raw)), category: 'iva' });
    }
  }

  return dls.sort((a, b) => a.date.localeCompare(b.date));
}

async function buildFiscalDeadlinesSection(supabase: SupabaseAdmin, todayStr: string): Promise<string> {
  const { data: bizSettings } = await supabase.from("business_settings").select("tax_iva_regime, tax_irs_regime, ss_exempt, iva_exempt").limit(1).single();
  if (!bizSettings) return "";

  const year = parseInt(todayStr.substring(0, 4));
  const deadlines = computeDigestFiscalDeadlines(year, {
    taxIvaRegime: bizSettings.tax_iva_regime || 'trimestral',
    taxIrsRegime: bizSettings.tax_irs_regime || 'simplificado',
    ssExempt: bizSettings.ss_exempt ?? false,
    ivaExempt: bizSettings.iva_exempt ?? false,
  });

  // Show deadlines that are today or within next 15 days, or overdue
  const upcoming = deadlines.filter(dl => {
    if (dl.date < todayStr) return true; // overdue
    const d = new Date(dl.date + 'T00:00:00');
    const t = new Date(todayStr + 'T00:00:00');
    const diff = Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 15;
  });

  if (upcoming.length === 0) return "";

  let html = sectionHeader("📋 Prazos Fiscais");
  html += "<ul>";
  for (const dl of upcoming) {
    const isOverdue = dl.date < todayStr;
    const isToday = dl.date === todayStr;
    const emoji = isOverdue ? "🔴" : isToday ? "📌" : "🟡";
    const label = isOverdue
      ? `em atraso (${daysDiff(dl.date, todayStr)} dias)`
      : isToday ? "HOJE" : `em ${daysDiff(todayStr, dl.date)} dias`;
    html += `<li>${emoji} ${esc(dl.name)} — <strong>${label}</strong></li>`;
  }
  html += "</ul>";
  return html;
}

function sectionHeader(title: string): string {
  return `<h2 style="font-size:12px;font-weight:600;color:%%PRIMARY%%;margin:20px 0 6px;border-bottom:2px solid %%SECONDARY%%;padding-bottom:5px;font-family:%%DISPLAY_FONT%%;text-transform:uppercase;letter-spacing:0.5px">${title}</h2>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDatePT(d: Date): string {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

function daysDiff(dateStr: string, todayStr: string): number {
  const d = new Date(dateStr);
  const t = new Date(todayStr);
  return Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getPeriodStart(frequency: string, now: Date): string {
  if (frequency === "diario") return formatDate(now);
  if (frequency === "semanal") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  }
  // mensal
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return formatDate(d);
}

function getFrequencyLabel(f: string): string {
  if (f === "diario") return "diário";
  if (f === "semanal") return "semanal";
  return "mensal";
}
function getContrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance < 0.4 ? "#ffffff" : "#1a1a1a";
  } catch {
    return "#ffffff";
  }
}

function hslToHex(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/);
    if (parts.length < 3) return "#6366f1";
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return "#6366f1";
  }
}
