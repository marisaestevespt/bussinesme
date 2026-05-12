import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowDownRight, ArrowUpRight, TrendingUp, Package, Users, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';

function fmtEur(n: number) {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function BlockComercial({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-comercial', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [salesNow, salesPrev, monthlyGoal, leads, stages, products, clients] = await Promise.all([
        supabase.from('commercial_sales').select('id, invoice_total, product, product_id, client, payment_date, status').eq('sale_year', year).eq('sale_month', month).order('payment_date', { ascending: false }),
        supabase.from('commercial_sales').select('invoice_total').eq('sale_year', prevYear).eq('sale_month', prevMonth),
        supabase.from('commercial_monthly_goals').select('goal_amount').eq('year', year).eq('month', month).maybeSingle(),
        supabase.from('crm_leads').select('id, status, estimated_value, next_followup, name, potential_product'),
        supabase.from('crm_pipeline_stages').select('id, name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('products').select('id, name, status, ticket').eq('status', 'ativo'),
        supabase.from('clients').select('id, current_product_id').eq('status', 'ativo'),
      ]);

      const sales = salesNow.data || [];
      const revenueNow = sales.reduce((s, r: any) => s + (Number(r.invoice_total) || 0), 0);
      const revenuePrev = (salesPrev.data || []).reduce((s, r: any) => s + (Number(r.invoice_total) || 0), 0);
      const goal = Number((monthlyGoal.data as any)?.goal_amount) || 0;

      // Sales by product
      const byProduct: Record<string, { name: string; qty: number; revenue: number }> = {};
      sales.forEach((s: any) => {
        const key = s.product_id || s.product || 'Outro';
        if (!byProduct[key]) byProduct[key] = { name: s.product || 'Outro', qty: 0, revenue: 0 };
        byProduct[key].qty += 1;
        byProduct[key].revenue += Number(s.invoice_total) || 0;
      });
      const salesByProduct = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);

      // Pipeline by stage / status
      const byStage: Record<string, { count: number; value: number }> = {};
      const activeStatuses = ['ativo','aberto','proposta','negociacao','qualificado','contactado'];
      const allLeads = leads.data || [];
      const activeLeads = allLeads.filter((l: any) => activeStatuses.includes((l.status || '').toLowerCase()));
      activeLeads.forEach((l: any) => {
        const k = l.status || '—';
        if (!byStage[k]) byStage[k] = { count: 0, value: 0 };
        byStage[k].count += 1;
        byStage[k].value += Number(l.estimated_value) || 0;
      });

      // Active products with client counts
      const clientsByProd: Record<string, number> = {};
      (clients.data || []).forEach((c: any) => {
        if (c.current_product_id) clientsByProd[c.current_product_id] = (clientsByProd[c.current_product_id] || 0) + 1;
      });
      const activeProducts = (products.data || []).map((p: any) => ({
        ...p,
        clients: clientsByProd[p.id] || 0,
        revenue: byProduct[p.id]?.revenue || 0,
        sold: byProduct[p.id]?.qty || 0,
      })).sort((a, b) => b.revenue - a.revenue);

      const pipelineValue = activeLeads.reduce((s: number, l: any) => s + (Number(l.estimated_value) || 0), 0);
      const conversion = allLeads.length > 0 ? (sales.length / allLeads.length) * 100 : 0;

      return {
        revenueNow, revenuePrev, goal, sales,
        salesByProduct, byStage, pipelineValue, activeLeads: activeLeads.length, conversion,
        activeProducts, stages: stages.data || [],
      };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  const pct = data.goal ? Math.min(100, (data.revenueNow / data.goal) * 100) : 0;
  const delta = data.revenueNow - data.revenuePrev;
  const ticket = data.sales.length > 0 ? data.revenueNow / data.sales.length : 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hq-surface-sunken rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Receita do mês</div>
          <div className="text-lg font-semibold tabular-nums">{fmtEur(data.revenueNow)}</div>
          {data.goal ? (
            <>
              <Progress value={pct} className="h-1 mt-1" />
              <div className="text-[10px] text-muted-foreground mt-0.5">{Math.round(pct)}% de {fmtEur(data.goal)}</div>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground mt-1">Sem meta mensal</div>
          )}
          <div className="text-[10px] flex items-center gap-1 mt-1">
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>{delta >= 0 ? '+' : ''}{fmtEur(delta)} vs. mês anterior</span>
          </div>
        </div>
        <div className="hq-surface-sunken rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendas</div>
          <div className="text-lg font-semibold tabular-nums">{data.sales.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Ticket médio: {fmtEur(ticket)}</div>
        </div>
        <div className="hq-surface-sunken rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pipeline ativo</div>
          <div className="text-lg font-semibold tabular-nums">{fmtEur(data.pipelineValue)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{data.activeLeads} leads</div>
        </div>
        <div className="hq-surface-sunken rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversão</div>
          <div className="text-lg font-semibold tabular-nums">{data.conversion.toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">leads → venda no mês</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Vendas por produto */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium">Vendas por produto</div>
          </div>
          {data.salesByProduct.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem vendas no mês</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium pb-1">Produto</th>
                  <th className="text-right font-medium pb-1">Qtd</th>
                  <th className="text-right font-medium pb-1">Receita</th>
                  <th className="text-right font-medium pb-1">%</th>
                </tr>
              </thead>
              <tbody>
                {data.salesByProduct.map((p, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-1 truncate max-w-[160px]">{p.name}</td>
                    <td className="text-right tabular-nums">{p.qty}</td>
                    <td className="text-right tabular-nums">{fmtEur(p.revenue)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{Math.round((p.revenue / data.revenueNow) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pipeline por estado */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium">Pipeline por estado</div>
          </div>
          {Object.keys(data.byStage).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem leads ativas</p>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(data.byStage).map(([stage, info]: any) => (
                <li key={stage} className="flex items-center justify-between text-xs">
                  <span className="capitalize truncate">{stage}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {info.count} · <span className="text-foreground">{fmtEur(info.value)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Vendas recentes */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs font-medium">Vendas recentes</div>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] px-2">
              <Link to="/hub/comercial">Ver todas →</Link>
            </Button>
          </div>
          {data.sales.length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-auto pr-1">
              {data.sales.slice(0, 8).map((s: any) => (
                <li key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="tabular-nums text-muted-foreground w-12 shrink-0">{(s.payment_date || '').slice(8,10)}/{(s.payment_date || '').slice(5,7)}</span>
                  <span className="truncate flex-1">{s.client || '—'}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{s.product || '—'}</Badge>
                  <span className="tabular-nums">{fmtEur(Number(s.invoice_total) || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Produtos ativos */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs font-medium">Portefólio ativo</div>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] px-2">
              <Link to="/hub/produtos"><Plus className="h-3 w-3" /></Link>
            </Button>
          </div>
          {data.activeProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem produtos ativos</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-auto pr-1">
              {data.activeProducts.map((p: any) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <Link to={`/hub/produtos/${p.id}`} className="truncate flex-1 hover:underline font-medium">{p.name}</Link>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{p.clients} clientes</Badge>
                  {p.sold > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0">{p.sold} vendas</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
