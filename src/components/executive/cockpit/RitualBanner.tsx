import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Target, Compass, ArrowRight } from 'lucide-react';
import { format, getDay, getDate, getMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const DAY_NAMES_FEM = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** Convert ISO weekday (1=Mon..7=Sun) to JS getDay (0=Sun..6=Sat). */
function isoToJsDay(iso: number): number {
  return iso === 7 ? 0 : iso;
}

/**
 * Banner contextual: muda conforme o dia/mês para empurrar o CEO
 * para o ritual certo na altura certa.
 *
 * Hierarquia (primeiro que aplique):
 * 1. Início de trimestre (mês 1, 4, 7, 10, dias 1-3) → Business Plan
 * 2. Início do mês (dias 1-3) → Planeamento mensal
 * 3. Sexta-feira → Weekly Align
 * 4. Segunda-feira → Weekly Align (preparar a semana)
 * 5. Outros dias → nada (banner não aparece)
 */
export function RitualBanner() {
  const { settings } = useBusinessSettings();
  const weeklyAlignIso = (settings as any)?.weekly_align_day ?? 5; // default sexta
  const weeklyAlignJsDay = isoToJsDay(weeklyAlignIso);
  const dayBeforeJs = (weeklyAlignJsDay - 1 + 7) % 7;

  const now = new Date();
  const dow = getDay(now); // 0=dom, 1=seg ... 6=sáb
  const dom = getDate(now);
  const month = getMonth(now) + 1; // 1-12

  const isQuarterStart = [1, 4, 7, 10].includes(month) && dom <= 3;
  const isMonthStart = !isQuarterStart && dom <= 3;
  const isWeeklyAlignDay = dow === weeklyAlignJsDay;
  const isDayBefore = dow === dayBeforeJs;

  let config: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    cta: string;
    to: string;
    accent: string;
  } | null = null;

  if (isQuarterStart) {
    config = {
      icon: Compass,
      title: 'Início de trimestre — revê a tua estratégia',
      subtitle: 'Avalia o modelo de negócio, visão e objetivos do ano.',
      cta: 'Abrir Plano de Negócio',
      to: '/executive/business-plan',
      accent: 'from-accent-violet/10 via-accent-violet/5 to-transparent border-accent-violet/30',
    };
  } else if (isMonthStart) {
    config = {
      icon: Target,
      title: `Mês novo — define o foco de ${format(now, 'MMMM', { locale: pt })}`,
      subtitle: 'Revê metas mensais, capacidade da equipa e prioridades.',
      cta: `Abrir ${format(now, 'MMMM', { locale: pt })}`,
      // Abre directamente o detalhe do mês corrente (regra: ver mem://design/ritual-banner-targets.md)
      to: `/executive/planeamento/operacional?ano=${now.getFullYear()}&mes=${month}`,
      accent: 'from-primary/10 via-primary/5 to-transparent border-primary/30',
    };
  } else if (isWeeklyAlignDay) {
    const dayName = DAY_NAMES_FEM[weeklyAlignJsDay];
    const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    config = {
      icon: CalendarCheck,
      title: `${cap} — está na hora do Weekly Align`,
      subtitle: 'Revê a semana, alinha decisões e prepara a próxima.',
      cta: 'Fazer Weekly Align',
      to: '/executive/weekly-align',
      accent: 'from-warning/10 via-warning/5 to-transparent border-warning/30',
    };
  } else if (isDayBefore) {
    const dayName = DAY_NAMES_FEM[weeklyAlignJsDay];
    config = {
      icon: CalendarCheck,
      title: `Amanhã é o teu Weekly Align (${dayName})`,
      subtitle: 'Aproveita para reunir notas, decisões e bloqueios da semana.',
      cta: 'Preparar Weekly Align',
      to: '/executive/weekly-align',
      accent: 'from-info/10 via-info/5 to-transparent border-info/30',
    };
  }

  if (!config) return null;

  const Icon = config.icon;

  return (
    <Card className={`bg-gradient-to-r ${config.accent} border`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shrink-0 shadow-sm">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{config.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to={config.to}>
            {config.cta}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}