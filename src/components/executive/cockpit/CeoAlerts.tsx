import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CalendarClock, Clock, FolderKanban, UserPlus, MessageSquareWarning, TrendingUp, ChevronRight, ShieldAlert, RefreshCw, Sparkles, Check, Eye, EyeOff, RotateCcw, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { useCeoCockpit } from '@/hooks/useCeoCockpit';
import { useDismissedAlerts } from '@/hooks/useDismissedAlerts';

type Derived = NonNullable<ReturnType<typeof useCeoCockpit>['derived']>;

type Severity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: Severity;
  icon: React.ElementType;
  title: string;
  detail: string;
  link: string;
  count: number;
}

function buildAlerts(derived: Derived): AlertItem[] {
  const a = derived.alerts;
  const list: AlertItem[] = [];

  if (a.overdueSales.length > 0) {
    list.push({
      id: `overdue-sales:${a.overdueSales.length}`, severity: 'critical', icon: AlertTriangle,
      title: 'Pagamentos em atraso',
      detail: `${a.overdueSales.length} venda${a.overdueSales.length === 1 ? '' : 's'} por receber`,
      link: '/hub/comercial/vendas', count: a.overdueSales.length,
    });
  }
  if (a.overdueProjects.length > 0) {
    list.push({
      id: `overdue-projects:${a.overdueProjects.length}`, severity: 'critical', icon: FolderKanban,
      title: 'Projetos atrasados',
      detail: `${a.overdueProjects.length} projeto${a.overdueProjects.length === 1 ? '' : 's'} passou${a.overdueProjects.length === 1 ? '' : 'aram'} o prazo`,
      link: '/hub/operacao', count: a.overdueProjects.length,
    });
  }
  if (a.overloadedMembers > 0) {
    list.push({
      id: `overload:${a.overloadedMembers}`, severity: a.overloadedMembers >= 3 ? 'critical' : 'warning', icon: UserPlus,
      title: 'Equipa sobrelotada',
      detail: `${a.overloadedMembers} membro${a.overloadedMembers === 1 ? '' : 's'} acima de 85% de ocupação`,
      link: '/executive/productivity', count: a.overloadedMembers,
    });
  }
  if (a.clientsNearEndOfCycle.length > 0) {
    list.push({
      id: `near-end:${a.clientsNearEndOfCycle.length}`, severity: 'warning', icon: CalendarClock,
      title: 'Clientes em fim de ciclo',
      detail: `${a.clientsNearEndOfCycle.length} cliente${a.clientsNearEndOfCycle.length === 1 ? '' : 's'} termina${a.clientsNearEndOfCycle.length === 1 ? '' : 'm'} nos próximos 30 dias`,
      link: '/hub/clientes', count: a.clientsNearEndOfCycle.length,
    });
  }
  if (a.renewalClients.length > 0) {
    list.push({
      id: `renewal:${a.renewalClients.length}`, severity: 'warning', icon: RefreshCw,
      title: 'Em altura de renovação',
      detail: `${a.renewalClients.length} cliente${a.renewalClients.length === 1 ? '' : 's'} no fim do ciclo — abrir renegociação?`,
      link: '/hub/clientes', count: a.renewalClients.length,
    });
  }
  if ((a as any).renegotiatingClients && (a as any).renegotiatingClients.length > 0) {
    const n = (a as any).renegotiatingClients.length;
    list.push({
      id: `renegotiating:${n}`, severity: 'critical', icon: Handshake,
      title: 'Renegociações em curso',
      detail: `${n} cliente${n === 1 ? '' : 's'} em renegociação ativa`,
      link: '/hub/clientes?tab=renegociacao', count: n,
    });
  }
  if (a.detractors.length > 0) {
    list.push({
      id: `detractors:${a.detractors.length}`, severity: 'warning', icon: MessageSquareWarning,
      title: 'Detratores no NPS',
      detail: `${a.detractors.length} avaliaç${a.detractors.length === 1 ? 'ão' : 'ões'} ≤ 6 nos últimos 90d`,
      link: '/hub/clientes/feedback', count: a.detractors.length,
    });
  }
  if (a.staleLeads.length > 0) {
    list.push({
      id: `stale-leads:${a.staleLeads.length}`, severity: 'warning', icon: Clock,
      title: 'Leads paradas',
      detail: `${a.staleLeads.length} lead${a.staleLeads.length === 1 ? '' : 's'} sem contacto há +14 dias`,
      link: '/hub/comercial/crm', count: a.staleLeads.length,
    });
  }
  if (a.expenseDeltaPct >= 25) {
    list.push({
      id: `expense-spike:${a.expenseDeltaPct}`, severity: a.expenseDeltaPct >= 50 ? 'critical' : 'warning', icon: TrendingUp,
      title: 'Despesas a subir',
      detail: `+${a.expenseDeltaPct}% face ao mês passado`,
      link: '/hub/financeiro/saidas', count: a.expenseDeltaPct,
    });
  }
  if (a.overdueTasks.length > 0) {
    list.push({
      id: `overdue-tasks:${a.overdueTasks.length}`, severity: 'info', icon: Clock,
      title: 'Tarefas atrasadas',
      detail: `${a.overdueTasks.length} tarefa${a.overdueTasks.length === 1 ? '' : 's'} por concluir`,
      link: '/tarefas', count: a.overdueTasks.length,
    });
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return list.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

const severityStyle: Record<Severity, { ring: string; iconBg: string }> = {
  critical: { ring: 'border-l-destructive', iconBg: 'bg-destructive/10 text-destructive' },
  warning: { ring: 'border-l-warning', iconBg: 'bg-warning/15 text-warning' },
  info: { ring: 'border-l-info', iconBg: 'bg-info/10 text-info' },
};

export function CeoAlerts({ derived }: { derived: Derived }) {
  const allAlerts = buildAlerts(derived);
  const { isDismissed, dismiss, restore } = useDismissedAlerts();
  const [showHandled, setShowHandled] = useState(false);

  const active = allAlerts.filter(a => !isDismissed(a.id));
  const handled = allAlerts.filter(a => isDismissed(a.id));

  const counts = {
    critical: active.filter(a => a.severity === 'critical').length,
    warning: active.filter(a => a.severity === 'warning').length,
    info: active.filter(a => a.severity === 'info').length,
  };

  const visible = showHandled ? handled : active;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Alertas que exigem decisão
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {!showHandled && counts.critical > 0 && <Badge variant="destructive" className="text-[10px]">{counts.critical} crítico{counts.critical === 1 ? '' : 's'}</Badge>}
            {!showHandled && counts.warning > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">{counts.warning} atenção</Badge>}
            {!showHandled && counts.info > 0 && <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-[10px]">{counts.info}</Badge>}
            {handled.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2"
                onClick={() => setShowHandled(s => !s)}
              >
                {showHandled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showHandled ? 'Ver ativos' : `Tratados (${handled.length})`}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <Sparkles className="h-6 w-6 text-success" />
            <p className="text-sm font-medium">{showHandled ? 'Nenhum alerta tratado hoje' : 'Tudo sob controlo'}</p>
            <p className="text-xs text-muted-foreground">
              {showHandled ? 'Os alertas tratados ficam visíveis durante o dia.' : 'Nenhuma decisão urgente neste momento.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {visible.map(a => {
              const Icon = a.icon;
              const s = severityStyle[a.severity];
              return (
                <div
                  key={a.id}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border-l-2 bg-muted/30 p-3 transition-all hover:bg-muted/60 hover:shadow-sm',
                    s.ring,
                    showHandled && 'opacity-70',
                  )}
                >
                  <Link to={a.link} className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn('rounded-md p-2 shrink-0', s.iconBg)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-0.5" />
                  </Link>
                  {showHandled ? (
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 shrink-0 -mr-1 -mt-1"
                      title="Repor alerta"
                      onClick={(e) => { e.preventDefault(); restore(a.id); }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 shrink-0 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Marcar como tratado"
                      onClick={(e) => { e.preventDefault(); dismiss(a.id); }}
                    >
                      <Check className="h-3.5 w-3.5 text-success" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
