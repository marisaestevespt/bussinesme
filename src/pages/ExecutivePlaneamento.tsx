import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { usePlanningData, planStatusLabel } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { BackNavigation } from '@/components/BackNavigation';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { MonthlyGallery } from '@/components/planning/MonthlyGallery';
import { QuarterlyGallery } from '@/components/planning/QuarterlyGallery';
import { SemesterGallery } from '@/components/planning/SemesterGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, BarChart3, PieChart, Target, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { YearSelector } from '@/components/YearSelector';

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

    return { totalObjs, achieved, inProgress, avgProgress, monthsWithGoals, totalGoals: goals.length, goalsAchieved };
  }, [planning.allObjectives, planning.allGoals]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Planeamento Anual" subtitle={String(year)} />

        <YearSelector year={year} onChange={setYear} />

        {/* Pulse — resumo rápido do ano */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
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
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobertura</p>
                <p className="text-lg font-bold">{stats.monthsWithGoals}<span className="text-sm font-normal text-muted-foreground">/12 meses</span></p>
                <p className="text-[10px] text-muted-foreground">{stats.totalGoals} metas definidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de navegação */}
        <Tabs defaultValue="objetivos" className="space-y-6">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="objetivos" className="gap-1.5">
              <Target className="h-3.5 w-3.5" /> Objetivos
            </TabsTrigger>
            <TabsTrigger value="mensal" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Mensal
            </TabsTrigger>
            <TabsTrigger value="trimestral" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Trimestral
            </TabsTrigger>
            <TabsTrigger value="semestral" className="gap-1.5">
              <PieChart className="h-3.5 w-3.5" /> Semestral
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Metas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="objetivos">
            <PlanningObjectivesTab planning={planning} />
          </TabsContent>

          <TabsContent value="mensal">
            <MonthlyGallery planning={planning} year={year} />
          </TabsContent>

          <TabsContent value="trimestral">
            <QuarterlyGallery planning={planning} year={year} />
          </TabsContent>

          <TabsContent value="semestral">
            <SemesterGallery planning={planning} year={year} />
          </TabsContent>

          <TabsContent value="metas">
            <PlanningGoalsTab planning={planning} viewMode="metas" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
