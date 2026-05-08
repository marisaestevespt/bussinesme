import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders } from "../_shared/cors.ts";
type SupabaseAdmin = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;

import { isAuthorizedCronCall } from "../_shared/cron-auth.ts";
import { sendTransactionalEmail } from "../_shared/send-email.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse optional body for test mode
  let testMode = false;
  let testUserId: string | null = null;
  let testDigestType: "morning" | "eod" | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.test === true) {
        testMode = true;
        testUserId = body.userId || null;
        testDigestType = body.digestType || null;
      }
    } catch {
      // no body / not JSON — ignore
    }
  }

  // Auth: cron service-role OR (in test mode) any authenticated Supabase JWT
  const authHeader = req.headers.get("Authorization") || "";
  const isCron = isAuthorizedCronCall(req);
  if (!isCron) {
    if (!testMode || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // In test mode, validate the caller's JWT and force userId to themselves.
    if (testMode) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      testUserId = userData.user.id;
    }

    const now = new Date();
    // send_time is stored in Europe/Lisbon local time (matches what the user
    // configures in Definições). Convert "now" to Lisbon time before matching.
    const lisbonParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const currentHour = parseInt(lisbonParts.find((p) => p.type === "hour")!.value, 10);
    const currentMinute = parseInt(lisbonParts.find((p) => p.type === "minute")!.value, 10);
    const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}:00`;

    const hourStr = `${String(currentHour).padStart(2, "0")}:00:00`;
    const hourEnd = `${String(currentHour).padStart(2, "0")}:59:59`;

    let digestQuery = supabase
      .from("digest_settings")
      .select("*, profiles!inner(user_id)")
      .eq("enabled", true);

    if (testMode && testUserId) {
      // Filter by auth user_id via profiles join
      digestQuery = digestQuery.eq("profiles.user_id", testUserId);
      if (testDigestType) digestQuery = digestQuery.eq("digest_type", testDigestType);
    } else {
      digestQuery = digestQuery.gte("send_time", hourStr).lte("send_time", hourEnd);
    }

    const { data: digests, error: digestErr } = await digestQuery;

    if (digestErr) throw digestErr;
    if (!digests || digests.length === 0) {
      return new Response(
        JSON.stringify({ message: testMode ? "No matching digest settings (activa o digest primeiro)" : "No digests to send this hour" }),
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
    const jsDow = now.getDay(); // 0=Sun … 6=Sat
    const dayOfWeek = jsDow === 0 ? 7 : jsDow; // 1=Mon, 7=Sun
    const dayOfMonth = now.getDate();

    // ── Skip weekends (Saturday=6, Sunday=0) — ignored in test mode ──
    if (!testMode && (jsDow === 0 || jsDow === 6)) {
      return new Response(
        JSON.stringify({ message: "Skipped: weekend", dow: jsDow }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { userId: string; sent: boolean; error?: string }[] = [];

    for (const digest of digests) {
      try {
        // Check frequency match (skipped in test mode for instant preview)
        if (!testMode) {
          if (digest.frequency === "semanal" && digest.send_day_of_week !== dayOfWeek) continue;
          if (digest.frequency === "mensal" && digest.send_day_of_month !== dayOfMonth) continue;
        }

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

        const templateName = digest.is_owner_digest
          ? (isEod ? "owner-eod-digest" : "owner-digest")
          : (isEod ? "member-eod-digest" : "member-digest");
        const idempotencyKey = testMode
          ? `digest-test-${digest.id}-${Date.now()}`
          : `digest-${digest.id}-${todayStr}-${isEod ? "eod" : "am"}`;
        const sendResult = await sendTransactionalEmail({
          templateName,
          recipientEmail: authUser.email,
          idempotencyKey,
          templateData: { subject, html },
        });
        if (!sendResult.ok) {
          console.error(`[send-digest] Failed to send ${templateName} to ${authUser.email}:`, sendResult.status, sendResult.details);
          results.push({ userId: digest.user_id, sent: false, error: `${sendResult.status}: ${sendResult.details}` });
        } else {
          results.push({ userId: digest.user_id, sent: true });
        }
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
  // (helper declared below)
  let html = "";
  let hasContent = false;
  const empty = () => `<p style="color:#999;font-style:italic;margin:4px 0 0">Sem registos.</p>`;

  // ── Reuniões do dia (primeiro — o que vai acontecer) ──
  if (sections.reunioes_dia) {
    const { data: meetings } = await supabase
      .from("meetings")
      .select("title, date_time, client_name")
      .gte("date_time", todayStr + "T00:00:00")
      .lte("date_time", todayStr + "T23:59:59")
      .order("date_time");

    hasContent = true;
    html += sectionHeader("📅 Reuniões do dia");
    if (meetings?.length) {
      html += "<ul>";
      for (const m of meetings) {
        const time = new Date(m.date_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        html += `<li>${time} — ${esc(m.title)}${m.client_name ? ` (${esc(m.client_name)})` : ""}</li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
    }
  }

  // ── Tarefas da equipa para hoje ──
  if (sections.tarefas_equipa_hoje) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, priority, deadline, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .gte("deadline", todayStr)
      .lte("deadline", todayStr);

    hasContent = true;
    html += sectionHeader("📋 Tarefas da equipa para hoje");
    if (tasks?.length) {
      const sorted = sortByPriorityThenDeadline(tasks as any[]);
      const rows = sorted.map((t: any) => [
        esc(t.name),
        esc(t.profiles?.full_name || "—"),
        priorityChip(t.priority),
      ]);
      html += dataTable(["Tarefa", "Responsável", "Prioridade"], rows, ["left", "left", "left"]);
    } else {
      html += empty();
    }
  }

  // ── Tarefas em atraso ──
  if (sections.tarefas_atraso) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, assigned_to, priority, deadline, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .lt("deadline", todayStr)
      .not("deadline", "is", null);

    hasContent = true;
    html += sectionHeader("⚠️ Tarefas em atraso");
    if (tasks?.length) {
      // Mais atrasadas primeiro
      const sorted = [...tasks].sort((a: any, b: any) => (a.deadline || "").localeCompare(b.deadline || ""));
      const rows = sorted.map((t: any) => {
        const days = daysDiff(t.deadline, todayStr);
        return [
          esc(t.name),
          esc(t.profiles?.full_name || "—"),
          priorityChip(t.priority),
          chip(`${days}d`, days >= 7 ? "red" : "amber"),
        ];
      });
      html += dataTable(["Tarefa", "Responsável", "Prioridade", "Atraso"], rows, ["left", "left", "left", "right"]);
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("📞 Follow-ups de leads pendentes");
    if (leads?.length) {
      html += "<ul>";
      for (const l of leads) {
        const isToday = l.next_followup === todayStr;
        const label = isToday ? "hoje" : `${daysDiff(l.next_followup, todayStr)} dias em atraso`;
        html += `<li>${esc(l.name)} <span style="color:#888">(${label})</span></li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("🎉 Aniversários próximos");
    if (items.length) {
      html += "<ul>";
      for (const item of items) html += `<li>${item}</li>`;
      html += "</ul>";
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("🔄 Renovações próximas");
    if (renewals?.length) {
      html += "<ul>";
      for (const r of renewals) {
        const days = daysDiff(todayStr, r.end_of_cycle);
        const label = days === 0 ? "HOJE" : `em ${days} dias`;
        html += `<li>${esc(r.full_name)} — ${label}</li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("🔄 Rotinas do dia");
    if (routines?.length) {
      const done = routines.filter((r: Row) => r.status === "done" || r.status === "concluida");
      const todo = routines.filter((r: Row) => r.status !== "done" && r.status !== "concluida");
      html += `<p>${done.length} feitas de ${routines.length}</p>`;
      if (todo.length) {
        html += "<p><em>Por fazer:</em></p><ul>";
        for (const t of todo) {
          const assignee = t.profiles?.full_name || "—";
          html += `<li>${esc(t.name)} (${esc(assignee)})</li>`;
        }
        html += "</ul>";
      }
    } else {
      html += empty();
    }
  }

  // ── Vendas hoje ──
  if (sections.vendas_hoje) {
    const { data: sales } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client, product")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    hasContent = true;
    html += sectionHeader("💰 Vendas registadas hoje");
    if (sales?.length) {
      const total = sales.reduce((s: number, v: Row) => s + (v.invoice_total || 0), 0);
      html += `<p><strong>${sales.length}</strong> venda(s) · Total: <strong>${formatCurrency(total)}</strong></p>`;
    } else {
      html += empty();
    }
  }

  // ── Leads novas ──
  if (sections.leads_novas) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    hasContent = true;
    html += sectionHeader("🎯 Leads novas no CRM");
    if (leads?.length) {
      html += `<p><strong>${leads.length}</strong> lead(s): ${leads.map((l: Row) => esc(l.name)).join(", ")}</p>`;
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("⭐ NPS recebidos");
    if (nps?.length) {
      html += "<ul>";
      for (const n of nps) {
        const clientName = (n as Row).clients?.full_name || "—";
        html += `<li>Score: ${n.nps_score} — ${esc(clientName)}</li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
    }
  }

  // ── Pagamentos recebidos ──
  if (sections.pagamentos_recebidos) {
    const { data: payments } = await supabase
      .from("commercial_sales")
      .select("invoice_total, client, product")
      .in("status", ["tudo_ok", "pago_falta_fatura"])
      .eq("payment_date", todayStr);

    hasContent = true;
    html += sectionHeader("💳 Pagamentos recebidos hoje");
    if (payments?.length) {
      const total = payments.reduce((s: number, p: Row) => s + (p.invoice_total || 0), 0);
      html += `<p>Total: <strong>${formatCurrency(total)}</strong></p>`;
      const rows = (payments as any[]).map((p: any) => [
        esc(p.client || "—"),
        esc(p.product || "—"),
        `<strong>${formatCurrency(p.invoice_total || 0)}</strong>`,
      ]);
      html += dataTable(["Cliente", "Produto/Serviço", "Valor"], rows, ["left", "left", "right"]);
    } else {
      html += empty();
    }
  }

  // ── Contas a pagar (próximos 7 dias) ──
  // Mostra despesas com status pendente / por_pagar com expense_date dentro
  // dos próximos 7 dias (incluindo já vencidas). Inclui fornecedor e valor.
  if (sections.contas_pagar !== false) {
    const sevenLater = new Date(now);
    sevenLater.setDate(sevenLater.getDate() + 7);
    const sevenStr = formatDate(sevenLater);

    const { data: expenses } = await supabase
      .from("financial_expenses")
      .select("expense_name, description, total_with_vat, expense_date, status, supplier_id, suppliers(name)")
      .eq("status", "por_pagar")
      .lte("expense_date", sevenStr)
      .order("expense_date", { ascending: true });

    hasContent = true;
    html += sectionHeader("🧾 Contas a pagar (próximos 7 dias)");
    if (expenses?.length) {
      const total = (expenses as Row[]).reduce((s: number, e: Row) => s + (Number(e.total_with_vat) || 0), 0);
      html += `<p>Total pendente: <strong>${formatCurrency(total)}</strong> · ${expenses.length} despesa(s)</p>`;
      const rows = (expenses as any[]).map((e: any) => {
        const supplier = e.suppliers?.name || "—";
        const isOverdue = e.expense_date < todayStr;
        const isToday = e.expense_date === todayStr;
        const dateLabel = isOverdue
          ? chip(`Atraso · ${e.expense_date.substring(8)}/${e.expense_date.substring(5,7)}`, "red")
          : isToday
            ? chip("Hoje", "amber")
            : `${e.expense_date.substring(8)}/${e.expense_date.substring(5,7)}`;
        return [
          esc(e.expense_name || e.description || "—"),
          esc(supplier),
          dateLabel,
          `<strong>${formatCurrency(Number(e.total_with_vat) || 0)}</strong>`,
        ];
      });
      html += dataTable(["Despesa", "Fornecedor", "Vencimento", "Valor"], rows, ["left", "left", "left", "right"]);
    } else {
      html += empty();
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

    hasContent = true;
    html += sectionHeader("🏁 Projetos fechados hoje");
    if (closed?.length) {
      html += "<ul>";
      for (const p of closed) {
        html += `<li>${esc(p.name)}${p.client_name ? ` <span style="color:#888">(${esc(p.client_name)})</span>` : ""}</li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
    }
  }

  // ── Projetos criados hoje ──
  if (sections.projetos_novos) {
    const { data: created } = await supabase
      .from("projects")
      .select("name, client_name, department")
      .gte("created_at", todayStr + "T00:00:00")
      .lte("created_at", todayStr + "T23:59:59");

    hasContent = true;
    html += sectionHeader("🆕 Projetos criados hoje");
    if (created?.length) {
      html += "<ul>";
      for (const p of created) {
        html += `<li>${esc(p.name)}${p.client_name ? ` <span style="color:#888">(${esc(p.client_name)})</span>` : ""}</li>`;
      }
      html += "</ul>";
    } else {
      html += empty();
    }
  }

  // ── Tempo trabalhado hoje (equipa) ──
  if (sections.tempo_trabalhado !== false) {
    const wt = await buildWorkTimeSection(supabase, todayStr, todayStr, 'team', { title: "⏱️ Tempo trabalhado hoje" });
    hasContent = true;
    if (wt) { html += wt; }
    else { html += sectionHeader("⏱️ Tempo trabalhado hoje") + empty(); }
  }

  // ── Resumo por membro ──
  if (sections.resumo_membros) {
    const { data: members } = await supabase
      .from("team_members")
      .select("id, full_name, profile_id, status")
      .eq("status", "activo");

    hasContent = true;
    html += sectionHeader("👥 Resumo por membro");
    if (members?.length) {
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
    } else {
      html += empty();
    }
  }

  // ── Prazos Fiscais ──
  if (sections.prazos_fiscais) {
    try {
      const fiscalHtml = await buildFiscalDeadlinesSection(supabase, now);
      hasContent = true;
      if (fiscalHtml) {
        html += fiscalHtml;
      } else {
        html += sectionHeader("📋 Prazos fiscais") + empty();
      }
    } catch (err) {
      console.error("[send-digest] fiscal section failed:", err);
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
      const sorted = sortByPriorityThenDeadline(tasks as any[]);
      const rows = sorted.map((t: any) => [esc(t.name), priorityChip(t.priority)]);
      html += dataTable(["Tarefa", "Prioridade"], rows, ["left", "left"]);
    }
  }

  // ── Tarefas em atraso ──
  if (sections.tarefas_atraso) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("name, deadline, priority")
      .eq("assigned_to", profile.id)
      .neq("status", "done")
      .neq("status", "concluida")
      .lt("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      const sorted = [...tasks].sort((a: any, b: any) => (a.deadline || "").localeCompare(b.deadline || ""));
      const rows = sorted.map((t: any) => {
        const days = daysDiff(t.deadline, todayStr);
        return [
          esc(t.name),
          priorityChip(t.priority),
          chip(`${days}d`, days >= 7 ? "red" : "amber"),
        ];
      });
      html += dataTable(["Tarefa", "Prioridade", "Atraso"], rows, ["left", "left", "right"]);
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

  // ── Tempo registado (próprio membro) ──
  if (sections.tempo_registado !== false) {
    const wt = await buildWorkTimeSection(supabase, periodStart, periodEnd, 'user', {
      memberId: tm?.id,
      userId: profile.user_id,
      title: "⏱️ O teu tempo registado",
    });
    if (wt) { hasContent = true; html += wt; }
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
      html += `<p><strong>${tasks.length}</strong> tarefa(s) concluída(s)</p>`;
      const rows = (tasks as any[]).map((t: any) => [
        esc(t.name),
        esc(t.profiles?.full_name || "—"),
      ]);
      html += dataTable(["Tarefa", "Responsável"], rows, ["left", "left"]);
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

  // ── Tempo trabalhado hoje (equipa) ──
  if (sections.tempo_trabalhado !== false) {
    const wt = await buildWorkTimeSection(supabase, todayStr, todayStr, 'team', { title: "⏱️ Tempo trabalhado da equipa hoje" });
    if (wt) { hasContent = true; html += wt; }
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
      .in("status", ["tudo_ok", "pago_falta_fatura"])
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
      .select("name, assigned_to, priority, deadline, profiles!tasks_assigned_to_fkey(full_name)")
      .neq("status", "done")
      .neq("status", "concluida")
      .lte("deadline", todayStr)
      .not("deadline", "is", null);

    if (tasks?.length) {
      hasContent = true;
      html += sectionHeader("⚠️ Tarefas em atraso");
      html += `<p><strong>${tasks.length}</strong> tarefa(s) por resolver</p>`;
      const sorted = [...tasks].sort((a: any, b: any) => (a.deadline || "").localeCompare(b.deadline || ""));
      const rows = sorted.slice(0, 15).map((t: any) => {
        const days = daysDiff(t.deadline, todayStr);
        return [
          esc(t.name),
          esc(t.profiles?.full_name || "—"),
          priorityChip(t.priority),
          chip(days > 0 ? `${days}d` : "Hoje", days >= 7 ? "red" : days > 0 ? "amber" : "slate"),
        ];
      });
      html += dataTable(["Tarefa", "Responsável", "Prioridade", "Atraso"], rows, ["left", "left", "left", "right"]);
      if (tasks.length > 15) {
        html += `<p style="font-size:12px;color:#86868b;margin:8px 0 0">… e mais ${tasks.length - 15} tarefa(s).</p>`;
      }
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

  // ── Tempo registado hoje (próprio membro) ──
  if (sections.tempo_registado !== false) {
    const wt = await buildWorkTimeSection(supabase, todayStr, todayStr, 'user', {
      memberId: tm?.id,
      userId: profile.user_id,
      title: "⏱️ O teu tempo registado hoje",
    });
    if (wt) { hasContent = true; html += wt; }
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
  const bodyFont = `'${opts.fontBody}', Arial, Helvetica, sans-serif`;
  const displayFont = `'${opts.fontDisplay}', '${opts.fontBody}', Arial, sans-serif`;
  // Wrap content with a sentinel pair so the first sectionHeader (which closes
  // the previous card via "</div></div>") has something valid to close.
  let content = `<div style="display:none"><div>` + opts.contentHtml + `</div></div>`;
  content = content
    .replace(/%%SECONDARY%%/g, opts.secondaryColor)
    .replace(/%%ACCENT%%/g, opts.accentColor)
    .replace(/%%PRIMARY%%/g, opts.primaryColor)
    .replace(/%%DISPLAY_FONT%%/g, displayFont)
    .replace(/%%BODY_FONT%%/g, bodyFont)
    .replace(/<ul>/g, '<ul class="dg-ul">')
    .replace(/<li>/g, '<li class="dg-li">')
    .replace(/<p><em>/g, '<p class="dg-cap"><em style="font-style:normal">')
    .replace(/<\/em><\/p>/g, '</em></p>');
  const onPrimary = getContrastColor(opts.primaryColor);
  const fontsToImport = [opts.fontBody, opts.fontDisplay].filter(f => f && f !== "Arial" && f !== "Helvetica");
  const googleFontsLink = fontsToImport.length
    ? `<link href="https://fonts.googleapis.com/css2?${fontsToImport.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap" rel="stylesheet">`
    : "";
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${googleFontsLink}
<style>
.dg-card{margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden}
.dg-card-inner{padding:18px 22px 16px;border-left:3px solid ${opts.primaryColor}}
.dg-h2{font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;font-family:${displayFont};letter-spacing:0.2px}
.dg-body{font-family:${bodyFont};font-size:14px;color:#3a3a3c;line-height:1.6}
.dg-tbl{width:100%;border-collapse:collapse;margin:6px 0 2px;table-layout:auto}
.dg-th{font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.6px;padding:6px 10px;border-bottom:1px solid #e5e5e7}
.dg-td{padding:9px 10px;border-bottom:1px solid #efeff1;font-size:13px;color:#1c1c1e;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word}
.dg-l{text-align:left}.dg-r{text-align:right}.dg-c{text-align:center}
.dg-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.2px;white-space:nowrap}
.dg-ul{margin:4px 0 0;padding:0;list-style:none}
.dg-li{padding:8px 0;border-bottom:1px solid #efeff1;font-size:14px;color:#3a3a3c;line-height:1.5}
.dg-cap{margin:8px 0 4px;font-size:12px;color:#86868b;font-weight:500;text-transform:uppercase;letter-spacing:0.6px}
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:${bodyFont};font-size:14px;color:#1c1c1e;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)">
  <tr><td style="background:linear-gradient(135deg, ${opts.primaryColor} 0%, ${opts.accentColor} 100%);padding:36px 36px 30px;color:${onPrimary};font-family:${displayFont}">
    ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="" style="height:24px;margin:0 0 20px;display:block">` : ""}
    <p style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${onPrimary};opacity:0.78;margin:0 0 8px;font-weight:500;font-family:${bodyFont}">${esc(opts.headerTitle)}</p>
    <h1 style="font-size:24px;line-height:1.3;color:${onPrimary};margin:0 0 6px;font-weight:600;font-family:${displayFont}">${esc(opts.greeting)}</h1>
    <p style="font-size:13px;color:${onPrimary};opacity:0.82;margin:0;font-family:${bodyFont}">${esc(opts.dateLine)}</p>
  </td></tr>
  <tr><td style="padding:8px 28px 32px;font-family:${bodyFont}">
    ${content}
  </td></tr>
  <tr><td style="padding:22px 36px 28px;background:#fafafa;border-top:1px solid #efeff1;text-align:center">
    <p style="font-size:12px;color:#86868b;margin:0;font-family:${bodyFont};letter-spacing:0.2px">${esc(opts.businessName)}</p>
  </td></tr>
</table>
<p style="font-size:11px;color:#a1a1a6;margin:18px 0 0;font-family:${bodyFont}">Recebes este email porque ativaste o teu resumo no ${esc(opts.businessName)}.</p>
</td></tr>
</table>
</body></html>`;
}

function sectionHeader(title: string): string {
  // Each section becomes a soft card with a colored accent rail. The leading
  // "</div></div>" closes the previous card (or the sentinel wrapper opened
  // in buildEmailHtml for the first section).
  return `</div></div><div class="dg-card"><div class="dg-card-inner"><h2 class="dg-h2">${title}</h2><div class="dg-body">`;
}

// ─── Table helpers (for richer sections) ──────────────────────────
// Each cell escapes its content. The `align` array applies "left"/"right"/"center"
// per column. Headers are 11px uppercase; rows are 13px with subtle separators.
// Aggregates work time from `time_entries` (manual, duration in MINUTES) and
// `task_time_entries` (timer cronometrado, duration_minutes). Optionally filters by user/member.
// scope: 'team' returns rows per member; 'user' returns total only.
async function buildWorkTimeSection(
  supabase: SupabaseAdmin,
  startDate: string,
  endDate: string,
  scope: 'team' | 'user',
  opts: { memberId?: string; userId?: string; title?: string } = {}
): Promise<string> {
  const totals: Record<string, { name: string; minutes: number }> = {};
  let total = 0;

  // 1) Manual entries
  let q1 = supabase
    .from("time_entries")
    .select("duration, member_id, team_members(full_name)")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);
  if (opts.memberId) q1 = q1.eq("member_id", opts.memberId);
  const { data: manual } = await q1;
  for (const e of (manual || []) as Row[]) {
    const mins = Number(e.duration) || 0;
    total += mins;
    if (scope === 'team') {
      const k = e.member_id || "—";
      if (!totals[k]) totals[k] = { name: e.team_members?.full_name || "Sem nome", minutes: 0 };
      totals[k].minutes += mins;
    }
  }

  // 2) Task timer entries (per user_id → join via team_members.profile_id → profiles.user_id)
  let q2 = supabase
    .from("task_time_entries")
    .select("duration_minutes, user_id")
    .gte("started_at", startDate + "T00:00:00")
    .lte("started_at", endDate + "T23:59:59");
  if (opts.userId) q2 = q2.eq("user_id", opts.userId);
  const { data: timers } = await q2;
  let userIdToMember: Record<string, { id: string; name: string }> = {};
  if (scope === 'team' && timers?.length) {
    const userIds = [...new Set(timers.map((t: Row) => t.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id, id, full_name, team_members(id, full_name)")
        .in("user_id", userIds);
      for (const p of (prof || []) as Row[]) {
        const tm = Array.isArray(p.team_members) ? p.team_members[0] : p.team_members;
        userIdToMember[p.user_id] = {
          id: tm?.id || p.id,
          name: tm?.full_name || p.full_name || "Sem nome",
        };
      }
    }
  }
  for (const t of (timers || []) as Row[]) {
    const mins = Number(t.duration_minutes) || 0;
    total += mins;
    if (scope === 'team') {
      const m = userIdToMember[t.user_id];
      const k = m?.id || `u:${t.user_id}`;
      if (!totals[k]) totals[k] = { name: m?.name || "Sem nome", minutes: 0 };
      totals[k].minutes += mins;
    }
  }

  if (total <= 0) return "";

  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    return h > 0 ? `${h}h${mm > 0 ? ` ${mm}min` : ""}` : `${mm}min`;
  };

  let html = sectionHeader(opts.title || (scope === 'team' ? "⏱️ Tempo trabalhado da equipa" : "⏱️ Tempo trabalhado"));
  if (scope === 'team' && Object.keys(totals).length > 0) {
    const rows = Object.values(totals)
      .sort((a, b) => b.minutes - a.minutes)
      .map(r => [esc(r.name), fmt(r.minutes)]);
    rows.push([`<strong>Total equipa</strong>`, `<strong>${fmt(total)}</strong>`]);
    html += dataTable(["Membro", "Tempo"], rows, ["left", "right"]);
  } else {
    html += `<p style="margin:6px 0 2px;font-size:14px;color:#1c1c1e">Total: <strong>${fmt(total)}</strong></p>`;
  }
  return html;
}

function dataTable(headers: string[], rows: string[][], align?: ("left"|"right"|"center")[]): string {
  const al = (i: number) => {
    const a = align?.[i] || "left";
    return a === "right" ? "dg-r" : a === "center" ? "dg-c" : "dg-l";
  };
  const headHtml = headers
    .map((h, i) => `<th class="dg-th ${al(i)}">${esc(h)}</th>`)
    .join("");
  const bodyHtml = rows
    .map(r => "<tr>" + r.map((c, i) => `<td class="dg-td ${al(i)}">${c}</td>`).join("") + "</tr>")
    .join("");
  return `<table class="dg-tbl" cellpadding="0" cellspacing="0" role="presentation"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

// Coloured chip, e.g. priority or overdue badge. Use sparingly inside table cells.
function chip(label: string, color: "red"|"amber"|"green"|"slate"|"primary" = "slate"): string {
  const palette: Record<string, { bg: string; fg: string }> = {
    red:    { bg: "#fdecea", fg: "#b71c1c" },
    amber:  { bg: "#fff4e0", fg: "#9a5b00" },
    green:  { bg: "#e7f5ec", fg: "#1f7a3a" },
    slate:  { bg: "#eceef1", fg: "#4a4a4f" },
    primary:{ bg: "#eceef1", fg: "#1c1c1e" },
  };
  const p = palette[color] || palette.slate;
  return `<span class="dg-chip" style="background:${p.bg};color:${p.fg}">${esc(label)}</span>`;
}

function priorityChip(prio?: string | null): string {
  if (prio === "alta") return chip("Alta", "red");
  if (prio === "media") return chip("Média", "amber");
  if (prio === "baixa") return chip("Baixa", "slate");
  return "—";
}

// Sort tasks by priority (alta → media → baixa → none) then by deadline asc.
function sortByPriorityThenDeadline<T extends { priority?: string | null; deadline?: string | null }>(tasks: T[]): T[] {
  const order: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return [...tasks].sort((a, b) => {
    const pa = order[a.priority || ""] ?? 3;
    const pb = order[b.priority || ""] ?? 3;
    if (pa !== pb) return pa - pb;
    const da = a.deadline || "9999-12-31";
    const db = b.deadline || "9999-12-31";
    return da.localeCompare(db);
  });
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

// ─── Fiscal Deadlines Section ─────────────────────────────
// Lê fiscal_monthly_checks (verificações mensais) e mostra as que ainda
// não foram marcadas no mês corrente, mais alertas do mês anterior em atraso.
async function buildFiscalDeadlinesSection(
  supabase: SupabaseAdmin,
  now: Date
): Promise<string> {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: thisMonth } = await supabase
    .from("fiscal_monthly_checks")
    .select("check_key, checked")
    .eq("year", year)
    .eq("month", month);

  const pending = (thisMonth || []).filter((r: Row) => !r.checked);
  if (!pending.length) return "";

  let html = `<h3 style="margin:18px 0 8px;font-size:14px">📋 Prazos fiscais — ${month}/${year}</h3>`;
  html += `<ul style="margin:0;padding-left:18px">`;
  for (const p of pending) {
    html += `<li>${esc(String(p.check_key))}</li>`;
  }
  html += `</ul>`;
  return html;
}
