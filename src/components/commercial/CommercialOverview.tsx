import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, X, Plus, Users, Target, Wallet, TrendingUp, CalendarDays, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useCommercialData } from '@/hooks/useCommercialData';
import { SaleFormDialog } from './SaleFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { saleRevenue } from '@/lib/salesCalculations';
import { formatNumber } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { StatCard } from '@/components/editorial';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  na: { label: 'N.A.', color: 'bg-muted text-muted-foreground' },
  fatura_emitida: { label: 'Fatura Emitida', color: 'bg-warning/10 text-warning' },
  pagamento_ok: { label: 'Pagamento OK', color: 'bg-success/10 text-success' },
  recibo_enviado: { label: 'Recibo Enviado', color: 'bg-info/10 text-info' },
  contabilidade_ok: { label: 'Contabilidade OK', color: 'bg-success/10 text-success' },
};

export function CommercialOverview() {
  const data = useCommercialData();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);

  const { data: activeLeadsCount = 0 } = useQuery({
    queryKey: ['active-leads-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('crm_leads')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("ganho","perdido")');
      return count || 0;
    },
  });
  const barData = MONTH_LABELS.map((name, i) => ({ name, total: data.monthlyTotals[i] }));
  const remaining = Math.max(0, data.annualGoalAmount - data.totalInvoiced);
  const donutData = [
    { name: 'Faturado', value: data.totalInvoiced },
    { name: 'Restante', value: remaining },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  const productGoalsList = data.productGoals.data || [];

  // Top selling product — aggregate by product_id (relational source of truth)
  const productSales = productGoalsList.map(p => ({
    name: p.product_name,
    total: (data.sales.data || [])
      .filter(s => p.product_id && (s as any).product_id === p.product_id)
      .reduce((acc, v) => acc + saleRevenue(v), 0),
  }));
  const topProduct = productSales.length > 0 ? productSales.sort((a, b) => b.total - a.total)[0] : null;

  return (
    <div className="space-y-6">
      {/* Summary stats — editorial ceramic style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 items-stretch">
        <StatCard
          tone="primary"
          size="sm"
          value={`€${formatNumber(data.annualGoalAmount)}`}
          label={<><Target className="h-3 w-3 inline mr-1.5 -mt-0.5" />meta anual</>}
          hint={`para ${data.year}`}
        />
        <StatCard
          tone="gold"
          size="sm"
          value={`€${formatNumber(data.totalInvoiced)}`}
          label={<><Wallet className="h-3 w-3 inline mr-1.5 -mt-0.5" />total faturado</>}
          hint={`${data.progressPct.toFixed(1)}% da meta`}
        />
        <StatCard
          tone="success"
          size="sm"
          value={`${data.progressPct.toFixed(0)}%`}
          label={<><TrendingUp className="h-3 w-3 inline mr-1.5 -mt-0.5" />progresso anual</>}
          hint={`faltam €${formatNumber(remaining)}`}
        />
        <StatCard
          tone="mocha"
          size="sm"
          value={`€${formatNumber(data.currentMonthTotal)}`}
          label={<><CalendarDays className="h-3 w-3 inline mr-1.5 -mt-0.5" />faturado este mês</>}
          hint="mês corrente"
        />
        <StatCard
          tone="violet"
          size="sm"
          value={topProduct && topProduct.total > 0 ? topProduct.name : '—'}
          label={<><Package className="h-3 w-3 inline mr-1.5 -mt-0.5" />top produto</>}
          hint={topProduct && topProduct.total > 0 ? `€${formatNumber(topProduct.total)}` : 'sem vendas registadas'}
        />
        <StatCard
          tone="info"
          size="sm"
          onClick={() => navigate('/hub/comercial/crm')}
          value={activeLeadsCount}
          label={<><Users className="h-3 w-3 inline mr-1.5 -mt-0.5" />leads ativas</>}
          hint="em pipeline →"
        />
      </div>

      {/* Mismatch alert */}
      {data.monthlyMismatch && !dismissed && (
        <Alert className="border-warning/30 bg-warning/15">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between text-warning">
            <span>As metas mensais não correspondem à meta anual. Verifica os valores antes de continuar.</span>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}><X className="h-4 w-4" /></Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução Mensal</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `€${formatNumber(v)}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Progresso vs Meta</CardTitle></CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `€${formatNumber(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Current month sales */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Vendas deste mês</h3>
          <Button size="sm" onClick={() => setSaleOpen(true)}><Plus className="h-4 w-4 mr-1" /> Registar Venda</Button>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor Base</TableHead>
                <TableHead className="text-right">Fatura Total</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.currentMonthSales.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem vendas este mês</TableCell></TableRow>
              )}
              {data.currentMonthSales.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.payment_date ? format(new Date(s.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell>{s.description || '—'}</TableCell>
                  <TableCell className="text-right">€{formatNumber(Number(s.base_value))}</TableCell>
                  <TableCell className="text-right">€{formatNumber(Number(s.invoice_total))}</TableCell>
                  <TableCell>{s.product || '—'}</TableCell>
                  <TableCell>{s.client || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <SaleFormDialog open={saleOpen} onOpenChange={setSaleOpen} products={productGoalsList.map(p => p.product_name)} onSave={(sale) => { data.upsertSale.mutate(sale); setSaleOpen(false); }} />
    </div>
  );
}
