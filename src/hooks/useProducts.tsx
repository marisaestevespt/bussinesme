import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Product = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sales_page_url: string | null;
  ticket: string | null;
  escada: string | null;
  product_type: string | null;
  sales_type: string | null;
  drive_url: string | null;
  important_dates: any;
  about_content: string | null;
  included_items: any;
  faqs: any;
  client_profile: any;
  competitors: any;
  improvements_content: string | null;
  brainstorming_content: string | null;
  logo_url: string | null;
  cover_url: string | null;
  vat_rate: string | null;
  invoice_denomination: string | null;
  accounting_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_OPTIONS = [
  { value: 'em_ideia', label: 'Em Ideia' },
  { value: 'a_criar', label: 'A Criar' },
  { value: 'vendas_ativas', label: 'Vendas Ativas' },
  { value: 'off', label: 'Off' },
] as const;

export const ESCADA_OPTIONS = [
  { value: 'lead_magnet', label: 'Lead Magnet' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'produto_entrada', label: 'Produto de Entrada' },
  { value: 'produto_intermedio', label: 'Produto Intermédio' },
  { value: 'servico_premium', label: 'Serviço Premium' },
  { value: 'produto_recorrencia', label: 'Produto de Recorrência' },
] as const;

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'curso', label: 'Curso' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'servico', label: 'Serviço' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'bonus', label: 'Bónus' },
  { value: 'lead_magnet', label: 'Lead Magnet' },
  { value: 'sessao', label: 'Sessão' },
] as const;

export const SALES_TYPE_OPTIONS = [
  { value: 'perpetuo', label: 'Perpétuo' },
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'candidatura', label: 'Candidatura' },
  { value: 'avenca_mensal', label: 'Avença Mensal' },
  { value: 'subscricao', label: 'Subscrição' },
  { value: 'gratuito', label: 'Gratuito' },
] as const;

export function useProducts() {
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  const upsertProduct = useMutation({
    mutationFn: async (product: Partial<Product> & { name: string }) => {
      if (product.id) {
        const { error } = await supabase.from('products').update(product).eq('id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(product);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: () => toast.error('Erro ao guardar produto'),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const duplicateProduct = useMutation({
    mutationFn: async (source: Product) => {
      const { id, created_at, updated_at, ...rest } = source;
      const { error } = await supabase.from('products').insert({
        ...rest,
        name: `${source.name} (cópia)`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto duplicado');
    },
  });

  return { products, upsertProduct, deleteProduct, duplicateProduct };
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id,
  });
}
