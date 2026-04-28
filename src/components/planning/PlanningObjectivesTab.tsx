import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { ObjectiveDialog } from './ObjectiveDialog';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';

export function PlanningObjectivesTab({
  planning,
  showHeaderButton = true,
  newDialogOpen: controlledOpen,
  onNewDialogChange,
  layout = 'list',
}: {
  planning: any;
  showHeaderButton?: boolean;
  newDialogOpen?: boolean;
  onNewDialogChange?: (open: boolean) => void;
  layout?: 'list' | 'gallery';
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const newDialogOpen = controlledOpen ?? internalOpen;
  const setNewDialogOpen = (v: boolean) => {
    if (onNewDialogChange) onNewDialogChange(v);
    else setInternalOpen(v);
  };
  const [detailObj, setDetailObj] = useState<any>(null);

  const handleNewSave = (obj: any) => {
    planning.upsertObjective.mutate(obj);
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

      {planning.allObjectives.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem objetivos para {planning.year}. Comece por criar o primeiro objetivo.
        </CardContent></Card>
      ) : (
        <div className={gridClass}>
          {planning.allObjectives.map((obj: any) => {
            const prog = planning.objectiveProgress(obj);
            return (
              <Card key={obj.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailObj(obj)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm line-clamp-2">{obj.title}</h3>
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
            );
          })}
        </div>
      )}

      {/* Dialog only for creating NEW objectives */}
      <ObjectiveDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        initial={null}
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
