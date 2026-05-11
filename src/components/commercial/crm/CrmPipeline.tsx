import { useMemo, useState, DragEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getFollowUpState, FollowUpState } from '@/hooks/useCrmData';
import { useCrmStages } from '@/hooks/useCrmStages';
import { useCrmLabels } from '@/hooks/useCrmLabels';
import { CrmLabelBadges } from './CrmLabelPicker';
import { format } from 'date-fns';
import { AlertTriangle, Clock, Phone, Mail, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';


interface CrmPipelineProps {
  leads: any[];
  onOpenLead: (lead: any) => void;
  onUpdateStatus: (leadId: string, newStatus: string) => void;
  manageStagesOpen: boolean;
  onManageStagesChange: (open: boolean) => void;
}

function fuBadgeClass(state: FollowUpState) {
  switch (state) {
    case 'overdue': return 'text-destructive font-medium';
    case 'today': return 'text-warning font-medium';
    case 'soon': return 'text-warning';
    default: return 'text-muted-foreground';
  }
}

function FuIcon({ state }: { state: FollowUpState }) {
  if (state === 'overdue') return <AlertTriangle className="h-3 w-3" />;
  if (state === 'today') return <Clock className="h-3 w-3" />;
  return null;
}

export function CrmPipeline({ leads, onOpenLead, onUpdateStatus, manageStagesOpen, onManageStagesChange }: CrmPipelineProps) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const { stages, addStage, removeStage } = useCrmStages();
  const { labels, leadLabelsMap } = useCrmLabels();

  const columns = useMemo(() => stages.map(s => ({
    ...s,
    leads: leads.filter(l => l.status === s.value),
    total: leads.filter(l => l.status === s.value).reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
  })), [leads, stages]);

  const handleDragStart = (e: DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    setDragOver(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;
    // Se está a marcar como 'ganho', exigir conversão completa via dialog em vez de update direto.
    // Isto previne leads ganhos sem cliente/projeto/portal associados (validado também por trigger DB).
    if (status === 'ganho') {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        toast.info('Para marcar como ganho, completa a conversão em "Converter em Cliente".');
        onOpenLead(lead);
        return;
      }
    }
    onUpdateStatus(leadId, status);
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const value = newStageName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_àáâãéèêíóôõúç]/g, '');
    addStage.mutate({ value, label: newStageName.trim() });
    setNewStageName('');
  };

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: `${columns.length * 320}px` }}>
          {columns.map(col => {
            const isWon = col.value === 'ganho';
            const isLost = col.value === 'perdido';
            const isWait = col.value === 'outra_altura';
            return (
              <div
                key={col.value}
                className={`flex flex-col w-[310px] shrink-0 rounded-xl border transition-colors ${dragOver === col.value ? 'ring-2 ring-primary/40 border-primary/30' : ''} ${isWon ? 'bg-success/5 border-success/20' : isLost ? 'bg-destructive/5 border-destructive/20' : isWait ? 'bg-warning/15 border-warning/30 dark:bg-warning/20 dark:border-warning/30' : 'bg-card/60'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(col.value); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, col.value)}
              >
                {/* Column header */}
                <div className={`px-4 py-3.5 border-b rounded-t-xl ${isWon ? 'bg-success/15 border-success/30' : isLost ? 'bg-destructive/15 border-destructive/30' : isWait ? 'bg-warning/15 border-warning/30 dark:bg-warning/30 dark:border-warning/40' : 'bg-primary/10 border-primary/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold uppercase tracking-wide truncate ${isWon ? 'text-success' : isLost ? 'text-destructive' : isWait ? 'text-warning dark:text-warning' : 'text-primary'}`}>{col.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold bg-foreground/10">{col.leads.length}</Badge>
                    </div>
                    <span className="text-xs font-bold text-foreground">{col.total.toLocaleString('pt-PT')}€</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-3 flex-1 min-h-[80px]">
                  {col.leads.map(lead => {
                    const fuState = getFollowUpState(lead.next_followup);
                    return (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={e => handleDragStart(e, lead.id)}
                        onClick={() => onOpenLead(lead)}
                        className="p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 border-border/70 shadow-md bg-card"
                      >
                        <div className="space-y-2">
                          <p className="font-bold text-sm truncate text-foreground">{lead.name}</p>
                          <CrmLabelBadges labelIds={leadLabelsMap[lead.id] || []} labels={labels} />
                          {lead.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                              <Mail className="h-3 w-3 shrink-0 text-primary/60" />{lead.email}
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0 text-primary/60" />{lead.phone}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className={`flex items-center gap-1 text-xs ${fuBadgeClass(fuState)}`}>
                            <FuIcon state={fuState} />
                            <span className="text-muted-foreground">Próximo FU:</span> {lead.next_followup ? format(new Date(lead.next_followup), 'dd/MM/yyyy') : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            <span>Notas:</span> {lead.followup_notes || '—'}
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-bold text-base text-primary">{Number(lead.estimated_value || 0).toLocaleString('pt-PT')}€</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Manage stages dialog */}
      <Dialog open={manageStagesOpen} onOpenChange={onManageStagesChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerir Etapas do CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {stages.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border">
                <span className="text-sm">{s.label}</span>
                {!s.is_default && (
                  <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStage.mutate(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Nome da nova etapa..."
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                className="h-8 text-sm"
              />
              <Button variant="soft" size="sm" onClick={handleAddStage} disabled={!newStageName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Novas etapas são adicionadas antes de "Ganho" e "Perdido". Etapas padrão não podem ser removidas.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
