import { supabase } from '@/integrations/supabase/client';

export const FALLBACK_PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_direto', label: 'Débito Direto' },
];

export async function fetchPaymentMethods() {
  const { data } = await supabase.from('business_setup').select('payment_methods').limit(1).single();
  return (data?.payment_methods as any[] || []).filter((m: any) => m.label?.trim());
}

export function buildPaymentMethodOptions(raw: any[] | undefined | null) {
  if (!raw || raw.length === 0) return FALLBACK_PAYMENT_METHODS;
  return raw.map((m: any) => {
    const last4 = m.card_last4 ? ` ****${m.card_last4}` : '';
    const expiry = m.card_expiry ? ` (${m.card_expiry})` : '';
    let displayLabel = m.label;
    if (m.type === 'iban') displayLabel = `IBAN — ${m.label}`;
    if (m.type === 'cartao') displayLabel = `${m.label}${last4}${expiry}`;
    return { value: `${m.type}:${m.label}`, label: displayLabel };
  });
}

export function getPaymentLabel(val: string, options: { value: string; label: string }[]) {
  return options.find(m => m.value === val)?.label || val || '—';
}
