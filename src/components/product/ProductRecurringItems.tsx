import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Repeat, Eye, EyeOff } from 'lucide-react';
import { EntitySection } from '@/components/layout/entity';
import { toast } from 'sonner';

interface RecurringItem {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  item_type: 'reuniao' | 'tarefa' | 'entrega';
  frequency: 'semanal' | 'quinzenal' | 'mensal' | 'trimestral';
  day_of_week: number | null;
  day_of_month: number | null;
  week_of_month: number | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  visible_in_portal: boolean;
}

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function ProductRecurringItems({ productId, isOwner }: { productId: string; isOwner: boolean }) {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['product-recurring-items', productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('product_recurring_items')
        .select('*').eq('product_id', productId).order('sort_order');
      if (error) throw error;
      return (data || []) as RecurringItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('product_recurring_items').insert({
        product_id: productId,
        name: 'Novo item recorrente',
        item_type: 'reuniao',
        frequency: 'semanal',
        day_of_week: 1,
        sort_order: items.length,
        visible_in_portal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-recurring-items', productId] }),
    onError: (e: Error) => toast.error('Erro ao adicionar item', { description: e.message }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RecurringItem> }) => {
      const { error } = await (supabase as any).from('product_recurring_items').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-recurring-items', productId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('product_recurring_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-recurring-items', productId] }),
  });

  return (
    <EntitySection
      title="Itens Recorrentes do Ciclo"
      icon={Repeat}
      action={isOwner ? (
        <Button size="sm" variant="outline" className="gap-1" onClick={() => addItem.mutate()}>
          <Plus className="h-3.5 w-3.5" /> Item
        </Button>
      ) : undefined}
    >
      <p className="text-xs text-muted-foreground mb-3">
        Reuniões, entregas ou tarefas que se repetem dentro do ciclo (ex: reunião semanal, relatório mensal). Quando criares um projeto a partir deste produto, o sistema gera automaticamente todas as ocorrências para o ciclo inteiro.
      </p>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border border-dashed rounded-lg py-8 text-center">
          Sem itens recorrentes. Adiciona o primeiro com o botão acima.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
              <Select value={it.item_type} disabled={!isOwner}
                onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { item_type: v as RecurringItem['item_type'] } })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">📅 Reunião</SelectItem>
                  <SelectItem value="tarefa">📋 Tarefa</SelectItem>
                  <SelectItem value="entrega">📦 Entrega</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-8 text-sm flex-1 min-w-[180px]" value={it.name} readOnly={!isOwner}
                onChange={(e) => updateItem.mutate({ id: it.id, patch: { name: e.target.value } })} />
              <Select value={it.frequency} disabled={!isOwner}
                onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { frequency: v as RecurringItem['frequency'] } })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                </SelectContent>
              </Select>
              {(it.frequency === 'semanal' || it.frequency === 'quinzenal') && (
                <Select value={String(it.day_of_week ?? 1)} disabled={!isOwner}
                  onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { day_of_week: parseInt(v) } })}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {(it.frequency === 'mensal' || it.frequency === 'trimestral') && (
                <Input type="number" min={1} max={31} className="h-8 w-24 text-xs"
                  placeholder="Dia" value={it.day_of_month ?? ''} readOnly={!isOwner}
                  onChange={(e) => updateItem.mutate({ id: it.id, patch: { day_of_month: e.target.value ? parseInt(e.target.value) : null } })} />
              )}
              {it.item_type === 'reuniao' && (
                <Input type="number" min={0} className="h-8 w-20 text-xs"
                  placeholder="min" value={it.duration_minutes ?? ''} readOnly={!isOwner}
                  onChange={(e) => updateItem.mutate({ id: it.id, patch: { duration_minutes: e.target.value ? parseInt(e.target.value) : null } })} />
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8"
                title={it.visible_in_portal ? 'Visível no portal do cliente' : 'Oculto do cliente'}
                onClick={() => isOwner && updateItem.mutate({ id: it.id, patch: { visible_in_portal: !it.visible_in_portal } })}>
                {it.visible_in_portal ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </Button>
              {isOwner && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                  onClick={() => { if (confirm('Eliminar este item recorrente?')) deleteItem.mutate(it.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </EntitySection>
  );
}