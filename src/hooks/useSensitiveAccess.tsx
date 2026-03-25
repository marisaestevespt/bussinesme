import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

export type SensitiveCategory = 'financial_values' | 'payroll' | 'fiscal_data' | 'contracts' | 'client_payments';

export const SENSITIVE_CATEGORIES: { key: SensitiveCategory; label: string; description: string }[] = [
  { key: 'financial_values', label: 'Valores financeiros', description: 'Entradas, saídas, balanço, margens, faturação' },
  { key: 'payroll', label: 'Ordenados & custos RH', description: 'Payroll, custos por pessoa, salários' },
  { key: 'fiscal_data', label: 'Dados fiscais', description: 'NIF, morada fiscal, regime IVA, IBAN' },
  { key: 'contracts', label: 'Contratos', description: 'Valores contratuais, datas, documentos legais' },
  { key: 'client_payments', label: 'Pagamentos de clientes', description: 'Método pagamento, valores, histórico' },
];

/**
 * Hook to check if the current user can see sensitive sections.
 * 
 * Owners always see everything.
 * For other users, checks the member_sensitive_access table for explicit grants.
 */
export function useSensitiveAccess() {
  const { isOwner, user } = useAuth();
  const { userDepartments } = usePermissions();
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isOwner) {
      setGrants(new Set());
      setLoading(false);
      return;
    }

    const fetchGrants = async () => {
      // Get team_member id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) { setLoading(false); return; }

      const { data: tm } = await supabase
        .from('team_members')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!tm) { setLoading(false); return; }

      const { data: access } = await supabase
        .from('member_sensitive_access')
        .select('category, granted')
        .eq('member_id', tm.id);

      const grantedSet = new Set<string>();
      (access || []).forEach(a => {
        if (a.granted) grantedSet.add(a.category);
      });
      setGrants(grantedSet);
      setLoading(false);
    };

    fetchGrants();
  }, [user, isOwner]);

  const canSee = (category: SensitiveCategory | 'financial' | 'legal'): boolean => {
    // Owners always see everything
    if (isOwner) return true;

    // Admin department sees everything
    if (userDepartments.includes('admin')) return true;

    // Map legacy tags to new categories
    if (category === 'financial') {
      return grants.has('financial_values') || grants.has('payroll');
    }
    if (category === 'legal') {
      return grants.has('contracts');
    }

    return grants.has(category);
  };

  return { canSee, loading };
}
