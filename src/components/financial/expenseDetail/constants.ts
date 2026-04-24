export const EXP_STATUS = [
  { value: 'por_pagar', label: 'Por Pagar', cls: 'bg-muted text-muted-foreground' },
  { value: 'pendente', label: 'Pendente', cls: 'bg-warning/10 text-warning' },
  { value: 'em_atraso', label: 'Em Atraso', cls: 'bg-destructive/10 text-destructive' },
  { value: 'pago_falta_fatura', label: 'Pago, Falta Fatura', cls: 'bg-info/10 text-info' },
  { value: 'tudo_ok', label: 'Tudo OK', cls: 'bg-success/10 text-success' },
  { value: 'cancelado', label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
];

export const VAT_OPTIONS = [0, 6, 13, 23];

export const LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
];

export const PERIODICITY_MULTIPLIERS: Record<string, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
};