import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function BlockClientes({ year, month }: { year: number; month: number }) {
  const { data } = useQuery({
    queryKey: ['cockpit-clientes', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

      const [clients, onb, nps] = await Promise.all([
        supabase.from('clients').select('id, status, end_of_cycle, full_name'),
        supabase.from('client_onboarding').select('client_id, completed'),
        supabase.from('client_nps_records').select('id, status, expected_date, client_id').gte('expected_date', start).lte('expected_date', end),
      ]);

      const all = clients.data || [];
      const ativos = all.filter((c: any) => c.status === 'ativo');
      const onboarding = all.filter((c: any) => c.status === 'onboarding');
      const offboarding = all.filter((c: any) => c.status === 'offboarding');
      const renewals = all.filter((c: any) => c.end_of_cycle && c.end_of_cycle >= start && c.end_of_cycle <= end);

      // Onboarding progress avg
      const byClient: Record<string, { total: number; done: number }> = {};
      (onb.data || []).forEach((row: any) => {
        if (!byClient[row.client_id]) byClient[row.client_id] = { total: 0, done: 0 };
        byClient[row.client_id].total += 1;
        if (row.completed) byClient[row.client_id].done += 1;
      });
      const onboardingProgress = onboarding.length
        ? Math.round(onboarding.reduce((s: number, c: any) => {
            const b = byClient[c.id];
            return s + (b && b.total ? (b.done / b.total) * 100 : 0);
          }, 0) / onboarding.length)
        : 0;

      return {
        ativos: ativos.length,
        onboarding: onboarding.length,
        offboarding: offboarding.length,
        onboardingProgress,
        renewals,
        nps: nps.data || [],
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Portefólio */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Portefólio</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-lg font-semibold tabular-nums">{data?.ativos ?? 0}</div><div className="text-[10px] text-muted-foreground">Ativos</div></div>
          <div><div className="text-lg font-semibold tabular-nums">{data?.onboarding ?? 0}</div><div className="text-[10px] text-muted-foreground">Onboarding</div></div>
          <div><div className="text-lg font-semibold tabular-nums">{data?.offboarding ?? 0}</div><div className="text-[10px] text-muted-foreground">Offboarding</div></div>
        </div>
        {(data?.onboarding ?? 0) > 0 && (
          <p className="text-[11px] text-muted-foreground">Progresso médio onboarding: {data?.onboardingProgress}%</p>
        )}
      </div>

      {/* Renovações */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Renovações este mês</div>
          {(data?.renewals.length ?? 0) > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
        </div>
        {(data?.renewals.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Sem renovações</p>
        ) : (
          <ul className="space-y-1 max-h-32 overflow-auto pr-1">
            {data!.renewals.slice(0, 6).map((c: any) => (
              <li key={c.id} className="text-xs flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1 py-0">a confirmar</Badge>
                <span className="truncate">{c.full_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* NPS */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">NPS do mês</div>
        {(data?.nps.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Sem registos NPS</p>
        ) : (
          <div className="text-xs space-y-1">
            <div>Agendados: {data!.nps.length}</div>
            <div>Respondidos: {data!.nps.filter((n: any) => n.status === 'respondido').length}</div>
            <div>Em atraso: {data!.nps.filter((n: any) => n.status === 'atrasado').length}</div>
          </div>
        )}
      </div>
    </div>
  );
}