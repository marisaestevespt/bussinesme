import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { statusLabel, getFollowUpState, FollowUpState } from '@/hooks/useCrmData';
import { format } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';

interface CrmListViewProps {
  leads: any[];
  onOpenLead: (lead: any) => void;
}

type QuickFilter = 'all' | 'today' | 'in_progress' | 'ganhos' | 'perdidos';

const FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'A contactar hoje' },
  { value: 'in_progress', label: 'Em progresso' },
  { value: 'ganhos', label: 'Ganhos' },
  { value: 'perdidos', label: 'Perdidos' },
];

function fuClass(state: FollowUpState) {
  switch (state) {
    case 'overdue': return 'text-destructive font-medium';
    case 'today': return 'text-warning font-medium';
    case 'soon': return 'text-warning';
    default: return '';
  }
}

function FuIcon({ state }: { state: FollowUpState }) {
  if (state === 'overdue') return <AlertTriangle className="h-3 w-3 inline mr-1" />;
  if (state === 'today') return <Clock className="h-3 w-3 inline mr-1" />;
  return null;
}

export function CrmListView({ leads, onOpenLead }: CrmListViewProps) {
  const [filter, setFilter] = useState<QuickFilter>('all');
  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    let result = [...leads];
    switch (filter) {
      case 'today':
        result = result.filter(l => l.next_followup && l.next_followup <= todayStr && l.status !== 'ganho' && l.status !== 'perdido');
        break;
      case 'in_progress':
        result = result.filter(l => !['lead', 'ganho', 'perdido'].includes(l.status));
        break;
      case 'ganhos':
        result = result.filter(l => l.status === 'ganho');
        break;
      case 'perdidos':
        result = result.filter(l => l.status === 'perdido');
        break;
    }
    return result.sort((a, b) => (a.next_followup || 'z').localeCompare(b.next_followup || 'z'));
  }, [leads, filter, todayStr]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
            className={filter === f.value ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[130px]">Fonte</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[110px]">Telefone</TableHead>
                <TableHead className="w-[130px]">Produto</TableHead>
                <TableHead className="w-[120px]">Próximo FU</TableHead>
                <TableHead className="w-[100px] text-right">Valor Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem resultados</TableCell></TableRow>
              )}
              {filtered.map(lead => {
                const fuState = getFollowUpState(lead.next_followup);
                return (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenLead(lead)}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{statusLabel(lead.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.source || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.email || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{lead.potential_product || '—'}</TableCell>
                    <TableCell className={`text-sm ${fuClass(fuState)}`}>
                      <FuIcon state={fuState} />
                      {lead.next_followup ? format(new Date(lead.next_followup), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {Number(lead.estimated_value || 0) > 0 ? `${Number(lead.estimated_value).toLocaleString('pt-PT')}€` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
