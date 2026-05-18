import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Frequency = 'weekly' | 'biweekly' | 'monthly';
type ItemType = 'reuniao' | 'tarefa';

const WEEKDAYS = [
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

interface Props {
  projectId: string;
}

export function AddCadenceDialog({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project-for-cadence', projectId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('start_date, deadline, cycle_start_date, cycle_duration_months')
        .eq('id', projectId)
        .maybeSingle();
      return data;
    },
  });

  const defaults = useMemo(() => {
    const today = new Date();
    const startStr = format(today, 'yyyy-MM-dd');
    let endStr = format(addMonths(today, 3), 'yyyy-MM-dd');
    if (project?.deadline) endStr = project.deadline;
    else if (project?.cycle_start_date && project?.cycle_duration_months) {
      endStr = format(
        addMonths(parseISO(project.cycle_start_date), project.cycle_duration_months),
        'yyyy-MM-dd',
      );
    }
    return { startStr, endStr };
  }, [project]);

  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<ItemType>('reuniao');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [weekday, setWeekday] = useState('1'); // Mon
  const [monthDay, setMonthDay] = useState('1');
  const [time, setTime] = useState('10:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const effectiveStart = startDate || defaults.startStr;
  const effectiveEnd = endDate || defaults.endStr;

  const generatedDates = useMemo(() => {
    if (!effectiveStart || !effectiveEnd) return [] as string[];
    const start = parseISO(effectiveStart);
    const end = parseISO(effectiveEnd);
    if (end < start) return [];
    const out: Date[] = [];
    if (frequency === 'monthly') {
      const day = Math.min(28, Math.max(1, parseInt(monthDay, 10) || 1));
      let cursor = new Date(start.getFullYear(), start.getMonth(), day);
      if (cursor < start) cursor = new Date(start.getFullYear(), start.getMonth() + 1, day);
      while (cursor <= end) {
        out.push(new Date(cursor));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, day);
      }
    } else {
      const targetDow = parseInt(weekday, 10);
      let cursor = new Date(start);
      const diff = (targetDow - cursor.getDay() + 7) % 7;
      cursor = addDays(cursor, diff);
      const step = frequency === 'weekly' ? 7 : 14;
      while (cursor <= end) {
        out.push(new Date(cursor));
        cursor = addDays(cursor, step);
      }
    }
    return out.map(d => format(d, 'yyyy-MM-dd'));
  }, [effectiveStart, effectiveEnd, frequency, weekday, monthDay]);

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Indica um nome.');
      if (generatedDates.length === 0) throw new Error('Sem datas para gerar — verifica o intervalo.');
      const rows = generatedDates.map((d, idx) => ({
        project_id: projectId,
        name: name.trim(),
        item_type: itemType,
        scheduled_date: d,
        scheduled_time: itemType === 'reuniao' ? `${time}:00` : null,
        status: 'pendente',
        sort_order: idx,
        source_recurring_item_id: null,
        visible_in_portal: false,
      }));
      const { error } = await (supabase as any)
        .from('project_recurring_occurrences')
        .insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Cadência criada`, { description: `${n} ocorrência(s) geradas.` });
      queryClient.invalidateQueries({ queryKey: ['project-recurring-occurrences', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-monthly-occurrences', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-contract-occurrences', projectId] });
      setOpen(false);
      setName('');
    },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar cadência
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova cadência neste projeto</DialogTitle>
          <DialogDescription>
            Gera reuniões ou tarefas recorrentes só para este projeto. Não afeta o produto nem outros projetos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              autoFocus
              placeholder="Ex.: Stand-up semanal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {frequency === 'monthly' ? (
            <div className="space-y-1.5">
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={monthDay}
                onChange={(e) => setMonthDay(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Dia da semana</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map(w => (
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {itemType === 'reuniao' && (
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="date"
                value={effectiveStart}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input
                type="date"
                value={effectiveEnd}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {generatedDates.length > 0 ? (
              <>
                Vai gerar <strong className="text-foreground">{generatedDates.length}</strong> ocorrência(s).
                {' '}Primeira: {format(parseISO(generatedDates[0]), "EEE d 'de' MMM yyyy", { locale: pt })}
                {generatedDates.length > 1 && (
                  <> · Última: {format(parseISO(generatedDates[generatedDates.length - 1]), "EEE d 'de' MMM yyyy", { locale: pt })}</>
                )}
              </>
            ) : (
              <>Sem datas geradas para o intervalo escolhido.</>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim() || generatedDates.length === 0}
          >
            {create.isPending ? 'A criar…' : 'Criar cadência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}