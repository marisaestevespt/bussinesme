import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, AlertTriangle, TrendingUp, Users, CalendarClock, UserX, Rocket, Clock } from 'lucide-react';

interface OperacaoKpisProps {
  allActiveCount: number;
  pontuaisCount: number;
  recorrentesCount: number;
  overdueTasks: number;
  weeklyCompletion: { done: number; total: number; rate: number };
  allocatedMembers: number;
  onClickOverdue?: () => void;
}

export function OperacaoKpis({ allActiveCount, pontuaisCount, recorrentesCount, overdueTasks, weeklyCompletion, allocatedMembers, onClickOverdue }: OperacaoKpisProps) {
  const overdueClickable = overdueTasks > 0 && !!onClickOverdue;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="border-l-4 border-l-primary/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Projetos Ativos</p>
              <p className="kpi-display-sm mt-1">{allActiveCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{pontuaisCount} pontuais · {recorrentesCount} recorrentes</p>
            </div>
            <div className="p-2 rounded-md bg-primary/10"><FolderOpen className="h-4 w-4 text-primary" /></div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`border-l-4 ${overdueTasks > 0 ? 'border-l-destructive' : 'border-l-emerald-500'} ${overdueClickable ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}
        onClick={overdueClickable ? onClickOverdue : undefined}
        role={overdueClickable ? 'button' : undefined}
        tabIndex={overdueClickable ? 0 : undefined}
        onKeyDown={overdueClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickOverdue?.(); } } : undefined}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Tarefas Atrasadas</p>
              <p className={`kpi-display-sm mt-1 ${overdueTasks > 0 ? 'text-destructive' : 'text-success'}`}>{overdueTasks}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{overdueTasks > 0 ? (overdueClickable ? 'Clica para ver →' : 'Requer atenção') : 'Tudo em dia ✓'}</p>
            </div>
            <div className={`p-2 rounded-md ${overdueTasks > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <AlertTriangle className={`h-4 w-4 ${overdueTasks > 0 ? 'text-destructive' : 'text-success'}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Conclusão Semanal</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold">{weeklyCompletion.done}</p>
                <span className="text-sm text-muted-foreground">/ {weeklyCompletion.total}</span>
              </div>
            </div>
            <div className="p-2 rounded-md bg-info/10"><TrendingUp className="h-4 w-4 text-info" /></div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-info transition-all" style={{ width: `${Math.min(weeklyCompletion.rate, 100)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{weeklyCompletion.rate}% concluído</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-violet-500/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Membros Alocados</p>
              <p className="kpi-display-sm mt-1">{allocatedMembers}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">em projetos ativos</p>
            </div>
            <div className="p-2 rounded-md bg-accent-violet/10"><Users className="h-4 w-4 text-accent-violet" /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AlertsSummaryProps {
  stalledCount: number;
  nearEndCount: number;
  unassignedCount: number;
  overdueDeliverablesCount: number;
  recurrentesWithoutDeliverablesCount: number;
  totalAlerts: number;
  onViewDetails: () => void;
}

export function OperacaoAlertsSummary({
  stalledCount, nearEndCount, unassignedCount, overdueDeliverablesCount, recurrentesWithoutDeliverablesCount, totalAlerts, onViewDetails,
}: AlertsSummaryProps) {
  if (totalAlerts === 0) return null;

  return (
    <Card className="border border-warning/30 dark:border-warning bg-warning/15/50 dark:bg-warning/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-warning dark:text-warning">Alertas Operacionais</h3>
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">{totalAlerts}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" onClick={onViewDetails}>Ver detalhes →</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stalledCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning dark:text-warning"><strong>{stalledCount}</strong> projeto{stalledCount > 1 ? 's' : ''} sem progresso</span>
            </div>
          )}
          {nearEndCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning dark:text-warning"><strong>{nearEndCount}</strong> cliente{nearEndCount > 1 ? 's' : ''} perto do fim de ciclo</span>
            </div>
          )}
          {unassignedCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <UserX className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning dark:text-warning"><strong>{unassignedCount}</strong> tarefa{unassignedCount > 1 ? 's' : ''} sem responsável</span>
            </div>
          )}
          {overdueDeliverablesCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning dark:text-warning"><strong>{overdueDeliverablesCount}</strong> entrega{overdueDeliverablesCount > 1 ? 's' : ''} atrasada{overdueDeliverablesCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {recurrentesWithoutDeliverablesCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Rocket className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning dark:text-warning"><strong>{recurrentesWithoutDeliverablesCount}</strong> recorrente{recurrentesWithoutDeliverablesCount > 1 ? 's' : ''} sem entregas</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
