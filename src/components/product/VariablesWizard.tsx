import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, ChevronLeft, ChevronRight, HelpCircle, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePricingDrivers } from '@/hooks/useProductPricing';
import { useProductModifiers } from '@/hooks/useProductModifiers';
import { InlineField } from '@/components/product/InlineField';
import { computeQuote, formatEuro, type VolumeDiscount } from '@/lib/quoteCalculator';

interface Props {
  productId: string;
  isOwner: boolean;
  initial: {
    base_price?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    volume_discounts?: VolumeDiscount[] | null;
  };
}

const STEPS = [
  { key: 'itens',     label: 'Itens & quantidades', desc: 'O que se conta e quanto custa cada' },
  { key: 'perguntas', label: 'Perguntas ao cliente', desc: 'Ajustes ao preço (×1.2, ×0.9…)' },
  { key: 'descontos', label: 'Descontos por volume', desc: 'Opcional — descontos automáticos' },
] as const;
type StepKey = typeof STEPS[number]['key'];

const Hint = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">{children}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export function VariablesWizard({ productId, isOwner, initial }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<StepKey>('itens');
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>(initial.volume_discounts || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDiscounts(initial.volume_discounts || []); }, [productId]); // eslint-disable-line

  const { drivers, upsert: upsertDriver, remove: removeDriver } = usePricingDrivers(productId);
  const modifiers = useProductModifiers(productId);

  const driversList = drivers.data || [];
  const dimensionsList = modifiers.query.data || [];

  const persistProductFields = async (patch: Record<string, any>) => {
    setSaving(true);
    const { error } = await supabase.from('products').update(patch as any).eq('id', productId);
    setSaving(false);
    if (error) { toast.error('Erro ao guardar'); return; }
    qc.invalidateQueries({ queryKey: ['products', productId] });
  };

  // Progress badges
  const progress = {
    itens: driversList.length > 0,
    perguntas: dimensionsList.length > 0 && dimensionsList.every(d => d.levels.length > 0),
    descontos: true, // optional
  };
  const completedCount = (progress.itens ? 1 : 0) + (progress.perguntas ? 1 : 0);
  const requiredCount = 2;

  // Live preview: use default_qty from drivers, first level of each modifier
  const preview = useMemo(() => {
    const previewDrivers = driversList.map(d => ({
      name: d.name || 'Item',
      unit: d.unit,
      unit_price: Number(d.unit_price) || 0,
      qty: Number(d.default_qty) || 1,
    }));
    const previewModifiers = dimensionsList
      .filter(dim => dim.levels.length > 0)
      .map(dim => {
        const lvl = dim.levels[0];
        return {
          dimension_id: dim.id,
          dimension_name: dim.name,
          level_id: lvl.id,
          level_label: lvl.label,
          multiplier: Number(lvl.multiplier) || 1,
        };
      });
    return computeQuote({
      basePrice: Number(initial.base_price ?? 0),
      drivers: previewDrivers,
      modifiers: previewModifiers,
      volumeDiscounts: discounts,
    });
  }, [driversList, dimensionsList, discounts, initial.base_price]);

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const goPrev = () => stepIndex > 0 && setStep(STEPS[stepIndex - 1].key);
  const goNext = () => stepIndex < STEPS.length - 1 && setStep(STEPS[stepIndex + 1].key);

  return (
    <div className="space-y-4">
      {/* Header: progress + stepper */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Configurar Calculadora de Orçamento</h3>
          <Badge variant={completedCount === requiredCount ? 'default' : 'secondary'} className="text-[10px]">
            {completedCount}/{requiredCount} essenciais
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">Define uma vez. Usado em todas as propostas.</p>
      </div>

      {/* Stepper */}
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isDone = (s.key === 'itens' && progress.itens) || (s.key === 'perguntas' && progress.perguntas);
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setStep(s.key)}
                className={cn(
                  'w-full text-left rounded-md border p-2.5 transition-all hq-transition',
                  isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-muted/20 hover:bg-muted/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0',
                    isDone ? 'bg-primary text-primary-foreground' : isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {isDone ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={cn('text-xs font-medium truncate', isActive && 'text-foreground', !isActive && 'text-muted-foreground')}>
                    {s.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 ml-7 truncate">{s.desc}</p>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Body: editor + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Editor */}
        <div className="rounded-md border bg-card p-4 min-h-[320px]">
          {step === 'itens' && (
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Itens & quantidades</h4>
                    <Hint>
                      <p>Coisas que se contam: cada uma tem preço unitário e quantidade.</p>
                      <p className="mt-1">Ex: "Horas/semana × 70€", "Posts × 25€".</p>
                    </Hint>
                  </div>
                  <p className="text-[11px] text-muted-foreground">A "quantidade sugerida" é usada na pré-visualização ao lado.</p>
                </div>
                {isOwner && (
                  <Button size="sm" variant="outline" onClick={() => upsertDriver.mutate({ product_id: productId, name: '', unit: 'unidade', unit_price: 0, default_qty: 0, sort_order: driversList.length })}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              {driversList.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground">Sem itens. Começa por adicionar pelo menos um.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ex: <em>Horas por semana — 70€/h — 4h sugeridas</em></p>
                </div>
              ) : (
                <div className="space-y-2">
                  {driversList.map(d => {
                    const unitLabel = (d.unit || 'unidade').trim();
                    const subtotal = (Number(d.unit_price) || 0) * (Number(d.default_qty) || 0);
                    return (
                      <div key={d.id} className="rounded-md border bg-muted/10 p-3 space-y-2">
                        {/* Linha 1: nome do item */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Item</p>
                            <InlineField value={d.name} placeholder="Ex: Horas por semana" disabled={!isOwner} bold
                              onSave={v => upsertDriver.mutate({ id: d.id, product_id: productId, name: v, unit: d.unit, unit_price: d.unit_price, default_qty: d.default_qty })} />
                          </div>
                          {isOwner && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0 mt-4" onClick={() => removeDriver.mutate(d.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {/* Linha 2: frase explicativa */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground bg-background rounded-md px-2 py-1.5 border">
                          <span>Medido em</span>
                          <span className="min-w-[80px]">
                            <InlineField value={d.unit || ''} placeholder="h, post, sessão…" disabled={!isOwner}
                              onSave={v => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: v || null, unit_price: d.unit_price, default_qty: d.default_qty })} />
                          </span>
                          <span>· cada <strong>{unitLabel}</strong> custa</span>
                          <span className="min-w-[90px]">
                            <InlineField value={d.unit_price} type="number" placeholder="70" suffix="€" align="right" disabled={!isOwner}
                              onSave={v => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: parseFloat(v) || 0, default_qty: d.default_qty })} />
                          </span>
                          <span>· quantidade sugerida</span>
                          <span className="min-w-[70px]">
                            <InlineField value={d.default_qty} type="number" placeholder="0" align="right" disabled={!isOwner}
                              onSave={v => upsertDriver.mutate({ id: d.id, product_id: productId, name: d.name, unit: d.unit, unit_price: d.unit_price, default_qty: parseFloat(v) || 0 })} />
                          </span>
                          <span className="ml-auto pl-2 border-l text-foreground">
                            = <strong className="tabular-nums">{formatEuro(subtotal)}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {step === 'perguntas' && (
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Perguntas ao cliente</h4>
                    <Hint>
                      <p>Cada pergunta tem várias respostas. Cada resposta tem um <strong>fator</strong>:</p>
                      <ul className="mt-1 list-disc pl-4">
                        <li><strong>1.0</strong> = preço normal</li>
                        <li><strong>1.20</strong> = +20%</li>
                        <li><strong>0.90</strong> = −10%</li>
                      </ul>
                    </Hint>
                  </div>
                  <p className="text-[11px] text-muted-foreground">A pré-visualização usa a 1ª resposta de cada pergunta.</p>
                </div>
                {isOwner && (
                  <Button size="sm" variant="outline" onClick={() => modifiers.addDimension.mutate('Nova pergunta')}>
                    <Plus className="h-3 w-3 mr-1" /> Pergunta
                  </Button>
                )}
              </div>
              {dimensionsList.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground">Sem perguntas. Opcional, mas útil para diferenciar clientes.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ex: <em>Tamanho da equipa — "1 pessoa" ×1.0, "2-4" ×1.2, "5+" ×1.5</em></p>
                </div>
              ) : dimensionsList.map(dim => (
                <div key={dim.id} className="rounded-md border bg-muted/10 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <InlineField value={dim.name} placeholder="Pergunta (ex: Tamanho da equipa)" bold disabled={!isOwner}
                        onSave={v => v !== dim.name && modifiers.updateDimension.mutate({ id: dim.id, name: v })} />
                    </div>
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
                  {dim.levels.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic pl-3">Adiciona pelo menos uma resposta.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-[1fr_100px_auto] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground pl-3">
                        <span>Resposta</span><span className="text-right">Fator</span><span></span>
                      </div>
                      {dim.levels.map(lvl => (
                        <div key={lvl.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center pl-3">
                          <InlineField value={lvl.label} placeholder="Ex: 2-4 pessoas" disabled={!isOwner}
                            onSave={v => v !== lvl.label && modifiers.updateLevel.mutate({ id: lvl.id, patch: { label: v } })} />
                          <InlineField value={lvl.multiplier} type="number" step="0.05" placeholder="1.00" suffix="×" align="right" disabled={!isOwner}
                            onSave={v => { const n = parseFloat(v) || 1; if (n !== Number(lvl.multiplier)) modifiers.updateLevel.mutate({ id: lvl.id, patch: { multiplier: n } }); }} />
                          {isOwner && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => modifiers.removeLevel.mutate(lvl.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </section>
          )}

          {step === 'descontos' && (
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Descontos por volume</h4>
                    <Hint>
                      <p>Quando o orçamento atingir um valor, aplica desconto automático.</p>
                      <p className="mt-1">Ex: ≥ 1.000€ → 5%; ≥ 5.000€ → 10%.</p>
                    </Hint>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Opcional. Aplica-se ao subtotal já com fatores.</p>
                </div>
                {isOwner && (
                  <Button size="sm" variant="outline" onClick={() => { const next = [...discounts, { min_subtotal: 0, discount_pct: 0 }]; setDiscounts(next); persistProductFields({ volume_discounts: next }); }}>
                    <Plus className="h-3 w-3 mr-1" /> Faixa
                  </Button>
                )}
              </div>
              {discounts.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground">Sem descontos automáticos.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                    <span>A partir de</span><span>Desconto</span><span></span>
                  </div>
                  {discounts.map((d, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-md border p-1.5 bg-muted/10">
                      <InlineField value={d.min_subtotal} type="number" suffix="€" align="right" disabled={!isOwner}
                        onSave={v => { const next = [...discounts]; next[i] = { ...d, min_subtotal: parseFloat(v) || 0 }; setDiscounts(next); persistProductFields({ volume_discounts: next }); }} />
                      <InlineField value={d.discount_pct} type="number" suffix="%" align="right" disabled={!isOwner}
                        onSave={v => { const next = [...discounts]; next[i] = { ...d, discount_pct: parseFloat(v) || 0 }; setDiscounts(next); persistProductFields({ volume_discounts: next }); }} />
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { const next = discounts.filter((_, j) => j !== i); setDiscounts(next); persistProductFields({ volume_discounts: next }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
        </div>

        {/* Live preview */}
        <aside className="rounded-md border bg-muted/30 p-3 space-y-2.5 lg:sticky lg:top-2 self-start">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-semibold">Pré-visualização</h4>
          </div>
          <p className="text-[10px] text-muted-foreground">Orçamento exemplo com qtd. sugeridas e 1ª resposta de cada pergunta.</p>

          {driversList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Adiciona itens para veres o exemplo.</p>
          ) : (
            <div className="space-y-1.5">
              {driversList.map(d => {
                const sub = (Number(d.unit_price) || 0) * (Number(d.default_qty) || 1);
                return (
                  <div key={d.id} className="flex items-baseline justify-between text-[11px]">
                    <span className="text-muted-foreground truncate">
                      {d.name || 'Item'} × {Number(d.default_qty) || 1}{d.unit ? ` ${d.unit}` : ''}
                    </span>
                    <span className="tabular-nums font-medium ml-2">{formatEuro(sub)}</span>
                  </div>
                );
              })}
              <div className="border-t pt-1.5 flex items-baseline justify-between text-[11px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatEuro(preview.base_with_drivers)}</span>
              </div>
              {preview.multiplier !== 1 && (
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">Fator combinado</span>
                  <span className="tabular-nums">×{preview.multiplier.toFixed(2)}</span>
                </div>
              )}
              {preview.applied_discount_pct > 0 && (
                <div className="flex items-baseline justify-between text-[11px] text-primary">
                  <span>Desconto auto.</span>
                  <span className="tabular-nums">−{preview.applied_discount_pct}%</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold">Total</span>
                <span className="text-base font-bold tabular-nums text-primary">{formatEuro(preview.total)}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={stepIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {saving && <span className="text-[11px] text-muted-foreground">A guardar…</span>}
        <Button variant="outline" size="sm" onClick={goNext} disabled={stepIndex === STEPS.length - 1}>
          Seguinte <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}