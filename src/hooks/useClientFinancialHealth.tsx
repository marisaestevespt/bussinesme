import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, isBefore, startOfDay } from 'date-fns';

export type HealthStatus = 'saudavel' | 'atencao' | 'critico' | 'sem_dados';

interface SaleRow {
  client: string | null;
  status: string;
  payment_date: string | null;
}

export interface ClientHealth {
  status: HealthStatus;
  label: string;
  total: number;
  paid: number;
  overdue: number;
  pending: number;
}

const PAID_STATUSES = ['tudo_ok', 'pago_falta_fatura'];

function computeHealth(sales: SaleRow[]): ClientHealth {
  if (sales.length === 0) return { status: 'sem_dados', label: 'Sem dados', total: 0, paid: 0, overdue: 0, pending: 0 };

  const today = startOfDay(new Date());
  let paid = 0, overdue = 0, pending = 0;

  for (const s of sales) {
    if (PAID_STATUSES.includes(s.status)) {
      paid++;
    } else if (s.payment_date && isBefore(parseISO(s.payment_date), today)) {
      overdue++;
    } else {
      pending++;
    }
  }

  const total = sales.length;
  let status: HealthStatus;
  let label: string;

  if (overdue === 0 && pending === 0) {
    status = 'saudavel'; label = 'Em dia';
  } else if (overdue === 0) {
    status = 'saudavel'; label = 'Em dia';
  } else if (overdue <= 1) {
    status = 'atencao'; label = 'Atenção';
  } else {
    status = 'critico'; label = 'Crítico';
  }

  return { status, label, total, paid, overdue, pending };
}

export function useClientFinancialHealth() {
  const { data: allSales = [] } = useQuery<SaleRow[]>({
    queryKey: ['commercial-sales-health'],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('client, status, payment_date');
      return (data || []) as SaleRow[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const healthMap = useMemo(() => {
    const map: Record<string, ClientHealth> = {};
    const grouped: Record<string, SaleRow[]> = {};
    for (const s of allSales) {
      const key = s.client || '';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    }
    for (const [client, sales] of Object.entries(grouped)) {
      map[client] = computeHealth(sales);
    }
    return map;
  }, [allSales]);

  const getHealth = (clientName: string): ClientHealth => {
    return healthMap[clientName] || { status: 'sem_dados', label: 'Sem dados', total: 0, paid: 0, overdue: 0, pending: 0 };
  };

  return { healthMap, getHealth };
}

export const HEALTH_BADGE: Record<HealthStatus, { className: string }> = {
  saudavel: { className: 'bg-success/10 text-success border-success/20' },
  atencao: { className: 'bg-warning/10 text-warning border-warning/20' },
  critico: { className: 'bg-destructive/10 text-destructive border-destructive/20' },
  sem_dados: { className: 'bg-muted text-muted-foreground' },
};
