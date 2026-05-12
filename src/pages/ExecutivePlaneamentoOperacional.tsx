import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarRange, ChevronDown } from 'lucide-react';
import { usePlanningData } from '@/hooks/usePlanningData';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { MonthlyCockpit } from '@/components/planning/cockpit/MonthlyCockpit';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const QUARTERS = [
  { short: 'T1', label: '1º Trimestre', monthIdx: [0, 1, 2] },
  { short: 'T2', label: '2º Trimestre', monthIdx: [3, 4, 5] },
  { short: 'T3', label: '3º Trimestre', monthIdx: [6, 7, 8] },
  { short: 'T4', label: '4º Trimestre', monthIdx: [9, 10, 11] },
];

/**
 * Planeamento Operacional — gere a operação.
 *
 * Layout pedido:
 *   - Em cima: vista trimestral (overview do ano em 4 blocos com drill-down).
 *   - Em baixo: galeria mensal (12 meses, mantém o layout atual com drill-down
 *     para MonthDetailView, que já agrega metas, capacidade e relatório).
 */
export default function ExecutivePlaneamentoOperacional() {
  const [params, setParams] = useSearchParams();
  const yearParam = parseInt(params.get('ano') || '', 10);
  const initialYear = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const [year, setYear] = useState(initialYear);
  const planning = usePlanningData(year);

  const mesParam = parseInt(params.get('mes') || '', 10);
  const hasMesParam = Number.isFinite(mesParam) && mesParam >= 1 && mesParam <= 12;
  const cockpitMonth = hasMesParam ? mesParam : (year === new Date().getFullYear() ? new Date().getMonth() + 1 : 1);
  const cockpitYear = year;
  const activeQuarterIdx = Math.floor((cockpitMonth - 1) / 3);
  const [quarterDetailOpen, setQuarterDetailOpen] = useState(false);

  const monthProgress = useMemo(
    () => MONTHS.map((name) => planning.getPeriodProgress([name])),
    [planning, year]
  );
  const quarterProgress = useMemo(
    () => QUARTERS.map((q) => planning.getPeriodProgress(q.monthIdx.map((i) => MONTHS[i]))),
    [planning, year]
  );

  const setCockpit = (y: number, m: number) => {
    setYear(y);
    const sp = new URLSearchParams(params);
    sp.set('ano', String(y));
    sp.set('mes', String(m));
    setParams(sp, { replace: true });
  };

  const updateYear = (next: number) => {
    setYear(next);
    const sp = new URLSearchParams(params);
    sp.set('ano', String(next));
    setParams(sp, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Cockpit Mensal" subtitle="Planeia, acompanha e fecha o mês — tudo numa vista" />

        {/* Year switcher */}
        <div className="flex items-center justify-end gap-1 text-muted-foreground -mt-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano anterior" onClick={() => updateYear(year - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium tabular-nums w-10 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano seguinte" onClick={() => updateYear(year + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Quarter strip — navega por trimestre e seleciona mês para o cockpit */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUARTERS.map((q, qi) => {
            const qProg = quarterProgress[qi];
            const isActive = qi === activeQuarterIdx;
            return (
              <Card
                key={q.short}
                className={cn('hq-card hq-transition', isActive && 'border-primary/60 ring-1 ring-primary/30')}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{q.short}</span>
                    <span className="text-sm font-bold tabular-nums">{qProg.pct}%</span>
                  </div>
                  <Progress value={qProg.pct} className="h-1" />
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    {q.monthIdx.map((mi) => {
                      const mActive = mi + 1 === cockpitMonth;
                      const mProg = monthProgress[mi];
                      return (
                        <button
                          key={mi}
                          onClick={() => setCockpit(year, mi + 1)}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-md px-1 py-1.5 text-[10px] hq-transition border',
                            mActive
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border/40 hover:border-primary/40 hover:bg-muted/40'
                          )}
                        >
                          <span className="font-semibold">{MONTH_SHORT[mi]}</span>
                          <span className={cn('tabular-nums', mActive ? 'opacity-90' : 'text-muted-foreground')}>{mProg.pct}%</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Cockpit do mês selecionado */}
        <MonthlyCockpit year={cockpitYear} month={cockpitMonth} onChange={setCockpit} />

        {/* Retrospectiva trimestral — detalhe do trimestre activo, sem duplicar a galeria mensal */}
        <Collapsible open={quarterDetailOpen} onOpenChange={setQuarterDetailOpen}>
          <Card className="hq-card">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 hq-transition rounded-xl text-left">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Retrospectiva trimestral — {QUARTERS[activeQuarterIdx].label}</p>
                    <p className="text-xs text-muted-foreground">Análise consolidada do trimestre, áreas e ajustes para o próximo.</p>
                  </div>
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground hq-transition', quarterDetailOpen && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <QuarterlyGallery planning={planning} year={year} initialQuarter={activeQuarterIdx} />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppLayout>
  );
}