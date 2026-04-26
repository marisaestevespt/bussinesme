import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarClock, Clock, FolderKanban, UserPlus, MessageSquareWarning, TrendingUp, ChevronRight, ShieldAlert, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { useCeoCockpit } from '@/hooks/useCeoCockpit';

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
      id: 'overdue-sales', severity: 'critical', icon: AlertTriangle,
      title: 'Pagamentos em atraso',
      detail: `${a.overdueSales.length} venda${a.overdueSales.length === 1 ? '' : 's'} por receber`,
      link: '/hub/comercial/vendas', count: a.overdueSales.length,
    });
  }
  if (a.overdueProjects.length > 0) {
    list.push({
      id: 'overdue-projects', severity: 'critical', icon: FolderKanban,
      title: 'Projetos atrasados',
      detail: `${a.overdueProjects.length} projeto${a.overdueProjects.length === 1 ? '' : 's'} passou${a.overdueProjects.length === 1 ? '' : 'aram'} o prazo`,
      link: '/hub/operacao', count: a.overdueProjects.length,
    });
  }
  if (a.overloadedMembers > 0) {
    list.push({
      id: 'overload', severity: a.overloadedMembers >= 3 ? 'critical' : 'warning', icon: UserPlus,
      title: 'Equipa sobrelotada',
      detail: `${a.overloadedMembers} membro${a.overloadedMembers === 1 ? '' : 's'} acima de 85% de ocupação`,
      link: '/executive/productivity', count: a.overloadedMembers,
    });
  }
  if (a.clientsNearEndOfCycle.length > 0) {
    list.push({
      id: 'near-end', severity: 'warning', icon: CalendarClock,
      title: 'Clientes em fim de ciclo',
      detail: `${a.clientsNearEndOfCycle.length} cliente${a.clientsNearEndOfCycle.length === 1 ? '' : 's'} termina${a.clientsNearEndOfCycle.length === 1 ? '' : 'm'} nos próximos 30 dias`,
      link: '/hub/clientes', count: a.clientsNearEndOfCycle.length,
    });
  }
  if (a.renewalClients.length > 0) {
    list.push({
      id: 'renewal', severity: 'warning', icon: RefreshCw,
      title: 'Clientes em renovação',
      detail: `${a.renewalClients.length} a renegociar`,
      link: '/hub/clientes', count: a.renewalClients.length,
    });
  }
  if (a.detractors.length > 0) {
    list.push({
      id: 'detractors', severity: 'warning', icon: MessageSquareWarning,
      title: 'Detratores no NPS',
      detail: `${a.detractors.length} avaliaç${a.detractors.length === 1 ? 'ão' : 'ões'} ≤ 6 nos últimos 90d`,
      link: '/hub/clientes/feedback', count: a.detractors.length,
    });
  }
  if (a.staleLeads.length > 0) {
    list.push({
      id: 'stale-leads', severity: 'warning', icon: Clock,
      title: 'Leads paradas',
      detail: `${a.staleLeads.length} lead${a.staleLeads.length === 1 ? '' : 's'} sem contacto há +14 dias`,
      link: '/hub/comercial/crm', count: a.staleLeads.length,
    });
  }
  if (a.expenseDeltaPct >= 25) {
    list.push({
      id: 'expense-spike', severity: a.expenseDeltaPct >= 50 ? 'critical' : 'warning', icon: TrendingUp,
      title: 'Despesas a subir',
      detail: `+${a.expenseDeltaPct}% face ao mês passado`,
      link: '/hub/financeiro/despesas', count: a.expenseDeltaPct,
    });
  }
  if (a.overdueTasks.length > 0) {
    list.push({
      id: 'overdue-tasks', severity: 'info', icon: Clock,
      title: 'Tarefas atrasadas',
      detail: `${a.overdueTasks.length} tarefa${a.overdueTasks.length === 1 ? '' : 's'} por concluir`,
      link: '/tarefas', count: a.overdueTasks.length,
    });
  }

  // Order: critical > warning > info, then by count desc
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return list.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

const severityStyle: Record<Severity, { ring: string; iconBg: string; badge: string; label: string }> = {
  critical: { ring: 'border-l-destructive', iconBg: 'bg-destructive/10 text-destructive', badge: 'bg-destructive text-destructive-foreground', label: 'Crítico' },
  warning: { ring: 'border-l-warning', iconBg: 'bg-warning/15 text-warning', badge: 'bg-warning/20 text-warning border-warning/40', label: 'Atenção' },
  info: { ring: 'border-l-info', iconBg: 'bg-info/10 text-info', badge: 'bg-info/15 text-info border-info/30', label: 'Info' },
};

export function CeoAlerts({ derived }: { derived: Derived }) {
  const alerts = buildAlerts(derived);
  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Alertas que exigem decisão
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {counts.critical > 0 && <Badge variant="destructive" className="text-[10px]">{counts.critical} crítico{counts.critical === 1 ? '' : 's'}</Badge>}
            {counts.warning > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">{counts.warning} atenção</Badge>}
            {counts.info > 0 && <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-[10px]">{counts.info}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <Sparkles className="h-6 w-6 text-success" />
            <p className="text-sm font-medium">Tudo sob controlo</p>
            <p className="text-xs text-muted-foreground">Nenhuma decisão urgente neste momento.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map(a => {
              const Icon = a.icon;
              const s = severityStyle[a.severity];
              return (
                <Link
                  key={a.id}
                  to={a.link}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border-l-2 bg-muted/30 p-3 transition-all hover:bg-muted/60 hover:shadow-sm',
                    s.ring,
                  )}
                >
                  <div className={cn('rounded-md p-2 shrink-0', s.iconBg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.detail}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors mt-0.5" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}