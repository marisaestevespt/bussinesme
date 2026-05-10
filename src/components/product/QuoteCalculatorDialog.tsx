import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { computeQuote, formatEuro, type DriverInput, type VolumeDiscount, type ModifierSelection } from '@/lib/quoteCalculator';
import { useProductQuotes } from '@/hooks/useProductPricing';
import { useProductModifiers } from '@/hooks/useProductModifiers';
import { toast } from 'sonner';
import { Calculator, Save, ChevronDown } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  leadId?: string | null;
  clientId?: string | null;
  onAccepted?: (quote: { id: string; total: number }) => void;
}

export function QuoteCalculatorDialog({ open, onOpenChange, productId, leadId, clientId, onAccepted }: Props) {
  const { create } = useProductQuotes({ productId });

  const productQ = useQuery({
    queryKey: ['quote-product', productId],
    enabled: open && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, ticket_type, base_price, price_min, price_max, target_price, volume_discounts').eq('id', productId).maybeSingle();
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
  const volumeDiscounts: VolumeDiscount[] = Array.isArray(product?.volume_discounts) ? product.volume_discounts : [];
  const modifiers = useProductModifiers(open ? productId : null);
  const dimensions = modifiers.query.data || [];

  const [driverQty, setDriverQty] = useState<Record<string, number>>({});
  const [selectedLevels, setSelectedLevels] = useState<Record<string, string>>({});
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showMath, setShowMath] = useState(false);

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

  const selectedModifiers: ModifierSelection[] = useMemo(() => {
    const out: ModifierSelection[] = [];
    dimensions.forEach(dim => {
      const lvlId = selectedLevels[dim.id];
      const lvl = dim.levels.find(l => l.id === lvlId);
      if (lvl) out.push({
        dimension_id: dim.id,
        dimension_name: dim.name,
        level_id: lvl.id,
        level_label: lvl.label,
        multiplier: Number(lvl.multiplier) || 1,
      });
    });
    return out;
  }, [dimensions, selectedLevels]);

  const result = useMemo(() => computeQuote({
    basePrice: Number(product?.base_price) || 0,
    drivers,
    modifiers: selectedModifiers,
    volumeDiscounts,
    manualDiscountPct: parseFloat(manualDiscount) || 0,
  }), [product?.base_price, drivers, selectedModifiers, volumeDiscounts, manualDiscount]);

  const selectedTier = tiersQ.data?.find((t: any) => t.id === selectedTierId);
  const fixedTotal = Number(selectedTier?.price) || 0;
  const total = ticketType === 'fixo' ? fixedTotal : result.total;

  const save = async (status: 'rascunho' | 'aceite') => {
    if (!productId) return;
    if (ticketType === 'fixo' && !selectedTierId) { toast.error('Escolhe um pacote'); return; }
    try {
      const created = await create.mutateAsync({
        product_id: productId,
        lead_id: leadId || null,
        client_id: clientId || null,
        pricing_mode: ticketType,
        drivers_snapshot: ticketType === 'variavel' ? (drivers as any) : ([] as any),
        base_price: ticketType === 'variavel' ? (Number(product?.base_price) || 0) : 0,
        complexity_key: selectedModifiers.map(m => `${m.dimension_name}:${m.level_label}`).join(' | ') || null,
        complexity_multiplier: selectedModifiers.reduce((acc, m) => acc * m.multiplier, 1),
        selected_tier_id: ticketType === 'fixo' ? selectedTierId : null,
        discount_pct: ticketType === 'variavel' ? result.applied_discount_pct : 0,
        subtotal: ticketType === 'variavel' ? result.after_multiplier : fixedTotal,
        total,
        status,
        valid_until: validUntil || null,
        notes: notes || null,
      } as any);

      if (status === 'aceite') {
        if (leadId) {
          await supabase.from('crm_leads').update({ estimated_value: total, quote_id: created.id } as any).eq('id', leadId);
        }
        onAccepted?.({ id: created.id, total });
      }
      toast.success(status === 'aceite' ? 'Orçamento aceite e propagado' : 'Orçamento guardado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  const driversWithQty = drivers.filter(d => d.qty > 0);
  const basePrice = Number(product?.base_price) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Novo orçamento — {product?.name || ''}
          </DialogTitle>
        </DialogHeader>

        {ticketType === 'fixo' ? (
          <div className="space-y-3">
            <Label>Escolhe um pacote</Label>
            <Select value={selectedTierId} onValueChange={setSelectedTierId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {(tiersQ.data || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} — {formatEuro(Number(t.price))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(tiersQ.data || []).length === 0 && <p className="text-xs text-muted-foreground">Sem pacotes definidos. Configura na ficha do produto.</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Passo 1 */}
            {(driversQ.data || []).length > 0 && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">1. Quanto trabalho?</h3>
                  <p className="text-xs text-muted-foreground">Indica as quantidades estimadas para este cliente.</p>
                </div>
                <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                  {(driversQ.data || []).map((d: any) => (
                    <div key={d.id} className="grid grid-cols-[1fr_120px_120px] gap-3 items-center">
                      <div className="text-sm">
                        <div>{d.name || <span className="italic text-muted-foreground">(sem nome)</span>}</div>
                        <div className="text-[11px] text-muted-foreground">{formatEuro(Number(d.unit_price))} por {d.unit || 'unidade'}</div>
                      </div>
                      <Input type="number" min="0" value={driverQty[d.id] ?? 0} onChange={e => setDriverQty(prev => ({ ...prev, [d.id]: parseFloat(e.target.value) || 0 }))} />
                      <div className="text-sm text-right tabular-nums font-medium">{formatEuro((Number(d.unit_price) || 0) * (driverQty[d.id] ?? 0))}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Passo 2 */}
            {dimensions.some(d => d.levels.length > 0) && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">2. Sobre o cliente</h3>
                  <p className="text-xs text-muted-foreground">Cada resposta ajusta o preço final.</p>
                </div>
                <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
                  {dimensions.map(dim => dim.levels.length > 0 && (
                    <div key={dim.id} className="space-y-1">
                      <Label className="text-xs">{dim.name}</Label>
                      <Select value={selectedLevels[dim.id] || ''} onValueChange={v => setSelectedLevels(prev => ({ ...prev, [dim.id]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                        <SelectContent>
                          {dim.levels.map(l => {
                            const m = Number(l.multiplier) || 1;
                            const pct = m === 1 ? 'sem alteração' : (m > 1 ? `+${Math.round((m - 1) * 100)}%` : `−${Math.round((1 - m) * 100)}%`);
                            return <SelectItem key={l.id} value={l.id}>{l.label} <span className="text-muted-foreground ml-1">({pct})</span></SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Passo 3 */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">3. Ajustes finais</h3>
                <p className="text-xs text-muted-foreground">Desconto manual (opcional) e validade do orçamento.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/10 p-3">
                <div>
                  <Label className="text-xs">Desconto (%)</Label>
                  <Input type="number" value={manualDiscount} onChange={e => setManualDiscount(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Válido até</Label>
                  <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
                </div>
              </div>
            </section>

            {/* Resultado */}
            <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Preço sugerido</span>
                <span className="text-3xl font-bold tabular-nums">{formatEuro(result.total)}</span>
              </div>
              {(() => {
                const min = Number(product?.price_min) || null;
                const tgt = Number(product?.target_price) || null;
                const max = Number(product?.price_max) || null;
                if (!min && !tgt && !max) return null;
                const t = result.total;
                let status: { color: string; label: string } | null = null;
                if (min && t < min) status = { color: 'text-destructive', label: `Abaixo do mínimo (${formatEuro(min)}) — perdes margem.` };
                else if (tgt && t < tgt) status = { color: 'text-warning', label: `Abaixo do sugerido (${formatEuro(tgt)}).` };
                else if (max && t > max) status = { color: 'text-info', label: `Acima do máximo (${formatEuro(max)}) — risco de perder o cliente.` };
                else status = { color: 'text-success', label: 'Dentro da zona saudável.' };
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Mínimo: <strong className="text-foreground">{min ? formatEuro(min) : '—'}</strong></span>
                      <span>Sugerido: <strong className="text-foreground">{tgt ? formatEuro(tgt) : '—'}</strong></span>
                      <span>Máximo: <strong className="text-foreground">{max ? formatEuro(max) : '—'}</strong></span>
                    </div>
                    <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
                  </div>
                );
              })()}

              <Collapsible open={showMath} onOpenChange={setShowMath}>
                <CollapsibleTrigger className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  <ChevronDown className={`h-3 w-3 transition-transform ${showMath ? 'rotate-180' : ''}`} />
                  {showMath ? 'Ocultar' : 'Ver'} cálculo
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-1 text-xs">
                  {basePrice > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor base</span><span className="tabular-nums">{formatEuro(basePrice)}</span></div>
                  )}
                  {driversWithQty.map(d => (
                    <div key={d.id} className="flex justify-between">
                      <span className="text-muted-foreground">{d.qty} × {d.name} ({formatEuro(d.unit_price)}/{d.unit || 'un'})</span>
                      <span className="tabular-nums">{formatEuro(d.qty * d.unit_price)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-medium">Subtotal</span>
                    <span className="tabular-nums font-medium">{formatEuro(result.base_with_drivers)}</span>
                  </div>
                  {selectedModifiers.map(m => {
                    const pct = m.multiplier === 1 ? '' : (m.multiplier > 1 ? `+${Math.round((m.multiplier - 1) * 100)}%` : `−${Math.round((1 - m.multiplier) * 100)}%`);
                    return (
                      <div key={m.dimension_id} className="flex justify-between">
                        <span className="text-muted-foreground">{m.dimension_name}: {m.level_label}</span>
                        <span className="tabular-nums">{pct}</span>
                      </div>
                    );
                  })}
                  {selectedModifiers.length > 0 && (
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-medium">Após ajustes</span>
                      <span className="tabular-nums font-medium">{formatEuro(result.after_multiplier)}</span>
                    </div>
                  )}
                  {result.applied_discount_pct > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Desconto</span>
                      <span className="tabular-nums">−{result.applied_discount_pct}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1 text-sm">
                    <span className="font-semibold">Total</span>
                    <span className="tabular-nums font-semibold">{formatEuro(result.total)}</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
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
