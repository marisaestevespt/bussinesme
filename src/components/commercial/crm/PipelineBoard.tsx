import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, UserPlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statusLabel } from '@/hooks/useCrmData';

interface PipelineBoardProps {
  pipeline: any;
  stages: any[];
  pipelineLeads: any[];
  allLeads: any[];
  onMoveLeadToStage: (leadId: string, stageId: string) => void;
  onAddLeadToPipeline: (leadId: string, stageId: string) => void;
  onRemoveLeadFromPipeline: (leadId: string) => void;
  onOpenLead: (lead: any) => void;
  onCreateLead: (stageId: string) => void;
  onAddStage: () => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (id: string, currentName: string) => void;
  onReorderStage?: (stageId: string, direction: 'left' | 'right') => void;
}

export function PipelineBoard({
  pipeline,
  stages,
  pipelineLeads,
  allLeads,
  onMoveLeadToStage,
  onAddLeadToPipeline,
  onRemoveLeadFromPipeline,
  onOpenLead,
  onCreateLead,
  onAddStage,
  onDeleteStage,
  onRenameStage,
  onReorderStage,
}: PipelineBoardProps) {
  const [addingToStage, setAddingToStage] = useState<string | null>(null);

  const assignedLeadIds = new Set(pipelineLeads.map(pl => pl.lead_id));
  const unassignedLeads = allLeads.filter(l => !assignedLeadIds.has(l.id));

  const getLeadsForStage = (stageId: string) => {
    const leadIds = pipelineLeads.filter(pl => pl.stage_id === stageId).map(pl => pl.lead_id);
    return allLeads.filter(l => leadIds.includes(l.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-lg">{pipeline.name}</h2>
        <Button variant="outline" size="sm" onClick={onAddStage}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
        </Button>
      </div>

      {stages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Este pipeline ainda não tem etapas. Adiciona uma para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage, idx) => {
            const stageLeads = getLeadsForStage(stage.id);
            const isFirst = idx === 0;
            const isLast = idx === stages.length - 1;

            return (
              <div
                key={stage.id}
                className="min-w-[260px] max-w-[300px] flex-shrink-0"
              >
                <Card className="h-full">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <CardTitle className="text-sm font-medium truncate">{stage.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">{stageLeads.length}</Badge>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Reorder arrows */}
                        {onReorderStage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={isFirst}
                              onClick={() => onReorderStage(stage.id, 'left')}
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={isLast}
                              onClick={() => onReorderStage(stage.id, 'right')}
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRenameStage(stage.id, stage.name)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (stageLeads.length > 0) {
                              alert('Remove as leads desta etapa antes de a eliminar.');
                              return;
                            }
                            if (confirm(`Eliminar etapa "${stage.name}"?`)) onDeleteStage(stage.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2">
                    {stageLeads.map(lead => (
                      <div
                        key={lead.id}
                        className="p-2.5 rounded-md border bg-background hover:bg-muted/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1" onClick={() => onOpenLead(lead)}>
                            <p className="text-sm font-medium truncate">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">{statusLabel(lead.status)}</p>
                            {lead.estimated_value ? (
                              <p className="text-xs font-medium text-primary mt-0.5">
                                {Number(lead.estimated_value).toLocaleString('pt-PT')}€
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Select onValueChange={(stageId) => onMoveLeadToStage(lead.id, stageId)}>
                              <SelectTrigger className="h-6 w-6 p-0 border-0 [&>svg]:hidden">
                                <span className="text-xs">→</span>
                              </SelectTrigger>
                              <SelectContent>
                                {stages.filter(s => s.id !== stage.id).map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onRemoveLeadFromPipeline(lead.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {addingToStage === stage.id ? (
                      <div className="space-y-1">
                        <Select onValueChange={(leadId) => {
                          onAddLeadToPipeline(leadId, stage.id);
                          setAddingToStage(null);
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar lead..." />
                          </SelectTrigger>
                          <SelectContent>
                            {unassignedLeads.length === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground">Todas as leads já estão no pipeline</div>
                            ) : (
                              unassignedLeads.map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setAddingToStage(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => setAddingToStage(stage.id)}
                      >
                        <UserPlus className="h-3 w-3 mr-1" /> Adicionar Lead
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
