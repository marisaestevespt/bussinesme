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

interface ProductRecurringItemsProps {
  productId: string;
  isOwner: boolean;
  /** Optional: filter items to those belonging to this phase. */
  phaseId?: string;
  /** Optional: when phaseId is set, force frequency on new items. */
  defaultFrequency?: 'semanal' | 'quinzenal' | 'mensal' | 'trimestral';
  /** When true, removes the EntitySection wrapper and helper text (used embedded inside a phase card). */
  embedded?: boolean;
}

export function ProductRecurringItems({ productId, isOwner, phaseId, defaultFrequency, embedded = false }: ProductRecurringItemsProps) {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['product-recurring-items', productId, phaseId ?? 'all'],
    queryFn: async () => {
      let q = (supabase as any).from('product_recurring_items')
        .select('*').eq('product_id', productId).order('sort_order');
      if (phaseId) q = q.eq('phase_id', phaseId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as RecurringItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const freq = defaultFrequency ?? 'semanal';
      const payload: Record<string, unknown> = {
        product_id: productId,
        name: 'Novo item recorrente',
        item_type: 'reuniao',
        frequency: freq,
        sort_order: items.length,
        visible_in_portal: true,
      };
      if (freq === 'semanal' || freq === 'quinzenal') payload.day_of_week = 1;
      if (phaseId) payload.phase_id = phaseId;
      const { error } = await (supabase as any).from('product_recurring_items').insert(payload);
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

  const body = (
    <>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border border-dashed rounded-lg py-8 text-center">
          Sem itens recorrentes. Adiciona o primeiro com o botão acima.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-end gap-2 p-3 rounded-lg border bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Tipo</span>
                <Select value={it.item_type} disabled={!isOwner}
                  onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { item_type: v as RecurringItem['item_type'] } })}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reuniao">📅 Reunião</SelectItem>
                    <SelectItem value="tarefa">📋 Tarefa</SelectItem>
                    <SelectItem value="entrega">📦 Entrega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Nome</span>
                <Input className="h-8 text-sm" value={it.name} readOnly={!isOwner}
                  placeholder="Nome do item recorrente…"
                  onChange={(e) => updateItem.mutate({ id: it.id, patch: { name: e.target.value } })} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Frequência</span>
                <Select value={it.frequency} disabled={!isOwner || !!phaseId}
                  onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { frequency: v as RecurringItem['frequency'] } })}>
                  <SelectTrigger className="h-8 w-32 text-xs" title={phaseId ? 'Definida pela fase' : undefined}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(it.frequency === 'semanal' || it.frequency === 'quinzenal') && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Dia da semana</span>
                  <Select value={String(it.day_of_week ?? 1)} disabled={!isOwner}
                    onValueChange={(v) => updateItem.mutate({ id: it.id, patch: { day_of_week: parseInt(v) } })}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(it.frequency === 'mensal' || it.frequency === 'trimestral') && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none" title="Opcional. Se vazio, herda o Dia início da fase.">Dia do mês</span>
                  <Input type="number" min={1} max={31} className="h-8 w-24 text-xs"
                    placeholder={phaseId ? 'herda fase' : '1-31'}
                    title="Opcional. Se vazio, usa o Dia início definido na fase."
                    value={it.day_of_month ?? ''} readOnly={!isOwner}
                    onChange={(e) => updateItem.mutate({ id: it.id, patch: { day_of_month: e.target.value ? parseInt(e.target.value) : null } })} />
                </div>
              )}
              {it.item_type === 'reuniao' && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Duração</span>
                  <Input type="number" min={0} className="h-8 w-20 text-xs"
                    placeholder="min" value={it.duration_minutes ?? ''} readOnly={!isOwner}
                    onChange={(e) => updateItem.mutate({ id: it.id, patch: { duration_minutes: e.target.value ? parseInt(e.target.value) : null } })} />
                </div>
              )}
              <div className="flex flex-col gap-0.5 items-center">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Portal</span>
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  title={it.visible_in_portal ? 'Visível no portal do cliente' : 'Oculto do cliente'}
                  onClick={() => isOwner && updateItem.mutate({ id: it.id, patch: { visible_in_portal: !it.visible_in_portal } })}>
                  {it.visible_in_portal ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
              </div>
              {isOwner && (
                <div className="flex flex-col gap-0.5 items-center">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">&nbsp;</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm('Eliminar este item recorrente?')) deleteItem.mutate(it.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        {body}
        {isOwner && (
          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => addItem.mutate()}>
            <Plus className="h-3 w-3" /> Item recorrente
          </Button>
        )}
      </div>
    );
  }

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
      {body}
    </EntitySection>
  );
}