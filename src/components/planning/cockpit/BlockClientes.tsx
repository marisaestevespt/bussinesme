import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Heart, UserPlus, UserMinus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function BlockClientes({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-clientes', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

      const [clients, onb, nps, activities, products] = await Promise.all([
        supabase.from('clients').select('id, status, end_of_cycle, full_name, current_product_id, client_since, account_manager_id'),
        supabase.from('client_onboarding').select('client_id, completed'),
        supabase.from('client_nps_records').select('id, status, expected_date, client_id, nps_score').gte('expected_date', start).lte('expected_date', end),
        supabase.from('client_activities').select('client_id, created_at'),
        supabase.from('products').select('id, name'),
      ]);

      const all = clients.data || [];
      const ativos = all.filter((c: any) => c.status === 'ativo');
      const onboarding = all.filter((c: any) => c.status === 'onboarding');
      const offboarding = all.filter((c: any) => c.status === 'offboarding');
      const newThisMonth = all.filter((c: any) => c.client_since && c.client_since >= start && c.client_since <= end);
      const renewals = all.filter((c: any) => c.end_of_cycle && c.end_of_cycle >= start && c.end_of_cycle <= end);

      // Onboarding progress per client
      const obByClient: Record<string, { total: number; done: number }> = {};
      (onb.data || []).forEach((row: any) => {
        if (!obByClient[row.client_id]) obByClient[row.client_id] = { total: 0, done: 0 };
        obByClient[row.client_id].total += 1;
        if (row.completed) obByClient[row.client_id].done += 1;
      });

      // Last activity per client
      const lastActivity: Record<string, string> = {};
      (activities.data || []).forEach((a: any) => {
        const cur = lastActivity[a.client_id];
        if (!cur || cur < a.created_at) lastActivity[a.client_id] = a.created_at;
      });
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      const cutoffISO = cutoff.toISOString();
      const stale = ativos.filter((c: any) => !lastActivity[c.id] || lastActivity[c.id] < cutoffISO).slice(0, 8);

      // NPS avg of month
      const npsRespondido = (nps.data || []).filter((n: any) => n.status === 'respondido' && n.nps_score != null);
      const npsAvg = npsRespondido.length > 0
        ? Math.round(npsRespondido.reduce((s: number, n: any) => s + Number(n.nps_score), 0) / npsRespondido.length)
        : null;

      const productById = new Map((products.data || []).map((p: any) => [p.id, p.name]));

      return {
        ativos, onboarding, offboarding, newThisMonth, renewals,
        obByClient, lastActivity, stale,
        nps: nps.data || [], npsAvg,
        productById,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Link to="/hub/clientes?status=ativo" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ativos</div>
          <div className="text-lg font-semibold tabular-nums">{data.ativos.length}</div>
        </Link>
        <Link to="/hub/clientes?novos=mes" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><UserPlus className="h-3 w-3" />Novos no mês</div>
          <div className="text-lg font-semibold tabular-nums">{data.newThisMonth.length}</div>
        </Link>
        <Link to="/hub/clientes?status=onboarding" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Em onboarding</div>
          <div className="text-lg font-semibold tabular-nums">{data.onboarding.length}</div>
        </Link>
        <Link to="/hub/clientes?status=offboarding" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><UserMinus className="h-3 w-3" />Offboarding</div>
          <div className="text-lg font-semibold tabular-nums">{data.offboarding.length}</div>
        </Link>
        <Link to="/hub/clientes?tab=nps" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" />NPS médio</div>
          <div className="text-lg font-semibold tabular-nums">{data.npsAvg ?? '—'}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{data.nps.length} agendados</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Renovações */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Renovações no mês ({data.renewals.length})</div>
            {data.renewals.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          </div>
          {data.renewals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem renovações</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium pb-1">Cliente</th>
                  <th className="text-left font-medium pb-1">Produto</th>
                  <th className="text-right font-medium pb-1">Fim ciclo</th>
                </tr>
              </thead>
              <tbody>
                {data.renewals.slice(0, 8).map((c: any) => (
                  <tr key={c.id} className="border-t border-border/40">
                    <td className="py-1 truncate max-w-[160px]">
                      <Link to={`/hub/clientes/${c.id}`} className="hover:underline">{c.full_name}</Link>
                    </td>
                    <td className="py-1 text-muted-foreground truncate">{data.productById.get(c.current_product_id) || '—'}</td>
                    <td className="py-1 text-right tabular-nums">{c.end_of_cycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Onboardings em curso */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium">Onboardings em curso</div>
          {data.onboarding.length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-auto pr-1">
              {data.onboarding.map((c: any) => {
                const b = data.obByClient[c.id];
                const pct = b && b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
                return (
                  <li key={c.id} className="flex items-center gap-2 text-xs">
                    <Link to={`/hub/clientes/${c.id}`} className="truncate flex-1 hover:underline">{c.full_name}</Link>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{b?.done ?? 0}/{b?.total ?? 0} · {pct}%</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Alertas — sem actividade */}
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Alertas — clientes sem actividade há +30 dias
            </div>
            <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] px-2">
              <Link to="/hub/clientes">Ver todos →</Link>
            </Button>
          </div>
          {data.stale.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tudo em dia.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {data.stale.map((c: any) => {
                const last = data.lastActivity[c.id];
                const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
                return (
                  <li key={c.id} className="flex items-center gap-2 text-xs">
                    <Link to={`/hub/clientes/${c.id}`} className="truncate flex-1 hover:underline">{c.full_name}</Link>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {days != null ? `${days}d` : 'sem registo'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
