import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, UserMinus, UserPlus, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWeeklyStrategicMetrics } from '@/hooks/useStrategicMetrics';

function fmt(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function WeeklyStrategicMetrics() {
  const m = useWeeklyStrategicMetrics();

  const ltvCacColor = m.ltvCacRatio < 1
    ? 'text-destructive'
    : m.ltvCacRatio < 3
    ? 'text-warning'
    : 'text-success';

  const mrrDiff = m.mrrPrev !== null ? m.mrr - m.mrrPrev : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">MRR</span>
                {m.isLoading ? <Skeleton className="h-6 w-16 mt-1" /> : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold">{m.mrr > 0 ? `€${fmt(m.mrr)}` : '—'}</p>
                    {mrrDiff !== null && mrrDiff !== 0 && (
                      <span className={cn("text-xs flex items-center gap-0.5", mrrDiff > 0 ? "text-success" : "text-destructive")}>
                        {mrrDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        €{Math.abs(mrrDiff)}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Receita Recorrente Mensal atual</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Churn (semana)</span>
                {m.isLoading ? <Skeleton className="h-6 w-10 mt-1" /> : (
                  <p className={cn("text-lg font-bold", m.churnWeek > 0 && "text-destructive")}>
                    {m.churnWeek}
                  </p>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Clientes perdidos esta semana</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Novos (semana)</span>
                {m.isLoading ? <Skeleton className="h-6 w-10 mt-1" /> : (
                  <p className={cn("text-lg font-bold", m.newClientsWeek > 0 && "text-success")}>
                    {m.newClientsWeek}
                  </p>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Novos clientes esta semana</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardContent className="p-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">LTV/CAC</span>
                {m.isLoading ? <Skeleton className="h-6 w-10 mt-1" /> : (
                  <p className={cn("text-lg font-bold", m.ltvCacRatio > 0 ? ltvCacColor : '')}>
                    {m.ltvCacRatio > 0 ? fmtDec(m.ltvCacRatio) : '—'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Rácio LTV/CAC: &gt;3 = saudável</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
