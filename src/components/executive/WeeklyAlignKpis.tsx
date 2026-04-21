import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Target, Users, AlertTriangle, Wallet, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function DeltaBadge({ current, previous, suffix = '', isCurrency = false }: { current: number; previous: number; suffix?: string; isCurrency?: boolean }) {
  const diff = current - previous;
  if (diff === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> =</span>;
  const formatted = isCurrency ? `€${Math.abs(diff).toLocaleString()}` : `${Math.abs(diff)}${suffix}`;
  return diff > 0
    ? <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> +{formatted}</span>
    : <span className="text-xs text-destructive flex items-center gap-0.5"><TrendingDown className="h-3 w-3" /> -{formatted}</span>;
}

interface KpiCardsProps {
  salesWeekTotal: number;
  prevSalesWeekTotal: number;
  tasksWeekDone: number;
  tasksWeekCount: number;
  prevTasksWeekCount: number;
  leadsCount: number;
  followUpsCount: number;
  overdueNpsCount: number;
  meetingsWeekCount: number;
  prevMeetingsWeekCount: number;
}

export function WeeklyKpiCards(props: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Faturação (semana)</span>
        </div>
        <p className="text-lg font-bold">€{props.salesWeekTotal.toLocaleString()}</p>
        <DeltaBadge current={props.salesWeekTotal} previous={props.prevSalesWeekTotal} isCurrency />
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tarefas (semana)</span>
        </div>
        <p className="text-lg font-bold">{props.tasksWeekDone}/{props.tasksWeekCount}</p>
        <DeltaBadge current={props.tasksWeekCount} previous={props.prevTasksWeekCount} />
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Leads ativas</span>
        </div>
        <p className="text-lg font-bold">{props.leadsCount}</p>
        <span className="text-xs text-muted-foreground">{props.followUpsCount} follow-ups pendentes</span>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">NPS em atraso</span>
        </div>
        <p className={cn("text-lg font-bold", props.overdueNpsCount > 0 && "text-destructive")}>{props.overdueNpsCount}</p>
        <div className="flex gap-2">
          <span className="text-xs text-muted-foreground">{props.meetingsWeekCount} reuniões</span>
          <DeltaBadge current={props.meetingsWeekCount} previous={props.prevMeetingsWeekCount} />
        </div>
      </CardContent></Card>
    </div>
  );
}

interface CapacityFinancialProps {
  capacityAlert: { pct: number; totalCapacity: number; totalUsed: number; overloadedCount: number; total: number } | null;
  totalBilled: number;
  financialSummary: { totalExpenses: number; totalPayroll: number; totalCosts: number; totalPending: number; balance: number };
  currentMonth: number;
}

export function CapacityFinancialCards({ capacityAlert, totalBilled, financialSummary, currentMonth }: CapacityFinancialProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {capacityAlert && (
        <Card className={cn(
          "border-l-4",
          capacityAlert.pct >= 95 ? "border-l-destructive bg-destructive/5" :
          capacityAlert.pct >= 75 ? "border-l-amber-500 bg-warning/15/50" :
          "border-l-emerald-500 bg-success/15/50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-lg p-2 mt-0.5",
                capacityAlert.pct >= 95 ? "bg-destructive/10 text-destructive" :
                capacityAlert.pct >= 75 ? "bg-warning/15 text-warning" :
                "bg-success/15 text-success"
              )}>
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold">
                  {capacityAlert.pct >= 95
                    ? '⚠️ Capacidade esgotada'
                    : capacityAlert.pct >= 75
                    ? '📊 Capacidade limitada'
                    : '✅ Capacidade saudável'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {capacityAlert.pct}% ocupação — {capacityAlert.totalUsed}h de {capacityAlert.totalCapacity}h
                  {capacityAlert.overloadedCount > 0 && ` • ${capacityAlert.overloadedCount} membro(s) acima de 85%`}
                </p>
                <Progress value={Math.min(capacityAlert.pct, 100)} className="h-2 mt-1" />
                <Link to="/executive/productivity?tab=simulation" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                  Ver simulador <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 mt-0.5 bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-sm font-semibold">Financeiro — {MONTH_NAMES[currentMonth - 1]}</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Faturação</p>
                  <p className="font-semibold text-success">€{totalBilled.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Custos</p>
                  <p className="font-semibold text-destructive">€{financialSummary.totalCosts.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo</p>
                  <p className={cn("font-semibold", financialSummary.balance >= 0 ? "text-success" : "text-destructive")}>
                    €{financialSummary.balance.toLocaleString()}
                  </p>
                </div>
              </div>
              {financialSummary.totalPending > 0 && (
                <p className="text-xs text-warning">⚠ €{financialSummary.totalPending.toLocaleString()} por pagar</p>
              )}
              <div className="flex gap-3 mt-1">
                <Link to="/hub/financeiro/entradas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Entradas <ArrowUpRight className="h-3 w-3" />
                </Link>
                <Link to="/hub/financeiro/saidas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Saídas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
