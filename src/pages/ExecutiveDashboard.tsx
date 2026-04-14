import { useState } from 'react';
import { differenceInDays } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Target, CalendarCheck, Lightbulb, Rocket, Clock, Trash2, Plus, Briefcase, MessageSquareHeart, AlertTriangle, Calculator, Zap, FileText } from 'lucide-react';
import { MonthlyReportSection } from '@/components/executive/MonthlyReportSection';

import { useExecutiveData } from '@/hooks/useExecutiveData';
import { usePlanningData, planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { ExecutiveKpiAlerts } from '@/components/executive/ExecutiveKpiAlerts';
import { StrategicMetricsSection } from '@/components/executive/StrategicMetricsSection';

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExecutiveDashboard() {
  const exec = useExecutiveData(currentYear);
  const planning = usePlanningData(currentYear);
  const [newTask, setNewTask] = useState('');

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    exec.addBrainDump.mutate(newTask.trim());
    setNewTask('');
  };

  const currentMonthName = MONTH_NAMES[currentMonth - 1];
  const monthGoals = planning.allGoals.filter(g => g.period === currentMonthName);
  const brainDumpItems = exec.brainDump.data || [];
  const pendingItems = brainDumpItems.filter(i => !i.completed);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cover Header */}
        <PageHeader title="Executive Room" subtitle="Planeamento estratégico & visão do negócio" />

        {/* KPIs — resumo executivo logo no topo */}
        <ExecutiveKpiAlerts />

        {/* Strategic Business Health Metrics */}
        <StrategicMetricsSection />




        {/* Navigation Cards — 2 columns */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Gestão</CardTitle>
                  <p className="text-xs text-muted-foreground">Planeamento & operações</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link to="/executive/planeamento" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <Target className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Planeamento Anual
              </Link>
              <Link to="/executive/weekly-align" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <CalendarCheck className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Weekly Align
              </Link>
              <Link to="/executive/recommendations" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <MessageSquareHeart className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Caixa das Recomendações
              </Link>
              <Link to="/executive/processos" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Processos da Administração
              </Link>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Business</CardTitle>
                  <p className="text-xs text-muted-foreground">Estratégia & inovação</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link to="/executive/business-plan" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <Rocket className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Plano & Modelo de Negócio
              </Link>
              <Link to="/executive/productivity" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Produtividade & Capacidade
              </Link>
              <Link to="/executive/innovation" className="flex items-center gap-3 rounded-lg p-2.5 text-sm font-medium hover:bg-primary/10 transition-colors group">
                <Lightbulb className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> Desenvolvimento & Inovação
              </Link>
            </CardContent>
          </Card>
        </div>


        {/* Este Mês (destaque) + Este Ano + Brain Dump */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Este Mês — destaque principal */}
          <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{currentMonthName}</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px]">Este mês</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthGoals.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Target className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sem metas para este mês</p>
                  <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Definir metas →</Link>
                </div>
              ) : monthGoals.map((g: any) => {
                const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
                const dev = g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null;
                return (
                  <div key={g.id} className="text-xs space-y-1 py-2 border-b last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{obj?.title || '—'}</span>
                      <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[9px]">{planStatusLabel(g.status)}</Badge>
                    </div>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>Alvo: {g.target_value || '—'}</span>
                      <span>Real: {g.actual_value || '—'}</span>
                      {dev != null && <span className={dev < 0 ? 'text-destructive' : 'text-emerald-600'}>{dev >= 0 ? `+${dev}` : dev}</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Este Ano — Objetivos */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Objetivos {currentYear}</h2>
            {planning.allObjectives.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center space-y-2">
                  <Zap className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sem objetivos definidos</p>
                  <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Criar objetivos →</Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {planning.allObjectives.map((obj: any) => {
                  const prog = planning.objectiveProgress(obj);
                  return (
                    <Link key={obj.id} to="/executive/planeamento" className="block">
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm leading-tight">{obj.title}</h3>
                            <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                              {planStatusLabel(obj.status)}
                            </Badge>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px]">{planAreaLabel(obj.area)}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{prog}%</span>
                              {obj.deadline && <span>Até {obj.deadline}</span>}
                            </div>
                            <Progress value={prog} className="h-1.5" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Brain Dump — compacto */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" /> Brain Dump
                </CardTitle>
                {pendingItems.length > 0 && (
                  <Badge variant="secondary" className="text-[9px]">{pendingItems.length} pendente{pendingItems.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Ideia rápida..." value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()} className="h-8 text-sm" />
                <Button size="sm" variant="ghost" onClick={handleAddTask} className="h-8 px-2"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {brainDumpItems.map(item => {
                  const daysOld = differenceInDays(new Date(), new Date(item.created_at));
                  const isStale = daysOld >= 30 && !item.completed;
                  return (
                    <div key={item.id} className={`flex items-start gap-2 group rounded-md p-1.5 ${isStale ? 'bg-destructive/10' : ''}`}>
                      <Checkbox checked={item.completed} onCheckedChange={(v) => exec.toggleBrainDump.mutate({ id: item.id, completed: !!v })} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.task}</span>
                        {isStale && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-destructive ml-1.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> +{daysOld}d
                          </span>
                        )}
                      </div>
                      <button onClick={() => exec.deleteBrainDump.mutate(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
                {brainDumpItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Sem notas rápidas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
