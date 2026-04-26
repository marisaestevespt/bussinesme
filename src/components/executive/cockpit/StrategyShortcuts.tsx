import { useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Rocket, Lightbulb, Calculator, FileText, MessageSquareHeart, Zap, Plus, Trash2, AlertTriangle, Crown } from 'lucide-react';
import { usePlanningData, planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { useExecutiveData } from '@/hooks/useExecutiveData';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const SHORTCUTS = [
  { to: '/executive/business-plan', icon: Rocket, label: 'Plano & Modelo de Negócio', desc: 'Visão, oferta, estratégia',
    iconColor: 'text-primary', color: 'from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10' },
  { to: '/executive/innovation', icon: Lightbulb, label: 'Desenvolvimento & Inovação', desc: 'Ideias e roadmap',
    iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10' },
  { to: '/executive/productivity', icon: Calculator, label: 'Produtividade & Capacidade', desc: 'Simular contratação',
    iconColor: 'text-success', color: 'from-success/10 to-success/5 hover:from-success/20 hover:to-success/10' },
  { to: '/executive/recommendations', icon: MessageSquareHeart, label: 'Caixa de Recomendações', desc: 'Feedback da equipa',
    iconColor: 'text-destructive', color: 'from-destructive/10 to-destructive/5 hover:from-destructive/20 hover:to-destructive/10' },
  { to: '/executive/processos', icon: FileText, label: 'Processos da Administração', desc: 'SOPs do owner',
    iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
  { to: '/executive/analise-empresarial', icon: Crown, label: 'Análise Empresarial', desc: 'Métricas estratégicas',
    iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10' },
];

export function StrategyShortcuts() {
  const planning = usePlanningData(new Date().getFullYear());
  const exec = useExecutiveData(new Date().getFullYear());
  const [newTask, setNewTask] = useState('');

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    exec.addBrainDump.mutate(newTask.trim());
    setNewTask('');
  };

  const brainDumpItems = exec.brainDump.data || [];
  const pendingItems = brainDumpItems.filter(i => !i.completed);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estratégia & crescimento</h2>
        <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Ver planeamento anual →</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Objetivos do ano */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Objetivos {new Date().getFullYear()}
              {planning.allObjectives.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-auto">{planning.allObjectives.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planning.allObjectives.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Zap className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <EmptyHint>Sem objetivos definidos</EmptyHint>
                <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Criar objetivos →</Link>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {planning.allObjectives.slice(0, 6).map((obj: any) => {
                  const prog = planning.objectiveProgress(obj);
                  return (
                    <Link key={obj.id} to="/executive/planeamento" className="block group">
                      <div className="rounded-lg border bg-card p-3 transition-all group-hover:shadow-sm group-hover:border-primary/30">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-medium text-xs leading-tight line-clamp-2">{obj.title}</h3>
                          <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                            {planStatusLabel(obj.status)}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-[9px] mb-1.5">{planAreaLabel(obj.area)}</Badge>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="font-medium">{prog}%</span>
                            {obj.deadline && <span>Até {obj.deadline}</span>}
                          </div>
                          <Progress value={prog} className="h-1" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Brain Dump */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" /> Brain Dump
              {pendingItems.length > 0 && (
                <Badge variant="secondary" className="text-[9px] ml-auto">{pendingItems.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Ideia rápida..."
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="ghost" onClick={handleAddTask} className="h-8 px-2">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {brainDumpItems.length === 0 ? (
                <EmptyHint>Sem notas rápidas</EmptyHint>
              ) : brainDumpItems.map(item => {
                const daysOld = differenceInDays(new Date(), new Date(item.created_at));
                const isStale = daysOld >= 30 && !item.completed;
                return (
                  <div key={item.id} className={`flex items-start gap-2 group rounded-md p-1.5 ${isStale ? 'bg-destructive/10' : ''}`}>
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(v) => exec.toggleBrainDump.mutate({ id: item.id, completed: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.task}</span>
                      {isStale && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-destructive ml-1.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> +{daysOld}d
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => exec.deleteBrainDump.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shortcuts */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.to} to={s.to} className="group">
              <Card className={`cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}