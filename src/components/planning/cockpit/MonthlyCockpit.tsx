import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChevronLeft, ChevronRight, Target, Calendar, Briefcase,
  Megaphone, Users, Settings2, NotebookPen, CheckCircle2,
  Package, Wallet, UserCog, Sparkles, Compass, LayoutGrid, Flag,
} from 'lucide-react';
import { CockpitSection } from './CockpitSection';
import { BlockObjetivos } from './BlockObjetivos';
import { BlockMonthlyKRs } from './BlockMonthlyKRs';
import { BlockAgenda } from './BlockAgenda';
import { BlockComercial } from './BlockComercial';
import { BlockMarketing } from './BlockMarketing';
import { BlockClientes } from './BlockClientes';
import { BlockOperacao } from './BlockOperacao';
import { BlockProdutos } from './BlockProdutos';
import { BlockFinanceiro } from './BlockFinanceiro';
import { BlockEquipa } from './BlockEquipa';
import { BlockGeral } from './BlockGeral';
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
  const [openSignal, setOpenSignal] = useState(0);
  const [sub, setSub] = useState<'foco' | 'areas' | 'fecho'>('foco');

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
            onClick={() => {
              setSub('fecho');
              setOpenSignal((s) => s + 1);
              setTimeout(() => reflectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Fechar mês
          </Button>
        )}
      </div>

      {/* Sub-tabs do Mês — 3 super-blocos */}
      <Tabs value={sub} onValueChange={(v) => setSub(v as typeof sub)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="foco" className="gap-1.5 text-xs">
            <Compass className="h-3.5 w-3.5" /> Foco do mês
          </TabsTrigger>
          <TabsTrigger value="areas" className="gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" /> Áreas do negócio
          </TabsTrigger>
          <TabsTrigger value="fecho" className="gap-1.5 text-xs">
            <Flag className="h-3.5 w-3.5" /> Fecho e reflexão
          </TabsTrigger>
        </TabsList>

        {/* FOCO — o que move este mês */}
        <TabsContent value="foco" className="mt-4 space-y-3">
          <CockpitSection
            storageKey={`b0:${year}-${month}`}
            icon={<Target className="h-4 w-4" />}
            title="Metas dos objetivos anuais"
            subtitle="Progresso das metas ligadas aos objetivos do ano"
          >
            <BlockMonthlyKRs year={year} month={month} />
          </CockpitSection>

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
        </TabsContent>

        {/* ÁREAS — drill-down por departamento */}
        <TabsContent value="areas" className="mt-4 space-y-3">
          <CockpitSection
            storageKey={`b3:${year}-${month}`}
            icon={<Briefcase className="h-4 w-4" />}
            title="Comercial"
            subtitle="Metas, vendas, pipeline e portefólio ativo"
          >
            <BlockComercial year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b3b:${year}-${month}`}
            icon={<Package className="h-4 w-4" />}
            title="Produtos"
            subtitle="Metas por produto e desempenho do portefólio"
          >
            <BlockProdutos year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b4:${year}-${month}`}
            icon={<Megaphone className="h-4 w-4" />}
            title="Marketing"
            subtitle="Metas, calendário de conteúdo, funis e campanhas"
          >
            <BlockMarketing year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b5:${year}-${month}`}
            icon={<Users className="h-4 w-4" />}
            title="Clientes"
            subtitle="Metas, portefólio, renovações, onboardings e alertas"
          >
            <BlockClientes year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b6:${year}-${month}`}
            icon={<Settings2 className="h-4 w-4" />}
            title="Operação"
            subtitle="Metas, projetos, capacidade e tarefas atrasadas"
          >
            <BlockOperacao year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b6b:${year}-${month}`}
            icon={<Wallet className="h-4 w-4" />}
            title="Financeiro"
            subtitle="Metas financeiras — faturação, MRR, custos, break-even"
          >
            <BlockFinanceiro year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b6c:${year}-${month}`}
            icon={<UserCog className="h-4 w-4" />}
            title="Equipa"
            subtitle="Metas da equipa — capacidade, ocupação, rotação"
          >
            <BlockEquipa year={year} month={month} />
          </CockpitSection>

          <CockpitSection
            storageKey={`b6d:${year}-${month}`}
            icon={<Sparkles className="h-4 w-4" />}
            title="Geral do negócio"
            subtitle="Metas transversais — MRR/faturação, capacidade, objetivos, referências"
          >
            <BlockGeral year={year} month={month} />
          </CockpitSection>
        </TabsContent>

        {/* FECHO — reflexão final do mês */}
        <TabsContent value="fecho" className="mt-4">
          <div ref={reflectionRef}>
            <CockpitSection
              storageKey={`b8:${year}-${month}`}
              icon={<NotebookPen className="h-4 w-4" />}
              title="Reflexão e fecho"
              subtitle="Escreve a reflexão e marca o mês como concluído"
              defaultOpen={true}
              openSignal={openSignal}
            >
              {isFuture ? (
                <p className="text-xs text-muted-foreground">Disponível no final do mês.</p>
              ) : (
                <MonthlyReflectionCard year={year} month={month} />
              )}
            </CockpitSection>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}