import { useMemo, useState, DragEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CRM_STATUSES, getFollowUpState, FollowUpState } from '@/hooks/useCrmData';
import { format } from 'date-fns';
import { AlertTriangle, Clock, Phone, Mail } from 'lucide-react';

interface CrmPipelineProps {
  leads: any[];
  onOpenLead: (lead: any) => void;
  onUpdateStatus: (leadId: string, newStatus: string) => void;
}

function fuBadgeClass(state: FollowUpState) {
  switch (state) {
    case 'overdue': return 'text-destructive font-medium';
    case 'today': return 'text-amber-600 font-medium';
    case 'soon': return 'text-yellow-600';
    default: return 'text-muted-foreground';
  }
}

function FuIcon({ state }: { state: FollowUpState }) {
  if (state === 'overdue') return <AlertTriangle className="h-3 w-3" />;
  if (state === 'today') return <Clock className="h-3 w-3" />;
  return null;
}

export function CrmPipeline({ leads, onOpenLead, onUpdateStatus }: CrmPipelineProps) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const columns = useMemo(() => CRM_STATUSES.map(s => ({
    ...s,
    leads: leads.filter(l => l.status === s.value),
    total: leads.filter(l => l.status === s.value).reduce((sum, l) => sum + Number(l.estimated_value || 0), 0),
  })), [leads]);

  const handleDragStart = (e: DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    setDragOver(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) onUpdateStatus(leadId, status);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4" style={{ minWidth: `${columns.length * 290}px` }}>
        {columns.map(col => (
          <div
            key={col.value}
            className={`flex flex-col w-[280px] shrink-0 rounded-lg border bg-muted/30 transition-colors ${dragOver === col.value ? 'ring-2 ring-primary/40' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(col.value); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, col.value)}
          >
            {/* Column header */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold truncate">{col.label}</span>
                <Badge variant="secondary" className="text-xs">{col.total.toLocaleString('pt-PT')}€</Badge>
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 flex-1 min-h-[80px]">
              {col.leads.map(lead => {
                const fuState = getFollowUpState(lead.next_followup);
                return (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={e => handleDragStart(e, lead.id)}
                    onClick={() => onOpenLead(lead)}
                    className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium text-sm truncate flex-1">{lead.name}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            {CRM_STATUSES.filter(s => s.value !== lead.status).map(s => (
                              <DropdownMenuItem key={s.value} onClick={() => onUpdateStatus(lead.id, s.value)}>
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <Mail className="h-3 w-3 shrink-0" />{lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />{lead.phone}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t space-y-1">
                      <div className={`flex items-center gap-1 text-xs ${fuBadgeClass(fuState)}`}>
                        <FuIcon state={fuState} />
                        <span className="text-muted-foreground">Próximo FU:</span> {lead.next_followup ? format(new Date(lead.next_followup), 'dd/MM/yyyy') : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span>Notas:</span> {lead.followup_notes || '—'}
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Valor:</span> <span className="font-semibold text-primary">{Number(lead.estimated_value || 0).toLocaleString('pt-PT')}€</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
