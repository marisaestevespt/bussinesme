import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Plus, Trash2, Pencil, Check, CreditCard, Building2, Smartphone, Wallet, Hash, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface PaymentMethod {
  type: string;
  label: string;
  value: string;
  card_last4?: string;
  card_expiry?: string;
}

const PAYMENT_TYPE_OPTIONS = [
  { value: 'iban', label: 'IBAN / Transferência' },
  { value: 'mbway', label: 'MBWay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'mb_ref', label: 'Referência Multibanco' },
  { value: 'outro', label: 'Outro' },
];

interface SetupData {
  id?: string;
  business_legal_name: string;
  nif: string;
  cae_principal: string;
  cae_secundarios: string;
  regime_iva: string;
  regime_fiscal: string;
  morada_fiscal: string;
  capital_social: string;
  iban: string;
  banco: string;
  contabilista: string;
  contabilista_contacto: string;
  notas: string;
  payment_methods: PaymentMethod[];
  business_email: string;
  business_phone: string;
  business_website: string;
  cirs_code: string;
}

const EMPTY: SetupData = {
  business_legal_name: '',
  nif: '',
  cae_principal: '',
  cae_secundarios: '',
  regime_iva: '',
  regime_fiscal: '',
  morada_fiscal: '',
  capital_social: '',
  iban: '',
  banco: '',
  contabilista: '',
  contabilista_contacto: '',
  notas: '',
  payment_methods: [],
  business_email: '',
  business_phone: '',
  business_website: '',
  cirs_code: '',
};

export function FinSetupNegocio() {
  const qc = useQueryClient();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: setup, isLoading } = useQuery({
    queryKey: ['business-setup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_setup' as any)
        .select('*')
        .maybeSingle();
      if (!data) return null;
      const d = data as any;
      return {
        ...d,
        payment_methods: Array.isArray(d.payment_methods) ? d.payment_methods : [],
      } as SetupData;
    },
  });

  const [form, setForm] = useState<SetupData | null>(null);
  const current = form ?? setup ?? EMPTY;

  useEffect(() => {
    if (setup && !form) setForm(setup);
  }, [setup]);

  const update = (key: keyof SetupData, value: any) => {
    setForm(prev => ({ ...(prev ?? setup ?? EMPTY), [key]: value }));
  };

  // Payment methods helpers
  const addPaymentMethod = () => {
    const methods = [...(current.payment_methods || []), { type: 'iban', label: '', value: '' }];
    update('payment_methods', methods);
    setEditingIndex(methods.length - 1);
  };

  const updatePaymentMethod = (index: number, field: keyof PaymentMethod, val: string) => {
    const methods = [...(current.payment_methods || [])];
    methods[index] = { ...methods[index], [field]: val };
    // Auto-fill label from type if empty
    if (field === 'type' && !methods[index].label) {
      const opt = PAYMENT_TYPE_OPTIONS.find(o => o.value === val);
      if (opt) methods[index].label = opt.label;
    }
    update('payment_methods', methods);
  };

  const removePaymentMethod = (index: number) => {
    const methods = (current.payment_methods || []).filter((_, i) => i !== index);
    update('payment_methods', methods);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...current };
      delete payload.id;
      if (setup?.id) {
        const { error } = await supabase.from('business_setup' as any).update(payload).eq('id', setup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('business_setup' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-setup'] });
      toast.success('Setup guardado');
    },
    onError: () => toast.error('Não consegui guardar a configuração. Tenta novamente.'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  return (
    <div className="space-y-6">
      {/* Dados da Empresa */}
      <Card id="sec-empresa" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome Legal / Firma</Label>
            <Input value={current.business_legal_name} onChange={e => update('business_legal_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">NIF</Label>
            <Input value={current.nif} onChange={e => update('nif', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Capital Social</Label>
            <Input value={current.capital_social} onChange={e => update('capital_social', e.target.value)} placeholder="€" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Morada Fiscal</Label>
            <Input value={current.morada_fiscal} onChange={e => update('morada_fiscal', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Contactos do Negócio */}
      <Card id="sec-contactos" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Contactos do Negócio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input type="email" value={current.business_email} onChange={e => update('business_email', e.target.value)} placeholder="geral@empresa.pt" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input value={current.business_phone} onChange={e => update('business_phone', e.target.value)} placeholder="+351 ..." />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <Input value={current.business_website} onChange={e => update('business_website', e.target.value)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {/* Métodos de Pagamento */}
      <Card id="sec-pagamentos" className="scroll-mt-24">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
          <Button size="sm" variant="outline" onClick={addPaymentMethod}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Estes dados ficam disponíveis no portal de cliente, na secção de pagamentos.
          </p>
          {(current.payment_methods || []).length === 0 ? (
            <EmptyHint>Nenhum método de pagamento adicionado.</EmptyHint>
          ) : (
            (current.payment_methods || []).map((pm, i) => {
              const isEditing = editingIndex === i;
              const typeLabel = PAYMENT_TYPE_OPTIONS.find(o => o.value === pm.type)?.label || pm.type;
              const TypeIcon = pm.type === 'cartao' ? CreditCard
                : pm.type === 'iban' ? Building2
                : pm.type === 'mbway' ? Smartphone
                : pm.type === 'paypal' || pm.type === 'stripe' ? Wallet
                : pm.type === 'mb_ref' ? Hash
                : MoreHorizontal;
              const summary = pm.type === 'cartao'
                ? [pm.card_last4 ? `**** ${pm.card_last4}` : null, pm.card_expiry || null].filter(Boolean).join(' · ')
                : pm.value;

              if (!isEditing) {
                return (
                  <div key={i} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pm.label || typeLabel}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {typeLabel}{summary ? ` · ${summary}` : ''}
                      </p>
                    </div>
                    <Button aria-label="Editar" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingIndex(i)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button aria-label="Eliminar" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removePaymentMethod(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              }

              return (
              <div key={i} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">A editar método {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button aria-label="Concluir" size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => setEditingIndex(null)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button aria-label="Eliminar" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { removePaymentMethod(i); setEditingIndex(null); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={pm.type} onValueChange={v => updatePaymentMethod(i, 'type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome / Etiqueta</Label>
                    <Input value={pm.label} onChange={e => updatePaymentMethod(i, 'label', e.target.value)} placeholder={pm.type === 'cartao' ? 'Ex: Visa Millennium' : 'Ex: Banco principal'} />
                  </div>
                  {pm.type === 'cartao' ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Últimos 4 dígitos</Label>
                        <Input value={(pm as any).card_last4 || ''} onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          updatePaymentMethod(i, 'card_last4' as any, val);
                        }} placeholder="1234" maxLength={4} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Validade</Label>
                        <Input value={(pm as any).card_expiry || ''} onChange={e => {
                          let val = e.target.value.replace(/[^\d/]/g, '');
                          if (val.length === 2 && !(pm as any).card_expiry?.includes('/')) val += '/';
                          updatePaymentMethod(i, 'card_expiry' as any, val.slice(0, 5));
                        }} placeholder="MM/AA" maxLength={5} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {pm.type === 'iban' ? 'IBAN' : pm.type === 'mbway' ? 'Nº MBWay' : pm.type === 'paypal' ? 'Email PayPal' : 'Dados'}
                      </Label>
                      <Input value={pm.value} onChange={e => updatePaymentMethod(i, 'value', e.target.value)} placeholder={pm.type === 'iban' ? 'PT50...' : pm.type === 'mbway' ? '9XX XXX XXX' : ''} />
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}

          {/* Legacy bank fields — show if they have data */}
          {(current.iban || current.banco) && (
            <div className="rounded-md border border-warning/30 bg-warning/15/50 dark:bg-warning/20 dark:border-warning p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Dados bancários antigos (migrar para métodos acima)</p>
              {current.banco && <p>Banco: {current.banco}</p>}
              {current.iban && <p>IBAN: {current.iban}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      <Card id="sec-notas" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={current.notas} onChange={e => update('notas', e.target.value)} rows={4} placeholder="Observações gerais sobre o setup do negócio..." />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {save.isPending ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
