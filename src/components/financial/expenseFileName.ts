import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Sanitize part of a filename: keep alnum, replace others with _ */
function sanitize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

/**
 * Build "MMYYYY_Fornecedor" or "MMYYYY_ExpenseName" from an expense form.
 */
export function buildExpenseFileName(opts: {
  expenseDate?: string | Date | null;
  supplierName?: string | null;
  expenseName?: string | null;
}): string | undefined {
  const d = opts.expenseDate
    ? (opts.expenseDate instanceof Date ? opts.expenseDate : new Date(opts.expenseDate))
    : null;
  if (!d || isNaN(d.getTime())) return undefined;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const label = sanitize(opts.supplierName || opts.expenseName || '');
  if (!label) return `${mm}${yyyy}`;
  return `${mm}${yyyy}_${label}`;
}

/** Hook to fetch supplier name by id (cached). */
export function useSupplierName(supplierId?: string | null) {
  return useQuery({
    queryKey: ['supplier-name', supplierId],
    enabled: !!supplierId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supplierId) return null;
      const { data } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', supplierId)
        .maybeSingle();
      return data?.name ?? null;
    },
  });
}