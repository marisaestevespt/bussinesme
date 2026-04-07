import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

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
  const [adding, setAdding] = useState(false);
  const [newTier, setNewTier] = useState({ name: '', price: '', description: '' });

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
      const { error } = await supabase.from('product_price_tiers').insert({
        product_id: productId,
        name: newTier.name,
        price: parseFloat(newTier.price) || 0,
        description: newTier.description || null,
        sort_order: tiers.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNewTier({ name: '', price: '', description: '' });
      setAdding(false);
      toast.success('Preço adicionado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
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
        {!readOnly && !adding && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {tiers.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Nenhum preço adicionado.</p>
      )}

      {tiers.map(tier => (
        <div key={tier.id} className="flex items-center gap-2 rounded-md border p-2 bg-muted/30">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <Input
              className="h-8 text-sm"
              value={tier.name}
              readOnly={readOnly}
              onChange={e => updateMut.mutate({ id: tier.id, field: 'name', value: e.target.value })}
              placeholder="Plano/Pacote"
            />
            <Input
              className="h-8 text-sm"
              type="number"
              value={tier.price}
              readOnly={readOnly}
              onChange={e => updateMut.mutate({ id: tier.id, field: 'price', value: parseFloat(e.target.value) || 0 })}
              placeholder="Preço"
            />
            <Input
              className="h-8 text-sm"
              value={tier.description || ''}
              readOnly={readOnly}
              onChange={e => updateMut.mutate({ id: tier.id, field: 'description', value: e.target.value || null })}
              placeholder="Descrição"
            />
          </div>
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteMut.mutate(tier.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {adding && (
        <div className="flex items-end gap-2 rounded-md border border-dashed p-2">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Nome</Label>
              <Input className="h-8 text-sm" value={newTier.name} onChange={e => setNewTier(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Básico" autoFocus />
            </div>
            <div>
              <Label className="text-[10px]">Preço (€)</Label>
              <Input className="h-8 text-sm" type="number" value={newTier.price} onChange={e => setNewTier(f => ({ ...f, price: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label className="text-[10px]">Descrição</Label>
              <Input className="h-8 text-sm" value={newTier.description} onChange={e => setNewTier(f => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" className="h-8" disabled={!newTier.name || addMut.isPending} onClick={() => addMut.mutate()}>Guardar</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setNewTier({ name: '', price: '', description: '' }); }}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
