import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Rocket, Zap, ArrowRight } from 'lucide-react';
import { usePlanningData, planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { useBrainDump } from '@/hooks/useBrainDump';
import { EmptyHint } from '@/components/ui/loading-skeletons';

export function ObjectivesBrainDump() {
  const planning = usePlanningData(new Date().getFullYear());
  const brain = useBrainDump();

  const items = brain.items.data || [];
  const pendingItems = items.filter(i => i.status === 'em_ideia');

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Objetivos & ideias</h2>
        <Link to="/executive/planeamento" className="text-xs text-primary hover:underline">Ver planeamento anual →</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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

        <Link to="/executive/brain-dump" className="block group">
          <Card className="h-full transition-all group-hover:shadow-sm group-hover:border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" /> Brain Dump
                {pendingItems.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] ml-auto">{pendingItems.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <EmptyHint>Sem ideias registadas</EmptyHint>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-hidden">
                  {items.slice(0, 4).map(item => (
                    <div key={item.id} className="text-xs truncate text-foreground/80">
                      • {item.task}
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{items.length - 4} mais…
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end pt-1 text-[11px] text-primary">
                Abrir Brain Dump <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  );
}