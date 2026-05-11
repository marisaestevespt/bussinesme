import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, AlertTriangle, TrendingUp, Users, CalendarClock, UserX, Rocket, Clock } from 'lucide-react';
import { StatCard } from '@/components/editorial';

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
      <StatCard
        tone="primary"
        size="sm"
        value={allActiveCount}
        label={<><FolderOpen className="h-3 w-3 inline mr-1.5 -mt-0.5" />projetos ativos</>}
        hint={`${pontuaisCount} pontuais · ${recorrentesCount} recorrentes`}
      />
      <StatCard
        tone={overdueTasks > 0 ? 'destructive' : 'success'}
        size="sm"
        onClick={overdueClickable ? onClickOverdue : undefined}
        value={overdueTasks}
        label={<><AlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />tarefas atrasadas</>}
        hint={overdueTasks > 0 ? (overdueClickable ? 'clica para ver →' : 'requer atenção') : 'tudo em dia ✓'}
      />
      <StatCard
        tone="info"
        size="sm"
        value={`${weeklyCompletion.done}/${weeklyCompletion.total}`}
        label={<><TrendingUp className="h-3 w-3 inline mr-1.5 -mt-0.5" />conclusão semanal</>}
        hint={`${weeklyCompletion.rate}% concluído`}
      />
      <StatCard
        tone="violet"
        size="sm"
        value={allocatedMembers}
        label={<><Users className="h-3 w-3 inline mr-1.5 -mt-0.5" />membros alocados</>}
        hint="em projetos ativos"
      />
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
