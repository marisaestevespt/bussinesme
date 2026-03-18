import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, List, LayoutGrid, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ─── Event types ────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'lancamento', label: 'Lançamento', color: 'hsl(var(--primary))' },
  { value: 'ferias', label: 'Férias', color: '#10b981' },
  { value: 'campanha_vendas', label: 'Campanha de Vendas', color: '#f59e0b' },
  { value: 'data_especial', label: 'Data Especial', color: '#8b5cf6' },
  { value: 'abertura_vagas', label: 'Abertura de Vagas', color: '#06b6d4' },
  { value: 'formacao_evento', label: 'Formação/Evento Externo', color: '#ec4899' },
  { value: 'reuniao_importante', label: 'Reunião Importante', color: '#ef4444' },
  { value: 'deadline', label: 'Deadline', color: '#f97316' },
  { value: 'parceria_colaboracao', label: 'Parceria/Colaboração', color: '#14b8a6' },
] as const;

type EventTypeValue = typeof EVENT_TYPES[number]['value'];

interface EventRow {
  id: string;
  title: string;
  event_type: EventTypeValue;
  start_date: string;
  end_date: string | null;
  product_name: string | null;
  notes: string | null;
  created_by: string | null;
}

function getEventType(val: string) {
  return EVENT_TYPES.find(t => t.value === val) ?? EVENT_TYPES[0];
}

function EventBadge({ type }: { type: string }) {
  const t = getEventType(type);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${t.color}20`, color: t.color }}
    >
      {t.label}
    </span>
  );
}

// ─── Data hooks ─────────────────────────────────────────────────

function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data as EventRow[];
    },
  });
}

// ─── Event Form Dialog ──────────────────────────────────────────

function EventFormDialog({
  open,
  onOpenChange,
  editEvent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editEvent?: EventRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventTypeValue>('lancamento');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [productName, setProductName] = useState('');
  const [notes, setNotes] = useState('');

  // Populate form when editing
  useState(() => {
    if (editEvent) {
      setTitle(editEvent.title);
      setEventType(editEvent.event_type);
      setStartDate(parseISO(editEvent.start_date));
      setEndDate(editEvent.end_date ? parseISO(editEvent.end_date) : undefined);
      setProductName(editEvent.product_name ?? '');
      setNotes(editEvent.notes ?? '');
    }
  });

  const resetForm = () => {
    setTitle('');
    setEventType('lancamento');
    setStartDate(undefined);
    setEndDate(undefined);
    setProductName('');
    setNotes('');
  };

  // Reset when dialog opens fresh
  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !startDate) throw new Error('Campos obrigatórios em falta');
      const payload = {
        title: title.trim(),
        event_type: eventType,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        product_name: productName.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      };
      if (editEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(editEvent ? 'Evento atualizado' : 'Evento criado');
      handleOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do evento *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Lançamento Verão 2026" />
          </div>
          <div>
            <Label>Tipo de evento *</Label>
            <Select value={eventType} onValueChange={v => setEventType(v as EventTypeValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de início *</Label>
              <DatePickerField date={startDate} onSelect={setStartDate} placeholder="Início" />
            </div>
            <div>
              <Label>Data de fim</Label>
              <DatePickerField date={endDate} onSelect={setEndDate} placeholder="Fim (opcional)" />
            </div>
          </div>
          <div>
            <Label>Produto associado</Label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={3} />
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'A guardar...' : editEvent ? 'Guardar alterações' : 'Criar evento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DatePickerField({ date, onSelect, placeholder }: { date?: Date; onSelect: (d: Date | undefined) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

// ─── Calendar View ──────────────────────────────────────────────

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function CalendarView({ events, onEventClick }: { events: EventRow[]; onEventClick: (e: EventRow) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start: Monday = 0
  const startDayIdx = (getDay(monthStart) + 6) % 7; // Convert Sunday=0 to Monday=0
  const paddedDays: (Date | null)[] = [...Array(startDayIdx).fill(null), ...days];

  // Events on a given day
  const eventsForDay = (day: Date) =>
    events.filter(ev => {
      const start = parseISO(ev.start_date);
      const end = ev.end_date ? parseISO(ev.end_date) : start;
      return isSameDay(day, start) || isSameDay(day, end) || isWithinInterval(day, { start, end });
    });

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize text-foreground">
          {format(currentMonth, 'MMMM yyyy', { locale: pt })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-muted px-2 py-2 text-xs font-medium text-muted-foreground text-center">
            {d}
          </div>
        ))}
        {paddedDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              'bg-card min-h-[90px] p-1.5 text-sm',
              day && isSameDay(day, new Date()) && 'ring-1 ring-inset ring-primary/30',
              !day && 'bg-muted/30'
            )}
          >
            {day && (
              <>
                <span className={cn('text-xs font-medium', isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-foreground/70')}>
                  {format(day, 'd')}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {eventsForDay(day).slice(0, 3).map(ev => {
                    const t = getEventType(ev.event_type);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className="w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-opacity hover:opacity-80"
                        style={{ backgroundColor: `${t.color}20`, color: t.color }}
                      >
                        {ev.title}
                      </button>
                    );
                  })}
                  {eventsForDay(day).length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{eventsForDay(day).length - 3}</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────

function ListView({ events, onEventClick }: { events: EventRow[]; onEventClick: (e: EventRow) => void }) {
  if (events.length === 0) {
    return <p className="text-center text-muted-foreground py-12">Nenhum evento registado.</p>;
  }
  return (
    <div className="border rounded-lg overflow-hidden divide-y divide-border">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground">
        <div className="col-span-4">Evento</div>
        <div className="col-span-3">Tipo</div>
        <div className="col-span-3">Data</div>
        <div className="col-span-2">Produto</div>
      </div>
      {events.map(ev => (
        <button
          key={ev.id}
          onClick={() => onEventClick(ev)}
          className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="col-span-4 font-medium text-foreground truncate">{ev.title}</div>
          <div className="col-span-3"><EventBadge type={ev.event_type} /></div>
          <div className="col-span-3 text-muted-foreground">
            {format(parseISO(ev.start_date), 'dd MMM yyyy', { locale: pt })}
            {ev.end_date && ` — ${format(parseISO(ev.end_date), 'dd MMM yyyy', { locale: pt })}`}
          </div>
          <div className="col-span-2 text-muted-foreground truncate">{ev.product_name || '—'}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Event Detail Dialog ────────────────────────────────────────

function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onEdit,
}: {
  event: EventRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
}) {
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!event) return;
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento eliminado');
      onOpenChange(false);
    },
    onError: () => toast.error('Erro ao eliminar'),
  });

  if (!event) return null;
  const t = getEventType(event.event_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><EventBadge type={event.event_type} /></div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {format(parseISO(event.start_date), 'dd MMM yyyy', { locale: pt })}
            {event.end_date && ` — ${format(parseISO(event.end_date), 'dd MMM yyyy', { locale: pt })}`}
          </div>
          {event.product_name && (
            <div><span className="font-medium text-foreground">Produto:</span> {event.product_name}</div>
          )}
          {event.notes && (
            <div><span className="font-medium text-foreground">Notas:</span> <span className="text-muted-foreground">{event.notes}</span></div>
          )}
          {isOwner && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>Editar</Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function AgendaPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: events = [], isLoading } = useEvents();

  const handleEventClick = (ev: EventRow) => {
    setDetailEvent(ev);
    setDetailOpen(true);
  };

  const handleEdit = () => {
    setDetailOpen(false);
    if (detailEvent) {
      setEditEvent(detailEvent);
      setFormOpen(true);
    }
  };

  const handleNewEvent = () => {
    setEditEvent(null);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Agenda do Negócio</h1>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView('calendar')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  view === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                <LayoutGrid className="h-4 w-4" /> Calendário
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                <List className="h-4 w-4" /> Lista
              </button>
            </div>
            <Button onClick={handleNewEvent}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo Evento
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : view === 'calendar' ? (
          <CalendarView events={events} onEventClick={handleEventClick} />
        ) : (
          <ListView events={events} onEventClick={handleEventClick} />
        )}
      </div>

      {/* Dialogs */}
      <EventFormDialog
        key={editEvent?.id ?? 'new'}
        open={formOpen}
        onOpenChange={setFormOpen}
        editEvent={editEvent}
      />
      <EventDetailDialog
        event={detailEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
}
