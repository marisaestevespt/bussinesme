import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Layers, SlidersHorizontal, Percent, Sliders } from 'lucide-react';
import { ProductPriceTiers } from '@/components/product/ProductPriceTiers';
import { usePricingDrivers } from '@/hooks/useProductPricing';
import { useProductModifiers } from '@/hooks/useProductModifiers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { VolumeDiscount } from '@/lib/quoteCalculator';
import { formatEuro } from '@/lib/quoteCalculator';

interface Props {
  productId: string;
  ticketType: 'fixo' | 'variavel';
  isOwner: boolean;
  initial: {
    base_price?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    volume_discounts?: VolumeDiscount[] | null;
  };
}

export function ProductPricingEditor({ productId, ticketType, isOwner, initial }: Props) {
  const qc = useQueryClient();
  const [basePrice, setBasePrice] = useState<string>(initial.base_price?.toString() ?? '');
  const [priceMin, setPriceMin] = useState<string>(initial.price_min?.toString() ?? '');
  const [priceMax, setPriceMax] = useState<string>(initial.price_max?.toString() ?? '');
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>(initial.volume_discounts || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBasePrice(initial.base_price?.toString() ?? '');
    setPriceMin(initial.price_min?.toString() ?? '');
    setPriceMax(initial.price_max?.toString() ?? '');
    setDiscounts(initial.volume_discounts || []);
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { drivers, upsert: upsertDriver, remove: removeDriver } = usePricingDrivers(productId);
  const modifiers = useProductModifiers(productId);

  const persistProductFields = async (patch: Record<string, any>) => {
    setSaving(true);
    const { error } = await supabase.from('products').update(patch as any).eq('id', productId);
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

        {/* Modificadores livres (multi-dimensão) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <Sliders className="h-3 w-3" /> Modificadores
            </h4>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => modifiers.addDimension.mutate('Nova dimensão')}>
                <Plus className="h-3 w-3 mr-1" /> Dimensão
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Cria as tuas próprias dimensões (ex: "Equipa cliente", "Complexidade", "Urgência"). Cada uma tem níveis com multiplicador (×).
          </p>
          {(modifiers.query.data || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sem modificadores. Os multiplicadores compõem-se ao calcular o orçamento.</p>
          )}
          {(modifiers.query.data || []).map(dim => (
            <div key={dim.id} className="rounded-md border bg-muted/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-sm font-medium"
                  defaultValue={dim.name}
                  onBlur={e => e.target.value !== dim.name && modifiers.updateDimension.mutate({ id: dim.id, name: e.target.value })}
                  disabled={!isOwner}
                />
                {isOwner && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => modifiers.addLevel.mutate(dim.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Nível
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => modifiers.removeDimension.mutate(dim.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              {dim.levels.map(lvl => (
                <div key={lvl.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center pl-3">
                  <Input
                    className="h-7 text-sm"
                    placeholder="Label (ex: Baixa)"
                    defaultValue={lvl.label}
                    onBlur={e => e.target.value !== lvl.label && modifiers.updateLevel.mutate({ id: lvl.id, patch: { label: e.target.value } })}
                    disabled={!isOwner}
                  />
                  <Input
                    className="h-7 text-sm"
                    type="number"
                    step="0.1"
                    placeholder="×"
                    defaultValue={lvl.multiplier}
                    onBlur={e => {
                      const v = parseFloat(e.target.value) || 1;
                      if (v !== Number(lvl.multiplier)) modifiers.updateLevel.mutate({ id: lvl.id, patch: { multiplier: v } });
                    }}
                    disabled={!isOwner}
                  />
                  {isOwner && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => modifiers.removeLevel.mutate(lvl.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {dim.levels.length === 0 && <p className="text-[11px] text-muted-foreground italic pl-3">Sem níveis ainda.</p>}
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