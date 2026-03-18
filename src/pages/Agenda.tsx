import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MentionTextarea } from '@/components/MentionTextarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarIcon, Plus, List, LayoutGrid, ChevronLeft, ChevronRight,
  Trash2, Settings2, X, Paperclip, Link2, FileText, Upload, Users, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface EventType { id: string; name: string; color: string; slug: string; }
interface EventRow { id: string; title: string; event_type_id: string | null; start_date: string; end_date: string | null; product_name: string | null; department: string | null; client_name: string | null; notes: string | null; created_by: string | null; }

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'produto_servico', label: 'Produto/Serviço' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
];
interface Attachment { id: string; event_id: string; type: string; name: string; url: string; }
interface Profile { id: string; user_id: string; full_name: string | null; avatar_url: string | null; role_title: string | null; }
interface EventMember { id: string; event_id: string; profile_id: string; }

// ─── Data hooks ─────────────────────────────────────────────────

function useEventTypes() {
  return useQuery({
    queryKey: ['event_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_types').select('*').order('name');
      if (error) throw error;
      return data as EventType[];
    },
  });
}

function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').order('start_date', { ascending: true });
      if (error) throw error;
      return data as EventRow[];
    },
  });
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url, role_title');
      if (error) throw error;
      return data as Profile[];
    },
  });
}

function useEventAttachments(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event_attachments', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase.from('event_attachments').select('*').eq('event_id', eventId).order('created_at');
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!eventId,
  });
}

function useEventMembers(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event_members', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase.from('event_members').select('*').eq('event_id', eventId);
      if (error) throw error;
      return data as EventMember[];
    },
    enabled: !!eventId,
  });
}

// ─── Helpers ────────────────────────────────────────────────────

function getType(types: EventType[], id: string | null): EventType | undefined {
  return types.find(t => t.id === id);
}

function TypeBadge({ types, typeId }: { types: EventType[]; typeId: string | null }) {
  const t = getType(types, typeId);
  if (!t) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${t.color}20`, color: t.color }}>
      {t.name}
    </span>
  );
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Date Time Picker ───────────────────────────────────────────

function DateTimePickerField({ date, onSelect, placeholder }: { date?: Date; onSelect: (d: Date | undefined) => void; placeholder: string }) {
  const handleDateSelect = (day: Date | undefined) => {
    if (!day) { onSelect(undefined); return; }
    // Preserve existing time if date already set
    if (date) {
      day.setHours(date.getHours(), date.getMinutes());
    }
    onSelect(new Date(day));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    const d = date ? new Date(date) : new Date();
    d.setHours(h, m, 0, 0);
    onSelect(d);
  };

  const timeValue = date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';

  return (
    <div className="space-y-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {date && (
        <Input
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

// ─── Event Type Manager ─────────────────────────────────────────

function EventTypeManager({ types }: { types: EventType[] }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Nome obrigatório');
      const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const { error } = await supabase.from('event_types').insert({ name: newName.trim(), color: newColor, slug });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_types'] }); setNewName(''); toast.success('Tipo criado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_types'] }); toast.success('Tipo eliminado'); },
    onError: () => toast.error('Erro ao eliminar (pode estar em uso)'),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Tipos de evento</h3>
      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
            <span className="flex-1 text-foreground">{t.name}</span>
            <button onClick={() => deleteMutation.mutate(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Novo tipo</Label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do tipo" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cor</Label>
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-8 w-10 rounded border border-input cursor-pointer" />
        </div>
        <Button size="sm" variant="outline" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Member Picker ──────────────────────────────────────────────

function MemberPicker({ selectedIds, onChange, profiles }: { selectedIds: string[]; onChange: (ids: string[]) => void; profiles: Profile[] }) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Membros</Label>
      <ScrollArea className="max-h-32 rounded border border-input p-2">
        <div className="space-y-1.5">
          {profiles.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
              <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <Avatar className="h-5 w-5">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              <span className="text-foreground">{p.full_name || 'Sem nome'}</span>
            </label>
          ))}
          {profiles.length === 0 && <span className="text-xs text-muted-foreground">Nenhum membro encontrado</span>}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Attachments Manager (inline in detail dialog) ──────────────

function AttachmentsSection({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { data: attachments = [] } = useEventAttachments(eventId);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `${eventId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('event-files').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('event-files').getPublicUrl(path);
      const { error } = await supabase.from('event_attachments').insert({
        event_id: eventId, type: 'file', name: file.name, url: urlData.publicUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_attachments', eventId] }); toast.success('Ficheiro adicionado'); },
    onError: () => toast.error('Erro no upload'),
  });

  const addLinkMutation = useMutation({
    mutationFn: async () => {
      if (!linkUrl.trim()) throw new Error('URL obrigatório');
      const { error } = await supabase.from('event_attachments').insert({
        event_id: eventId, type: 'link', name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event_attachments', eventId] });
      setLinkName(''); setLinkUrl(''); setShowAddLink(false);
      toast.success('Link adicionado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_attachments', eventId] }); },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-semibold"><Paperclip className="h-3.5 w-3.5" /> Anexos</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Ficheiro
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowAddLink(!showAddLink)}>
            <Link2 className="h-3 w-3 mr-1" /> Link
          </Button>
        </div>
      </div>
      <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadMutation.mutate(e.target.files[0]); e.target.value = ''; }} />

      {showAddLink && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Nome (opcional)" className="h-7 text-xs" />
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="h-7 text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addLinkMutation.mutate()} disabled={addLinkMutation.isPending}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-xs group">
              {a.type === 'file' ? <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1 flex items-center gap-1">
                {a.name} <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
              <button onClick={() => deleteMutation.mutate(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachments.length === 0 && !showAddLink && (
        <p className="text-xs text-muted-foreground">Sem anexos</p>
      )}
    </div>
  );
}

// ─── Event Form Dialog ──────────────────────────────────────────

function EventFormDialog({
  open, onOpenChange, editEvent, types, profiles,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editEvent?: EventRow | null; types: EventType[]; profiles: Profile[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: existingMembers = [] } = useEventMembers(editEvent?.id);

  const [title, setTitle] = useState(editEvent?.title ?? '');
  const [eventTypeId, setEventTypeId] = useState(editEvent?.event_type_id ?? (types[0]?.id ?? ''));
  const [startDate, setStartDate] = useState<Date | undefined>(editEvent?.start_date ? parseISO(editEvent.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(editEvent?.end_date ? parseISO(editEvent.end_date) : undefined);
  const [productName, setProductName] = useState(editEvent?.product_name ?? '');
  const [department, setDepartment] = useState(editEvent?.department ?? '');
  const [clientName, setClientName] = useState(editEvent?.client_name ?? '');
  const [notes, setNotes] = useState(editEvent?.notes ?? '');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(existingMembers.map(m => m.profile_id));

  // Sync when existingMembers loads
  if (editEvent && existingMembers.length > 0 && selectedMembers.length === 0) {
    // Only set once
    const ids = existingMembers.map(m => m.profile_id);
    if (ids.length > 0 && selectedMembers.join() !== ids.join()) {
      setSelectedMembers(ids);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !startDate) throw new Error('Campos obrigatórios em falta');
      const payload = {
        title: title.trim(),
        event_type_id: eventTypeId || null,
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        product_name: productName.trim() || null,
        department: department || null,
        client_name: clientName.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      };

      let eventId = editEvent?.id;

      if (editEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editEvent.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('events').insert(payload).select('id').single();
        if (error) throw error;
        eventId = data.id;
      }

      // Sync members
      if (eventId) {
        // Delete existing
        await supabase.from('event_members').delete().eq('event_id', eventId);
        // Insert selected
        if (selectedMembers.length > 0) {
          const rows = selectedMembers.map(pid => ({ event_id: eventId!, profile_id: pid }));
          const { error } = await supabase.from('event_members').insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event_members'] });
      toast.success(editEvent ? 'Evento atualizado' : 'Evento criado');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <Select value={eventTypeId} onValueChange={setEventTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de início *</Label>
              <DateTimePickerField date={startDate} onSelect={setStartDate} placeholder="Início" />
            </div>
            <div>
              <Label>Data de fim</Label>
              <DateTimePickerField date={endDate} onSelect={setEndDate} placeholder="Fim (opcional)" />
            </div>
          </div>
          <div>
            <Label>Produto associado</Label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Departamento</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Notas</Label>
            <MentionTextarea value={notes} onChange={setNotes} placeholder="Notas adicionais... usa @ para mencionar" rows={3} />
          </div>

          {/* Member picker */}
          <MemberPicker selectedIds={selectedMembers} onChange={setSelectedMembers} profiles={profiles} />

          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'A guardar...' : editEvent ? 'Guardar alterações' : 'Criar evento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calendar View ──────────────────────────────────────────────

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function CalendarView({ events, types, onEventClick }: { events: EventRow[]; types: EventType[]; onEventClick: (e: EventRow) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayIdx = (getDay(monthStart) + 6) % 7;
  const paddedDays: (Date | null)[] = [...Array(startDayIdx).fill(null), ...days];

  const eventsForDay = (day: Date) =>
    events.filter(ev => {
      const start = parseISO(ev.start_date);
      const end = ev.end_date ? parseISO(ev.end_date) : start;
      return isSameDay(day, start) || isSameDay(day, end) || isWithinInterval(day, { start, end });
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-lg font-semibold capitalize text-foreground">{format(currentMonth, 'MMMM yyyy', { locale: pt })}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-muted px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
        ))}
        {paddedDays.map((day, i) => (
          <div key={i} className={cn('bg-card min-h-[90px] p-1.5 text-sm', day && isSameDay(day, new Date()) && 'ring-1 ring-inset ring-primary/30', !day && 'bg-muted/30')}>
            {day && (
              <>
                <span className={cn('text-xs font-medium', isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-foreground/70')}>{format(day, 'd')}</span>
                <div className="mt-0.5 space-y-0.5">
                  {eventsForDay(day).slice(0, 3).map(ev => {
                    const t = getType(types, ev.event_type_id);
                    const color = t?.color ?? '#888';
                    return (
                      <button key={ev.id} onClick={() => onEventClick(ev)} className="w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-opacity hover:opacity-80" style={{ backgroundColor: `${color}20`, color }}>
                        {ev.title}
                      </button>
                    );
                  })}
                  {eventsForDay(day).length > 3 && <span className="text-[10px] text-muted-foreground">+{eventsForDay(day).length - 3}</span>}
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

function ListView({ events, types, onEventClick }: { events: EventRow[]; types: EventType[]; onEventClick: (e: EventRow) => void }) {
  if (events.length === 0) return <p className="text-center text-muted-foreground py-12">Nenhum evento registado.</p>;
  return (
    <div className="border rounded-lg overflow-hidden divide-y divide-border">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground">
        <div className="col-span-4">Evento</div>
        <div className="col-span-3">Tipo</div>
        <div className="col-span-3">Data</div>
        <div className="col-span-2">Produto</div>
      </div>
      {events.map(ev => (
        <button key={ev.id} onClick={() => onEventClick(ev)} className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm">
          <div className="col-span-4 font-medium text-foreground truncate">{ev.title}</div>
          <div className="col-span-3"><TypeBadge types={types} typeId={ev.event_type_id} /></div>
          <div className="col-span-3 text-muted-foreground">
            {format(parseISO(ev.start_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
            {ev.end_date && ` — ${format(parseISO(ev.end_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}`}
          </div>
          <div className="col-span-2 text-muted-foreground truncate">{ev.product_name || '—'}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Event Detail Dialog ────────────────────────────────────────

function EventDetailDialog({
  event, types, profiles, open, onOpenChange, onEdit,
}: {
  event: EventRow | null; types: EventType[]; profiles: Profile[]; open: boolean; onOpenChange: (o: boolean) => void; onEdit: () => void;
}) {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const { data: members = [] } = useEventMembers(event?.id);

  const assignedProfiles = profiles.filter(p => members.some(m => m.profile_id === p.id));

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div><TypeBadge types={types} typeId={event.event_type_id} /></div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {format(parseISO(event.start_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
            {event.end_date && ` — ${format(parseISO(event.end_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}`}
          </div>
          {event.product_name && (
            <div><span className="font-medium text-foreground">Produto:</span> {event.product_name}</div>
          )}
          {event.notes && (
            <div><span className="font-medium text-foreground">Notas:</span> <span className="text-muted-foreground">{event.notes}</span></div>
          )}

          {/* Members */}
          {assignedProfiles.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold"><Users className="h-3.5 w-3.5" /> Membros</Label>
              <div className="flex flex-wrap gap-2">
                {assignedProfiles.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-foreground">{p.full_name || 'Sem nome'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <AttachmentsSection eventId={event.id} />

          {isOwner && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
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
  const [typesManagerOpen, setTypesManagerOpen] = useState(false);

  const { isOwner } = useAuth();
  const { data: events = [], isLoading } = useEvents();
  const { data: types = [] } = useEventTypes();
  const { data: profiles = [] } = useProfiles();

  const handleEventClick = (ev: EventRow) => { setDetailEvent(ev); setDetailOpen(true); };
  const handleEdit = () => { setDetailOpen(false); if (detailEvent) { setEditEvent(detailEvent); setFormOpen(true); } };
  const handleNewEvent = () => { setEditEvent(null); setFormOpen(true); };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Agenda do Negócio</h1>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Button variant="ghost" size="icon" onClick={() => setTypesManagerOpen(true)} title="Gerir tipos de evento">
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView('calendar')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors', view === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                <LayoutGrid className="h-4 w-4" /> Calendário
              </button>
              <button onClick={() => setView('list')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                <List className="h-4 w-4" /> Lista
              </button>
            </div>
            <Button onClick={handleNewEvent}><Plus className="h-4 w-4 mr-1.5" /> Novo Evento</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : view === 'calendar' ? (
          <CalendarView events={events} types={types} onEventClick={handleEventClick} />
        ) : (
          <ListView events={events} types={types} onEventClick={handleEventClick} />
        )}
      </div>

      <EventFormDialog key={editEvent?.id ?? 'new'} open={formOpen} onOpenChange={setFormOpen} editEvent={editEvent} types={types} profiles={profiles} />
      <EventDetailDialog event={detailEvent} types={types} profiles={profiles} open={detailOpen} onOpenChange={setDetailOpen} onEdit={handleEdit} />

      <Dialog open={typesManagerOpen} onOpenChange={setTypesManagerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gerir Tipos de Evento</DialogTitle></DialogHeader>
          <EventTypeManager types={types} />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
