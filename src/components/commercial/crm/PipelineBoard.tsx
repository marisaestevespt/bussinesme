import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, UserPlus, X, ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { statusLabel } from '@/hooks/useCrmData';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface PipelineBoardProps {
  pipeline: any;
  stages: any[];
  pipelineLeads: any[];
  allLeads: any[];
  stagesDialogOpen?: boolean;
  onStagesDialogChange?: (open: boolean) => void;
  onMoveLeadToStage: (leadId: string, stageId: string) => void;
  onAddLeadToPipeline: (leadId: string, stageId: string) => void;
  onRemoveLeadFromPipeline: (leadId: string) => void;
  onOpenLead: (lead: any) => void;
  onCreateLead: (stageId: string) => void;
  onAddStage: (name: string) => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (id: string, newName: string) => void;
  onReorderStage?: (stageId: string, direction: 'left' | 'right') => void;
}

export function PipelineBoard({
  pipeline,
  stages,
  pipelineLeads,
  allLeads,
  stagesDialogOpen: externalOpen,
  onStagesDialogChange,
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
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = externalOpen ?? internalOpen;
  const setDialogOpen = onStagesDialogChange ?? setInternalOpen;

  const assignedLeadIds = new Set(pipelineLeads.map(pl => pl.lead_id));
  const unassignedLeads = allLeads.filter(l => !assignedLeadIds.has(l.id));

  const getLeadsForStage = (stageId: string) => {
    const leadIds = pipelineLeads.filter(pl => pl.stage_id === stageId).map(pl => pl.lead_id);
    return allLeads.filter(l => leadIds.includes(l.id));
  };

  return (
    <div className="space-y-4">

      {stages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Este pipeline ainda não tem etapas.
            <Button variant="link" className="ml-1" onClick={() => setDialogOpen(true)}>
              Adicionar etapas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageLeads = getLeadsForStage(stage.id);

            return (
              <div key={stage.id} className="min-w-[260px] max-w-[300px] flex-shrink-0">
                <Card className="h-full">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <CardTitle className="text-sm font-medium truncate">{stage.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">{stageLeads.length}</Badge>
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
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => setAddingToStage(stage.id)}
                        >
                          <UserPlus className="h-3 w-3 mr-1" /> Adicionar Lead
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => onCreateLead(stage.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Nova Lead
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Stages Dialog */}
      <StagesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages}
        pipelineLeads={pipelineLeads}
        onAdd={onAddStage}
        onRename={onRenameStage}
        onDelete={onDeleteStage}
        onReorder={onReorderStage}
      />
    </div>
  );
}

/* ─── Stages Management Dialog ─── */
function StagesDialog({
  open,
  onOpenChange,
  stages,
  pipelineLeads,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: any[];
  pipelineLeads: any[];
  onAdd: (name: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (stageId: string, direction: 'left' | 'right') => void;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const confirm = useConfirm();

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    onRename(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const leadsInStage = (stageId: string) =>
    pipelineLeads.filter(pl => pl.stage_id === stageId).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Etapas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Existing stages */}
          {stages.length === 0 && (
            <EmptyHint>Nenhuma etapa criada.</EmptyHint>
          )}
          <div className="space-y-2">
            {stages.map((stage, idx) => {
              const count = leadsInStage(stage.id);
              const isEditing = editingId === stage.id;
              const isFirst = idx === 0;
              const isLast = idx === stages.length - 1;

              return (
                <div key={stage.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />

                  {isEditing ? (
                    <Input
                      autoFocus
                      className="h-7 text-sm flex-1"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(stage.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => handleRename(stage.id)}
                    />
                  ) : (
                    <span
                      className="text-sm flex-1 cursor-pointer hover:text-primary truncate"
                      onClick={() => { setEditingId(stage.id); setEditName(stage.name); }}
                    >
                      {stage.name}
                    </span>
                  )}

                  {count > 0 && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{count}</Badge>
                  )}

                  {/* Reorder */}
                  {onReorder && (
                    <div className="flex flex-col flex-shrink-0">
                      <Button
                        variant="ghost"
                        aria-label="Mostrar menos" size="icon"
                        className="h-5 w-5"
                        disabled={isFirst}
                        onClick={() => onReorder(stage.id, 'left')}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Mostrar mais" size="icon"
                        className="h-5 w-5"
                        disabled={isLast}
                        onClick={() => onReorder(stage.id, 'right')}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                    disabled={count > 0}
                    aria-label="Eliminar etapa"
                    onClick={async () => {
                      if (count > 0) return;
                      const ok = await confirm({
                        title: 'Eliminar etapa?',
                        description: `A etapa "${stage.name}" será removida do pipeline.`,
                        confirmText: 'Eliminar',
                        variant: 'destructive',
                      });
                      if (ok) onDelete(stage.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add new */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="Nome da nova etapa..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} variant="soft">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
