import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Entradas (s/ IVA)</p><p className="text-lg sm:text-xl font-bold text-success">{formatEuro(totalEntradas)}</p></CardContent></Card>
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Saídas (s/ IVA)</p><p className="text-lg sm:text-xl font-bold text-destructive">{formatEuro(totalSaidas)}</p></CardContent></Card>
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Resultado</p><p className={`text-lg sm:text-xl font-bold ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(resultado)}</p></CardContent></Card>
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Margem</p><p className={`text-lg sm:text-xl font-bold ${margem >= 0 ? 'text-success' : 'text-destructive'}`}>{margem}%</p></CardContent></Card>
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Média Mensal Ent.</p><p className="text-lg sm:text-xl font-bold">{formatEuro(avgEntradas)}</p></CardContent></Card>
      <Card><CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3"><p className="text-[10px] sm:text-xs text-muted-foreground">Média Mensal Saí.</p><p className="text-lg sm:text-xl font-bold">{formatEuro(avgSaidas)}</p></CardContent></Card>
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