import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES } from '@/lib/financialCategories';
import type { TablesInsert } from '@/integrations/supabase/types';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

export type CategoryType = 'expense' | 'subscription';

interface FinancialCategory {
  id: string;
  category_type: string;
  value: string;
  label: string;
  sort_order: number;
}

const DEFAULT_EXP_CATEGORIES = EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }));

const DEFAULT_SUB_CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'operacao', label: 'Operação' },
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'design', label: 'Design' },
  { value: 'outro', label: 'Outro' },
];

export function useFinancialCategories() {
  const qc = useQueryClient();

  const { data: customCategories = [] } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as FinancialCategory[];
    },
  });

  const addCategory = useMutation({
    mutationFn: async ({ category_type, value, label }: { category_type: CategoryType; value: string; label: string }) => {
      const { error } = await supabase.from('financial_categories').insert({
        category_type,
        value,
        label,
        sort_order: 100,
      } as TablesInsert<'financial_categories'>);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria adicionada');
    },
    onError: () => toast.error('Erro ao adicionar categoria'),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('financial_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria removida');
    },
  });

  function getExpenseCategories() {
    const dbCats = customCategories
      .filter(c => c.category_type === 'expense')
      .map(c => ({ value: c.value, label: c.label, isCustom: true, id: c.id }));
    if (dbCats.length > 0) return dbCats;
    return DEFAULT_EXP_CATEGORIES.map(c => ({ ...c, isCustom: false, id: '' }));
  }

  function getSubscriptionCategories() {
    const dbCats = customCategories
      .filter(c => c.category_type === 'subscription')
      .map(c => ({ value: c.value, label: c.label, isCustom: true, id: c.id }));
    if (dbCats.length > 0) return dbCats;
    return DEFAULT_SUB_CATEGORIES.map(c => ({ ...c, isCustom: false, id: '' }));
  }

  function getCategoryLabel(type: CategoryType, value: string) {
    const all = type === 'expense' ? getExpenseCategories() : getSubscriptionCategories();
    return all.find(c => c.value === value)?.label || value;
  }

  return {
    expenseCategories: getExpenseCategories(),
    subscriptionCategories: getSubscriptionCategories(),
    getCategoryLabel,
    addCategory,
    deleteCategory,
  };
}
