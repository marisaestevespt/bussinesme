import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
  const mrr = useMemo(() => {
    const recurringProducts = new Set(
      products.filter(p => p.product_type === 'servico_mensal').map(p => p.name)
    );
    const recurringProductTickets = new Map(
      products.filter(p => p.product_type === 'servico_mensal').map(p => [p.name, parseFloat(p.ticket || '0') || 0])
    );

    const activeRecurringClients = clients.filter(c =>
      c.status === 'ativo' && c.current_product && recurringProducts.has(c.current_product)
    );

    const total = activeRecurringClients.reduce((sum, c) => {
      return sum + (recurringProductTickets.get(c.current_product!) || 0);
    }, 0);

    return { total, count: activeRecurringClients.length };
  }, [clients, products]);

  // 2. Revenue concentration — top 3 clients by revenue share
  const concentration = useMemo(() => {
    const totalRevenue = monthSales.reduce((s, v) => s + v.invoice_total, 0);
    if (totalRevenue === 0) return { topClients: [], alerts: [] };

    const byClient = new Map<string, number>();
    monthSales.forEach(s => {
      const name = s.client || 'Sem cliente';
      byClient.set(name, (byClient.get(name) || 0) + s.invoice_total);
    });

    const sorted = [...byClient.entries()]
      .map(([name, value]) => ({ name, value, pct: (value / totalRevenue) * 100 }))
      .sort((a, b) => b.value - a.value);

    const topClients = sorted.slice(0, 3);
    const alerts = sorted.filter(c => c.pct > 30);

    return { topClients, alerts, totalRevenue };
  }, [monthSales]);

  // 3. Forecast next month
  const forecast = useMemo(() => {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? currentYear + 1 : currentYear;
    const nextMonthEnd = new Date(nextYear, nextMonth, 0); // last day of next month

    const recurringProducts = new Map(
      products.filter(p => p.product_type === 'servico_mensal').map(p => [p.name, parseFloat(p.ticket || '0') || 0])
    );

    const activeClients = clients.filter(c => {
      if (c.status !== 'ativo' || !c.current_product) return false;
      if (!recurringProducts.has(c.current_product)) return false;
      if (c.end_of_cycle) {
        const endDate = new Date(c.end_of_cycle);
        return endDate > nextMonthEnd;
      }
      return true; // no end date = ongoing
    });

    const total = activeClients.reduce((sum, c) => {
      return sum + (recurringProducts.get(c.current_product!) || 0);
    }, 0);

    return {
      total,
      count: activeClients.length,
      label: `${MONTHS[nextMonth - 1]} ${nextYear}`,
    };
  }, [clients, products, month, currentYear]);

  // 4. Revenue churn
  const churn = useMemo(() => {
    const monthStart = new Date(currentYear, month - 1, 1);
    const monthEnd = new Date(currentYear, month, 0);

    // Clients that ended this month (status = 'terminado' and end_of_cycle in this month)
    const lostClients = clients.filter(c => {
      if (c.status !== 'terminado' || !c.end_of_cycle) return false;
      const endDate = new Date(c.end_of_cycle);
      return endDate >= monthStart && endDate <= monthEnd;
    });

    const recurringProductTickets = new Map(
      products.filter(p => p.product_type === 'servico_mensal').map(p => [p.name, parseFloat(p.ticket || '0') || 0])
    );

    const lostRevenue = lostClients.reduce((sum, c) => {
      return sum + (recurringProductTickets.get(c.current_product || '') || 0);
    }, 0);

    // New clients that started this month
    const newClients = clients.filter(c => {
      if (!c.start_date) return false;
      const startDate = new Date(c.start_date);
      return startDate >= monthStart && startDate <= monthEnd && c.status === 'ativo';
    });

    const gainedRevenue = newClients.reduce((sum, c) => {
      return sum + (recurringProductTickets.get(c.current_product || '') || 0);
    }, 0);

    const net = gainedRevenue - lostRevenue;

    return { lostRevenue, lostCount: lostClients.length, gainedRevenue, gainedCount: newClients.length, net };
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
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">MRR (Receita Recorrente)</p>
              </div>
              <p className="text-lg font-bold">{fmt(mrr.total)}</p>
              <p className="text-[10px] text-muted-foreground">{mrr.count} cliente{mrr.count !== 1 ? 's' : ''} com produto mensal</p>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Previsão {forecast.label}</p>
              </div>
              <p className="text-lg font-bold">{fmt(forecast.total)}</p>
              <p className="text-[10px] text-muted-foreground">{forecast.count} cliente{forecast.count !== 1 ? 's' : ''} activo{forecast.count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          {/* Churn */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Churn de Receita</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-success">+{fmt(churn.gainedRevenue)}</span>
                <span className="text-xs text-destructive">-{fmt(churn.lostRevenue)}</span>
              </div>
              <p className={`text-lg font-bold ${churn.net >= 0 ? 'text-success' : 'text-destructive'}`}>{churn.net >= 0 ? '+' : ''}{fmt(churn.net)}</p>
              <p className="text-[10px] text-muted-foreground">{churn.gainedCount} novo{churn.gainedCount !== 1 ? 's' : ''} · {churn.lostCount} saíd{churn.lostCount !== 1 ? 'as' : 'a'}</p>
            </CardContent>
          </Card>

          {/* Concentration */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Concentração de Receita</p>
              </div>
              {concentration.topClients.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados</p>
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
          <div className="space-y-1.5">
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
