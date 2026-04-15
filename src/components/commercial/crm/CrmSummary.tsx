import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Phone, TrendingUp, Trophy, AlertTriangle, Clock, GitBranchPlus } from 'lucide-react';
import { format } from 'date-fns';
import { getFollowUpState, statusLabel } from '@/hooks/useCrmData';
import { useCrmStages } from '@/hooks/useCrmStages';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  lead: '#6366f1',
  primeiro_contacto: '#8b5cf6',
  sessao_agendada: '#a78bfa',
  proposta_enviada: '#3b82f6',
  follow_up_1: '#f59e0b',
  follow_up_2: '#f97316',
  follow_up_3: '#ef4444',
  aguarda_retorno: '#64748b',
  outra_altura: '#94a3b8',
  ganho: '#22c55e',
  perdido: '#dc2626',
};

interface CrmSummaryProps {
  activeCount: number;
  toContactToday: any[];
  pipelineValue: number;
  winsThisMonth: number;
  allLeads: any[];
  onOpenLead: (lead: any) => void;
}

export function CrmSummary({ activeCount, toContactToday, pipelineValue, winsThisMonth, allLeads, onOpenLead }: CrmSummaryProps) {
  const navigate = useNavigate();
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of allLeads) {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    }
    return CRM_STATUSES
      .map(s => ({ status: s.value, label: s.label, count: counts[s.value] || 0 }))
      .filter(d => d.count > 0);
  }, [allLeads]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/hub/comercial/pipelines')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <GitBranchPlus className="h-4.5 w-4.5 text-accent-foreground" />
            </div>
            <div><p className="text-sm font-semibold">Pipelines</p><p className="text-xs text-muted-foreground">Ver todos</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Leads by status chart */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Leads por Status</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Leads']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
