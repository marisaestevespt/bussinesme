import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { PlanningOverviewView } from '@/components/planning/PlanningOverviewView';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle2, Clock, AlertTriangle, Compass, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExecutivePlaneamento() {
  const [year, setYear] = useState(new Date().getFullYear());
  const planning = usePlanningData(year);

  const stats = useMemo(() => {
    const objs = planning.allObjectives;
    const goals = planning.allGoals;
    const totalObjs = objs.length;
    const achieved = objs.filter((o: any) => o.status === 'atingido').length;
    const inProgress = objs.filter((o: any) => o.status === 'em_curso').length;
    const avgProgress = totalObjs > 0
      ? Math.round(objs.reduce((s: number, o: any) => s + planning.objectiveProgress(o), 0) / totalObjs)
      : 0;

    const monthsWithGoals = new Set(goals.filter((g: any) => MONTHS.includes(g.period)).map((g: any) => g.period)).size;
    const goalsAchieved = goals.filter((g: any) => g.status === 'atingido').length;
    const goalsWithDeviation = planning.getGoalsWithDeviations();

    return { totalObjs, achieved, inProgress, avgProgress, monthsWithGoals, totalGoals: goals.length, goalsAchieved, deviationCount: goalsWithDeviation.length };
  }, [planning.allObjectives, planning.allGoals]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Planeamento" subtitle={String(year)} />

        <div className="flex items-center justify-end gap-1 text-muted-foreground -mt-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano anterior" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium tabular-nums w-10 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ano seguinte" onClick={() => setYear(year + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Pulse — resumo rápido do ano */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Objetivos</p>
                <p className="text-lg font-bold">{stats.totalObjs}</p>
                <p className="text-[10px] text-muted-foreground">{stats.inProgress} em curso</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-success/10 p-2 text-success">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progresso médio</p>
                <p className="text-lg font-bold">{stats.avgProgress}%</p>
                <Progress value={stats.avgProgress} className="h-1.5 mt-1 w-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-accent-violet/10 p-2 text-accent-violet">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Metas atingidas</p>
                <p className="text-lg font-bold">{stats.goalsAchieved}<span className="text-sm font-normal text-muted-foreground">/{stats.totalGoals}</span></p>
                <p className="text-[10px] text-muted-foreground">{stats.totalGoals > 0 ? Math.round((stats.goalsAchieved / stats.totalGoals) * 100) : 0}% concluídas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-warning/10 p-2 text-warning">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobertura</p>
                <p className="text-lg font-bold">{stats.monthsWithGoals}<span className="text-sm font-normal text-muted-foreground">/12 meses</span></p>
                <p className="text-[10px] text-muted-foreground">{stats.totalGoals} metas definidas</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.deviationCount > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`rounded-lg p-2 ${stats.deviationCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Desvios</p>
                <p className="text-lg font-bold">{stats.deviationCount}</p>
                <p className="text-[10px] text-muted-foreground">{stats.deviationCount > 0 ? 'Metas abaixo do alvo' : 'Tudo no caminho'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View mode cards */}
        <div className="grid grid-cols-2 gap-3">
          {VIEW_CARDS.map(v => (
            <Card
              key={v.key}
              className={`group cursor-pointer border-2 bg-gradient-to-br ${v.color} transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${viewMode === v.key ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'shadow-md'}`}
              onClick={() => setViewMode(prev => prev === v.key ? null : v.key)}
            >
              <CardContent className="p-5 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow shrink-0 ${v.iconColor}`}>
                  <v.icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-foreground">{v.label}</span>
                  <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Back button when a view is active */}
        {viewMode !== null && viewMode !== 'visao' && (
          <Button variant="ghost" size="sm" onClick={() => setViewMode(null)} className="gap-2 text-muted-foreground hover:text-foreground -mt-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar à Visão Geral
          </Button>
        )}

        {viewMode === 'visao' && (
          <>
            <PlanningOverviewView planning={planning} year={year} stats={stats} />
            <div data-objectives-section>
              <PlanningObjectivesTab planning={planning} />
            </div>
          </>
        )}

        {viewMode === null && (
          <div data-objectives-section>
            <PlanningObjectivesTab planning={planning} />
          </div>
        )}

        {viewMode === 'previsibilidade' && <PrevisibilidadeView year={year} />}
      </div>
    </AppLayout>
  );
}

function PrevisibilidadeView({ year }: { year: number }) {
  const fin = useFinancialData({ expenses: true, recurring: true, documents: false, payroll: true, contractors: true });
  const com = useCommercialData(year);
  const sales = excludeCancelled(com.sales.data || []);
  return <FinPrevisibilidade fin={fin} currentYear={year} sales={sales} />;
}
