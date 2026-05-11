import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function fmtEur(n: number) {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function BlockComercial({ year, month }: { year: number; month: number }) {
  const { data } = useQuery({
    queryKey: ['cockpit-comercial', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [salesNow, salesPrev, monthlyGoal, leads, stages, actions] = await Promise.all([
        supabase.from('commercial_sales').select('invoice_total').eq('sale_year', year).eq('sale_month', month),
        supabase.from('commercial_sales').select('invoice_total').eq('sale_year', prevYear).eq('sale_month', prevMonth),
        supabase.from('commercial_monthly_goals').select('goal_amount').eq('year', year).eq('month', month).maybeSingle(),
        supabase.from('crm_leads').select('id, status, next_followup'),
        supabase.from('crm_pipeline_stages').select('id, name'),
        supabase.from('commercial_sales_actions').select('id, action_name, status, start_date, end_date').or(`and(start_date.gte.${start},start_date.lte.${end}),and(end_date.gte.${start},end_date.lte.${end})`),
      ]);

      const revenueNow = (salesNow.data || []).reduce((s, r: any) => s + (Number(r.invoice_total) || 0), 0);
      const revenuePrev = (salesPrev.data || []).reduce((s, r: any) => s + (Number(r.invoice_total) || 0), 0);
      const goal = Number((monthlyGoal.data as any)?.goal_amount) || 0;
      const followups = (leads.data || []).filter((l: any) => l.next_followup >= start && l.next_followup <= end);
      const activeStatuses = ['ativo', 'proposta', 'negociacao', 'qualificado'];
      const activeLeads = (leads.data || []).filter((l: any) => activeStatuses.includes((l.status || '').toLowerCase()));

      return { revenueNow, revenuePrev, goal, activeLeads: activeLeads.length, followups: followups.length, actions: actions.data || [], stages: stages.data || [] };
    },
    staleTime: 60_000,
  });

  const pct = data?.goal ? Math.min(100, (data.revenueNow / data.goal) * 100) : 0;
  const delta = (data?.revenueNow || 0) - (data?.revenuePrev || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Meta de vendas */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Meta de vendas</div>
        <div className="text-lg font-semibold tabular-nums">{fmtEur(data?.revenueNow || 0)}</div>
        {data?.goal ? <Progress value={pct} className="h-1.5" /> : <p className="text-xs text-muted-foreground">Sem meta mensal</p>}
        {data?.goal ? <div className="text-[11px] text-muted-foreground">de {fmtEur(data.goal)} ({Math.round(pct)}%)</div> : null}
        <div className="text-[11px] flex items-center gap-1">
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
          <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {delta >= 0 ? '+' : ''}{fmtEur(delta)} vs. mês anterior
          </span>
        </div>
      </div>

      {/* Pipeline */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Pipeline ativo</div>
        <div className="text-lg font-semibold tabular-nums">{data?.activeLeads ?? 0} <span className="text-xs font-normal text-muted-foreground">leads ativas</span></div>
        <div className="text-[11px] text-muted-foreground">{data?.followups ?? 0} follow-ups este mês</div>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-start px-2">
          <Link to="/comercial">Ver pipeline →</Link>
        </Button>
      </div>

      {/* Ações */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Ações de venda</div>
          <Button asChild size="icon" variant="ghost" className="h-6 w-6">
            <Link to="/comercial?tab=actions"><Plus className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        {(data?.actions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem ações neste mês</p>
        ) : (
          <ul className="space-y-1 max-h-32 overflow-auto pr-1">
            {data!.actions.slice(0, 6).map((a: any) => (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] px-1 py-0">{a.status || '—'}</Badge>
                <span className="truncate">{a.action_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}