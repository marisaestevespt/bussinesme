import { Card, CardContent } from '@/components/ui/card';
import { Package, ArrowUpRight, UserCheck, BarChart3 } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { expenseLabel } from '@/lib/financialCategories';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Insight { name: string; value: number; }

interface Props {
  productInsights: { best: Insight | null; worst: Insight | null };
  categoryInsights: { biggest: Insight | null; smallest: Insight | null };
  clientsInYear: number;
  yearSalesCount: number;
  yearExpensesCount: number;
}

export function InsightsRow({ productInsights, categoryInsights, clientsInYear, yearSalesCount, yearExpensesCount }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Package className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Produto + vendido</p></div>
            {productInsights.best ? (<><p className="text-sm font-semibold truncate">{productInsights.best.name}</p><p className="text-xs text-muted-foreground">{formatEuro(productInsights.best.value)}</p></>) : <EmptyHint>Sem dados</EmptyHint>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><Package className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Produto - vendido</p></div>
            {productInsights.worst ? (<><p className="text-sm font-semibold truncate">{productInsights.worst.name}</p><p className="text-xs text-muted-foreground">{formatEuro(productInsights.worst.value)}</p></>) : <EmptyHint>Sem dados</EmptyHint>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Maior despesa</p></div>
            {categoryInsights.biggest ? (<><p className="text-sm font-semibold">{expenseLabel(categoryInsights.biggest.name)}</p><p className="text-xs text-muted-foreground">{formatEuro(categoryInsights.biggest.value)}</p></>) : <EmptyHint>Sem dados</EmptyHint>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Menor despesa</p></div>
            {categoryInsights.smallest ? (<><p className="text-sm font-semibold">{expenseLabel(categoryInsights.smallest.name)}</p><p className="text-xs text-muted-foreground">{formatEuro(categoryInsights.smallest.value)}</p></>) : <EmptyHint>Sem dados</EmptyHint>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><UserCheck className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Clientes no ano</p></div>
            <p className="text-xl font-bold">{clientsInYear}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total de vendas registadas</p></div>
            <p className="text-xl font-bold">{yearSalesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total de despesas registadas</p></div>
            <p className="text-xl font-bold">{yearExpensesCount}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}