import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft, ChevronRight, Compass, Target, CalendarRange,
  CalendarDays, Flame, ArrowRight,
} from 'lucide-react';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { HorizonsView } from '@/components/planning/HorizonsView';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { MonthlyCockpit } from '@/components/planning/cockpit/MonthlyCockpit';
import { StrategicSection } from '@/components/planning/StrategicSection';
import { BusinessPlanCanvas } from '@/components/planning/BusinessPlanCanvas';
import { Visao5AnosBlock } from '@/components/planning/Visao5AnosBlock';
import { WeekFocus } from '@/components/executive/cockpit/WeekFocus';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const QUARTERS = [
  { short: 'T1', monthIdx: [0,1,2] },
  { short: 'T2', monthIdx: [3,4,5] },
  { short: 'T3', monthIdx: [6,7,8] },
  { short: 'T4', monthIdx: [9,10,11] },
];

type Nivel = 'visao' | 'ano' | 'trimestre' | 'mes' | 'semana';
const NIVEIS: { value: Nivel; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: 'visao',      label: 'Visão',      icon: Compass,      desc: 'Plano de negócio, missão, 3-5 anos' },
  { value: 'ano',        label: 'Ano',        icon: Target,       desc: 'Objetivos anuais por área' },
  { value: 'trimestre',  label: 'Trimestre',  icon: CalendarRange,desc: 'Metas trimestrais (rocks)' },
  { value: 'mes',        label: 'Mês',        icon: CalendarDays, desc: 'Cockpit mensal e metas do mês' },
  { value: 'semana',     label: 'Semana',     icon: Flame,        desc: 'Foco da semana — OKRs e rotinas' },
];

/**
 * Planeamento — página única que substitui as 3 antigas (estratégico, tático,
 * operacional). Uma cascata clara em 5 níveis com tabs. O nível e o ano são
 * sincronizados via query string (`?nivel=...&ano=...&mes=...`).
 */
export default function PlaneamentoPage() {
  const [params, setParams] = useSearchParams();

  const yearParam = parseInt(params.get('ano') || '', 10);
  const initialYear = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const [year, setYear] = useState(initialYear);

  const nivel = (params.get('nivel') as Nivel) || 'ano';

  const planning = usePlanningData(year);

  const mesParam = parseInt(params.get('mes') || '', 10);
  const validMes = Number.isFinite(mesParam) && mesParam >= 1 && mesParam <= 12;
  const cockpitMonth = validMes ? mesParam : (year === new Date().getFullYear() ? new Date().getMonth() + 1 : 1);
  const activeQuarterIdx = Math.floor((cockpitMonth - 1) / 3);

  const updateParam = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined) sp.delete(k);
      else sp.set(k, v);
    });
    setParams(sp, { replace: true });
  };

  const setNivel = (next: Nivel) => updateParam({ nivel: next });
  const setYearAndUrl = (next: number) => { setYear(next); updateParam({ ano: String(next) }); };
  const setMonth = (y: number, m: number) => { setYear(y); updateParam({ ano: String(y), mes: String(m) }); };

  const stats = useMemo(() => {
    const objs = planning.allObjectives;
    const goals = planning.allGoals;
    const totalObjs = objs.length;
    const achieved = objs.filter((o: any) => o.status === 'atingido').length;
    const inProgress = objs.filter((o: any) => o.status === 'em_curso').length;
    const avgProgress = totalObjs > 0
      ? Math.round(objs.reduce((s: number, o: any) => s + planning.objectiveProgress(o), 0) / totalObjs)
      : 0;
    const deviationCount = planning.getGoalsWithDeviations().length;
    return { totalObjs, achieved, inProgress, avgProgress, deviationCount, totalGoals: goals.length };
  }, [planning]);

  const monthProgress = useMemo(() => MONTHS.map((m) => planning.getPeriodProgress([m])), [planning, year]);
  const quarterProgress = useMemo(() => QUARTERS.map((q) => planning.getPeriodProgress(q.monthIdx.map((i) => MONTHS[i]))), [planning, year]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader
            title="Planeamento"
            subtitle="Visão → Ano → Trimestre → Mês → Semana"
          />
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano anterior" onClick={() => setYearAndUrl(year - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium tabular-nums w-10 text-center">{year}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano seguinte" onClick={() => setYearAndUrl(year + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Cascade tabs */}
        <Tabs value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
          <TabsList className="grid grid-cols-5 w-full">
            {NIVEIS.map((n) => {
              const Icon = n.icon;
              return (
                <TabsTrigger key={n.value} value={n.value} className="flex flex-col items-center gap-0.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{n.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground hidden md:block">{n.desc}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Mini-breadcrumb da cascata */}
          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap">
            {NIVEIS.map((n, i) => (
              <span key={n.value} className="flex items-center gap-1">
                <button
                  onClick={() => setNivel(n.value)}
                  className={cn(
                    'hover:text-foreground hq-transition',
                    n.value === nivel && 'text-foreground font-semibold'
                  )}
                >
                  {n.label}
                </button>
                {i < NIVEIS.length - 1 && <ArrowRight className="h-3 w-3 opacity-50" />}
              </span>
            ))}
          </div>

          {/* VISÃO */}
          <TabsContent value="visao" className="mt-6 space-y-8">
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Plano de Negócio</h2>
              <BusinessPlanCanvas />
            </section>
            <div className="pt-6 border-t border-border/60">
              <StrategicSection />
            </div>
            <div className="pt-6 border-t border-border/60">
              <Visao5AnosBlock />
            </div>
          </TabsContent>

          {/* ANO */}
          <TabsContent value="ano" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Objetivos" value={String(stats.totalObjs)} hint={`${stats.inProgress} em curso`} />
              <StatCard label="Progresso médio" value={`${stats.avgProgress}%`} progress={stats.avgProgress} />
              <StatCard label="Atingidos" value={`${stats.achieved}/${stats.totalObjs}`} />
              <StatCard label="Desvios" value={String(stats.deviationCount)} tone={stats.deviationCount > 0 ? 'destructive' : 'muted'} />
            </div>

            <Card className="hq-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Objetivos do ano</p>
                    <p className="text-xs text-muted-foreground">Define o que tens de fazer este ano, agrupado por área.</p>
                  </div>
                </div>
                <PlanningObjectivesTab planning={planning} layout="gallery" hideCascade compact />
              </CardContent>
            </Card>

            <Card className="hq-card">
              <CardContent className="pt-5">
                <div className="mb-3">
                  <p className="text-sm font-semibold">Desmembramento por horizonte</p>
                  <p className="text-xs text-muted-foreground">Como os objetivos anuais se traduzem em metas trimestrais e mensais.</p>
                </div>
                <HorizonsView planning={planning} year={year} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRIMESTRE */}
          <TabsContent value="trimestre" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {QUARTERS.map((q, i) => {
                const p = quarterProgress[i];
                const isActive = i === activeQuarterIdx;
                return (
                  <Card key={q.short} className={cn('hq-card', isActive && 'border-primary/60 ring-1 ring-primary/30')}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{q.short}</span>
                        <span className="text-sm font-bold tabular-nums">{p.pct}%</span>
                      </div>
                      <Progress value={p.pct} className="h-1" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <QuarterlyGallery planning={planning} year={year} initialQuarter={activeQuarterIdx} />
          </TabsContent>

          {/* MÊS */}
          <TabsContent value="mes" className="mt-6 space-y-4">
            <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5">
              {MONTHS.map((m, i) => {
                const active = i + 1 === cockpitMonth;
                const p = monthProgress[i];
                return (
                  <button
                    key={m}
                    onClick={() => setMonth(year, i + 1)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md px-1 py-1.5 text-[10px] hq-transition border',
                      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/40 hover:border-primary/40 hover:bg-muted/40'
                    )}
                  >
                    <span className="font-semibold">{m.slice(0,3)}</span>
                    <span className={cn('tabular-nums', active ? 'opacity-90' : 'text-muted-foreground')}>{p.pct}%</span>
                  </button>
                );
              })}
            </div>
            <MonthlyCockpit year={year} month={cockpitMonth} onChange={setMonth} />
          </TabsContent>

          {/* SEMANA */}
          <TabsContent value="semana" className="mt-6 space-y-4">
            <Card className="hq-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Foco da semana</p>
                    <p className="text-xs text-muted-foreground">As 1-3 ações que mais movem as metas do mês. OKRs operacionais.</p>
                  </div>
                </div>
                <WeekFocus />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({
  label, value, hint, progress, tone = 'default',
}: { label: string; value: string; hint?: string; progress?: number; tone?: 'default' | 'destructive' | 'muted' }) {
  const toneCls =
    tone === 'destructive' ? 'border-destructive/40'
    : tone === 'muted' ? 'opacity-90'
    : '';
  return (
    <Card className={cn('hq-card', toneCls)}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
        {progress !== undefined && <Progress value={progress} className="h-1 mt-1.5" />}
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}