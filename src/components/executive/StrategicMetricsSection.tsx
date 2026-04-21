import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Activity, DollarSign, UserMinus, Users, BarChart3, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStrategicMetrics, type MetricPeriod } from '@/hooks/useStrategicMetrics';

const PERIOD_OPTIONS = [
  { value: 'last_month', label: 'Último mês' },
  { value: 'last_quarter', label: 'Último trimestre' },
  { value: 'last_year', label: 'Último ano' },
  { value: 'all_time', label: 'Desde sempre' },
];

function fmt(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(v: number) {
  return v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function TrendIndicator({ current, previous, suffix = '', invert = false }: { current: number; previous: number | null; suffix?: string; invert?: boolean }) {
  if (previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> =</span>;
  const isPositive = invert ? diff < 0 : diff > 0;
  const pctChange = previous !== 0 ? Math.round(Math.abs(diff / previous) * 100) : 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn("text-xs flex items-center gap-0.5", isPositive ? "text-success" : "text-destructive")}>
      <Icon className="h-3 w-3" /> {pctChange > 0 ? `${pctChange}%` : ''}{suffix}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, tooltip, trend, statusColor, statusLabel, isLoading, estimated }: {
  icon: any;
  label: string;
  value: string;
  tooltip: string;
  trend?: React.ReactNode;
  statusColor?: string;
  statusLabel?: string;
  isLoading?: boolean;
  estimated?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="hover:shadow-md transition-shadow cursor-help">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{label}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <>
                  <p className="text-xl font-bold tracking-tight">{value}</p>
                  <div className="flex items-center gap-2 mt-1 min-h-[20px]">
                    {trend}
                    {estimated && <span className="text-[10px] text-warning bg-warning/15 px-1.5 py-0.5 rounded">estimativa</span>}
                    {statusColor && statusLabel && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusColor)}>{statusLabel}</span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StrategicMetricsSection() {
  const [period, setPeriod] = useState<MetricPeriod>('last_quarter');
  const m = useStrategicMetrics(period);

  const ltvCacStatus = m.ltvCacRatio < 1
    ? { color: 'bg-destructive/10 text-destructive', label: 'Insustentável' }
    : m.ltvCacRatio < 3
    ? { color: 'bg-warning/15 text-warning', label: 'A melhorar' }
    : { color: 'bg-success/15 text-success', label: 'Saudável' };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Saúde do Negócio</h2>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as MetricPeriod)}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard
          icon={DollarSign}
          label="MRR"
          value={m.mrr > 0 ? `€${fmt(m.mrr)}` : '—'}
          tooltip="Receita Recorrente Mensal: soma do ticket de clientes ativos com produto mensal."
          trend={<TrendIndicator current={m.mrr} previous={m.mrrPrev} />}
          isLoading={m.isLoading}
        />
        <MetricCard
          icon={BarChart3}
          label="LTV"
          value={m.ltv > 0 ? `€${fmt(m.ltv)}` : '—'}
          tooltip={`Lifetime Value: ticket médio × tempo médio de retenção (${fmtDec(m.avgRetentionMonths)} meses).`}
          isLoading={m.isLoading}
          estimated={m.ltvEstimated}
        />
        <MetricCard
          icon={Users}
          label="CAC"
          value={m.cac > 0 ? `€${fmt(m.cac)}` : '—'}
          tooltip={`Custo de Aquisição: despesas de marketing e comerciais / ${m.newClientsCount} novos clientes no período.`}
          isLoading={m.isLoading}
        />
        <MetricCard
          icon={UserMinus}
          label="Churn"
          value={m.churnRate > 0 ? `${fmtDec(m.churnRate)}%` : '0%'}
          tooltip={`Taxa de churn: ${m.lostClientsCount} clientes perdidos no período.`}
          trend={<TrendIndicator current={m.churnRate} previous={m.churnRatePrev} invert />}
          isLoading={m.isLoading}
        />
        <MetricCard
          icon={BarChart3}
          label="LTV/CAC"
          value={m.cac > 0 ? fmtDec(m.ltvCacRatio) : '—'}
          tooltip="Rácio LTV/CAC: acima de 3 = negócio saudável, abaixo de 1 = insustentável."
          statusColor={m.cac > 0 ? ltvCacStatus.color : undefined}
          statusLabel={m.cac > 0 ? ltvCacStatus.label : undefined}
          isLoading={m.isLoading}
        />
        <MetricCard
          icon={Clock}
          label="Retenção"
          value={`${fmtDec(m.avgRetentionMonths)} meses`}
          tooltip="Tempo médio que os clientes permanecem ativos."
          isLoading={m.isLoading}
          estimated={m.avgRetentionEstimated}
        />
        <MetricCard
          icon={Star}
          label="NPS (90d)"
          value={m.avgNps !== null ? fmtDec(m.avgNps) : '—'}
          tooltip={m.avgNps !== null ? "Média de NPS dos últimos 90 dias." : "Dados insuficientes para calcular."}
          isLoading={m.isLoading}
        />
      </div>
    </section>
  );
}
