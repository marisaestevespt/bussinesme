import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentMethodEntry } from '@/components/financial/types';

/**
 * Centralised access to the `business_setup` table (fiscal config, payment
 * methods, etc). Use these hooks instead of querying the table directly so
 * that all consumers share a single React Query cache key and stay in sync.
 *
 * Note: `business_setup` ≠ `business_settings` (which holds branding/theme).
 */

export const BUSINESS_SETUP_PAYMENT_METHODS_KEY = ['business-setup-payment-methods'] as const;

/** Returns the configured payment methods (filtered to entries with a label). */
export function useBusinessSetupPaymentMethods() {
  return useQuery({
    queryKey: BUSINESS_SETUP_PAYMENT_METHODS_KEY,
    queryFn: async (): Promise<PaymentMethodEntry[]> => {
      const { data } = await supabase
        .from('business_setup')
        .select('payment_methods')
        .limit(1)
        .single();
      const list = (data?.payment_methods as PaymentMethodEntry[] | null) || [];
      return list.filter(m => m.label?.trim());
    },
  });
}
