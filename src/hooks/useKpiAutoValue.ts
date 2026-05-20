import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DepartmentKpi } from './useDepartmentKpis';

const CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } as const;

/**
 * Resolves auto value for monthly KPRs, scoped to a (year, month).
 * Mirrors the source codes used in usePlanningData (VALUE_SOURCES) but per-month.
 */
export function useKpiAutoValue(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  const endTs = end + 'T23:59:59';

  const sales = useQuery({
    queryKey: ['kpi-auto-sales', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('invoice_total,product,product_id')
        .eq('sale_year', year)
        .eq('sale_month', month);
      return data || [];
    },
    ...CACHE,
  });

  const crm = useQuery({
    queryKey: ['kpi-auto-crm', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_leads')
        .select('id,potential_product_id,potential_product,created_at')
        .eq('status', 'ganho')
        .gte('created_at', start)
        .lte('created_at', endTs);
      return data || [];
    },
    ...CACHE,
  });

  const activeClients = useQuery({
    queryKey: ['kpi-auto-clients-active'],
    queryFn: async () => {
      const { count } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');
      return count ?? 0;
    },
    ...CACHE,
  });

  const timeEntries = useQuery({
    queryKey: ['kpi-auto-time', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('duration,category,client_id')
        .eq('entry_year', year)
        .eq('entry_month', month);
      return data || [];
    },
    ...CACHE,
  });

  const tasksDone = useQuery({
    queryKey: ['kpi-auto-tasks', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id,department,updated_at')
        .eq('status', 'done')
        .gte('updated_at', start)
        .lte('updated_at', endTs);
      return data || [];
    },
    ...CACHE,
  });

  const team = useQuery({
    queryKey: ['kpi-auto-team'],
    queryFn: async () => {
      const { count } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');
      return count ?? 0;
    },
    ...CACHE,
  });

  const followers = useQuery({
    queryKey: ['kpi-auto-followers', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('channel_monthly_metrics')
        .select('followers,channel_id')
        .eq('year', year)
        .eq('month', month);
      return data || [];
    },
    ...CACHE,
  });

  const content = useQuery({
    queryKey: ['kpi-auto-content', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('id,scheduled_at')
        .eq('status', 'publicado')
        .gte('scheduled_at', start)
        .lte('scheduled_at', endTs);
      return data || [];
    },
    ...CACHE,
  });

  const contentChannels = useQuery({
    queryKey: ['kpi-auto-content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('content_id,channel_id');
      return data || [];
    },
    ...CACHE,
  });

  const meetings = useQuery({
    queryKey: ['kpi-auto-meetings', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id,department,client_id,date_time')
        .in('status', ['terminada', 'confirmada'])
        .gte('date_time', start + 'T00:00:00')
        .lte('date_time', endTs);
      return data || [];
    },
    ...CACHE,
  });

  const nps = useQuery({
    queryKey: ['kpi-auto-nps', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_nps_records')
        .select('nps_score,client_id')
        .not('nps_score', 'is', null)
        .gte('actual_date', start)
        .lte('actual_date', end);
      return data || [];
    },
    ...CACHE,
  });

  const expenses = useQuery({
    queryKey: ['kpi-auto-expenses', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('total_with_vat,category')
        .gte('expense_date', start)
        .lte('expense_date', end);
      return data || [];
    },
    ...CACHE,
  });

  const projectsDone = useQuery({
    queryKey: ['kpi-auto-projects', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,type,updated_at')
        .eq('status', 'concluido')
        .is('archived_at', null)
        .gte('updated_at', start)
        .lte('updated_at', endTs);
      return data || [];
    },
    ...CACHE,
  });

  const metrics = useQuery({
    queryKey: ['kpi-auto-metrics'],
    queryFn: async () => {
      const { data } = await supabase.from('product_metrics').select('id,current_value');
      return data || [];
    },
    ...CACHE,
  });

  const resolve = (kpi: DepartmentKpi): number | null => {
    const src = kpi.value_source;
    const sf = (kpi.source_filter as Record<string, string> | null) || {};
    if (!src || src === 'manual') return null;

    if (src === 'metrica') {
      const m = (metrics.data || []).find((x: any) => x.id === (sf.metric_id || ''));
      return m ? Number((m as any).current_value || 0) : null;
    }
    if (src === 'bd_vendas' || src === 'commercial') {
      let rows = (sales.data || []) as any[];
      if (sf.product_id) rows = rows.filter((r) => r.product_id === sf.product_id);
      return rows.reduce((s, r) => s + Number(r.invoice_total || 0), 0);
    }
    if (src === 'bd_crm') {
      let rows = (crm.data || []) as any[];
      if (sf.product_id) rows = rows.filter((r) => r.potential_product_id === sf.product_id);
      return rows.length;
    }
    if (src === 'bd_clientes') return activeClients.data ?? null;
    if (src === 'bd_tempo') {
      let rows = (timeEntries.data || []) as any[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      return rows.reduce((s, r) => s + Number(r.duration || 0), 0);
    }
    if (src === 'bd_tarefas') {
      let rows = (tasksDone.data || []) as any[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (src === 'bd_equipa') return team.data ?? null;
    if (src === 'bd_marketing') {
      let rows = (followers.data || []) as any[];
      if (sf.channel_id) rows = rows.filter((r) => r.channel_id === sf.channel_id);
      return rows.reduce((s, r) => s + Number(r.followers || 0), 0);
    }
    if (src === 'bd_conteudos') {
      let rows = (content.data || []) as any[];
      if (sf.channel_id) {
        const links = (contentChannels.data || []) as any[];
        const ids = new Set(links.filter((l) => l.channel_id === sf.channel_id).map((l) => l.content_id));
        rows = rows.filter((r) => ids.has(r.id));
      }
      return rows.length;
    }
    if (src === 'bd_reunioes') {
      let rows = (meetings.data || []) as any[];
      if (sf.department) rows = rows.filter((r) => r.department === sf.department);
      return rows.length;
    }
    if (src === 'bd_nps') {
      let rows = (nps.data || []) as any[];
      if (sf.client_id) rows = rows.filter((r) => r.client_id === sf.client_id);
      if (rows.length === 0) return null;
      const sum = rows.reduce((s, r) => s + Number(r.nps_score), 0);
      return Math.round((sum / rows.length) * 10) / 10;
    }
    if (src === 'bd_despesas') {
      let rows = (expenses.data || []) as any[];
      if (sf.category) rows = rows.filter((r) => r.category === sf.category);
      return rows.reduce((s, r) => s + Number(r.total_with_vat || 0), 0);
    }
    if (src === 'bd_projetos') {
      let rows = (projectsDone.data || []) as any[];
      if (sf.type) rows = rows.filter((r) => r.type === sf.type);
      return rows.length;
    }
    return null;
  };

  const isLoading =
    sales.isLoading || crm.isLoading || activeClients.isLoading || timeEntries.isLoading ||
    tasksDone.isLoading || team.isLoading || followers.isLoading || content.isLoading ||
    meetings.isLoading || nps.isLoading || expenses.isLoading || projectsDone.isLoading;

  return { resolve, isLoading };
}