import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type Product = Tables<'products'>;

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
  { value: 'servico_premium', label: 'Produto Premium' },
  { value: 'produto_recorrencia', label: 'Produto de Recorrência' },
  { value: 'servico', label: 'Serviço' },
] as const;

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'consulta', label: 'Consulta (sessão única)' },
  { value: 'consultoria_individual', label: 'Consultoria Individual' },
  { value: 'consultoria_grupo', label: 'Consultoria em Grupo' },
  { value: 'mentoria_individual', label: 'Mentoria Individual' },
  { value: 'mentoria_grupo', label: 'Mentoria em Grupo' },
  { value: 'programa_implementacao', label: 'Programa de Implementação Individual' },
  { value: 'programa_implementacao_grupo', label: 'Programa de Implementação em Grupo' },
  { value: 'curso', label: 'Curso Gravado' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'servico_pontual', label: 'Serviço Pontual' },
  { value: 'servico_mensal', label: 'Serviço Mensal' },
  { value: 'template', label: 'Template' },
  { value: 'ebook', label: 'E-book' },
] as const;

/**
 * Modos operacionais combináveis (multi-select).
 * Substitui o antigo `task_mode` único — `task_mode` continua sincronizado
 * (= primeiro valor do array) por trigger DB para retrocompatibilidade.
 */
export const TASK_MODE_OPTIONS = [
  { value: 'fases', label: 'Fases & Entregáveis', description: 'Projeto com início, meio e fim, organizado por fases.' },
  { value: 'tarefas_fixas', label: 'Tarefas Fixas Recorrentes', description: 'Tarefas que se repetem sempre na mesma cadência (semanal, mensal…).' },
  { value: 'tarefas_livres', label: 'Tarefas Livres', description: 'Tarefas ad-hoc adicionadas conforme necessário.' },
] as const;

export function normalizeTaskModes(modes?: readonly (string | null | undefined)[] | null, fallback?: string | null): string[] {
  const allowed = TASK_MODE_OPTIONS.map(o => o.value as string);
  const source = modes && modes.length > 0 ? modes : (fallback ? [fallback] : ['fases']);
  const unique = Array.from(new Set(source.filter((m): m is string => typeof m === 'string' && allowed.includes(m))));
  const ordered = allowed.filter(mode => unique.includes(mode));
  return ordered.length > 0 ? ordered : ['fases'];
}

/** Tipos onde faz sentido perguntar nº de sessões. */
export const SESSION_BASED_TYPES = new Set([
  'consulta',
  'consultoria_individual',
  'consultoria_grupo',
  'mentoria_individual',
  'mentoria_grupo',
  'programa_implementacao',
  'programa_implementacao_grupo',
  'workshop',
]);

export const SALES_TYPE_OPTIONS = [
  { value: 'perpetuo', label: 'Perpétuo' },
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'candidatura', label: 'Candidatura' },
  { value: 'avenca_mensal', label: 'Avença Mensal' },
  { value: 'subscricao', label: 'Subscrição' },
  { value: 'gratuito', label: 'Gratuito' },
] as const;

/**
 * Deriva o modo do projeto (pontual / recorrente) a partir do tipo de produto
 * e tipo de vendas. Substitui o antigo campo manual `default_project_mode`.
 */
export function deriveProjectMode(
  product_type?: string | null,
  sales_type?: string | null,
): 'pontual' | 'recorrente' {
  if (product_type === 'servico_mensal') return 'recorrente';
  if (sales_type === 'avenca_mensal' || sales_type === 'subscricao') return 'recorrente';
  return 'pontual';
}

export function useProducts() {
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ['products'],
    staleTime: 2 * 60 * 1000,
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
    mutationFn: async (product: Partial<Product> & { name: string }): Promise<string | null> => {
      const taskModes = normalizeTaskModes(product.task_modes, product.task_mode);
      const payload = { ...product, task_modes: taskModes, task_mode: taskModes[0] };
      if (product.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
        return product.id;
      } else {
        const { data, error } = await supabase.from('products').insert(payload as TablesInsert<'products'>).select('id').single();
        if (error) throw error;
        const newId = data.id;

        // Auto-create 6 default SOPs for the new product
        const defaultSops = [
          { name: 'Entrada/Onboarding de Clientes', sop_type: 'onboarding' },
          { name: 'Gestão de Pagamentos', sop_type: 'operacional' },
          { name: 'Recolha de NPS/Feedbacks', sop_type: 'operacional' },
          { name: 'Acompanhamento de Cliente', sop_type: 'operacional' },
          { name: 'KPIs de Produto', sop_type: 'operacional' },
          { name: 'Fecho/Offboarding de Clientes', sop_type: 'operacional' },
        ];
        await supabase.from('sops').insert(
          defaultSops.map((s, idx) => ({
            name: `${s.name} — ${product.name}`,
            department: 'produtos',
            departments: ['produtos'],
            status: 'para_criar',
            linked_entity_type: 'produto',
            linked_entity_id: newId,
            product_name: product.name,
            product_id: newId,
            sop_type: s.sop_type,
            sort_order: idx,
          }))
        );

        return newId;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-brand-colors'] });
      qc.invalidateQueries({ queryKey: ['product-brand-list'] });
    },
    onError: () => toast.error('Erro ao guardar produto'),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { data: snap } = await supabase.from('products').select('name').eq('id', id).maybeSingle();
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      logAudit('deleted', 'product', id, { name: snap?.name });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const duplicateProduct = useMutation({
    mutationFn: async (source: Product) => {
      const { id, created_at, updated_at, ...rest } = source;
      const { error } = await supabase.from('products').insert({
        ...rest,
        name: `${source.name} (cópia)`,
      } as TablesInsert<'products'>);
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
    staleTime: 2 * 60 * 1000,
  });
}
