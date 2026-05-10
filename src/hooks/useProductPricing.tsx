import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type PricingDriver = Tables<'product_pricing_drivers'>;
export type ProductQuote = Tables<'product_quotes'>;

export function usePricingDrivers(productId?: string | null) {
  const qc = useQueryClient();

  const drivers = useQuery({
    queryKey: ['pricing-drivers', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_pricing_drivers')
        .select('*')
        .eq('product_id', productId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as PricingDriver[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pricing-drivers', productId] });

  const upsert = useMutation({
    mutationFn: async (row: Partial<PricingDriver> & { product_id: string; name: string }) => {
      if (row.id) {
        const { error } = await supabase.from('product_pricing_drivers').update(row).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_pricing_drivers').insert(row as TablesInsert<'product_pricing_drivers'>);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar driver'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_pricing_drivers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { drivers, upsert, remove };
}

export function useProductQuotes(opts: { productId?: string | null; leadId?: string | null; clientId?: string | null }) {
  const qc = useQueryClient();
  const key = ['product-quotes', opts.productId || null, opts.leadId || null, opts.clientId || null];

  const quotes = useQuery({
    queryKey: key,
    enabled: !!(opts.productId || opts.leadId || opts.clientId),
    queryFn: async () => {
      let q = supabase.from('product_quotes').select('*').order('created_at', { ascending: false });
      if (opts.productId) q = q.eq('product_id', opts.productId);
      if (opts.leadId) q = q.eq('lead_id', opts.leadId);
      if (opts.clientId) q = q.eq('client_id', opts.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ProductQuote[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['product-quotes'] });

  const create = useMutation({
    mutationFn: async (row: TablesInsert<'product_quotes'>) => {
      const { data, error } = await supabase.from('product_quotes').insert(row).select('*').single();
      if (error) throw error;
      return data as ProductQuote;
    },
    onSuccess: invalidate,
    onError: () => toast.error('Erro ao guardar orçamento'),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductQuote> }) => {
      const { error } = await supabase.from('product_quotes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { quotes, create, update, remove };
}