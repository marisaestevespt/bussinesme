import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { planAreaLabel, planStatusLabel } from '@/hooks/usePlanningData';
import { ObjectiveDialog } from './ObjectiveDialog';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';

export function PlanningObjectivesTab({ planning }: { planning: any }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editObj, setEditObj] = useState<any>(null);
  const [detailObj, setDetailObj] = useState<any>(null);

  const handleSave = (obj: any) => {
    planning.upsertObjective.mutate(obj);
    setDialogOpen(false);
    setEditObj(null);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditObj(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
        </Button>
      </div>

      {planning.allObjectives.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem objetivos para {planning.year}. Comece por criar o primeiro objetivo.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <ObjectiveDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditObj(null); }}
        initial={editObj}
        onSave={handleSave}
      />

      <ObjectiveDetailSheet
        open={!!detailObj}
        onClose={() => setDetailObj(null)}
        objective={detailObj}
        planning={planning}
        onEdit={(obj: any) => { setDetailObj(null); setEditObj(obj); setDialogOpen(true); }}
      />
    </div>
  );
}
