import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarDays, Check, Eye, EyeOff, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface OccurrenceRowData {
  id: string;
  name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  item_type: 'reuniao' | 'tarefa' | 'entrega';
  status: 'pendente' | 'concluida' | 'cancelada' | 'reagendada';
  visible_in_portal?: boolean;
  linked_meeting_id?: string | null;
}

interface MeetingOption {
  value: string;
  label: string;
  date: string;
}

interface Props {
  occurrence: OccurrenceRowData;
  meetingOptions: MeetingOption[];
  onUpdate: (patch: Partial<OccurrenceRowData>) => void;
  onDelete: () => void;
}

const STATUS_META: Record<OccurrenceRowData['status'], { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-muted text-muted-foreground border-border' },
  concluida: { label: 'Concluída', cls: 'bg-success/15 text-success border-success/30' },
  reagendada: { label: 'Reagendada', cls: 'bg-warning/15 text-warning border-warning/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export function OccurrenceRow({ occurrence: o, meetingOptions, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(o.name);
  const [draftDate, setDraftDate] = useState(o.scheduled_date);
  const [draftTime, setDraftTime] = useState(o.scheduled_time || '');
  const [draftMeeting, setDraftMeeting] = useState<string>(o.linked_meeting_id || '__none__');

  const date = parseISO(o.scheduled_date);
  const weekday = format(date, 'EEE', { locale: pt });
  const dayLabel = format(date, "d 'de' MMM", { locale: pt });
  const statusMeta = STATUS_META[o.status];

  function startEdit() {
    setDraftName(o.name);
    setDraftDate(o.scheduled_date);
    setDraftTime(o.scheduled_time || '');
    setDraftMeeting(o.linked_meeting_id || '__none__');
    setEditing(true);
  }

  function saveEdit() {
    const patch: Partial<OccurrenceRowData> = {};
    if (draftName !== o.name) patch.name = draftName;
    if (draftDate !== o.scheduled_date) patch.scheduled_date = draftDate;
    if ((draftTime || null) !== o.scheduled_time) patch.scheduled_time = draftTime ? draftTime : null;
    const meetingVal = draftMeeting === '__none__' ? null : draftMeeting;
    if (meetingVal !== (o.linked_meeting_id || null)) patch.linked_meeting_id = meetingVal;
    if (Object.keys(patch).length > 0) onUpdate(patch);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40',
          o.status === 'cancelada' && 'opacity-50',
          o.status === 'concluida' && 'opacity-70',
        )}
      >
        <div className="flex items-center gap-2 shrink-0 px-2 py-1 rounded bg-muted/40 text-xs font-mono">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="capitalize">{weekday}</span>
          <span>{dayLabel}</span>
          {o.item_type === 'reuniao' && o.scheduled_time && (
            <span className="text-muted-foreground">· {o.scheduled_time.slice(0, 5)}</span>
          )}
        </div>
        <span
          className={cn(
            'text-sm flex-1 truncate',
            o.status === 'cancelada' && 'line-through text-muted-foreground',
            o.status === 'concluida' && 'line-through text-muted-foreground',
          )}
        >
          {o.name}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:inline">
          {o.item_type === 'reuniao' ? 'Reunião' : 'Tarefa'}
        </span>
        <Badge className={cn('border text-[10px] shrink-0', statusMeta.cls)}>{statusMeta.label}</Badge>
        {o.visible_in_portal && (
          <Eye className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Visível no portal" />
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar"
          onClick={startEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          className="h-8 text-sm flex-1 min-w-[200px]"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          {o.item_type === 'reuniao' ? 'Reunião' : 'Tarefa'}
        </span>
        <Select value={o.status} onValueChange={(v) => onUpdate({ status: v as OccurrenceRowData['status'] })}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="reagendada">Reagendada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title={o.visible_in_portal ? 'Visível no portal' : 'Oculto do cliente'}
          onClick={() => onUpdate({ visible_in_portal: !o.visible_in_portal })}
        >
          {o.visible_in_portal ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <Input
          type="date"
          value={draftDate}
          className="h-7 w-36 text-xs"
          onChange={(e) => setDraftDate(e.target.value)}
        />
        {o.item_type === 'reuniao' && (
          <>
            <Input
              type="time"
              value={draftTime}
              className="h-7 w-24 text-xs"
              onChange={(e) => setDraftTime(e.target.value)}
            />
            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reunião:</span>
              <Select value={draftMeeting} onValueChange={setDraftMeeting}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Associar reunião…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {meetingOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}{m.date ? ` · ${m.date}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-destructive hover:text-destructive"
          onClick={() => { if (confirm('Eliminar esta ocorrência?')) { onDelete(); setEditing(false); } }}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Eliminar
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        <Button size="sm" className="h-7" onClick={saveEdit}>
          <Check className="h-3.5 w-3.5 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}