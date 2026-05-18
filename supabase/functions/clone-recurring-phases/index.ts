import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { logRun } from '../_shared/resilience.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clona fases recorrentes (definidas em product_phases.is_recurring) como
 * novas instâncias em project_phases para cada projeto ativo, sempre que
 * se aproxima o deadline do próximo período.
 *
 * Lógica:
 * 1. Busca product_phases com is_recurring=true.
 * 2. Para cada um, lista projetos ativos (status not in concluido/cancelado/arquivado)
 *    cujo produto tem default_project_mode=recorrente.
 * 3. Calcula deadline e abertura do PRÓXIMO período (mensal/semanal/trimestral)
 *    em função de hoje + recurrence_anchor_day.
 * 4. Se ainda não existe project_phase com (project_id, source_phase_id, recurrence_period),
 *    insere a nova fase + clona deliverables/templates (que ficarão geradas como
 *    tarefas via trigger sync_deliverable_to_task existente).
 */

function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < Math.abs(days)) {
    d.setDate(d.getDate() + (days >= 0 ? 1 : -1));
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // weekday: 1=Mon..7=Sun. n: 1..4 ou 5 = última.
  const targetDow = weekday % 7; // JS: 0=Sun..6=Sat → Mon=1..Sun=0
  if (n >= 5) {
    // última ocorrência: começa no último dia do mês e recua
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - targetDow + 7) % 7;
    return new Date(year, month, last.getDate() - diff);
  }
  const first = new Date(year, month, 1);
  const diff = (targetDow - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

function nextDeadline(today: Date, freq: string, anchorDay: number, weekOfMonth?: number | null): { deadline: Date; period: string } {
  if (freq === 'semanal') {
    // anchorDay: 1=Mon..7=Sun
    const target = ((anchorDay - 1) % 7);
    const todayDow = (today.getDay() + 6) % 7; // 0=Mon..6=Sun
    const diff = (target - todayDow + 7) % 7 || 7; // próximo (não hoje)
    const d = new Date(today);
    d.setDate(d.getDate() + diff);
    const year = d.getFullYear();
    // ISO week
    const tmp = new Date(Date.UTC(year, d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { deadline: d, period: `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}` };
  }
  if (freq === 'trimestral') {
    const m = today.getMonth();
    const quarter = Math.floor(m / 3);
    const lastMonthOfQuarter = quarter * 3 + 2;
    let year = today.getFullYear();
    let monthIdx = lastMonthOfQuarter;
    let candidate = new Date(year, monthIdx, anchorDay);
    if (candidate <= today) {
      monthIdx += 3;
      if (monthIdx > 11) { monthIdx -= 12; year += 1; }
      candidate = new Date(year, monthIdx, anchorDay);
    }
    const q = Math.floor(monthIdx / 3) + 1;
    return { deadline: candidate, period: `${year}-Q${q}` };
  }
  // mensal (default)
  let year = today.getFullYear();
  let month = today.getMonth();
  let candidate: Date;
  if (weekOfMonth) {
    // anchorDay = dia da semana (1=Seg..7=Dom); weekOfMonth = 1..5
    candidate = nthWeekdayOfMonth(year, month, anchorDay, weekOfMonth);
    if (candidate <= today) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
      candidate = nthWeekdayOfMonth(year, month, anchorDay, weekOfMonth);
    }
  } else {
    candidate = new Date(year, month, anchorDay);
    if (candidate <= today) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
      candidate = new Date(year, month, anchorDay);
    }
  }
  return { deadline: candidate, period: `${year}-${String(month + 1).padStart(2, '0')}` };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = new Date();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar templates de fases recorrentes
    const { data: templates, error: tErr } = await supabase
      .from('product_phases')
      .select('id, product_id, name, description, sort_order, duration_unit, is_onboarding, linked_sop_id, recurrence_frequency, recurrence_anchor_day, recurrence_lead_days, recurrence_week_of_month')
      .eq('is_recurring', true)
      .not('recurrence_anchor_day', 'is', null);

    if (tErr) throw tErr;

    let cloned = 0;
    let skipped = 0;

    for (const tpl of templates || []) {
      const freq = tpl.recurrence_frequency || 'mensal';
      const lead = tpl.recurrence_lead_days ?? 5;
      const { deadline, period } = nextDeadline(today, freq, tpl.recurrence_anchor_day!, (tpl as any).recurrence_week_of_month);
      const start = addBusinessDays(deadline, -lead);

      // Só agimos se a abertura é hoje ou já passou (evita criar com muita antecedência)
      if (start > today) { skipped++; continue; }

      // 2. Projetos ativos para este produto
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('product_id', tpl.product_id)
        .not('status', 'in', '(concluido,cancelado,arquivado)');

      for (const proj of projects || []) {
        // Idempotência: já existe para este período?
        const { data: existing } = await supabase
          .from('project_phases')
          .select('id')
          .eq('project_id', proj.id)
          .eq('source_phase_id', tpl.id)
          .eq('recurrence_period', period)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        // Insere a nova fase
        const { data: newPhase, error: pErr } = await supabase
          .from('project_phases')
          .insert({
            project_id: proj.id,
            source_phase_id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            sort_order: 9999, // recorrentes ao fim
            duration_unit: tpl.duration_unit,
            is_onboarding: false,
            linked_sop_id: tpl.linked_sop_id,
            planned_start: start.toISOString().slice(0, 10),
            planned_end: deadline.toISOString().slice(0, 10),
            status: 'pendente',
            is_recurring: true,
            recurrence_frequency: freq,
            recurrence_anchor_day: tpl.recurrence_anchor_day,
            recurrence_lead_days: lead,
            recurrence_week_of_month: (tpl as any).recurrence_week_of_month ?? null,
            recurrence_period: period,
          })
          .select('id')
          .single();

        if (pErr || !newPhase) { console.error('phase insert error', pErr); continue; }

        // Clonar deliverables do template para esta fase do projeto
        const { data: dts } = await supabase
          .from('product_deliverable_templates')
          .select('*')
          .eq('product_id', tpl.product_id)
          .eq('phase_id', tpl.id);

        for (const dt of dts || []) {
          const cadence = (dt as any).cadence || 'por_ciclo_fase';

          // 'sem_data' nunca gera tarefas calendarizadas — ignora.
          if (cadence === 'sem_data') continue;

          // 'unica' só é clonada uma vez por projeto (na primeira ocorrência da fase).
          if (cadence === 'unica') {
            const { data: already } = await supabase
              .from('project_deliverables')
              .select('id')
              .eq('project_id', proj.id)
              .eq('source_template_id', dt.id)
              .limit(1)
              .maybeSingle();
            if (already) continue;
          }

          // 'propria' guarda a sua própria cadência em project_deliverables;
          // o gerador diário (generate-deliverable-tasks) usa recurrence_week/weekday.
          // Para semanal/quinzenal mapeamos anchor_day -> recurrence_weekday.
          // Para mensal mapeamos anchor_day -> dia do mês via recurrence_label.
          const isPropria = cadence === 'propria';
          const propriaFields: Record<string, unknown> = {};
          if (isPropria) {
            const freq = (dt as any).recurrence_frequency || 'semanal';
            const anchor = (dt as any).recurrence_anchor_day ?? null;
            const wom = (dt as any).recurrence_week_of_month ?? null;
            propriaFields.is_recurring = true;
            if (freq === 'mensal' && wom && anchor) {
              // "Nª <weekday> do mês" → recurrence_week (1..4 ou -1 para última) + weekday (0..6, Dom=0)
              propriaFields.recurrence_label = `mensal:${wom === 5 ? 'ultima' : wom}:${anchor}`;
              propriaFields.recurrence_week = wom === 5 ? -1 : wom;
              // anchor 1=Seg..7=Dom → JS 1..6,0
              propriaFields.recurrence_weekday = anchor === 7 ? 0 : anchor;
            } else if (freq === 'mensal' && anchor) {
              propriaFields.recurrence_label = `mensal:${anchor}`;
            } else {
              propriaFields.recurrence_label = freq;
              if (anchor) propriaFields.recurrence_weekday = anchor === 7 ? 0 : anchor;
            }
            // 'unica' já clonou uma vez; 'propria' também só uma vez por projeto
            const { data: already } = await supabase
              .from('project_deliverables')
              .select('id')
              .eq('project_id', proj.id)
              .eq('source_template_id', dt.id)
              .limit(1)
              .maybeSingle();
            if (already) continue;
          }

          await supabase.from('project_deliverables').insert({
            project_id: proj.id,
            phase_id: newPhase.id,
            source_template_id: dt.id,
            name: dt.name,
            description: dt.description,
            deliverable_type: dt.deliverable_type || 'tarefa',
            sort_order: dt.sort_order ?? 0,
            responsible_type: dt.responsible_type || 'equipa',
            estimated_minutes: dt.estimated_minutes,
            portal_visible: dt.portal_visible ?? true,
            linked_sop_id: dt.linked_sop_id,
            meeting_title_template: dt.meeting_title_template,
            deadline: deadline.toISOString().slice(0, 10),
            planned_end: deadline.toISOString().slice(0, 10),
            status: 'pendente',
            ...propriaFields,
          });
        }

        cloned++;
      }
    }

    await logRun({ functionName: 'clone-recurring-phases', startedAt, status: 'success', context: { cloned, skipped, templates: templates?.length ?? 0 } });
    return new Response(JSON.stringify({ ok: true, cloned, skipped, templates: templates?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('clone-recurring-phases error', err);
    await logRun({ functionName: 'clone-recurring-phases', startedAt, status: 'failed', errorMessage: err?.message ?? String(err) });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});