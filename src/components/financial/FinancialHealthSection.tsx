import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sumRevenue } from '@/lib/salesCalculations';
import {
  calculateMRR,
  forecastRecurringRevenue,
  recurringChurn,
  revenueConcentration,
} from '@/lib/financialHealth';
import { formatEuro } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; status?: string };

interface Props {
  sales: Sale[];
  allSales: Sale[];
  currentYear: number;
  month: number;
}

export function FinancialHealthSection({ sales, allSales, currentYear, month }: Props) {
  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-financial-health'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-financial-health'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, product_type, ticket');
      return data || [];
    },
  });

  const monthSales = sales; // already filtered

  // 1. MRR — clients with active status + product_type = 'servico_mensal'
  const mrr = useMemo(() => calculateMRR(clients, products), [clients, products]);

  // 2. Revenue concentration — top 3 clients by revenue share
  const concentration = useMemo(() => revenueConcentration(monthSales), [monthSales]);

  // 3. Forecast next month
  const forecast = useMemo(() => {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? currentYear + 1 : currentYear;
    const nextMonthEnd = new Date(nextYear, nextMonth, 0); // last day of next month
    // Preferimos vendas REAIS já agendadas para esse mês (alinha com Previsibilidade
    // e respeita pro-rata, fim de ciclo, etc.). Caímos para forecast por ticket
    // apenas quando ainda não há nada agendado.
    const scheduledSales = allSales.filter(
      s => s.sale_year === nextYear && s.sale_month === nextMonth,
    );
    const scheduledTotal = scheduledSales.reduce(
      (sum, s) => sum + (Number(s.base_value) || 0),
      0,
    );
    const scheduledClients = new Set(
      scheduledSales.map(s => s.client).filter(Boolean) as string[],
    );
    if (scheduledTotal > 0) {
      return {
        total: scheduledTotal,
        count: scheduledClients.size,
        label: `${MONTHS[nextMonth - 1]} ${nextYear}`,
        source: 'scheduled' as const,
      };
    }
    const { total, count } = forecastRecurringRevenue(clients, products, nextMonthEnd);
    return {
      total,
      count,
      label: `${MONTHS[nextMonth - 1]} ${nextYear}`,
      source: 'estimate' as const,
    };
  }, [clients, products, month, currentYear, allSales]);

  // 4. Revenue churn
  const churn = useMemo(() => {
    const monthStart = new Date(currentYear, month - 1, 1);
    const monthEnd = new Date(currentYear, month, 0);
    return recurringChurn(clients, products, monthStart, monthEnd);
  }, [clients, products, currentYear, month]);

  return (
    <Card className="bg-primary/10 border-primary/30">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Saúde Financeira</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* MRR */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">MRR (Receita Recorrente)</p>
              </div>
              <p className="text-lg font-bold">{formatEuro(mrr.total)}</p>
              <p className="text-[10px] text-muted-foreground">{mrr.count} cliente{mrr.count !== 1 ? 's' : ''} com produto mensal</p>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Previsão {forecast.label}</p>
              </div>
              <p className="text-lg font-bold">{formatEuro(forecast.total)}</p>
              <p className="text-[10px] text-muted-foreground">
                {forecast.count} cliente{forecast.count !== 1 ? 's' : ''}{' '}
                {forecast.source === 'scheduled' ? 'agendado' : 'previsto'}
                {forecast.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Churn */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Churn de Receita</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-success">+{formatEuro(churn.gainedRevenue)}</span>
                <span className="text-xs text-destructive">-{formatEuro(churn.lostRevenue)}</span>
              </div>
              <p className={`text-lg font-bold ${churn.net >= 0 ? 'text-success' : 'text-destructive'}`}>{churn.net >= 0 ? '+' : ''}{formatEuro(churn.net)}</p>
              <p className="text-[10px] text-muted-foreground">{churn.gainedCount} novo{churn.gainedCount !== 1 ? 's' : ''} · {churn.lostCount} saíd{churn.lostCount !== 1 ? 'as' : 'a'}</p>
            </CardContent>
          </Card>

          {/* Concentration */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Concentração de Receita</p>
              </div>
              {concentration.topClients.length === 0 ? (
                <EmptyHint>Sem dados</EmptyHint>
              ) : (
                <div className="space-y-0.5">
                  {concentration.topClients.map((c, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="truncate max-w-[120px]">{c.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${c.pct > 30 ? 'bg-warning/15 text-warning border-warning/30' : ''}`}>
                        {c.pct.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {concentration.alerts.length > 0 && (
          <div className="space-y-2">
            {concentration.alerts.map((c, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-background border-2 border-warning/60 shadow-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <span className="font-semibold text-warning">Atenção</span> — {c.name} representa {c.pct.toFixed(1)}% da receita este mês.
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
