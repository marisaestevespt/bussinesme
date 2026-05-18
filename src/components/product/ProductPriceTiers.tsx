import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { InlineField } from '@/components/product/InlineField';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface PriceTier {
  id: string;
  name: string;
  price: number;
  description: string | null;
  sort_order: number;
}

interface Props {
  productId: string;
  readOnly?: boolean;
}

export function ProductPriceTiers({ productId, readOnly }: Props) {
  const qc = useQueryClient();
  const [showDescFor, setShowDescFor] = useState<Record<string, boolean>>({});

  const { data: tiers = [] } = useQuery({
    queryKey: ['product-price-tiers', productId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_price_tiers')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      return (data || []) as PriceTier[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['product-price-tiers', productId] });

  const addMut = useMutation({
    mutationFn: async () => {
      // Smart defaults: insert an empty row immediately; user edits inline.
      const { error } = await supabase.from('product_price_tiers').insert({
        product_id: productId,
        name: '',
        price: 0,
        description: null,
        sort_order: tiers.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('product_price_tiers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Preço removido'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from('product_price_tiers').update({ [field]: value } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Tabela de Preços</Label>
        {!readOnly && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addMut.mutate()} disabled={addMut.isPending}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {tiers.length === 0 && (
        <EmptyHint>Nenhum preço adicionado.</EmptyHint>
      )}

      {tiers.map(tier => {
        const showDesc = showDescFor[tier.id] || !!tier.description;
        return (
          <div key={tier.id} className="rounded-md border p-2 bg-muted/30 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-[2fr_1fr] gap-2">
                <InlineField
                  value={tier.name}
                  placeholder="Plano/Pacote (ex: Básico)"
                  bold
                  disabled={readOnly}
                  onSave={v => updateMut.mutate({ id: tier.id, field: 'name', value: v })}
                />
                <InlineField
                  value={tier.price}
                  type="number"
                  placeholder="0"
                  suffix="€"
                  align="right"
                  disabled={readOnly}
                  onSave={v => updateMut.mutate({ id: tier.id, field: 'price', value: parseFloat(v) || 0 })}
                />
              </div>
              {!readOnly && (
                <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteMut.mutate(tier.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {showDesc ? (
              <InlineField
                value={tier.description || ''}
                placeholder="Descrição (opcional)…"
                disabled={readOnly}
                multiline
                onSave={v => updateMut.mutate({ id: tier.id, field: 'description', value: v || null })}
              />
            ) : (
              !readOnly && (
                <button
                  type="button"
                  onClick={() => setShowDescFor(s => ({ ...s, [tier.id]: true }))}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  + adicionar descrição
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
