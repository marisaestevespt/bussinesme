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
import { Target, CalendarCheck, Lightbulb, Rocket, Clock, Trash2, Plus, Briefcase, MessageSquareHeart, AlertTriangle } from 'lucide-react';
import { useExecutiveData, getMonthName } from '@/hooks/useExecutiveData';
import { usePlanningData, planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';

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

  // Current month goals from planning_goals
  const currentMonthName = MONTH_NAMES[currentMonth - 1];
  const monthGoals = planning.allGoals.filter(g => g.period === currentMonthName);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Cover Header */}
        <PageHeader title="Executive Room" subtitle="Planeamento estratégico & visão do negócio" />

        {/* 3-Column Layout */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Gestão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/executive/planeamento" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Target className="h-4 w-4 text-muted-foreground" /> Planeamento Anual
              </Link>
              <Link to="/executive/weekly-align" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" /> Weekly Align
              </Link>
              <Link to="/executive/productivity" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Clock className="h-4 w-4 text-muted-foreground" /> Gestão de Produtividade & Tempo
              </Link>
              <Link to="/executive/recommendations" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <MessageSquareHeart className="h-4 w-4 text-muted-foreground" /> Caixa das Recomendações
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/executive/business-plan" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Rocket className="h-4 w-4 text-muted-foreground" /> Plano & Modelo de Negócio
              </Link>
              <Link to="/executive/innovation" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Lightbulb className="h-4 w-4 text-muted-foreground" /> Desenvolvimento & Inovação
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Brain Dump</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Nova tarefa rápida..." value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()} className="h-8 text-sm" />
                <Button size="sm" variant="ghost" onClick={handleAddTask} className="h-8 px-2"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(exec.brainDump.data || []).map(item => {
                  const daysOld = differenceInDays(new Date(), new Date(item.created_at));
                  const isStale = daysOld >= 30 && !item.completed;
                  return (
                    <div key={item.id} className={`flex items-start gap-2 group rounded-md p-1 ${isStale ? 'bg-destructive/10' : ''}`}>
                      <Checkbox checked={item.completed} onCheckedChange={(v) => exec.toggleBrainDump.mutate({ id: item.id, completed: !!v })} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.task}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('pt-PT')}
                          </span>
                          {isStale && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive">
                              <AlertTriangle className="h-2.5 w-2.5" /> +{daysOld}d
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => exec.deleteBrainDump.mutate(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
                {(exec.brainDump.data || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem tarefas rápidas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Este Ano + Este Mês */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Este Ano — Objetivos from new planning DB */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Este ano — Como estamos...</h2>
            {planning.allObjectives.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sem objetivos para {currentYear}. <Link to="/executive/planeamento" className="text-primary underline">Criar objetivos</Link>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {planning.allObjectives.map((obj: any) => {
                  const prog = planning.objectiveProgress(obj);
                  return (
                    <Link key={obj.id} to="/executive/planeamento" className="block">
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="font-medium text-sm">{obj.title}</h3>
                            <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                              {planStatusLabel(obj.status)}
                            </Badge>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{planAreaLabel(obj.area)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{obj.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{prog}%</span>
                              {obj.deadline && <span>Até {obj.deadline}</span>}
                            </div>
                            <Progress value={prog} className="h-2" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Este Mês — from planning_goals */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Este mês</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-sm">{currentMonthName}</h3>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metas do mês</h4>
                  {monthGoals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem metas para este mês</p>
                  ) : monthGoals.map((g: any) => {
                    const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
                    const dev = g.actual_value && g.target_value ? (Number(g.actual_value) - Number(g.target_value)) : null;
                    return (
                      <div key={g.id} className="text-xs space-y-0.5 py-1 border-b last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{obj?.title || '—'}</span>
                          <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[9px]">{planStatusLabel(g.status)}</Badge>
                        </div>
                        <div className="flex gap-3 text-muted-foreground">
                          <span>Alvo: {g.target_value || '—'}</span>
                          <span>Real: {g.actual_value || '—'}</span>
                          {dev != null && <span className={dev < 0 ? 'text-destructive' : ''}>{dev >= 0 ? `+${dev}` : dev}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
