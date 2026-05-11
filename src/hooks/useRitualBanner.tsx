import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

export type RitualType =
  | 'fecho_ano'
  | 'fecho_mes'
  | 'planear_mes'
  | 'inicio_semestre'
  | 'inicio_trimestre'
  | 'weekly_align'
  | 'vespera_weekly';

export interface RitualBannerConfig {
  type: RitualType;
  periodo: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  ctaSecundario?: { label: string; action: 'mark_complete' | 'dismiss' };
  tone: 'bordeaux' | 'navy' | 'gold';
}

const MONTH_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function isoToJsDay(iso: number): number { return iso === 7 ? 0 : iso; }

function isoWeekStart(d: Date): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

/**
 * Calcula qual ritual mostrar hoje, por ordem de prioridade.
 * Ver instrução do utilizador para ordem completa.
 */
export function useRitualBanner() {
  const qc = useQueryClient();
  const { settings } = useBusinessSettings();
  const weeklyAlignIso = (settings as any)?.weekly_align_day ?? 5;
  const weeklyAlignJsDay = isoToJsDay(weeklyAlignIso);
  const dayBeforeJs = (weeklyAlignJsDay - 1 + 7) % 7;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const dom = now.getDate();
  const dow = now.getDay();
  const todayISO = now.toISOString().slice(0, 10);

  // ── Carregar dependências ────────────────────────────────────────
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevMonthYear = m === 1 ? y - 1 : y;

  const reflections = useQuery({
    queryKey: ['ritual-banner-reflections', y, m, prevMonthYear, prevMonth],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('monthly_reflection')
        .select('year, month, revisto')
        .in('year', [y, prevMonthYear, y - 1])
        .in('month', [12, prevMonth, m]);
      return data as Array<{ year: number; month: number; revisto: boolean }> || [];
    },
    staleTime: 60_000,
  });

  const yearReviews = useQuery({
    queryKey: ['ritual-banner-year-reviews', y],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('year_review')
        .select('year, status')
        .in('year', [y - 1, y]);
      return data as Array<{ year: number; status: string }> || [];
    },
    staleTime: 60_000,
  });

  const weeklyNotes = useQuery({
    queryKey: ['ritual-banner-weekly', isoWeekStart(now)],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_align_notes')
        .select('id, week_start, key_points, decisions, blockers')
        .eq('week_start', isoWeekStart(now))
        .maybeSingle();
      return data as any | null;
    },
    staleTime: 60_000,
  });

  const states = useQuery({
    queryKey: ['ritual-banner-states'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ritual_banner_state')
        .select('*');
      return data as Array<{
        id: string; ritual_type: RitualType; periodo: string;
        dispensado_em: string | null; completado: boolean;
      }> || [];
    },
    staleTime: 30_000,
  });

  // ── Helpers ──────────────────────────────────────────────────────
  const refl = (yy: number, mm: number) =>
    reflections.data?.find(r => r.year === yy && r.month === mm);
  const stateOf = (type: RitualType, periodo: string) =>
    states.data?.find(s => s.ritual_type === type && s.periodo === periodo);

  const isDismissedToday = (type: RitualType, periodo: string) => {
    const s = stateOf(type, periodo);
    return s?.dispensado_em && s.dispensado_em.slice(0, 10) === todayISO;
  };
  const isCompleted = (type: RitualType, periodo: string) => {
    const s = stateOf(type, periodo);
    return s?.completado === true;
  };

  // ── Triggers ─────────────────────────────────────────────────────
  const candidates: RitualBannerConfig[] = [];

  // 1. Fecho de Ano: 31 Dez OU 1-5 Jan e Dezembro do ano anterior não revisto
  const yearTarget = (m === 12 && dom === 31) ? y : (m === 1 && dom <= 5 ? y - 1 : null);
  if (yearTarget !== null) {
    const yr = yearReviews.data?.find(r => r.year === yearTarget);
    const yearClosed = yr?.status === 'fechado';
    if (!yearClosed) {
      candidates.push({
        type: 'fecho_ano',
        periodo: String(yearTarget),
        title: `Fechaste o ano de ${yearTarget}?`,
        subtitle: `Antes de planear ${yearTarget + 1}, vale a pena olhar para trás.`,
        cta: `Fechar o ano de ${yearTarget}`,
        to: `/executive/fecho-de-ano/${yearTarget}`,
        ctaSecundario: { label: 'Mais tarde', action: 'dismiss' },
        tone: 'bordeaux',
      });
    }
  }

  // 2 + 3. Dias 1-3 do mês: fecho do mês anterior OU planear novo
  if (dom <= 3) {
    const prev = refl(prevMonthYear, prevMonth);
    const prevRevisto = !!prev?.revisto;
    const periodoPrev = `${prevMonthYear}-${String(prevMonth).padStart(2,'0')}`;
    const periodoAtual = `${y}-${String(m).padStart(2,'0')}`;
    if (!prevRevisto) {
      candidates.push({
        type: 'fecho_mes',
        periodo: periodoPrev,
        title: `Fechaste ${cap(MONTH_PT[prevMonth - 1])}?`,
        subtitle: `Leva 5 minutos. Faz diferença para planear ${cap(MONTH_PT[m - 1])} com clareza.`,
        cta: `Fechar ${cap(MONTH_PT[prevMonth - 1])}`,
        to: `/executive/planeamento/operacional?ano=${prevMonthYear}&mes=${prevMonth}&scroll=reflexao`,
        ctaSecundario: { label: 'Já está feito', action: 'mark_complete' },
        tone: 'navy',
      });
    } else {
      candidates.push({
        type: 'planear_mes',
        periodo: periodoAtual,
        title: `Está na hora de planear ${cap(MONTH_PT[m - 1])}.`,
        subtitle: 'Define as tuas prioridades, agenda e metas para o mês.',
        cta: `Planear ${cap(MONTH_PT[m - 1])}`,
        to: `/executive/planeamento/operacional?ano=${y}&mes=${m}`,
        ctaSecundario: { label: 'Mais tarde', action: 'dismiss' },
        tone: 'bordeaux',
      });
    }
  }

  // 4. Início de semestre: 1 Jan ou 1 Jul
  if (dom === 1 && (m === 1 || m === 7)) {
    const sem = m === 1 ? `${y}-S1` : `${y}-S2`;
    candidates.push({
      type: 'inicio_semestre',
      periodo: sem,
      title: 'Início de semestre — como estás vs. os objetivos do ano?',
      subtitle: 'Revê o progresso do semestre anterior e ajusta as metas do próximo.',
      cta: 'Rever objetivos',
      to: '/executive/planeamento/tatico?view=semestral',
      ctaSecundario: { label: 'Mais tarde', action: 'dismiss' },
      tone: 'gold',
    });
  }

  // 5. Início de trimestre (apenas se não houver semestre)
  if (dom === 1 && [1, 4, 7, 10].includes(m) && !(m === 1 || m === 7)) {
    const q = Math.ceil(m / 3);
    candidates.push({
      type: 'inicio_trimestre',
      periodo: `${y}-T${q}`,
      title: `Começa o T${q}. As tuas prioridades estão definidas?`,
      subtitle: 'Revê os objetivos do trimestre e define o que é prioritário.',
      cta: 'Ver planeamento trimestral',
      to: `/executive/planeamento/tatico?view=trimestral&quarter=T${q}`,
      ctaSecundario: { label: 'Mais tarde', action: 'dismiss' },
      tone: 'navy',
    });
  }

  // 6. Weekly Align (dia configurado)
  const weeklyPeriodo = isoWeekStart(now);
  if (dow === weeklyAlignJsDay) {
    const w = weeklyNotes.data;
    const hasContent = !!(w && (
      (Array.isArray(w.key_points) ? w.key_points.length : (w.key_points && Object.keys(w.key_points).length)) ||
      (Array.isArray(w.decisions) ? w.decisions.length : (w.decisions && Object.keys(w.decisions).length)) ||
      (Array.isArray(w.blockers) ? w.blockers.length : (w.blockers && Object.keys(w.blockers).length))
    ));
    if (!hasContent) {
      candidates.push({
        type: 'weekly_align',
        periodo: weeklyPeriodo,
        title: 'Hoje é o teu Weekly Align.',
        subtitle: '15 minutos para fechar a semana com clareza.',
        cta: 'Ir para o Weekly Align',
        to: '/executive/weekly-align',
        ctaSecundario: { label: 'Mais tarde', action: 'dismiss' },
        tone: 'bordeaux',
      });
    }
  }

  // 7. Véspera do Weekly Align
  if (dow === dayBeforeJs) {
    candidates.push({
      type: 'vespera_weekly',
      periodo: weeklyPeriodo,
      title: 'Amanhã é o teu Weekly Align.',
      subtitle: 'Prepara os pontos que queres rever.',
      cta: 'Ver Weekly Align',
      to: '/executive/weekly-align',
      ctaSecundario: { label: 'Dispensar', action: 'dismiss' },
      tone: 'navy',
    });
  }

  // ── Filtrar dispensados/completados e devolver o de maior prioridade ──
  const banner = candidates.find(c =>
    !isCompleted(c.type, c.periodo) && !isDismissedToday(c.type, c.periodo)
  ) || null;

  // ── Mutações ─────────────────────────────────────────────────────
  const upsertState = useMutation({
    mutationFn: async ({ type, periodo, dismiss, complete }: {
      type: RitualType; periodo: string; dismiss?: boolean; complete?: boolean;
    }) => {
      const existing = stateOf(type, periodo);
      const patch: any = {};
      if (dismiss) patch.dispensado_em = new Date().toISOString();
      if (complete) { patch.completado = true; patch.completado_em = new Date().toISOString(); }
      if (existing) {
        await (supabase as any).from('ritual_banner_state')
          .update(patch).eq('id', existing.id);
      } else {
        await (supabase as any).from('ritual_banner_state')
          .insert({ ritual_type: type, periodo, ...patch });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ritual-banner-states'] }),
  });

  const dismiss = (b: RitualBannerConfig) =>
    upsertState.mutate({ type: b.type, periodo: b.periodo, dismiss: true });
  const markComplete = (b: RitualBannerConfig) =>
    upsertState.mutate({ type: b.type, periodo: b.periodo, complete: true });

  return { banner, dismiss, markComplete };
}