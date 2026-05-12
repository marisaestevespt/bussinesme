import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { planningAreaMatches } from '@/lib/planningAreaFilters';
import { ObjectiveDialog } from './ObjectiveDialog';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';
import { ObjectiveCascadeRow } from './ObjectiveCascadeRow';

export function PlanningObjectivesTab({
  planning,
  showHeaderButton = true,
  newDialogOpen: controlledOpen,
  onNewDialogChange,
  layout = 'list',
  areaFilter,
  hideCascade = false,
  showGoalsInline = false,
  compact = false,
}: {
  planning: any;
  showHeaderButton?: boolean;
  newDialogOpen?: boolean;
  onNewDialogChange?: (open: boolean) => void;
  layout?: 'list' | 'gallery';
  areaFilter?: string;
  hideCascade?: boolean;
  showGoalsInline?: boolean;
  compact?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const newDialogOpen = controlledOpen ?? internalOpen;
  const setNewDialogOpen = (v: boolean) => {
    if (onNewDialogChange) onNewDialogChange(v);
    else setInternalOpen(v);
  };
  const [detailObj, setDetailObj] = useState<any>(null);

  const handleNewSave = (obj: any) => {
    // When the tab is filtered by area, ensure new objectives inherit it
    // (the dialog already pre-fills the field, but this guards against
    // someone changing it back to 'outro' or empty).
    const payload = areaFilter && (!obj.area || obj.area === 'outro')
      ? { ...obj, area: areaFilter }
      : obj;
    planning.upsertObjective.mutate(payload);
    setNewDialogOpen(false);
  };

  const gridClass = layout === 'gallery'
    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid gap-4';

  return (
    <div className="space-y-4">
      {showHeaderButton && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
          </Button>
        </div>
      )}

      {(() => {
        const objs = areaFilter
          ? planning.allObjectives.filter((o: any) => planningAreaMatches(o.area, areaFilter))
          : planning.allObjectives;
        return objs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem objetivos para {planning.year}. Comece por criar o primeiro objetivo.
        </CardContent></Card>
      ) : (
        <div className={gridClass}>
          {objs.map((obj: any) => {
            const prog = planning.objectiveProgress(obj);
            if (compact) {
              return (
                <Card
                  key={obj.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/40 hq-transition"
                  onClick={() => setDetailObj(obj)}
                >
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {obj.title}
                    </h3>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold tabular-nums">{prog}%</span>
                    </div>
                    <Progress value={prog} className="h-1.5" />
                  </CardContent>
                </Card>
              );
            }
            return (
              <Card
                key={obj.id}
                className="cursor-pointer hover:shadow-md hover:border-primary/40 hq-transition overflow-hidden flex flex-col"
                onClick={() => setDetailObj(obj)}
              >
                {/* Faixa: área (esquerda) + status (direita) */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {planAreaLabel(obj.area)}
                  </span>
                  <Badge
                    variant={obj.status === 'atingido' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {planStatusLabel(obj.status)}
                  </Badge>
                </div>

                {/* Corpo: título + tipo */}
                <CardContent className="p-4 pb-3 flex-1 flex flex-col gap-2">
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem] flex items-start gap-1.5">
                    <span className="flex-1">{obj.title}</span>
                    {obj.contribui_visao_5_anos && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          </TooltipTrigger>
                          <TooltipContent>Este objetivo contribui para a tua visão a 5 anos.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    {obj.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}
                  </span>
                </CardContent>

                {/* Rodapé: progresso destacado */}
                <div className="px-4 pb-4 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-foreground tabular-nums">{prog}%</span>
                    {obj.deadline && (
                      <span className="text-[10px] text-muted-foreground">Até {obj.deadline}</span>
                    )}
                  </div>
                  <Progress value={prog} className="h-1.5" />
                </div>
                {!hideCascade && (
                  <ObjectiveCascadeRow objective={obj} planning={planning} />
                )}
                {showGoalsInline && (() => {
                  const linkedGoals = (planning.allGoals || []).filter((g: any) => g.objective_id === obj.id);
                  if (linkedGoals.length === 0) {
                    return (
                      <div className="px-4 pb-3 -mt-1">
                        <p className="text-[10px] text-muted-foreground italic">Sem metas pequenas associadas.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="px-4 pb-3 -mt-1 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                        {linkedGoals.length} {linkedGoals.length === 1 ? 'meta' : 'metas'}
                      </p>
                      <div className="space-y-1">
                        {linkedGoals.slice(0, 4).map((g: any) => (
                          <div key={g.id} className="flex items-center justify-between text-[11px] gap-2">
                            <span className="truncate text-muted-foreground">
                              <span className="font-medium text-foreground">{g.period}</span> · {g.title || g.description || 'Meta sem título'}
                            </span>
                            <Badge variant="outline" className="text-[9px] shrink-0">{planStatusLabel(g.status)}</Badge>
                          </div>
                        ))}
                        {linkedGoals.length > 4 && (
                          <p className="text-[10px] text-muted-foreground">+ {linkedGoals.length - 4} mais…</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      );
      })()}

      {/* Dialog only for creating NEW objectives */}
      <ObjectiveDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        initial={areaFilter ? { area: areaFilter } : null}
        onSave={handleNewSave}
      />

      {/* Full detail view (with inline editing) for existing objectives */}
      <ObjectiveDetailSheet
        open={!!detailObj}
        onClose={() => setDetailObj(null)}
        objective={detailObj}
        planning={planning}
      />
    </div>
  );
}
