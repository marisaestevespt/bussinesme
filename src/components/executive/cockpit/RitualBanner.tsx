import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Target, Compass, ArrowRight } from 'lucide-react';
import { format, getDay, getDate, getMonth } from 'date-fns';
import { pt } from 'date-fns/locale';

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
  const now = new Date();
  const dow = getDay(now); // 0=dom, 1=seg ... 5=sex
  const dom = getDate(now);
  const month = getMonth(now) + 1; // 1-12

  const isQuarterStart = [1, 4, 7, 10].includes(month) && dom <= 3;
  const isMonthStart = !isQuarterStart && dom <= 3;
  const isFriday = dow === 5;
  const isMonday = dow === 1;

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
      cta: 'Abrir Planeamento',
      to: '/executive/planeamento',
      accent: 'from-primary/10 via-primary/5 to-transparent border-primary/30',
    };
  } else if (isFriday) {
    config = {
      icon: CalendarCheck,
      title: 'Sexta-feira — está na hora do Weekly Align',
      subtitle: 'Revê a semana, alinha decisões e prepara a próxima.',
      cta: 'Fazer Weekly Align',
      to: '/executive/weekly-align',
      accent: 'from-warning/10 via-warning/5 to-transparent border-warning/30',
    };
  } else if (isMonday) {
    config = {
      icon: CalendarCheck,
      title: 'Segunda-feira — alinha o foco da semana',
      subtitle: 'Define top 3 prioridades e revê saúde por área.',
      cta: 'Abrir Weekly Align',
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