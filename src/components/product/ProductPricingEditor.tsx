import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Layers, Calculator, Percent, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

const Hint = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><HelpCircle className="h-3.5 w-3.5" /></button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">{children}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Pacotes pré-definidos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Cria pacotes fechados (ex: Básico / Pro / Premium) com preço definido.</p>
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
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Variáveis do orçamento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Define os ingredientes que a Calculadora de Orçamento usa para gerar propostas. Os preços mín/sugerido/máx são calculados na <strong>Calculadora de Oferta</strong> (na secção Contabilidade & Pricing).
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* 1. O que entra na conta */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">1. O que entra na conta — quantidades</h4>
              <Hint>
                <p>Lista de coisas que se contam e cada uma tem um preço unitário.</p>
                <p className="mt-1">Exemplos: "Horas/semana × 70€", "Posts × 25€", "Sessões × 120€".</p>
                <p className="mt-1">No orçamento, escreves quantos e o sistema multiplica.</p>
              </Hint>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => upsertDriver.mutate({ product_id: productId, name: '', unit: 'unidade', unit_price: 0, default_qty: 0, sort_order: drivers.data?.length || 0 })}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar item
              </Button>
            )}
          </div>
          {(drivers.data || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sem itens. Ex: "Horas por semana" a 70€/h, "Posts" a 25€/un.</p>
          )}
          {(drivers.data || []).length > 0 && (
            <div className="grid grid-cols-[1fr_120px_120px_120px_auto] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
              <span>Nome</span><span>Unidade</span><span>€ por unidade</span><span>Qtd. sugerida</span><span></span>
            </div>
          )}
          {(drivers.data || []).map(d => (
            <div key={d.id} className="grid grid-cols-[1fr_120px_120px_120px_auto] gap-2 items-center rounded-md border p-2 bg-muted/20">
              <Input className="h-8 text-sm" placeholder="Ex: Horas por semana" defaultValue={d.name} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: e.target.value, unit: d.unit, unit_price: d.unit_price, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" placeholder="h, post…" defaultValue={d.unit || ''} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: e.target.value || null, unit_price: d.unit_price, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" type="number" placeholder="70" defaultValue={d.unit_price} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: parseFloat(e.target.value) || 0, default_qty: d.default_qty })} disabled={!isOwner} />
              <Input className="h-8 text-sm" type="number" placeholder="0" defaultValue={d.default_qty} onBlur={e => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: d.unit_price, default_qty: parseFloat(e.target.value) || 0 })} disabled={!isOwner} />
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDriver.mutate(d.id)}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </section>

        {/* 2. Perguntas sobre o cliente */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">2. Perguntas sobre o cliente — ajustes ao preço</h4>
              <Hint>
                <p>Cria perguntas (ex: "Tamanho da equipa") e respostas possíveis (ex: "1 pessoa", "2-4", "5+").</p>
                <p className="mt-1">Cada resposta tem um <strong>fator</strong> que aumenta ou reduz o preço:</p>
                <ul className="mt-1 list-disc pl-4">
                  <li><strong>1.0</strong> = preço normal</li>
                  <li><strong>1.20</strong> = +20%</li>
                  <li><strong>0.90</strong> = −10%</li>
                </ul>
              </Hint>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => modifiers.addDimension.mutate('Nova pergunta')}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar pergunta
              </Button>
            )}
          </div>
          {(modifiers.query.data || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sem perguntas. Ex: "Tamanho equipa", "Fase do negócio", "Urgência".</p>
          )}
          {(modifiers.query.data || []).map(dim => (
            <div key={dim.id} className="rounded-md border bg-muted/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-sm font-medium"
                  placeholder="Pergunta (ex: Tamanho da equipa)"
                  defaultValue={dim.name}
                  onBlur={e => e.target.value !== dim.name && modifiers.updateDimension.mutate({ id: dim.id, name: e.target.value })}
                  disabled={!isOwner}
                />
                {isOwner && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => modifiers.addLevel.mutate(dim.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Resposta
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => modifiers.removeDimension.mutate(dim.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              {dim.levels.length > 0 && (
                <div className="grid grid-cols-[1fr_120px_auto] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground pl-3">
                  <span>Resposta</span><span>Fator (×)</span><span></span>
                </div>
              )}
              {dim.levels.map(lvl => (
                <div key={lvl.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center pl-3">
                  <Input
                    className="h-7 text-sm"
                    placeholder="Ex: 2-4 pessoas"
                    defaultValue={lvl.label}
                    onBlur={e => e.target.value !== lvl.label && modifiers.updateLevel.mutate({ id: lvl.id, patch: { label: e.target.value } })}
                    disabled={!isOwner}
                  />
                  <Input
                    className="h-7 text-sm"
                    type="number"
                    step="0.05"
                    placeholder="1.00"
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
              {dim.levels.length === 0 && <p className="text-[11px] text-muted-foreground italic pl-3">Adiciona pelo menos uma resposta.</p>}
            </div>
          ))}
        </section>

        {/* 3. Descontos automáticos */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> 3. Descontos automáticos por valor</h4>
              <Hint>
                <p>Quando o orçamento atingir um valor, aplica desconto automático.</p>
                <p className="mt-1">Ex: "≥ 1.000€ → 5%", "≥ 5.000€ → 10%". Opcional.</p>
              </Hint>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => { const next = [...discounts, { min_subtotal: 0, discount_pct: 0 }]; setDiscounts(next); persistProductFields({ volume_discounts: next }); }}><Plus className="h-3 w-3 mr-1" /> Faixa</Button>
            )}
          </div>
          {discounts.length === 0 && <p className="text-xs text-muted-foreground italic">Sem descontos automáticos.</p>}
          {discounts.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-md border p-2 bg-muted/20">
              <div>
                <label className="text-[10px] text-muted-foreground">A partir de (€)</label>
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
