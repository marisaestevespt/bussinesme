import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Repeat, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Routine {
  id: string;
  title: string;
  recurrence_type: string;
  weekday: number | null;
  month_day: number | null;
  hour_time: string | null;
  active: boolean;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function describeRecurrence(r: Routine): string {
  switch (r.recurrence_type) {
    case 'diaria': return 'Todos os dias';
    case 'semanal': return r.weekday !== null ? `Semanal · ${WEEKDAYS[r.weekday]}` : 'Semanal';
    case 'mensal': return r.month_day ? `Dia ${r.month_day} de cada mês` : 'Mensal';
    default: return r.recurrence_type;
  }
}

export function ProjectRoutines({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newRec, setNewRec] = useState<'diaria' | 'semanal' | 'mensal'>('semanal');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['project-routines', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_routines')
        .select('id, title, recurrence_type, weekday, month_day, hour_time, active')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('recurrence_type')
        .order('title');
      if (error) throw error;
      return (data || []) as unknown as Routine[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const { error } = await supabase.from('planning_routines').insert({
        title: newTitle.trim(),
        recurrence_type: newRec,
        weekday: newRec === 'semanal' ? 1 : null,
        month_day: newRec === 'mensal' ? 1 : null,
        project_id: projectId,
        active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNewTitle(''); qc.invalidateQueries({ queryKey: ['project-routines', projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planning_routines').update({ active: false } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-routines', projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tarefas fixas / rotinas deste projeto. Geram tarefas automaticamente. Visíveis no portal do cliente.</p>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-xs shrink-0">
          <Link to="/hub/tarefas?tab=rotinas"><ExternalLink className="h-3 w-3" /> Gestão</Link>
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">Sem rotinas definidas.</div>
      ) : (
        <div className="space-y-2">
          {items.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Repeat className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{describeRecurrence(r)}{r.hour_time ? ` · ${r.hour_time.slice(0,5)}` : ''}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMut.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Select value={newRec} onValueChange={v => setNewRec(v as any)}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="diaria">Diária</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Ex: Publicar post no Instagram"
          onKeyDown={e => { if (e.key === 'Enter') addMut.mutate(); }}
          className="flex-1 h-9"
        />
        <Button size="sm" onClick={() => addMut.mutate()} disabled={!newTitle.trim() || addMut.isPending} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
    </div>
  );
}