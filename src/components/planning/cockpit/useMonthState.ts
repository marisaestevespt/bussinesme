import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MonthState =
  | 'futuro'
  | 'a_planear'
  | 'em_curso'
  | 'por_rever'
  | 'revisto';

export const MONTH_NAMES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export function useMonthState(year: number, month: number /* 1-12 */) {
  const { data: reflection } = useQuery({
    queryKey: ['monthly_reflection', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_reflection')
        .select('id, revisto, revisto_em')
        .eq('year', year).eq('month', month)
        .maybeSingle();
      return data as { id?: string; revisto?: boolean; revisto_em?: string | null } | null;
    },
    staleTime: 60_000,
  });

  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();

  const isFuture = year > ty || (year === ty && month > tm);
  const isPast = year < ty || (year === ty && month < tm);
  const isCurrent = year === ty && month === tm;

  const lastDay = new Date(year, month, 0).getDate();
  const inClosingWindow =
    (isCurrent && td >= lastDay - 2) ||
    (year === ty && month === tm - 1 && td <= 3) ||
    (year === ty - 1 && tm === 1 && month === 12 && td <= 3);

  const inPlanningWindow = isCurrent && td <= 3;

  let state: MonthState;
  if (reflection?.revisto) state = 'revisto';
  else if (isFuture) state = 'futuro';
  else if (inPlanningWindow) state = 'a_planear';
  else if (isPast) state = 'por_rever';
  else state = 'em_curso';

  return {
    state,
    isFuture,
    isPast,
    isCurrent,
    inClosingWindow,
    inPlanningWindow,
    revisto: !!reflection?.revisto,
    canEditReflection: !isFuture, // futuro: bloqueado; passado/atual ok
    showCloseButton: inClosingWindow && !reflection?.revisto,
  };
}

export const STATE_LABELS: Record<MonthState, string> = {
  futuro: 'Planeamento futuro',
  a_planear: 'A planear',
  em_curso: 'Em curso',
  por_rever: 'Por rever',
  revisto: 'Revisto',
};

export const STATE_TONES: Record<MonthState, string> = {
  futuro: 'bg-muted text-muted-foreground',
  a_planear: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  em_curso: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  por_rever: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  revisto: 'bg-primary/15 text-primary',
};