import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { usePlanningData } from '@/hooks/usePlanningData';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { PlanningOverviewView } from '@/components/planning/PlanningOverviewView';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { AllGoalsList } from '@/components/planning/AllGoalsList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle2, Clock, AlertTriangle, ChevronLeft, ChevronRight, TrendingUp, Sparkles, Compass, ChevronDown, Plus, ListChecks, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExecutivePlaneamento() {
  const [year, setYear] = useState(new Date().getFullYear());
  const planning = usePlanningData(year);
  const navigate = useNavigate();
  const [allGoalsOpen, setAllGoalsOpen] = useState(false);
  const [newObjOpen, setNewObjOpen] = useState(false);

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
          {year <= new Date().getFullYear() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-3 h-7 text-xs"
              onClick={() => navigate(`/executive/fecho-de-ano/${year}`)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Fecho de {year}
            </Button>
          )}
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

        {/* Objetivos anuais — sobem para o topo, mais visíveis */}
        <Card className="hq-card" data-objectives-section>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold">Objetivos do ano</p>
                  <p className="text-xs text-muted-foreground">Clica num objetivo para editar no painel lateral.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => setNewObjOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo objetivo
              </Button>
            </div>
            <PlanningObjectivesTab
              planning={planning}
              showHeaderButton={false}
              newDialogOpen={newObjOpen}
              onNewDialogChange={setNewObjOpen}
              layout="gallery"
              hideCascade
              compact
            />
          </CardContent>
        </Card>

        <PlanningOverviewView planning={planning} year={year} stats={stats} />

        {/* Todas as metas — colapsável, vista global */}
        <Collapsible open={allGoalsOpen} onOpenChange={setAllGoalsOpen}>
          <Card className="hq-card">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 hq-transition rounded-xl text-left">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ListChecks className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Todas as metas do ano</p>
                    <p className="text-xs text-muted-foreground">Vista plana de todas as metas pequenas, agrupadas por período.</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground hq-transition ${allGoalsOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <AllGoalsList planning={planning} />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Estratégia 3-5 anos vive no Plano de Negócio (oculto aqui) */}
      </div>
    </AppLayout>
  );
}
