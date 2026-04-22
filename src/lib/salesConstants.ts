/**
 * Shared sale-related constants (payment methods, offer reasons).
 * Used by SaleFormDialog, SaleDetailDialog, ProjectGestaoTab, MemberDialog.
 */

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'transferencia',  label: 'Transferência Bancária' },
  { value: 'cartao',         label: 'Cartão de Crédito/Débito' },
  { value: 'debito_direto',  label: 'Débito Direto' },
  { value: 'mbway',          label: 'MB WAY' },
  { value: 'multibanco',     label: 'Multibanco' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHOD_OPTIONS[number]['value'];

export function getPaymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '';
  return PAYMENT_METHOD_OPTIONS.find(m => m.value === value)?.label || value;
}

export const SPECIAL_OFFER_REASONS = [
  'Campanha especial',
  'Cliente antigo',
  'Parceria',
  'Desconto de lançamento',
  'Upgrade de produto',
] as const;
