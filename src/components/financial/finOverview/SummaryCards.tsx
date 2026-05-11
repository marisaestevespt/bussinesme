import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownToLine, ArrowUpFromLine, Scale, Percent, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { StatCard } from '@/components/editorial';

interface SummaryProps {
  totalEntradas: number;
  totalSaidas: number;
  resultado: number;
  margem: number;
  avgEntradas: number;
  avgSaidas: number;
}

export function SummaryCards({ totalEntradas, totalSaidas, resultado, margem, avgEntradas, avgSaidas }: SummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
      <StatCard tone="success" size="sm" value={formatEuro(totalEntradas)} label={<><ArrowDownToLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />entradas (s/ IVA)</>} />
      <StatCard tone="destructive" size="sm" value={formatEuro(totalSaidas)} label={<><ArrowUpFromLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />saídas (s/ IVA)</>} />
      <StatCard tone={resultado >= 0 ? 'success' : 'destructive'} size="sm" value={formatEuro(resultado)} label={<><Scale className="h-3 w-3 inline mr-1.5 -mt-0.5" />resultado</>} />
      <StatCard tone={margem >= 0 ? 'gold' : 'destructive'} size="sm" value={`${margem}%`} label={<><Percent className="h-3 w-3 inline mr-1.5 -mt-0.5" />margem</>} />
      <StatCard tone="mocha" size="sm" value={formatEuro(avgEntradas)} label={<><BarChart3 className="h-3 w-3 inline mr-1.5 -mt-0.5" />média mensal ent.</>} />
      <StatCard tone="muted" size="sm" value={formatEuro(avgSaidas)} label={<><BarChart3 className="h-3 w-3 inline mr-1.5 -mt-0.5" />média mensal saí.</>} />
    </div>
  );
}

interface BWMonth { mes: string; resultado: number; }

export function BestWorstMonth({ best, worst }: { best: BWMonth; worst: BWMonth }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-success/30 bg-success/15/50 dark:bg-success/20 dark:border-success">
        <CardContent className="pt-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-success shrink-0" />
          <div><p className="text-xs text-muted-foreground">Melhor mês</p><p className="font-semibold">{best.mes}</p><p className="text-sm text-success">{formatEuro(best.resultado)}</p></div>
        </CardContent>
      </Card>
      <Card className="border-destructive/30 bg-destructive/15/50 dark:bg-destructive/20 dark:border-destructive">
        <CardContent className="pt-4 flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
          <div><p className="text-xs text-muted-foreground">Pior mês</p><p className="font-semibold">{worst.mes}</p><p className="text-sm text-destructive">{formatEuro(worst.resultado)}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}