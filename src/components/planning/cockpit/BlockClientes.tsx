import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Heart, UserPlus, UserMinus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { KPRsInline } from './KPRsInline';

const STATUS_TONE: Record<string, string> = {
  ativo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  onboarding: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  offboarding: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  inativo: 'bg-muted text-muted-foreground border-border',
};

export function BlockClientes({ year, month }: { year: number; month: number }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-clientes', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

      const [clients, onb, nps, npsAll, activities, products, members] = await Promise.all([
        supabase.from('clients').select('id, status, end_of_cycle, full_name, current_product_id, client_since, account_manager_id, monthly_value'),
        supabase.from('client_onboarding').select('client_id, completed'),
        supabase.from('client_nps_records').select('id, status, expected_date, client_id, nps_score').gte('expected_date', start).lte('expected_date', end),
        supabase.from('client_nps_records').select('client_id, nps_score, actual_date, status').eq('status', 'respondido').not('nps_score', 'is', null).order('actual_date', { ascending: false }),
        supabase.from('client_activities').select('client_id, created_at'),
        supabase.from('products').select('id, name'),
        supabase.from('team_members').select('id, name'),
      ]);

      const all = clients.data || [];
      const ativos = all.filter((c: any) => c.status === 'ativo');
      const onboarding = all.filter((c: any) => c.status === 'onboarding');
      const offboarding = all.filter((c: any) => c.status === 'offboarding');
      const newThisMonth = all.filter((c: any) => c.client_since && c.client_since >= start && c.client_since <= end);
      const renewals = all.filter((c: any) => c.end_of_cycle && c.end_of_cycle >= start && c.end_of_cycle <= end);

      const obByClient: Record<string, { total: number; done: number }> = {};
      (onb.data || []).forEach((row: any) => {
        if (!obByClient[row.client_id]) obByClient[row.client_id] = { total: 0, done: 0 };
        obByClient[row.client_id].total += 1;
        if (row.completed) obByClient[row.client_id].done += 1;
      });

      const lastActivity: Record<string, string> = {};
      (activities.data || []).forEach((a: any) => {
        const cur = lastActivity[a.client_id];
        if (!cur || cur < a.created_at) lastActivity[a.client_id] = a.created_at;
      });

      const lastNps: Record<string, number> = {};
      (npsAll.data || []).forEach((n: any) => {
        if (lastNps[n.client_id] == null) lastNps[n.client_id] = Number(n.nps_score);
      });

      const npsRespondido = (nps.data || []).filter((n: any) => n.status === 'respondido' && n.nps_score != null);
      const npsAvg = npsRespondido.length > 0
        ? Math.round(npsRespondido.reduce((s: number, n: any) => s + Number(n.nps_score), 0) / npsRespondido.length)
        : null;

      const productById = new Map((products.data || []).map((p: any) => [p.id, p.name]));
      const memberById = new Map((members.data || []).map((m: any) => [m.id, m.name]));
      const today = Date.now();

      const enriched = all.map((c: any) => {
        const lastAct = lastActivity[c.id];
        const daysSince = lastAct ? Math.floor((today - new Date(lastAct).getTime()) / 86400000) : null;
        return {
          ...c,
          product: productById.get(c.current_product_id) || null,
          manager: memberById.get(c.account_manager_id) || null,
          ob: obByClient[c.id],
          lastNps: lastNps[c.id] ?? null,
          daysSince,
        };
      });

      return {
        ativos, onboarding, offboarding, newThisMonth, renewals,
        nps: nps.data || [], npsAvg, enriched,
      };
    },
    staleTime: 60_000,
  });

  const filteredClients = useMemo(() => {
    if (!data) return [];
    let list = data.enriched;
    if (statusFilter !== 'todos') list = list.filter((c: any) => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.product?.toLowerCase().includes(q) ||
        c.manager?.toLowerCase().includes(q),
      );
    }
    return list.sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [data, search, statusFilter]);

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  return (
    <div className="space-y-4">
      <KPRsInline area="clientes" year={year} month={month} />
      {/* KPIs compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          { label: 'Ativos', value: data.ativos.length, href: '/hub/clientes?status=ativo', filter: 'ativo' },
          { label: 'Novos no mês', value: data.newThisMonth.length, icon: UserPlus, href: '/hub/clientes?novos=mes' },
          { label: 'Em onboarding', value: data.onboarding.length, href: '/hub/clientes?status=onboarding', filter: 'onboarding' },
          { label: 'Offboarding', value: data.offboarding.length, icon: UserMinus, href: '/hub/clientes?status=offboarding', filter: 'offboarding' },
          { label: 'NPS médio', value: data.npsAvg ?? '—', icon: Heart, href: '/hub/clientes?tab=nps', sub: `${data.nps.length} agendados` },
        ].map((k: any, i) => (
          <button
            key={i}
            onClick={() => k.filter && setStatusFilter(k.filter)}
            className="hq-surface-sunken rounded-lg p-2.5 hover:bg-accent/40 hq-transition text-left"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              {k.icon && <k.icon className="h-3 w-3" />}
              {k.label}
            </div>
            <div className="text-lg font-semibold tabular-nums">{k.value}</div>
            {k.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>}
          </button>
        ))}
      </div>

      {/* TABELA PRINCIPAL — todos os clientes */}
      <div className="hq-surface-sunken rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border/40">
          <div className="flex items-center gap-2 flex-1">
            <div className="text-sm font-semibold">Carteira de clientes</div>
            <Badge variant="outline" className="text-[10px]">{filteredClients.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {['todos', 'ativo', 'onboarding', 'offboarding'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-[11px] px-2 py-1 rounded capitalize hq-transition',
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar…"
                className="h-8 w-48 pl-7 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs sticky top-0 z-10">
              <tr>
                <th className="text-left font-medium px-3 py-2">Cliente</th>
                <th className="text-left font-medium px-3 py-2">Produto</th>
                <th className="text-left font-medium px-3 py-2">Gestor</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Mensal</th>
                <th className="text-right font-medium px-3 py-2">Fim ciclo</th>
                <th className="text-right font-medium px-3 py-2">Última atividade</th>
                <th className="text-right font-medium px-3 py-2">NPS</th>
                <th className="text-left font-medium px-3 py-2 w-32">Onboarding</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8 text-xs">Sem clientes para este filtro.</td></tr>
              ) : filteredClients.map((c: any) => {
                const obPct = c.ob && c.ob.total > 0 ? Math.round((c.ob.done / c.ob.total) * 100) : null;
                const stale = c.status === 'ativo' && (c.daysSince == null || c.daysSince > 30);
                return (
                  <tr key={c.id} className="border-t border-border/40 hover:bg-accent/30 hq-transition">
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/hub/clientes/${c.id}`} className="hover:underline flex items-center gap-1.5" target="_blank" rel="noopener noreferrer">
                        {stale && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span className="truncate max-w-[200px]">{c.full_name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">{c.product || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{c.manager || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_TONE[c.status] || '')}>{c.status || '—'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.monthly_value ? Number(c.monthly_value).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{c.end_of_cycle || '—'}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums text-xs', stale && 'text-amber-600 dark:text-amber-400')}>
                      {c.daysSince != null ? `${c.daysSince}d` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.lastNps != null ? (
                        <span className={cn(c.lastNps >= 9 ? 'text-emerald-600' : c.lastNps >= 7 ? 'text-amber-600' : 'text-red-600')}>{c.lastNps}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {obPct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${obPct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{obPct}%</span>
                        </div>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renovações destacadas */}
      {data.renewals.length > 0 && (
        <div className="hq-surface-sunken rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-border/40">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div className="text-sm font-semibold">Renovações no mês</div>
            <Badge variant="outline" className="text-[10px]">{data.renewals.length}</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">Cliente</th>
                <th className="text-left font-medium px-3 py-2">Produto</th>
                <th className="text-right font-medium px-3 py-2">Valor mensal</th>
                <th className="text-right font-medium px-3 py-2">Fim ciclo</th>
              </tr>
            </thead>
            <tbody>
              {data.renewals.map((c: any) => {
                const enriched = data.enriched.find((e: any) => e.id === c.id);
                return (
                  <tr key={c.id} className="border-t border-border/40 hover:bg-accent/30 hq-transition">
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/hub/clientes/${c.id}`} className="hover:underline" target="_blank" rel="noopener noreferrer">{c.full_name}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{enriched?.product || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.monthly_value ? Number(c.monthly_value).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{c.end_of_cycle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
