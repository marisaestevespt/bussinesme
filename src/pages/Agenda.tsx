import { useState, useRef, useMemo } from 'react';
import { DEPARTMENTS as SHARED_DEPARTMENTS } from '@/lib/departments';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
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
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarIcon, Plus, List, LayoutGrid, ChevronLeft, ChevronRight,
  Trash2, Settings2, X, Paperclip, Link2, FileText, Upload, Users, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isWithinInterval, parseISO, addDays, addWeeks, setDate as setDateFns, getDate as getDateFns } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { toast } from 'sonner';
import { getPortugueseHolidays, type Holiday } from '@/lib/holidays';
import { AddToCalendarButtons } from '@/components/AddToCalendarButtons';
import { resolveProductId } from '@/lib/productResolver';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import {
  type AgendaViewMode,
} from '@/components/agenda/AppleCalendarViews';
import {
  type CalendarItem,
} from '@/components/agenda/AgendaCalendarsSidebar';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { useOffDates, findOffRange } from '@/hooks/useOffDates';
import { getProductColorFromMap, useProductColors, useProductBrands, useClientProductMap } from '@/hooks/useProductColors';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useAutoCalendarLabels } from '@/hooks/useAutoCalendarLabels';
import { safeUrl } from '@/lib/url';

// ─── Types ──────────────────────────────────────────────────────

interface EventType { id: string; name: string; color: string; slug: string; }
interface EventRow { id: string; title: string; event_type_id: string | null; start_date: string; end_date: string | null; product_name: string | null; product_id: string | null; department: string | null; client_id?: string | null; client_name: string | null; notes: string | null; created_by: string | null; recurrence_type: string | null; recurrence_end: string | null; meeting_url: string | null; }

type RecurrenceType = 'semanal' | 'quinzenal' | 'mensal' | 'mensal_primeiro' | 'diario';
const RECURRENCE_OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '', label: 'Não se repete' },
  { value: 'diario', label: 'Todos os dias' },
  { value: 'semanal', label: 'Todas as semanas' },
  { value: 'quinzenal', label: 'A cada 2 semanas' },
  { value: 'mensal', label: 'Todos os meses (mesmo dia)' },
  { value: 'mensal_primeiro', label: '1º dia de cada mês' },
];

const DEPARTMENTS = SHARED_DEPARTMENTS.map(d => ({ value: d.value, label: d.label }));
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

function useEvents(userId: string | undefined, isOwner: boolean, range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['events', userId, isOwner, range.from, range.to],
    queryFn: async () => {
      // Limit fetch to a reasonable window around the cursor (covers Year view).
      // Recurring events expansion is performed client-side in expandRecurringEvents.
      const inRange = (q: any) => q
        .or(`and(start_date.gte.${range.from},start_date.lte.${range.to}),and(end_date.gte.${range.from},end_date.lte.${range.to}),and(start_date.lte.${range.from},end_date.gte.${range.to}),and(recurrence_type.not.is.null,start_date.lte.${range.to})`);

      if (isOwner || !userId) {
        // Owners see everything within the visible range (+ recurring that started before)
        const { data, error } = await inRange(
          supabase.from('events').select('*')
        ).order('start_date', { ascending: true });
        if (error) throw error;
        return data as EventRow[];
      }

      // Non-owners: events they created OR are a participant of.
      // event_members.profile_id stores profiles.id (NOT auth.users.id),
      // so resolve the matching profile id first.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      const profileIds = [userId, profile?.id].filter(Boolean) as string[];
      const { data: participations } = await supabase
        .from('event_members')
        .select('event_id')
        .in('profile_id', profileIds);
      const participantIds = participations?.map(p => p.event_id) || [];

      const { data: createdEvents, error: e1 } = await inRange(
        supabase.from('events').select('*').eq('created_by', userId)
      ).order('start_date', { ascending: true });
      if (e1) throw e1;

      let participantEvents: EventRow[] = [];
      if (participantIds.length > 0) {
        const { data, error: e2 } = await inRange(
          supabase.from('events').select('*').in('id', participantIds)
        ).order('start_date', { ascending: true });
        if (e2) throw e2;
        participantEvents = (data as EventRow[]) || [];
      }

      // Merge and deduplicate
      const map = new Map<string, EventRow>();
      for (const ev of [...(createdEvents || []), ...participantEvents]) {
        map.set(ev.id, ev as EventRow);
      }
      return Array.from(map.values()).sort((a, b) => a.start_date.localeCompare(b.start_date));
    },
    enabled: !!userId,
  });
}

const MEETING_PSEUDO_COLOR = '#8B5CF6'; // violet for meetings on calendar
const SALES_ACTION_PSEUDO_COLOR = '#F59E0B'; // amber for sales campaigns

/**
 * Surfaces commercial sales actions on the agenda as virtual events so the
 * user sees them alongside meetings & explicit events. Read-only.
 */
function useSalesActionsAsEvents(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['sales-actions-as-events', range.from, range.to],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_sales_actions')
        .select('id,action_name,start_date,end_date,enrollment_open_date,product_id,product,status')
        .or(`and(start_date.gte.${range.from},start_date.lte.${range.to}),and(end_date.gte.${range.from},end_date.lte.${range.to}),and(enrollment_open_date.gte.${range.from},enrollment_open_date.lte.${range.to})`)
        .order('start_date');
      if (error) throw error;
      const events: Array<EventRow & { _isSalesAction: true; _salesActionId: string }> = [];
      for (const a of (data || []) as any[]) {
        // Período da campanha
        if (a.start_date) {
          events.push({
            id: `sales_${a.id}`,
            _isSalesAction: true as const,
            _salesActionId: a.id,
            title: `📣 ${a.action_name}`,
            event_type_id: null,
            start_date: `${a.start_date}T09:00:00`,
            end_date: a.end_date ? `${a.end_date}T18:00:00` : null,
            product_name: a.product || null,
            product_id: a.product_id || null,
            department: 'comercial',
            client_name: null,
            notes: null,
            created_by: null,
            recurrence_type: null,
            recurrence_end: null,
            meeting_url: null,
          });
        }
        // Abertura de vagas/vendas (evento próprio)
        if (a.enrollment_open_date) {
          events.push({
            id: `sales_open_${a.id}`,
            _isSalesAction: true as const,
            _salesActionId: a.id,
            title: `🚪 Abertura: ${a.action_name}`,
            event_type_id: null,
            start_date: `${a.enrollment_open_date}T09:00:00`,
            end_date: null,
            product_name: a.product || null,
            product_id: a.product_id || null,
            department: 'comercial',
            client_name: null,
            notes: null,
            created_by: null,
            recurrence_type: null,
            recurrence_end: null,
            meeting_url: null,
          });
        }
      }
      return events;
    },
  });
}

function useMeetingsAsEvents(range: { from: string; to: string }) {
  const { userId: user } = { userId: useEffectiveUser().userId } as any;
  return useQuery({
    queryKey: ['meetings-as-events', range.from, range.to, user],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Listagem aberta a todos os autenticados.
      // Quem pode ABRIR o detalhe é controlado pela página de detalhe + cadeado na UI.
      const q = supabase
        .from('meetings')
        .select('id,title,date_time,status,meeting_url,client_id,client_name,department,project_name,product_id,product_name,is_recurring,recurrence_frequency,recurrence_end_date')
        .gte('date_time', range.from + 'T00:00:00')
        .lte('date_time', range.to + 'T23:59:59')
        .order('date_time');
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((m: any): EventRow & { _isMeeting: true; _meetingId: string } => ({
        id: `meeting_${m.id}`,
        _isMeeting: true as const,
        _meetingId: m.id,
        title: `📹 ${m.title}`,
        event_type_id: null,
        start_date: m.date_time,
        end_date: null,
        product_name: m.product_name || null,
        product_id: m.product_id || null,
        department: m.department || null,
        client_id: m.client_id || null,
        client_name: m.client_name || null,
        notes: m.project_name ? `Projeto: ${m.project_name}` : null,
        created_by: null,
        recurrence_type: null, // instances are already separate rows
        recurrence_end: null,
        meeting_url: m.meeting_url || null,
      }));
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

function TypeBadge({ types, typeId, isMeeting, colorOverride }: { types: EventType[]; typeId: string | null; isMeeting?: boolean; colorOverride?: string }) {
  if (isMeeting) {
    const c = colorOverride ?? MEETING_PSEUDO_COLOR;
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${c}20`, color: c }}>
        Reunião
      </span>
    );
  }
  const t = getType(types, typeId);
  if (!t) return <span className="text-xs text-muted-foreground">—</span>;
  const c = colorOverride ?? t.color;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${c}20`, color: c }}>
      {t.name}
    </span>
  );
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Recurrence Expansion ───────────────────────────────────────

function expandRecurringEvents(events: EventRow[], rangeStart: Date, rangeEnd: Date): EventRow[] {
  const result: EventRow[] = [];
  const recEndFallback = rangeEnd;

  for (const ev of events) {
    const start = parseISO(ev.start_date);
    if (!ev.recurrence_type) {
      result.push(ev);
      continue;
    }

    const recEnd = ev.recurrence_end ? parseISO(ev.recurrence_end) : recEndFallback;
    const hours = start.getHours();
    const minutes = start.getMinutes();
    let cursor = new Date(start);

    const maxOccurrences = 366; // safety limit
    let count = 0;

    while (cursor <= recEnd && cursor <= rangeEnd && count < maxOccurrences) {
      if (cursor >= rangeStart || isSameDay(cursor, rangeStart)) {
        const occurrenceDate = new Date(cursor);
        occurrenceDate.setHours(hours, minutes, 0, 0);
        result.push({
          ...ev,
          id: `${ev.id}_${format(cursor, 'yyyy-MM-dd')}`,
          start_date: occurrenceDate.toISOString(),
          end_date: null,
        });
      }

      count++;
      switch (ev.recurrence_type) {
        case 'diario':
          cursor = addDays(cursor, 1);
          break;
        case 'semanal':
          cursor = addWeeks(cursor, 1);
          break;
        case 'quinzenal':
          cursor = addWeeks(cursor, 2);
          break;
        case 'mensal':
          cursor = addMonths(cursor, 1);
          break;
        case 'mensal_primeiro':
          cursor = addMonths(cursor, 1);
          cursor = setDateFns(cursor, 1);
          break;
        default:
          count = maxOccurrences; // unknown type, stop
      }
    }
  }
  return result;
}


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
    <div className="space-y-2">
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

  const updateColorMutation = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await supabase.from('event_types').update({ color }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_types'] }); toast.success('Cor atualizada'); },
    onError: () => toast.error('Não consegui atualizar a cor. Tenta novamente.'),
  });

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Nome obrigatório');
      const { error } = await supabase.from('event_types').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event_types'] }); toast.success('Nome atualizado'); },
    onError: (e: Error) => toast.error(e.message || 'Não consegui atualizar o nome.'),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Tipos de evento</h3>
      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-sm">
            <label className="relative h-4 w-4 rounded-full flex-shrink-0 cursor-pointer ring-1 ring-border hover:ring-2 hover:ring-primary transition" style={{ backgroundColor: t.color }} title="Alterar cor">
              <input
                type="color"
                value={t.color}
                onChange={e => updateColorMutation.mutate({ id: t.id, color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <Input
              defaultValue={t.name}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== t.name) updateNameMutation.mutate({ id: t.id, name: v });
                else if (!v) e.target.value = t.name;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { (e.target as HTMLInputElement).value = t.name; (e.target as HTMLInputElement).blur(); }
              }}
              className="flex-1 h-7 text-sm border-transparent hover:border-input focus:border-input bg-transparent px-2"
              title="Clica para renomear"
            />
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
  const { getPhotoUrl } = useTeamPhotos();
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Membros</Label>
      <ScrollArea className="max-h-32 rounded border border-input p-2">
        <div className="space-y-2">
          {profiles.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
              <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <Avatar className="h-5 w-5">
                <AvatarImage src={getPhotoUrl(p)} />
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
        <Label className="flex items-center gap-2 text-xs font-semibold"><Paperclip className="h-3.5 w-3.5" /> Anexos</Label>
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
              <a href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1 flex items-center gap-1">
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
        <EmptyHint>Sem anexos</EmptyHint>
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
  const { data: offRanges } = useOffDates();

  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list-agenda'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').order('name');
      return (data || []) as { id: string; name: string }[];
    },
  });

  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients-list-agenda'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
      return (data || []) as { id: string; full_name: string }[];
    },
  });

  const [title, setTitle] = useState(editEvent?.title ?? '');
  const [eventTypeId, setEventTypeId] = useState(editEvent?.event_type_id ?? (types[0]?.id ?? ''));
  const [startDate, setStartDate] = useState<Date | undefined>(editEvent?.start_date ? parseISO(editEvent.start_date) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(editEvent?.end_date ? parseISO(editEvent.end_date) : undefined);
  const [productName, setProductName] = useState(editEvent?.product_name ?? '');
  const [department, setDepartment] = useState(editEvent?.department ?? '');
  const [clientName, setClientName] = useState(editEvent?.client_name ?? '');
  const [notes, setNotes] = useState(editEvent?.notes ?? '');
  const [recurrenceType, setRecurrenceType] = useState(editEvent?.recurrence_type ?? '');
  const [recurrenceEnd, setRecurrenceEnd] = useState<Date | undefined>(editEvent?.recurrence_end ? parseISO(editEvent.recurrence_end) : undefined);
  const [meetingUrl, setMeetingUrl] = useState(editEvent?.meeting_url ?? '');
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
      // Soft warn if start date falls in an Off period (and the event itself is not the Off marker)
      const currentTypeSlug = types.find(t => t.id === eventTypeId)?.slug;
      if (currentTypeSlug !== 'off' && currentTypeSlug !== 'feriado' && !editEvent) {
        const offRange = findOffRange(offRanges, startDate);
        if (offRange) {
          toast.warning(`Atenção: este evento cai num período Off (${offRange.title}).`, { duration: 6000 });
        }
      }
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
        recurrence_type: recurrenceType || null,
        recurrence_end: recurrenceEnd ? format(recurrenceEnd, 'yyyy-MM-dd') : null,
        meeting_url: meetingUrl.trim() || null,
      };

      let eventId = editEvent?.id;

      if (editEvent) {
        const productId = await resolveProductId(payload.product_name);
        const { error } = await supabase.from('events').update({ ...payload, product_id: productId }).eq('id', editEvent.id);
        if (error) throw error;
      } else {
        const productId = await resolveProductId(payload.product_name);
        const { data, error } = await supabase.from('events').insert({ ...payload, product_id: productId }).select('id').single();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          {/* Recurrence */}
          <div>
            <Label className="flex items-center gap-2">🔁 Repetição</Label>
            <Select value={recurrenceType || 'none'} onValueChange={v => setRecurrenceType(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Não se repete" /></SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(o => (
                  <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {recurrenceType && recurrenceType !== 'none' && (
            <div>
              <Label>Repetir até</Label>
              <DateTimePickerField date={recurrenceEnd} onSelect={setRecurrenceEnd} placeholder="Sem data final (opcional)" />
            </div>
          )}
          <div>
            <Label>Produto associado</Label>
            <Select value={productName || '_none_'} onValueChange={v => setProductName(v === '_none_' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhum</SelectItem>
                {productsList.map(p => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={clientName || '_none_'} onValueChange={v => setClientName(v === '_none_' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhum</SelectItem>
                {clientsList.map(c => (
                  <SelectItem key={c.id} value={c.full_name}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-2">🔗 Link da reunião</Label>
            <Input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/... ou https://meet.google.com/..." />
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
  const totalCells = Math.ceil(paddedDays.length / 7) * 7;
  while (paddedDays.length < totalCells) paddedDays.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) weeks.push(paddedDays.slice(i, i + 7));

  const expandedEvents = expandRecurringEvents(events, monthStart, monthEnd);

  // Off days (negócio fechado) — set of yyyy-MM-dd strings to highlight in grey
  const offTypeId = types.find(t => t.slug === 'off')?.id;
  const offDayStrs = new Set<string>();
  if (offTypeId) {
    expandedEvents.forEach(ev => {
      if (ev.event_type_id !== offTypeId) return;
      const s = parseISO(ev.start_date);
      const e = ev.end_date ? parseISO(ev.end_date) : s;
      let cur = new Date(s);
      while (cur <= e) {
        offDayStrs.add(format(cur, 'yyyy-MM-dd'));
        cur = addDays(cur, 1);
      }
    });
  }

  // Portuguese holidays for displayed year(s)
  const holidayMap = new Map<string, string>();
  const yearsToCheck = new Set([monthStart.getFullYear(), monthEnd.getFullYear()]);
  yearsToCheck.forEach(y => {
    getPortugueseHolidays(y).forEach(h => holidayMap.set(h.dateStr, h.name));
  });

  // For each week, compute which events span which columns
  const getWeekBars = (week: (Date | null)[]) => {
    const weekDays = week.map((d, i) => ({ day: d, col: i }));
    const bars: { ev: EventRow; startCol: number; span: number; color: string }[] = [];

    expandedEvents.forEach(ev => {
      const evStart = parseISO(ev.start_date);
      const evEnd = ev.end_date ? parseISO(ev.end_date) : evStart;
      let firstCol = -1;
      let lastCol = -1;

      weekDays.forEach(({ day, col }) => {
        if (!day) return;
        if (isSameDay(day, evStart) || isSameDay(day, evEnd) || (day > evStart && day < evEnd)) {
          if (firstCol === -1) firstCol = col;
          lastCol = col;
        }
      });

      if (firstCol !== -1) {
        const isMeeting = (ev as any)._isMeeting;
        const t = getType(types, ev.event_type_id);
        const colorOverride = (ev as any)._color as string | undefined;
        const color = colorOverride ?? (isMeeting ? MEETING_PSEUDO_COLOR : (t?.color ?? '#888'));
        bars.push({ ev, startCol: firstCol, span: lastCol - firstCol + 1, color });
      }
    });

    return bars;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" aria-label="Anterior" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-lg font-semibold capitalize text-foreground">{format(currentMonth, 'MMMM yyyy', { locale: pt })}</h3>
        <Button variant="ghost" aria-label="Seguinte" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {WEEKDAYS.map(d => (
            <div key={d} className="bg-primary px-2 py-2 text-xs font-medium text-primary-foreground text-center">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => {
          const bars = getWeekBars(week);
          // Assign rows to bars to avoid overlap
          const barRows: number[] = [];
          bars.forEach((bar, bi) => {
            let row = 0;
            while (bars.some((other, oi) => oi < bi && barRows[oi] === row && !(other.startCol + other.span - 1 < bar.startCol || bar.startCol + bar.span - 1 < other.startCol))) {
              row++;
            }
            barRows.push(row);
          });
          const maxRow = barRows.length > 0 ? Math.max(...barRows) : -1;
          const barSlotsHeight = (maxRow + 1) * 28;

          return (
            <div key={wi} className="grid grid-cols-7 gap-px bg-border relative">
              {week.map((day, di) => {
                const dayStr = day ? format(day, 'yyyy-MM-dd') : '';
                const holidayName = day ? holidayMap.get(dayStr) : undefined;
                const isOffDay = day ? offDayStrs.has(dayStr) : false;
                return (
                  <div key={di} className={cn(
                    'bg-card min-h-[110px] p-1.5',
                    day && isSameDay(day, new Date()) && 'ring-1 ring-inset ring-primary/30',
                    !day && 'bg-muted/30',
                    holidayName && 'bg-destructive/5',
                    isOffDay && 'bg-muted/60',
                  )}>
                    {day && (
                      <div className="flex items-center gap-1">
                        <span className={cn('text-xs font-medium', isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-foreground/70')}>{format(day, 'd')}</span>
                        {holidayName && (
                          <span className="text-[10px] text-destructive font-medium truncate">{holidayName}</span>
                        )}
                        {isOffDay && !holidayName && (
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Off</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Overlay bars positioned from top of week row */}
              {bars.map((bar, bi) => {
                const leftPct = (bar.startCol / 7) * 100;
                const widthPct = (bar.span / 7) * 100;
                const topPx = 24 + barRows[bi] * 26;
                return (
                  <button
                    key={`${bar.ev.id}-${wi}`}
                    onClick={() => onEventClick(bar.ev)}
                    className="absolute rounded-md px-2 py-0.5 text-xs font-medium truncate transition-opacity hover:opacity-80 z-10"
                    style={{
                      left: `calc(${leftPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                      top: `${topPx}px`,
                      backgroundColor: `${bar.color}20`,
                      color: bar.color,
                      height: '22px',
                      lineHeight: '18px',
                    }}
                  >
                    {bar.ev.recurrence_type && '🔁 '}{bar.ev.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────

function ListView({ events, types, onEventClick }: { events: EventRow[]; types: EventType[]; onEventClick: (e: EventRow) => void }) {
  if (events.length === 0) return <EmptyHint>Nenhum evento registado.</EmptyHint>;
  return (
    <div className="border rounded-lg overflow-hidden divide-y divide-border">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-primary text-xs font-medium text-primary-foreground rounded-t-lg">
        <div className="col-span-3">Evento</div>
        <div className="col-span-2">Tipo</div>
        <div className="col-span-2">Data</div>
        <div className="col-span-2">Departamento</div>
        <div className="col-span-1">Produto</div>
        <div className="col-span-2">Cliente</div>
      </div>
      {events.map(ev => (
        <button key={ev.id} onClick={() => onEventClick(ev)} className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm">
          <div className="col-span-3 font-medium text-foreground truncate">{ev.title}</div>
          <div className="col-span-2"><TypeBadge types={types} typeId={ev.event_type_id} isMeeting={(ev as any)._isMeeting} colorOverride={(ev as any)._color} /></div>
          <div className="col-span-2 text-muted-foreground text-xs">
            {format(parseISO(ev.start_date), "dd MMM yyyy", { locale: pt })}
          </div>
          <div className="col-span-2 text-muted-foreground truncate">{ev.department ? DEPARTMENTS.find(d => d.value === ev.department)?.label || ev.department : '—'}</div>
          <div className="col-span-1 text-muted-foreground truncate">{ev.product_name || '—'}</div>
          <div className="col-span-2 text-muted-foreground truncate">{ev.client_name || '—'}</div>
        </button>
      ))}
    </div>
  );
}

// AddToCalendarButtons moved to src/components/AddToCalendarButtons.tsx

// ─── Event Detail Dialog ────────────────────────────────────────

function EventDetailDialog({
  event, types, profiles, open, onOpenChange, onEdit,
}: {
  event: EventRow | null; types: EventType[]; profiles: Profile[]; open: boolean; onOpenChange: (o: boolean) => void; onEdit: () => void;
}) {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const { getPhotoUrl } = useTeamPhotos();
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
    onError: () => toast.error('Não consegui eliminar a evento. Tenta novamente.'),
  });

  if (!event) return null;

  const isMeeting = (event as any)._isMeeting === true;
  const meetingId = (event as any)._meetingId as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
          {event.recurrence_type && (
            <div className="flex items-center gap-2">
              <span className="text-sm">🔁</span>
              <span className="text-muted-foreground">
                {RECURRENCE_OPTIONS.find(o => o.value === event.recurrence_type)?.label || event.recurrence_type}
                {event.recurrence_end && ` (até ${format(parseISO(event.recurrence_end), 'dd MMM yyyy', { locale: pt })})`}
              </span>
            </div>
          )}
          {event.department && (
            <div><span className="font-medium text-foreground">Departamento:</span> {DEPARTMENTS.find(d => d.value === event.department)?.label || event.department}</div>
          )}
          {event.product_name && (
            <div><span className="font-medium text-foreground">Produto:</span> {event.product_name}</div>
          )}
          {event.client_name && (
            <div><span className="font-medium text-foreground">Cliente:</span> {event.client_name}</div>
          )}
          {event.meeting_url && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Link:</span>
              <a href={event.meeting_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                {event.meeting_url.includes('zoom') ? '📹 Zoom' : event.meeting_url.includes('meet.google') ? '📹 Google Meet' : '🔗 Abrir link'}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {event.notes && (
            <div><span className="font-medium text-foreground">Notas:</span> <span className="text-muted-foreground">{event.notes}</span></div>
          )}

          {/* Members */}
          {assignedProfiles.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold"><Users className="h-3.5 w-3.5" /> Membros</Label>
              <div className="flex flex-wrap gap-2">
                {assignedProfiles.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={getPhotoUrl(p)} />
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

          {/* Add to Calendar */}
          <AddToCalendarButtons event={{ title: event.title, startDate: event.start_date, endDate: event.end_date, notes: event.notes, meetingUrl: event.meeting_url }} />

          {isMeeting && meetingId && (
            <div className="pt-2">
              <Button
                variant="default"
                className="w-full"
                onClick={() => { onOpenChange(false); window.open(`/hub/reunioes/${meetingId}`, '_self'); }}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Abrir página da reunião
              </Button>
            </div>
          )}

          {isOwner && !isMeeting && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>Editar</Button>
              <Button variant="destructive" aria-label="Eliminar" size="icon" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
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

const AGENDA_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'calendar', label: 'Calendário', icon: <LayoutGrid className="h-4 w-4" />, isDefault: true },
  { key: 'list', label: 'Lista', icon: <List className="h-4 w-4" />, isDefault: true },
];

const AGENDA_MODE_KEY = 'agenda:viewMode';

export default function AgendaPage() {
  const { allViews, addView, renameView, deleteView } = useUserViews('agenda', AGENDA_DEFAULT_VIEWS);
  const [view, setView] = useState<string>('calendar');
  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [typesManagerOpen, setTypesManagerOpen] = useState(false);

  const { userId: effUserId, isOwner: effIsOwner } = useEffectiveUser();
  const isOwner = effIsOwner;
  // Fetch range: -6 / +18 months around cursor (covers Year view + recurring base)
  const [cursor, setCursor] = useState<Date>(new Date());
  const fetchRange = useMemo(() => ({
    from: format(subMonths(cursor, 6), 'yyyy-MM-dd'),
    to: format(addMonths(cursor, 18), 'yyyy-MM-dd'),
  }), [cursor.getFullYear(), cursor.getMonth()]);
  const { data: events = [], isLoading } = useEvents(effUserId ?? undefined, effIsOwner, fetchRange);
  const { data: meetingEvents = [] } = useMeetingsAsEvents(fetchRange);
  const { data: salesActionEvents = [] } = useSalesActionsAsEvents(fetchRange);
  const { data: types = [] } = useEventTypes();
  const { data: profiles = [] } = useProfiles();
  const { data: productColors, isLoading: productColorsLoading } = useProductColors();
  const { data: productBrands = [] } = useProductBrands();
  const { data: clientProductMap } = useClientProductMap();
  const { settings: businessSettings } = useBusinessSettings();
  const { labels: autoLabels, rename: renameAutoLabel } = useAutoCalendarLabels();
  // Brand colour for internal/company meetings (no client/product). Falls
  // back to the meeting pseudo-colour only if branding is empty.
  const companyBrandColor = useMemo(() => {
    const raw = (businessSettings as any)?.primary_color as string | null | undefined;
    if (!raw) return undefined;
    const t = raw.trim();
    if (/^hsl\(.*\)$/i.test(t)) return t;
    if (/^\d+\s+\d+%\s+\d+%$/.test(t)) return `hsl(${t})`;
    return t;
  }, [businessSettings]);

  // ─── Calendars sidebar items (filters live inside AgendaCalendarView) ─────
  const typeCalendarItems: CalendarItem[] = useMemo(() => {
    return types.map(t => ({ id: `type:${t.id}`, label: t.name, color: t.color }));
  }, [types]);

  // Calendários automáticos (gerados pelo sistema, sempre presentes, não editáveis).
  const autoTypeCalendarItems: CalendarItem[] = useMemo(() => ([
    { id: 'meta:meeting',  label: autoLabels.meeting, color: MEETING_PSEUDO_COLOR },
    { id: 'meta:sales',    label: autoLabels.sales,   color: SALES_ACTION_PSEUDO_COLOR },
    { id: 'meta:feriado',  label: autoLabels.feriado, color: 'hsl(var(--destructive))' },
  ]), [autoLabels]);

  const productCalendarItems: CalendarItem[] = useMemo(
    () => productBrands.map(p => ({ id: `product:${p.id}`, label: p.name, color: p.color })),
    [productBrands],
  );

  const isEventVisible = (ev: any, isVisible: (id: string) => boolean) => {
    let typeKey: string | null = null;
    if (ev._isMeeting) typeKey = 'meta:meeting';
    else if (ev._isSalesAction) typeKey = 'meta:sales';
    else if (ev.event_type_id) typeKey = `type:${ev.event_type_id}`;
    // Events without a type are not filterable by type — always visible from the type axis.
    if (typeKey && !isVisible(typeKey)) return false;
    const pid = ev.product_id as string | null | undefined;
    if (pid && !isVisible(`product:${pid}`)) return false;
    return true;
  };

  // Merge events + meetings into a single sorted list
  const allEventsRaw = [...events, ...meetingEvents, ...salesActionEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
  // Product brand colour ALWAYS takes precedence over the event-type colour
  // when an event is linked to a product (per business rule).
  // When an event only knows the client (no product_id), we look up the
  // client's current product so the meeting still inherits the product colour.
  const allEvents = useMemo(() => {
    return allEventsRaw.map(ev => {
      let pid = (ev as any).product_id as string | null | undefined;
      let productName = (ev as any).product_name as string | null | undefined;
      // Derive product from client when missing — guarantees calendar colour
      // for every client meeting, even if the form was saved without product.
      if (!pid && !productName) {
        const clientId = (ev as any).client_id as string | null | undefined;
        const clientName = (ev as any).client_name as string | null | undefined;
        const cp = (clientId && clientProductMap?.byId.get(clientId))
          || (clientName && clientProductMap?.byName.get(clientName.trim().toLocaleLowerCase('pt-PT')))
          || null;
        if (cp) { pid = cp.product_id ?? undefined; productName = cp.product_name ?? undefined; }
      }
      const productC = getProductColorFromMap(productColors, pid, productName);
      // Sales actions get the amber pseudo-colour by default; product colour wins when present.
      const isSales = (ev as any)._isSalesAction;
      const isMeeting = (ev as any)._isMeeting;
      // Internal company meetings (no product, no client product): use the
      // company brand colour so they are clearly distinguishable from the
      // generic violet "meeting" pill.
      const fallbackC = isSales
        ? SALES_ACTION_PSEUDO_COLOR
        : (isMeeting ? companyBrandColor : undefined);
      const c = productC ?? fallbackC;
      if (!c) return { ...ev, product_id: pid ?? null, product_name: productName ?? null } as EventRow;
      return { ...ev, product_id: pid ?? null, product_name: productName ?? null, _color: c } as EventRow;
    });
  }, [allEventsRaw, productColors, clientProductMap, companyBrandColor]);

  // Expand recurring events into a wide window so all views see occurrences.
  // The visibility filter is applied inside AgendaCalendarView so it can react
  // to sidebar toggles without re-running this expensive expansion.
  const expandedEvents = useMemo(() => {
    const rangeStart = subMonths(cursor, 6);
    const rangeEnd = addMonths(cursor, 18);
    return expandRecurringEvents(allEvents, rangeStart, rangeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, cursor.getFullYear(), cursor.getMonth()]);

  const handleEventClick = (ev: EventRow) => {
    // Meetings and regular events both open the preview dialog.
    // The dialog has an "Abrir página" button to navigate to the full meeting page when applicable.
    setDetailEvent(ev);
    setDetailOpen(true);
  };
  const handleEdit = () => { setDetailOpen(false); if (detailEvent) { setEditEvent(detailEvent); setFormOpen(true); } };
  const handleNewEvent = () => { setEditEvent(null); setFormOpen(true); };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Agenda do Negócio" />
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            {isOwner && (
              <Button variant="ghost" aria-label="Definições" size="icon" onClick={() => setTypesManagerOpen(true)} title="Gerir tipos de evento">
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
            <ViewTabs
              views={allViews}
              activeKey={view}
              onSelect={setView}
              onAdd={(label) => addView(label)}
              onRename={(id, label) => renameView({ id, label })}
              onDelete={(id) => { if (view.startsWith('custom_')) setView('calendar'); deleteView(id); }}
            />
            <Button onClick={handleNewEvent}><Plus className="h-4 w-4 mr-1.5" /> Novo Evento</Button>
          </div>
        </div>

        {isLoading || productColorsLoading ? (
          <div className="flex items-center justify-center py-24">
            <InlineLoader />
          </div>
        ) : view === 'calendar' ? (
          <AgendaCalendarView
            storageKey="agenda-business"
            cursor={cursor}
            onCursorChange={setCursor}
            events={expandedEvents}
            types={types}
            typeItems={typeCalendarItems}
            autoTypeItems={autoTypeCalendarItems}
            productItems={productCalendarItems}
            isEventVisible={isEventVisible}
            onEventClick={handleEventClick}
            defaultMode="week"
            onAutoItemRename={(id, name) => {
              const key = id === 'meta:meeting' ? 'meeting'
                        : id === 'meta:sales'   ? 'sales'
                        : id === 'meta:feriado' ? 'feriado' : null;
              if (key) renameAutoLabel(key, name);
            }}
            toolbarRight={
              <Button size="sm" className="rounded-full h-8" onClick={handleNewEvent}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo
              </Button>
            }
          />
        ) : (
          <ListView events={allEvents} types={types} onEventClick={handleEventClick} />
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
