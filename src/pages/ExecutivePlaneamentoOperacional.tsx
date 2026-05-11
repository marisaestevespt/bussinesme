import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarRange, CalendarDays } from 'lucide-react';
import { usePlanningData } from '@/hooks/usePlanningData';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { MonthlyGallery } from '@/components/planning/MonthlyGallery';
import { MonthlyCockpit } from '@/components/planning/cockpit/MonthlyCockpit';

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
  const initialMonth = hasMesParam ? mesParam - 1 : null;
  const cockpitMonth = hasMesParam ? mesParam : (year === new Date().getFullYear() ? new Date().getMonth() + 1 : 1);
  const cockpitYear = year;

  const setCockpit = (y: number, m: number) => {
    setYear(y);
    const sp = new URLSearchParams(params);
    sp.set('ano', String(y));
    sp.set('mes', String(m));
    setParams(sp, { replace: true });
  };

  const handleMonthChange = (monthIdx: number | null) => {
    const sp = new URLSearchParams(params);
    if (monthIdx === null) sp.delete('mes');
    else sp.set('mes', String(monthIdx + 1));
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
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader title="Cockpit Mensal" subtitle="Planeia, acompanha e fecha o mês — tudo numa vista" />

        <MonthlyCockpit year={cockpitYear} month={cockpitMonth} onChange={setCockpit} />

        <details className="hq-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
            Ver vista anual completa (trimestres + galeria mensal)
          </summary>
          <div className="p-4 space-y-8">

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

        {/* Trimestral */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Planeamento Trimestral</h2>
              <p className="text-xs text-muted-foreground">Os 4 trimestres do ano. Clica num para ver detalhe e retrospectiva.</p>
            </div>
          </div>
          <QuarterlyGallery planning={planning} year={year} />
        </section>

        {/* Mensal */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Planeamento e Gestão Mensal</h2>
              <p className="text-xs text-muted-foreground">Mês-a-mês: metas, capacidade da equipa e relatório.</p>
            </div>
          </div>
          <MonthlyGallery
            planning={planning}
            year={year}
            initialMonth={initialMonth}
            onMonthChange={handleMonthChange}
          />
        </section>
          </div>
        </details>
      </div>
    </AppLayout>
  );
}