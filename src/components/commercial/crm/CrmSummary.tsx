import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Phone, TrendingUp, Trophy, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { getFollowUpState, statusLabel } from '@/hooks/useCrmData';

interface CrmSummaryProps {
  activeCount: number;
  toContactToday: any[];
  pipelineValue: number;
  winsThisMonth: number;
  onOpenLead: (lead: any) => void;
}

export function CrmSummary({ activeCount, toContactToday, pipelineValue, winsThisMonth, onOpenLead }: CrmSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-4.5 w-4.5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Leads Ativos</p><p className="text-xl font-bold">{activeCount}</p></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center"><Phone className="h-4.5 w-4.5 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">A Contactar Hoje</p><p className="text-xl font-bold">{toContactToday.length}</p></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="h-4.5 w-4.5 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Valor Pipeline</p><p className="text-xl font-bold">{pipelineValue.toLocaleString('pt-PT')}€</p></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center"><Trophy className="h-4.5 w-4.5 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">Ganhos este mês</p><p className="text-xl font-bold">{winsThisMonth}</p></div>
        </CardContent></Card>
      </div>

      {/* Alert: To Contact Today */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">A Contactar Hoje</h3>
          </div>
          {toContactToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem contactos para hoje.</p>
          ) : (
            <div className="space-y-2">
              {toContactToday.map(lead => {
                const fuState = getFollowUpState(lead.next_followup);
                return (
                  <div key={lead.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/80 border">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-sm truncate">{lead.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">{statusLabel(lead.status)}</Badge>
                      <span className={`text-xs shrink-0 ${fuState === 'overdue' ? 'text-destructive font-medium' : 'text-amber-600'}`}>
                        <Clock className="h-3 w-3 inline mr-1" />
                        {lead.next_followup ? format(new Date(lead.next_followup), 'dd/MM') : '—'}
                      </span>
                      {lead.followup_notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.followup_notes}</span>}
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => onOpenLead(lead)}>Abrir</Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
