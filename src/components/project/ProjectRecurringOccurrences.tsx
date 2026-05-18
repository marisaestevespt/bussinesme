import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Repeat, X, Check, Eye, EyeOff } from 'lucide-react';
import { EntitySection } from '@/components/layout/entity';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Occurrence {
  id: string;
  project_id: string;
  source_recurring_item_id: string | null;
  item_type: 'reuniao' | 'tarefa' | 'entrega';
  name: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  status: 'pendente' | 'concluida' | 'cancelada' | 'reagendada';
  visible_in_portal: boolean;
}

const TYPE_ICON: Record<string, string> = { reuniao: '📅', tarefa: '📋', entrega: '📦' };
const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  concluida: 'bg-success/15 text-success',
  cancelada: 'bg-destructive/15 text-destructive',
  reagendada: 'bg-warning/15 text-warning',
};

export function ProjectRecurringOccurrences({
  projectId, cycleStartDate, cycleDurationMonths,
}: { projectId: string; cycleStartDate: string | null; cycleDurationMonths: number | null }) {
  const qc = useQueryClient();

  const { data: occurrences = [] } = useQuery({
    queryKey: ['project-recurring-occurrences', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('project_recurring_occurrences')
        .select('*').eq('project_id', projectId).order('scheduled_date');
      if (error) throw error;
      return (data || []) as Occurrence[];
    },
  });

  const updateOcc = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Occurrence> }) => {
      const { error } = await (supabase as any).from('project_recurring_occurrences').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] }),
    onError: (e: Error) => toast.error('Erro ao atualizar', { description: e.message }),
  });

  const deleteOcc = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await (supabase as any).from('project_recurring_occurrences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] }),
  });

  const cycleProgress = useMemo(() => {
    if (!cycleStartDate || !cycleDurationMonths) return null;
    const start = parseISO(cycleStartDate);
    const monthsElapsed = Math.max(0, Math.min(cycleDurationMonths, differenceInMonths(new Date(), start) + 1));
    return { current: monthsElapsed, total: cycleDurationMonths };
  }, [cycleStartDate, cycleDurationMonths]);

  const stats = useMemo(() => {
    const total = occurrences.length;
    const done = occurrences.filter(o => o.status === 'concluida').length;
    const cancelled = occurrences.filter(o => o.status === 'cancelada').length;
    return { total, done, cancelled, pending: total - done - cancelled };
  }, [occurrences]);

  // Group by month for readability
  const grouped = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const key = o.scheduled_date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences]);

  return (
    <EntitySection
      title="Itens Recorrentes do Ciclo"
      icon={Repeat}
      action={
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {cycleProgress && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" /> Mês {cycleProgress.current} de {cycleProgress.total}
            </Badge>
          )}
          <span>{stats.done}/{stats.total} concluídas</span>
          {stats.cancelled > 0 && <span className="text-destructive">{stats.cancelled} canceladas</span>}
        </div>
      }
    >
      {occurrences.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border border-dashed rounded-lg py-8 text-center">
          Sem ocorrências geradas. Configura itens recorrentes no produto e clica em "Sincronizar com produto" no topo.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([monthKey, list]) => (
            <div key={monthKey}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {format(parseISO(monthKey + '-01'), 'MMMM yyyy', { locale: pt })}
              </h4>
              <div className="space-y-1.5">
                {list.map(o => (
                  <div key={o.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border bg-card text-sm ${o.status === 'cancelada' ? 'opacity-50 line-through' : ''}`}>
                    <span className="text-base shrink-0">{TYPE_ICON[o.item_type]}</span>
                    <Input
                      type="date"
                      value={o.scheduled_date}
                      className="h-7 w-36 text-xs"
                      onChange={(e) => updateOcc.mutate({ id: o.id, patch: { scheduled_date: e.target.value } })}
                    />
                    <Input className="h-7 text-sm flex-1 min-w-[160px]" value={o.name}
                      onChange={(e) => updateOcc.mutate({ id: o.id, patch: { name: e.target.value } })} />
                    {o.item_type === 'reuniao' && (
                      <Input type="time" value={o.scheduled_time || ''} className="h-7 w-24 text-xs"
                        onChange={(e) => updateOcc.mutate({ id: o.id, patch: { scheduled_time: e.target.value || null } })} />
                    )}
                    <Select value={o.status}
                      onValueChange={(v) => updateOcc.mutate({ id: o.id, patch: { status: v as Occurrence['status'] } })}>
                      <SelectTrigger className={`h-7 w-32 text-xs border-0 ${STATUS_COLOR[o.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="reagendada">Reagendada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      title={o.visible_in_portal ? 'Visível no portal' : 'Oculto do cliente'}
                      onClick={() => updateOcc.mutate({ id: o.id, patch: { visible_in_portal: !o.visible_in_portal } })}>
                      {o.visible_in_portal ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      title="Eliminar definitivamente"
                      onClick={() => { if (confirm('Eliminar esta ocorrência?')) deleteOcc.mutate(o.id); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </EntitySection>
  );
}