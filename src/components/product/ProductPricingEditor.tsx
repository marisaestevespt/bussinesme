import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Layers, SlidersHorizontal, Percent } from 'lucide-react';
import { ProductPriceTiers } from '@/components/product/ProductPriceTiers';
import { usePricingDrivers } from '@/hooks/useProductPricing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ComplexityLevel, VolumeDiscount } from '@/lib/quoteCalculator';
import { formatEuro } from '@/lib/quoteCalculator';

interface Props {
  productId: string;
  ticketType: 'fixo' | 'variavel';
  isOwner: boolean;
  initial: {
    base_price?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    complexity_levels?: ComplexityLevel[] | null;
    volume_discounts?: VolumeDiscount[] | null;
  };
}

export function ProductPricingEditor({ productId, ticketType, isOwner, initial }: Props) {
  const qc = useQueryClient();
  const [basePrice, setBasePrice] = useState<string>(initial.base_price?.toString() ?? '');
  const [priceMin, setPriceMin] = useState<string>(initial.price_min?.toString() ?? '');
  const [priceMax, setPriceMax] = useState<string>(initial.price_max?.toString() ?? '');
  const [complexity, setComplexity] = useState<ComplexityLevel[]>(initial.complexity_levels || []);
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>(initial.volume_discounts || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBasePrice(initial.base_price?.toString() ?? '');
    setPriceMin(initial.price_min?.toString() ?? '');
    setPriceMax(initial.price_max?.toString() ?? '');
    setComplexity(initial.complexity_levels || []);
    setDiscounts(initial.volume_discounts || []);
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { drivers, upsert: upsertDriver, remove: removeDriver } = usePricingDrivers(productId);

  const persistProductFields = async (patch: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await supabase.from('products').update(patch).eq('id', productId);
    setSaving(false);
    if (error) { toast.error('Erro ao guardar'); return; }
    qc.invalidateQueries({ queryKey: ['products', productId] });
  };

  if (ticketType === 'fixo') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Tiers de Preço</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPriceTiers productId={productId} readOnly={!isOwner} />
        </CardContent>
      </Card>
    );
  }

  // Variável
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Calculadora de Orçamento (Preço Variável)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Range + base */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Intervalo & base</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Mínimo (€)</label>
              <Input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} onBlur={() => persistProductFields({ price_min: parseFloat(priceMin) || null })} disabled={!isOwner} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Máximo (€)</label>
              <Input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} onBlur={() => persistProductFields({ price_max: parseFloat(priceMax) || null })} disabled={!isOwner} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Base (€)</label>
              <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} onBlur={() => persistProductFields({ base_price: parseFloat(basePrice) || 0 })} disabled={!isOwner} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic">O intervalo é mostrado em landings e propostas. A "Base" é somada aos drivers no cálculo.</p>
        </section>

        {/* Drivers */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Drivers de Orçamento</h4>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => upsertDriver.mutate({ product_id: productId, name: 'Novo driver', unit: 'unidade', unit_price: 0, default_qty: 0, sort_order: drivers.data?.length || 0 })}>
                <Plus className="h-3 w-3 mr-1" /> Driver
              </Button>
            )}
          </div>
          {(drivers.data || []).length === 0 && <p className="text-xs text-muted-foreground italic">Sem drivers. Ex: "Nº páginas × 50€".</p>}
          {(drivers.data || []).map(d => (
            <div key={d.id} className="grid grid-cols-[1fr_120px_120px_120px_auto] gap-2 items-center rounded-md border p-2 bg-muted/20">
              <Input className="h-8 text-sm" placeholder="Nome (ex: Páginas)" defaultValue={d.name} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: e.target.value, unit: d.unit, unit_price: d.unit_price, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" placeholder="Unidade" defaultValue={d.unit || ''} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: e.target.value || null, unit_price: d.unit_price, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" type="number" placeholder="€/unidade" defaultValue={d.unit_price} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: parseFloat(e.target.value) || 0, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" type="number" placeholder="Qty default" defaultValue={d.default_qty} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: d.unit_price, default_qty: parseFloat(e.target.value) || 0 })} disabled={!isOwner} />
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDriver.mutate(d.id)}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </section>

        {/* Complexity multipliers */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Níveis de Complexidade</h4>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => {
                const next = [...complexity, { key: `nivel-${complexity.length + 1}`, label: 'Novo nível', multiplier: 1 }];
                setComplexity(next);
                persistProductFields({ complexity_levels: next });
              }}><Plus className="h-3 w-3 mr-1" /> Nível</Button>
            )}
          </div>
          {complexity.length === 0 && <p className="text-xs text-muted-foreground italic">Sem níveis. Ex: Baixa ×1, Média ×1.3, Alta ×1.6.</p>}
          {complexity.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center rounded-md border p-2 bg-muted/20">
              <Input className="h-8 text-sm" placeholder="Label" value={c.label} onChange={e => { const next = [...complexity]; next[i] = { ...c, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '-') }; setComplexity(next); }} onBlur={() => persistProductFields({ complexity_levels: complexity })} disabled={!isOwner} />
              <Input className="h-8 text-sm" type="number" step="0.1" placeholder="×" value={c.multiplier} onChange={e => { const next = [...complexity]; next[i] = { ...c, multiplier: parseFloat(e.target.value) || 1 }; setComplexity(next); }} onBlur={() => persistProductFields({ complexity_levels: complexity })} disabled={!isOwner} />
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { const next = complexity.filter((_, j) => j !== i); setComplexity(next); persistProductFields({ complexity_levels: next }); }}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </section>

        {/* Volume discounts */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><Percent className="h-3 w-3" /> Descontos por Volume</h4>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => { const next = [...discounts, { min_subtotal: 0, discount_pct: 0 }]; setDiscounts(next); persistProductFields({ volume_discounts: next }); }}><Plus className="h-3 w-3 mr-1" /> Faixa</Button>
            )}
          </div>
          {discounts.length === 0 && <p className="text-xs text-muted-foreground italic">Sem descontos automáticos.</p>}
          {discounts.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-md border p-2 bg-muted/20">
              <div>
                <label className="text-[10px] text-muted-foreground">Subtotal ≥ (€)</label>
                <Input className="h-8 text-sm" type="number" value={d.min_subtotal} onChange={e => { const next = [...discounts]; next[i] = { ...d, min_subtotal: parseFloat(e.target.value) || 0 }; setDiscounts(next); }} onBlur={() => persistProductFields({ volume_discounts: discounts })} disabled={!isOwner} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Desconto (%)</label>
                <Input className="h-8 text-sm" type="number" value={d.discount_pct} onChange={e => { const next = [...discounts]; next[i] = { ...d, discount_pct: parseFloat(e.target.value) || 0 }; setDiscounts(next); }} onBlur={() => persistProductFields({ volume_discounts: discounts })} disabled={!isOwner} />
              </div>
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive mt-4" onClick={() => { const next = discounts.filter((_, j) => j !== i); setDiscounts(next); persistProductFields({ volume_discounts: next }); }}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </section>

        {saving && <p className="text-[11px] text-muted-foreground">A guardar…</p>}
        {(priceMin || priceMax) && (
          <p className="text-[11px] text-muted-foreground italic">Intervalo público: <strong>{priceMin ? formatEuro(parseFloat(priceMin)) : '—'} – {priceMax ? formatEuro(parseFloat(priceMax)) : '—'}</strong></p>
        )}
      </CardContent>
    </Card>
  );
}