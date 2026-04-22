import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { MonthlyGallery } from '@/components/planning/MonthlyGallery';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { SemesterGallery } from '@/components/planning/SemesterGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar, BarChart3, PieChart, Target, TrendingUp, CheckCircle2, Clock, ArrowLeft, AlertTriangle, LineChart } from 'lucide-react';
import { YearSelector } from '@/components/YearSelector';
import { FinPrevisibilidade } from '@/components/financial/FinPrevisibilidade';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { excludeCancelled } from '@/lib/utils';

type ViewMode = 'mensal' | 'trimestral' | 'semestral' | 'metas' | 'previsibilidade' | null;

const VIEW_CARDS: { key: Exclude<ViewMode, null>; label: string; desc: string; icon: typeof Calendar; iconColor: string; color: string }[] = [
  { key: 'mensal', label: 'Mensal', desc: '12 meses', icon: Calendar, iconColor: 'text-success', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
  { key: 'trimestral', label: 'Trimestral', desc: '4 trimestres', icon: BarChart3, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { key: 'semestral', label: 'Semestral', desc: '2 semestres', icon: PieChart, iconColor: 'text-warning', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { key: 'metas', label: 'Metas', desc: 'Todas as metas', icon: Target, iconColor: 'text-destructive', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
  { key: 'previsibilidade', label: 'Previsibilidade', desc: 'Cashflow anual', icon: LineChart, iconColor: 'text-primary', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
];

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExecutivePlaneamento() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>(null);
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
        <PageHeader title="Planeamento Anual" subtitle={String(year)} />

        <YearSelector year={year} onChange={setYear} />

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
              <div className="rounded-lg bg-emerald-500/10 p-2 text-success">
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
              <div className="rounded-lg bg-violet-500/10 p-2 text-violet-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atingidos</p>
                <p className="text-lg font-bold">{stats.achieved}<span className="text-sm font-normal text-muted-foreground">/{stats.totalObjs}</span></p>
                <p className="text-[10px] text-muted-foreground">{stats.goalsAchieved} metas atingidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2 text-warning">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        {viewMode !== null && (
          <Button variant="ghost" size="sm" onClick={() => setViewMode(null)} className="gap-1.5 text-muted-foreground hover:text-foreground -mt-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Planeamento
          </Button>
        )}

        {/* Default: Objetivos */}
        {viewMode === null && (
          <PlanningObjectivesTab planning={planning} />
        )}

        {viewMode === 'mensal' && <MonthlyGallery planning={planning} year={year} />}
        {viewMode === 'trimestral' && <QuarterlyGallery planning={planning} year={year} />}
        {viewMode === 'semestral' && <SemesterGallery planning={planning} year={year} />}
        {viewMode === 'metas' && <PlanningGoalsTab planning={planning} viewMode="metas" />}
      </div>
    </AppLayout>
  );
}
