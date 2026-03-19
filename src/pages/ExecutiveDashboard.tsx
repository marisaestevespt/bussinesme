import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Target, CalendarCheck, Lightbulb, Rocket, Clock, Trash2, Plus, Users, Briefcase } from 'lucide-react';
import { useExecutiveData, getMonthName, areaLabel, statusLabel } from '@/hooks/useExecutiveData';

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export default function ExecutiveDashboard() {
  const exec = useExecutiveData(currentYear);
  const [newTask, setNewTask] = useState('');

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    exec.addBrainDump.mutate(newTask.trim());
    setNewTask('');
  };

  const monthGoals = exec.goalsForMonth(currentMonth);
  const monthProg = exec.monthProgress(currentMonth);
  const monthRange = `1 - ${new Date(currentYear, currentMonth, 0).getDate()} ${getMonthName(currentMonth)}`;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Cover Header */}
        <div className="relative h-40 rounded-xl bg-gradient-to-br from-primary/90 to-primary/60 flex items-end p-6 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/placeholder.svg')] bg-cover bg-center opacity-10" />
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-primary-foreground">Executive Room</h1>
            <p className="text-primary-foreground/70 text-sm mt-1">Planeamento estratégico & visão do negócio</p>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Coluna Esquerda — Gestão */}
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
              <Link to="/executive/gestao-equipa" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Users className="h-4 w-4 text-muted-foreground" /> Gestão de Equipa
              </Link>
            </CardContent>
          </Card>

          {/* Coluna Central — Business */}
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
              <Link to="/executive/productivity" className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors">
                <Clock className="h-4 w-4 text-muted-foreground" /> Gestão de Produtividade & Tempo
              </Link>
            </CardContent>
          </Card>

          {/* Coluna Direita — Brain Dump */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Brain Dump</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nova tarefa rápida..."
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="ghost" onClick={handleAddTask} className="h-8 px-2"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(exec.brainDump.data || []).map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(v) => exec.toggleBrainDump.mutate({ id: item.id, completed: !!v })}
                    />
                    <span className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.task}</span>
                    <button onClick={() => exec.deleteBrainDump.mutate(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                {(exec.brainDump.data || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem tarefas rápidas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Este Ano + Este Mês */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Este Ano — Objetivos */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Este ano — Como estamos...</h2>
            {exec.allObjectives.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sem objetivos para {currentYear}. <Link to="/executive/planeamento" className="text-primary underline">Criar objetivos</Link>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {exec.allObjectives.map(obj => {
                  const prog = exec.objectiveProgress(obj.id);
                  return (
                    <Card key={obj.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium text-sm">{obj.title}</h3>
                          <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {statusLabel(obj.status)}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{areaLabel(obj.area)}</Badge>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{prog}%</span>
                            {obj.deadline && <span>Até {obj.deadline}</span>}
                          </div>
                          <Progress value={prog} className="h-2" />
                        </div>
                        {obj.description && <p className="text-xs text-muted-foreground line-clamp-2">{obj.description}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Este Mês */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Este mês</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-sm">{getMonthName(currentMonth)}</h3>
                  <p className="text-xs text-muted-foreground">{monthRange}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progresso</span><span>{monthProg}%</span>
                  </div>
                  <Progress value={monthProg} className="h-2" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metas do mês</h4>
                  {monthGoals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem metas para este mês</p>
                  ) : monthGoals.map(g => (
                    <div key={g.id} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${g.status === 'atingido' ? 'bg-green-500' : g.status === 'doing' ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`} />
                      <span className="text-xs">{g.meta}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
