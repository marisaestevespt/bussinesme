import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { computeQuote, formatEuro, type DriverInput, type ComplexityLevel, type VolumeDiscount } from '@/lib/quoteCalculator';
import { useProductQuotes } from '@/hooks/useProductPricing';
import { toast } from 'sonner';
import { Calculator, Save } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  leadId?: string | null;
  clientId?: string | null;
  /** Called after the quote is saved (status='aceite'). Receives the saved quote. */
  onAccepted?: (quote: { id: string; total: number }) => void;
}

export function QuoteCalculatorDialog({ open, onOpenChange, productId, leadId, clientId, onAccepted }: Props) {
  const { create } = useProductQuotes({ productId });

  const productQ = useQuery({
    queryKey: ['quote-product', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, ticket_type, base_price, price_min, price_max, complexity_levels, volume_discounts').eq('id', productId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const driversQ = useQuery({
    queryKey: ['quote-drivers', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.from('product_pricing_drivers').select('*').eq('product_id', productId).order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });
  const tiersQ = useQuery({
    queryKey: ['quote-tiers', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.from('product_price_tiers').select('*').eq('product_id', productId).order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const product = productQ.data;
  const ticketType = (product?.ticket_type || 'fixo') as 'fixo' | 'variavel';
  const complexityLevels: ComplexityLevel[] = Array.isArray(product?.complexity_levels) ? product.complexity_levels : [];
  const volumeDiscounts: VolumeDiscount[] = Array.isArray(product?.volume_discounts) ? product.volume_discounts : [];

  // Variable mode state
  const [driverQty, setDriverQty] = useState<Record<string, number>>({});
  const [complexityKey, setComplexityKey] = useState<string>('');
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  // Fixed mode state
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  // Common
  const [validUntil, setValidUntil] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (driversQ.data) {
      const init: Record<string, number> = {};
      driversQ.data.forEach((d: any) => { init[d.id] = Number(d.default_qty) || 0; });
      setDriverQty(init);
    }
  }, [driversQ.data]);

  const drivers: DriverInput[] = useMemo(() => (driversQ.data || []).map((d: any) => ({
    id: d.id, name: d.name, unit: d.unit, unit_price: Number(d.unit_price) || 0,
    qty: driverQty[d.id] ?? 0,
  })), [driversQ.data, driverQty]);

  const complexity = complexityLevels.find(c => c.key === complexityKey) || null;

  const result = useMemo(() => computeQuote({
    basePrice: Number(product?.base_price) || 0,
    drivers,
    complexity,
    volumeDiscounts,
    manualDiscountPct: parseFloat(manualDiscount) || 0,
  }), [product?.base_price, drivers, complexity, volumeDiscounts, manualDiscount]);

  const selectedTier = tiersQ.data?.find((t: any) => t.id === selectedTierId);
  const fixedTotal = Number(selectedTier?.price) || 0;

  const total = ticketType === 'fixo' ? fixedTotal : result.total;

  const save = async (status: 'rascunho' | 'aceite') => {
    if (!productId) return;
    if (ticketType === 'fixo' && !selectedTierId) { toast.error('Escolhe um tier'); return; }
    try {
      const created = await create.mutateAsync({
        product_id: productId,
        lead_id: leadId || null,
        client_id: clientId || null,
        pricing_mode: ticketType,
        drivers_snapshot: ticketType === 'variavel' ? (drivers as any) : ([] as any),
        base_price: ticketType === 'variavel' ? (Number(product?.base_price) || 0) : 0,
        complexity_key: complexity?.key || null,
        complexity_multiplier: complexity?.multiplier ?? 1,
        selected_tier_id: ticketType === 'fixo' ? selectedTierId : null,
        discount_pct: ticketType === 'variavel' ? result.applied_discount_pct : 0,
        subtotal: ticketType === 'variavel' ? result.after_multiplier : fixedTotal,
        total,
        status,
        valid_until: validUntil || null,
        notes: notes || null,
      } as any);

      if (status === 'aceite') {
        // Propagation: update lead/client links to this quote + value
        if (leadId) {
          await supabase.from('crm_leads').update({ estimated_value: total, quote_id: created.id } as any).eq('id', leadId);
        }
        if (clientId) {
          await supabase.from('clients').update({ contract_value: total, current_quote_id: created.id } as any).eq('id', clientId);
        }
        onAccepted?.({ id: created.id, total });
      }
      toast.success(status === 'aceite' ? 'Orçamento aceite e propagado' : 'Orçamento guardado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-4 w-4" /> Calculadora de Orçamento — {product?.name || ''}</DialogTitle>
        </DialogHeader>

        {ticketType === 'fixo' ? (
          <div className="space-y-3">
            <Label>Escolhe um tier</Label>
            <Select value={selectedTierId} onValueChange={setSelectedTierId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {(tiersQ.data || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — {formatEuro(Number(t.price))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(tiersQ.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem tiers definidos. Configura na ficha do produto.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {(driversQ.data || []).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Drivers</Label>
                {(driversQ.data || []).map((d: any) => (
                  <div key={d.id} className="grid grid-cols-[1fr_120px_120px] gap-2 items-center">
                    <div className="text-sm">{d.name} <span className="text-xs text-muted-foreground">({formatEuro(Number(d.unit_price))}/{d.unit || 'un'})</span></div>
                    <Input type="number" value={driverQty[d.id] ?? 0} onChange={e => setDriverQty(prev => ({ ...prev, [d.id]: parseFloat(e.target.value) || 0 }))} />
                    <div className="text-sm text-right tabular-nums">{formatEuro((Number(d.unit_price) || 0) * (driverQty[d.id] ?? 0))}</div>
                  </div>
                ))}
              </div>
            )}
            {complexityLevels.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Complexidade</Label>
                <Select value={complexityKey} onValueChange={setComplexityKey}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {complexityLevels.map(c => <SelectItem key={c.key} value={c.key}>{c.label} (×{c.multiplier})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Desconto manual (%)</Label>
              <Input type="number" value={manualDiscount} onChange={e => setManualDiscount(e.target.value)} />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="tabular-nums">{formatEuro(Number(product?.base_price) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Drivers</span><span className="tabular-nums">{formatEuro(result.drivers_subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Multiplicador</span><span className="tabular-nums">×{result.multiplier}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto aplicado</span><span className="tabular-nums">{result.applied_discount_pct}%</span></div>
              <div className="flex justify-between font-semibold pt-2 border-t mt-2"><span>Total</span><span className="tabular-nums">{formatEuro(result.total)}</span></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <Label>Válido até</Label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => save('rascunho')} disabled={create.isPending}>Guardar rascunho</Button>
          <Button onClick={() => save('aceite')} disabled={create.isPending || total <= 0}>
            <Save className="h-4 w-4 mr-1" /> Aceitar — {formatEuro(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}