import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Target, Calendar, Briefcase,
  Megaphone, Users, Settings2, NotebookPen, CheckCircle2,
} from 'lucide-react';
import { CockpitSection } from './CockpitSection';
import { BlockObjetivos } from './BlockObjetivos';
import { BlockAgenda } from './BlockAgenda';
import { BlockComercial } from './BlockComercial';
import { BlockMarketing } from './BlockMarketing';
import { BlockClientes } from './BlockClientes';
import { BlockOperacao } from './BlockOperacao';
import { MonthlyReflectionCard } from '../MonthlyReflectionCard';
import { MONTH_NAMES_PT, useMonthState, STATE_LABELS, STATE_TONES } from './useMonthState';
import { cn } from '@/lib/utils';

interface Props {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export function MonthlyCockpit({ year, month, onChange }: Props) {
  const reflectionRef = useRef<HTMLDivElement>(null);
  const { state, isFuture, showCloseButton } = useMonthState(year, month);

  const prev = () => {
    const m = month - 1;
    if (m < 1) onChange(year - 1, 12);
    else onChange(year, m);
  };
  const next = () => {
    const m = month + 1;
    if (m > 12) onChange(year + 1, 1);
    else onChange(year, m);
  };

  const monthName = MONTH_NAMES_PT[month - 1];
  const stateBadge = (
    <Badge variant="secondary" className={cn('text-[10px]', STATE_TONES[state])}>
      {STATE_LABELS[state]}
    </Badge>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{monthName} {year}</h1>
            {stateBadge}
          </div>
          <p className="text-xs text-muted-foreground">
            {isFuture ? 'Mês futuro — define metas e prepara o terreno.' : 'Cockpit do mês: planeia, acompanha e fecha.'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next} aria-label="Mês seguinte">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {showCloseButton && (
          <Button
            size="sm"
            onClick={() => reflectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Fechar mês
          </Button>
        )}
      </div>

      {/* Blocks */}
      <CockpitSection
        storageKey={`b1:${year}-${month}`}
        icon={<Target className="h-4 w-4" />}
        title="Objetivos do mês"
        subtitle="Metas mensais por área (8) com semáforo automático"
      >
        <BlockObjetivos year={year} month={month} />
      </CockpitSection>

      <CockpitSection
        storageKey={`b2:${year}-${month}`}
        icon={<Calendar className="h-4 w-4" />}
        title="Agenda do mês"
        subtitle="Eventos, reuniões e deadlines"
      >
        {isFuture
          ? <p className="text-xs text-muted-foreground">Planeamento futuro — agenda ainda vazia.</p>
          : <BlockAgenda year={year} month={month} />}
      </CockpitSection>

      <CockpitSection
        storageKey={`b3:${year}-${month}`}
        icon={<Briefcase className="h-4 w-4" />}
        title="Comercial e Produtos"
        subtitle="KPIs, vendas por produto, pipeline e portefólio ativo"
      >
        <BlockComercial year={year} month={month} />
      </CockpitSection>

      <CockpitSection
        storageKey={`b4:${year}-${month}`}
        icon={<Megaphone className="h-4 w-4" />}
        title="Marketing"
        subtitle="KPIs, calendário de conteúdo, funis e campanhas"
      >
        <BlockMarketing year={year} month={month} />
      </CockpitSection>

      <CockpitSection
        storageKey={`b5:${year}-${month}`}
        icon={<Users className="h-4 w-4" />}
        title="Clientes"
        subtitle="Portefólio, renovações, onboardings e alertas"
      >
        <BlockClientes year={year} month={month} />
      </CockpitSection>

      <CockpitSection
        storageKey={`b6:${year}-${month}`}
        icon={<Settings2 className="h-4 w-4" />}
        title="Operação"
        subtitle="Projetos, capacidade, análise por área/cliente e tarefas atrasadas"
      >
        <BlockOperacao year={year} month={month} />
      </CockpitSection>

      <div ref={reflectionRef}>
        <CockpitSection
          storageKey={`b8:${year}-${month}`}
          icon={<NotebookPen className="h-4 w-4" />}
          title="Reflexão e fecho"
          subtitle="Disponível no fim do mês ou nos primeiros 3 dias do mês seguinte"
          defaultOpen={false}
        >
          {isFuture ? (
            <p className="text-xs text-muted-foreground">Disponível no final do mês.</p>
          ) : (
            <MonthlyReflectionCard year={year} month={month} />
          )}
        </CockpitSection>
      </div>
    </div>
  );
}