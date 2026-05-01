import { Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  HEALTH_LABEL,
  computeProjectHealth,
  type ProjectHealthInput,
} from '@/lib/projectHealth';
import type { TaskLike } from '@/lib/taskStatus';

type ProjectTask = TaskLike & { project_id?: string | null };

interface ProjectHealthBadgeProps {
  project: ProjectHealthInput;
  tasks: ProjectTask[];
  today?: Date;
  progressOverride?: number | null;
  /** Visual style: compact pill (header) or full row (KPI). */
  variant?: 'pill' | 'card';
  className?: string;
}

const HEALTH_STYLES = {
  green: {
    badge: 'border-success/40 bg-success/10 text-success',
    dot: 'bg-success',
    icon: CheckCircle2,
  },
  yellow: {
    badge: 'border-warning/40 bg-warning/10 text-warning',
    dot: 'bg-warning',
    icon: AlertTriangle,
  },
  red: {
    badge: 'border-destructive/40 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
    icon: AlertTriangle,
  },
} as const;

export function ProjectHealthBadge({
  project,
  tasks,
  today = new Date(),
  progressOverride,
  variant = 'pill',
  className,
}: ProjectHealthBadgeProps) {
  const result = computeProjectHealth(project, tasks, today, progressOverride);
  const style = HEALTH_STYLES[result.health];
  const Icon = style.icon;
  const label = HEALTH_LABEL[result.health];

  const tooltipBody = (
    <div className="space-y-2 max-w-xs">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={cn('h-2 w-2 rounded-full', style.dot)} />
        Saúde do projeto: {label}
      </div>
      <p className="text-xs text-muted-foreground">{result.reason}</p>
      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {result.overdueCount > 0
            ? `${result.overdueCount} em atraso`
            : 'Sem atrasos'}
        </div>
        {!result.useOverdueOnly && result.prog !== null && (
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            {Math.round(result.prog)}% progresso
          </div>
        )}
        {result.daysLeft !== null && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Clock className="h-3 w-3" />
            {result.daysLeft >= 0
              ? `${result.daysLeft} dia${result.daysLeft === 1 ? '' : 's'} até ao prazo`
              : `${Math.abs(result.daysLeft)} dia${Math.abs(result.daysLeft) === 1 ? '' : 's'} de atraso no prazo`}
          </div>
        )}
        {!result.useOverdueOnly && result.expectedProg !== null && result.prog !== null && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Activity className="h-3 w-3" />
            Esperado a esta data: {Math.round(result.expectedProg)}%
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 cursor-help',
                className,
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  style.badge,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Saúde do projeto
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start">
            {tooltipBody}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 gap-1.5 px-2.5 py-1 text-[11px] font-medium cursor-help',
              style.badge,
              className,
            )}
          >
            <Icon className="h-3 w-3" />
            Saúde: {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}