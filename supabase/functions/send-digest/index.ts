import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
        let htmlSections = "";

        if (digest.is_owner_digest) {
          htmlSections = await buildOwnerDigest(supabase, sections, todayStr, now);
        } else {
          htmlSections = await buildMemberDigest(supabase, sections, digest, profile, todayStr, now);
        }

        // Build email
        const firstName = (profile.full_name || "").split(" ")[0] || "—";
        const freqLabel = getFrequencyLabel(digest.frequency);
        const headerTitle = digest.is_owner_digest ? "Resumo do dia" : `O teu resumo ${freqLabel}`;
        const periodWord = digest.frequency === "diario" ? "dia" : digest.frequency === "semanal" ? "semana" : "mês";
        const greeting = `Olá, ${firstName}! Aqui está o resumo do teu ${periodWord}.`;
        const subject = digest.is_owner_digest
          ? `Resumo do dia — ${businessName} — ${formatDatePT(now)}`
          : `O teu resumo — ${freqLabel} — ${formatDatePT(now)}`;

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
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: digest.is_owner_digest ? "owner-digest" : "member-digest",
              recipientEmail: authUser.email,
              idempotencyKey: `digest-${digest.id}-${todayStr}`,
              templateData: { subject, html },
            },
          });
        } catch {
          // If transactional email not set up yet, just log
          console.log(`Would send digest to ${authUser.email}: ${subject}`);
        }

        results.push({ userId: digest.user_id, sent: true });
      } catch (err: any) {
        results.push({ userId: digest.user_id, sent: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Owner Digest Builder ─────────────────────────────────
async function buildOwnerDigest(
  supabase: any,
  sections: Record<string, boolean>,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  // Tarefas concluídas hoje
  if (sections.tarefas_concluidas) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .eq("status", "done")
      .gte("updated_at", todayStr + "T00:00:00")
      .lte("updated_at", todayStr + "T23:59:59");

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("✅ Tarefas concluídas hoje");
      html += "<ul>";
      for (const t of tasks) {
        const assignee = t.profiles?.full_name || "—";
        html += `<li>${esc(t.name)} <span style="color:#888">(${esc(assignee)})</span></li>`;
      }
      html += "</ul>";
    }
  }

  // Tarefas em atraso
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

  // Reuniões do dia
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

  // Vendas hoje
  if (sections.vendas_hoje) {
    const { data: sales } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client, product")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (sales?.length) {
      hasContent = true;
      const total = sales.reduce((s: number, v: any) => s + (v.invoice_total || 0), 0);
      html += sectionHeader("💰 Vendas registadas hoje");
      html += `<p><strong>${sales.length}</strong> venda(s) · Total: <strong>${formatCurrency(total)}</strong></p>`;
    }
  }

  // Leads novas
  if (sections.leads_novas) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    if (leads?.length) {
      hasContent = true;
      html += sectionHeader("🎯 Leads novas no CRM");
      html += `<p><strong>${leads.length}</strong> lead(s): ${leads.map((l: any) => esc(l.name)).join(", ")}</p>`;
    }
  }

  // NPS recebidos
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
        const clientName = (n as any).clients?.full_name || "—";
        html += `<li>Score: ${n.nps_score} — ${esc(clientName)}</li>`;
      }
      html += "</ul>";
    }
  }

  // Pagamentos recebidos
  if (sections.pagamentos_recebidos) {
    const { data: payments } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client")
      .eq("status", "pago")
      .eq("payment_date", todayStr);

    if (payments?.length) {
      hasContent = true;
      const total = payments.reduce((s: number, p: any) => s + (p.invoice_total || 0), 0);
      html += sectionHeader("💳 Pagamentos recebidos hoje");
      html += `<p>Total: <strong>${formatCurrency(total)}</strong></p>`;
      html += "<ul>";
      for (const p of payments) {
        html += `<li>${esc(p.client || "—")} — ${formatCurrency(p.invoice_total)}</li>`;
      }
      html += "</ul>";
    }
  }

  // Rotinas do dia
  if (sections.rotinas_dia) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
      .eq("tag", "Rotina")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: any) => r.status === "done" || r.status === "concluida");
      const todo = routines.filter((r: any) => r.status !== "done" && r.status !== "concluida");
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

  // Projetos fechados hoje
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

  // Projetos criados hoje
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

  // Tempo trabalhado hoje (total equipa)
  if (sections.tempo_trabalhado) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("duration, member_id, team_members(full_name)")
      .gte("entry_date", todayStr)
      .lte("entry_date", todayStr);

    if (entries?.length) {
      hasContent = true;
      const totalMin = entries.reduce((s: number, e: any) => s + (e.duration || 0), 0);
      html += sectionHeader("⏱️ Tempo trabalhado hoje");
      html += `<p>Total equipa: <strong>${(totalMin / 60).toFixed(1)}h</strong></p>`;
      // Group by member
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

  // Resumo por membro
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

        const { data: doneTasks } = await supabase
          .from("tasks")
          .select("name")
          .eq("assigned_to", m.profile_id)
          .eq("status", "done")
          .gte("updated_at", todayStr + "T00:00:00")
          .lte("updated_at", todayStr + "T23:59:59");

        const { data: overdue } = await supabase
          .from("tasks")
          .select("name")
          .eq("assigned_to", m.profile_id)
          .neq("status", "done")
          .neq("status", "concluida")
          .lt("deadline", todayStr)
          .not("deadline", "is", null);

        html += `<p style="margin-top:8px"><strong>${esc(m.full_name)}</strong>: `;
        html += `${doneTasks?.length || 0} concluída(s), ${overdue?.length || 0} em atraso</p>`;
      }
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Dia tranquilo — sem registos para hoje. 🌿</p>`;
  }

  return html;
}

// ─── Member Digest Builder ────────────────────────────────
async function buildMemberDigest(
  supabase: any,
  sections: Record<string, boolean>,
  digest: any,
  profile: any,
  todayStr: string,
  now: Date
): Promise<string> {
  let html = "";
  let hasContent = false;

  // Determine period range based on frequency
  const periodStart = getPeriodStart(digest.frequency, now);
  const periodEnd = todayStr;

  // Tarefas concluídas
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

  // Tarefas em atraso
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

  // Reuniões
  if (sections.reunioes_periodo) {
    const { data: partRows } = await supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("profile_id", profile.id);

    if (partRows?.length) {
      const ids = partRows.map((r: any) => r.meeting_id);
      const { data: meetings } = await supabase
        .from("meetings")
        .select("title, date_time")
        .in("id", ids)
        .gte("date_time", periodStart + "T00:00:00")
        .lte("date_time", periodEnd + "T23:59:59")
        .order("date_time");

      if (meetings?.length) {
        hasContent = true;
        html += sectionHeader("📅 Reuniões");
        html += "<ul>";
        for (const m of meetings) {
          const date = new Date(m.date_time);
          const dateStr = date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
          const time = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
          html += `<li>${dateStr} ${time} — ${esc(m.title)}</li>`;
        }
        html += "</ul>";
      }
    }
  }

  // Rotinas
  if (sections.rotinas) {
    const { data: routines } = await supabase
      .from("tasks")
      .select("name, status")
      .eq("assigned_to", profile.id)
      .eq("tag", "Rotina")
      .gte("deadline", periodStart)
      .lte("deadline", periodEnd);

    if (routines?.length) {
      hasContent = true;
      const done = routines.filter((r: any) => r.status === "done" || r.status === "concluida");
      html += sectionHeader("🔄 Rotinas");
      html += `<p>${done.length} feitas de ${routines.length}</p>`;
    }
  }

  // NPS realizados
  if (sections.nps_realizados) {
    // Get team member for this profile
    const { data: tm } = await supabase
      .from("team_members")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (tm) {
      const { data: nps } = await supabase
        .from("client_nps_records")
        .select("nps_score, clients(full_name)")
        .eq("status", "respondido")
        .gte("actual_date", periodStart)
        .lte("actual_date", periodEnd);

      if (nps?.length) {
        hasContent = true;
        html += sectionHeader("⭐ NPS realizados");
        html += "<ul>";
        for (const n of nps) {
          const name = (n as any).clients?.full_name || "—";
          html += `<li>Score: ${n.nps_score} — ${esc(name)}</li>`;
        }
        html += "</ul>";
      }
    }
  }

  // Tempo registado
  if (sections.tempo_registado) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (tm) {
      const { data: entries } = await supabase
        .from("time_entries")
        .select("duration, project_id, client_name")
        .eq("member_id", tm.id)
        .gte("entry_date", periodStart)
        .lte("entry_date", periodEnd);

      if (entries?.length) {
        hasContent = true;
        const totalHours = entries.reduce((s: number, e: any) => s + (e.duration || 0), 0);
        html += sectionHeader("⏱️ Tempo registado");
        html += `<p>Total: <strong>${(totalHours / 60).toFixed(1)}h</strong></p>`;
      }
    }
  }

  if (!hasContent) {
    html = `<p style="color:#888;font-style:italic">Período tranquilo — sem registos para reportar. 🌿</p>`;
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
  contentHtml: string;
  isOwner: boolean;
}) {
  const content = opts.contentHtml.replace(/%%SECONDARY%%/g, opts.secondaryColor).replace(/%%ACCENT%%/g, opts.accentColor).replace(/%%PRIMARY%%/g, opts.primaryColor);
  const textColor = getContrastColor(opts.primaryColor);
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;font-size:13px">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <tr><td style="padding:28px 32px">
    ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="" style="height:32px;margin:0 0 16px;display:block">` : ""}
    <p style="font-size:14px;color:#333;margin:0 0 4px">${esc(opts.greeting)}</p>
    <p style="font-size:12px;color:#888;margin:0 0 20px">${esc(opts.dateLine)}</p>
    ${content}
  </td></tr>
  <tr><td style="padding:14px 32px 20px;border-top:2px solid ${opts.secondaryColor};text-align:center">
    <p style="font-size:11px;color:#a1a1aa;margin:0">${esc(opts.businessName)}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── Helpers ──────────────────────────────────────────────
function sectionHeader(title: string): string {
  return `<h2 style="font-size:14px;font-weight:600;color:#18181b;margin:20px 0 6px;border-bottom:2px solid %%SECONDARY%%;padding-bottom:5px">${title}</h2>`;
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
