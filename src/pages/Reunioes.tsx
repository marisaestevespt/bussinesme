import { useState, useRef, useEffect, useMemo } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { useNavigate } from 'react-router-dom';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Plus, Users, Clock, Repeat, Video, FolderOpen, UserCheck, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, addWeeks, addMonths, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/lib/departments';
import { logAudit } from '@/lib/auditLog';
import { InlineLoader } from '@/components/ui/loading-skeletons';

// ─── Types ──────────────────────────────────────────────────────

import { MEETING_STATUSES as CANON_MEETING_STATUSES, type MeetingStatusValue } from '@/lib/meetingStatus';
type MeetingStatus = MeetingStatusValue;
type MeetingType = 'recorrente' | 'projeto' | 'cliente' | 'diagnostico';

const STATUSES = CANON_MEETING_STATUSES.map(s => ({ value: s.value, label: s.label, color: s.dotColor }));

const MEETING_TYPES: { value: MeetingType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'inicial' as MeetingType, label: 'Reunião Inicial', icon: <Handshake className="h-5 w-5" />, description: 'Primeira reunião com o cliente (1 por cliente)' },
  { value: 'recorrente', label: 'Reunião Recorrente', icon: <Repeat className="h-5 w-5" />, description: 'Reunião periódica interna ou com cliente' },
  { value: 'projeto', label: 'Reunião de Projeto', icon: <FolderOpen className="h-5 w-5" />, description: 'Reunião associada a um projeto específico' },
  { value: 'cliente', label: 'Reunião com Cliente', icon: <UserCheck className="h-5 w-5" />, description: 'Reunião com cliente associado' },
  { value: 'diagnostico', label: 'Reunião de Diagnóstico', icon: <Users className="h-5 w-5" />, description: 'Reunião de diagnóstico com lead ou potencial cliente' },
];

interface MeetingRow {
  id: string;
  title: string;
  date_time: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  department: string | null;
  transcript_url: string | null;
  created_by: string | null;
  parent_meeting_id: string | null;
  is_recurring: boolean;
}

export interface ProjectOption {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  department: string | null;
  type: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role_title: string | null;
}

interface MeetingParticipant {
  id: string;
  meeting_id: string;
  profile_id: string;
}

// ─── Data hooks ─────────────────────────────────────────────────

function useMeetings() {
  return useInfiniteQuery<InfinitePageResult<MeetingRow>>({
    queryKey: ['meetings'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase.from('meetings').select('id, title, date_time, status, client_id, client_name, project_id, project_name, transcript_url, created_by, department, meeting_url, meeting_type, parent_meeting_id, is_recurring', { count: 'exact' }).order('date_time', { ascending: false }).range(from, to);
      if (error) throw error;
      return { data: (data || []) as MeetingRow[], count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });
}

function useProjects() {
  return useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, client_id, client_name, department, type').order('name');
      if (error) throw error;
      return (data || []) as ProjectOption[];
    },
  });
}

function useClientsList() {
  return useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, full_name').order('full_name');
      if (error) throw error;
      return data || [];
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

// ─── Helpers ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MeetingStatus }) {
  const s = STATUSES.find(x => x.value === status) ?? STATUSES[0];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
      {s.label}
    </span>
  );
}

function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const colors: Record<MeetingType, string> = { recorrente: '#6366f1', projeto: '#3b82f6', cliente: '#10b981', diagnostico: '#f59e0b' };
  const labels: Record<MeetingType, string> = { recorrente: 'Recorrente', projeto: 'Projeto', cliente: 'Cliente', diagnostico: 'Diagnóstico' };
  const c = colors[type] || '#6b7280';
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${c}20`, color: c }}>
      {labels[type] || type}
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
    if (date) day.setHours(date.getHours(), date.getMinutes());
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
      {date && <Input type="time" value={timeValue} onChange={handleTimeChange} className="h-8 text-sm" />}
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
      <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Participantes</Label>
      <ScrollArea className="max-h-32 rounded border border-input p-2">
        <div className="space-y-1.5">
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
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Project Picker Dialog (multi-select) ───────────────────────

function ProjectPickerDialog({
  open, onOpenChange, projects, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: ProjectOption[];
  onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => { if (open) setSelected([]); }, [open]);

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Selecionar projeto(s)</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Este cliente tem vários projetos. Selecione o(s) que pretende associar:</p>
        <div className="space-y-2 mt-2">
          {projects.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="text-foreground">{p.name}</span>
              {p.type && <span className="text-xs text-muted-foreground">({p.type})</span>}
            </label>
          ))}
        </div>
        <Button className="w-full mt-2" onClick={() => { onConfirm(selected); onOpenChange(false); }} disabled={selected.length === 0}>
          Confirmar ({selected.length})
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recurrence helpers ─────────────────────────────────────────

function getAdvanceFn(frequency: string): (d: Date) => Date {
  switch (frequency) {
    case 'diaria': return (d: Date) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; };
    case 'semanal': return (d: Date) => addWeeks(d, 1);
    case 'quinzenal': return (d: Date) => addWeeks(d, 2);
    case 'cada_3_semanas': return (d: Date) => addWeeks(d, 3);
    case 'mensal': return (d: Date) => addMonths(d, 1);
    case 'bimestral': return (d: Date) => addMonths(d, 2);
    case 'trimestral': return (d: Date) => addMonths(d, 3);
    case 'semestral': return (d: Date) => addMonths(d, 6);
    default: return (d: Date) => addWeeks(d, 1);
  }
}

function generateRecurrenceDates(startDate: Date, frequency: string, endDate?: Date): Date[] {
  const dates: Date[] = [];
  const limit = endDate || addMonths(startDate, 12);
  let current = new Date(startDate);
  const advanceFn = getAdvanceFn(frequency);

  // Skip the first one (it's the original / the 1ª data)
  current = advanceFn(current);
  while (isBefore(current, limit) || current.getTime() === limit.getTime()) {
    dates.push(new Date(current));
    current = advanceFn(current);
  }
  return dates;
}

// ─── Meeting Type Picker Step ───────────────────────────────────

function MeetingTypeStep({ onSelect }: { onSelect: (type: MeetingType) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Selecione o tipo de reunião que pretende criar:</p>
      <div className="grid gap-3">
        {MEETING_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => onSelect(t.value)}
            className="flex items-center gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {t.icon}
            </div>
            <div>
              <p className="font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── New Meeting Dialog ─────────────────────────────────────────

export function MeetingFormDialog({
  open, onOpenChange, profiles, projects, clients,
  defaultClientId, defaultClientName, defaultRecurrenceEndDate,
  defaultProjectId, defaultProjectName,
  onMeetingCreated, navigateAfterCreate = true,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; profiles: Profile[]; projects: ProjectOption[]; clients: { id: string; full_name: string }[];
  defaultClientId?: string; defaultClientName?: string; defaultRecurrenceEndDate?: Date;
  defaultProjectId?: string; defaultProjectName?: string;
  /** Called with the created meeting id BEFORE any navigation, so the caller can do follow-up writes (e.g. linking to a deliverable). */
  onMeetingCreated?: (meetingId: string) => void | Promise<void>;
  /** When false, the dialog closes but does not navigate to the meeting detail page. Useful when called from another context. */
  navigateAfterCreate?: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasDefaults = !!defaultClientId || !!defaultProjectId;
  const [step, setStep] = useState<'type' | 'form'>(hasDefaults ? 'form' : 'type');
  const [meetingType, setMeetingType] = useState<MeetingType>(hasDefaults ? (defaultProjectId ? 'projeto' : 'cliente') : 'recorrente');
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState<Date | undefined>();
  const [status, setStatus] = useState<MeetingStatus>('por_confirmar');
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);
  const [department, setDepartment] = useState(hasDefaults ? 'clientes' : '');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [pendingClientProjects, setPendingClientProjects] = useState<ProjectOption[]>([]);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<string>('semanal');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<Date | undefined>();
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(defaultRecurrenceEndDate);

  const skipAutoFillRef = useRef(false);

  const resetForm = () => {
    setStep(hasDefaults ? 'form' : 'type'); setMeetingType(hasDefaults ? (defaultProjectId ? 'projeto' : 'cliente') : 'recorrente');
    setTitle(''); setDateTime(undefined); setStatus('por_confirmar');
    setClientId(defaultClientId || ''); setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []); setDepartment(hasDefaults ? 'clientes' : '');
    setSelectedMembers([]); setMeetingUrl('');
    setIsRecurring(false); setRecurrenceFrequency('semanal'); setRecurrenceStartDate(undefined); setRecurrenceEndDate(defaultRecurrenceEndDate);
    skipAutoFillRef.current = false;
  };

  const handleTypeSelect = (type: MeetingType) => {
    setMeetingType(type);
    setStep('form');
    if (type === 'cliente' || type === ('inicial' as MeetingType)) setDepartment('clientes');
    // Auto-set title for inicial meeting if client already selected
    if (type === ('inicial' as MeetingType) && clientId) {
      const c = clients.find((c: any) => c.id === clientId);
      if (c) setTitle(`Reunião Inicial_${(c as any).full_name}`);
    }
  };

  // Projects for selected client
  const clientProjects = useMemo(() => {
    if (!clientId) return [];
    return projects.filter(p => p.client_id === clientId);
  }, [clientId, projects]);

  const handleClientChange = (newClientId: string) => {
    const actualId = newClientId === '__none' ? '' : newClientId;
    skipAutoFillRef.current = true;
    setClientId(actualId);

    if (actualId) {
      setDepartment('clientes');
      // Auto-set title for inicial meeting
      if (meetingType === ('inicial' as MeetingType)) {
        const c = clients.find((c: any) => c.id === actualId);
        if (c) setTitle(`Reunião Inicial_${(c as any).full_name}`);
      }
      const cProjects = projects.filter(p => p.client_id === actualId);
      if (cProjects.length === 1) {
        setSelectedProjectIds([cProjects[0].id]);
      } else if (cProjects.length > 1) {
        setPendingClientProjects(cProjects);
        setProjectPickerOpen(true);
      } else {
        setSelectedProjectIds([]);
      }
    } else {
      setDepartment('');
      setSelectedProjectIds([]);
    }
    setTimeout(() => { skipAutoFillRef.current = false; }, 0);
  };

  const handleProjectToggle = (projId: string) => {
    const isAdding = !selectedProjectIds.includes(projId);
    const newIds = isAdding
      ? [...selectedProjectIds, projId]
      : selectedProjectIds.filter(x => x !== projId);
    setSelectedProjectIds(newIds);

    if (isAdding && !skipAutoFillRef.current) {
      const proj = projects.find(p => p.id === projId);
      if (proj) {
        if (proj.department) setDepartment(proj.department);
        if (proj.client_id && !clientId) {
          skipAutoFillRef.current = true;
          setClientId(proj.client_id);
          if (!department) setDepartment('clientes');
          setTimeout(() => { skipAutoFillRef.current = false; }, 0);
        }
      }
    }
  };

  const handleProjectPickerConfirm = (ids: string[]) => {
    setSelectedProjectIds(ids);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !dateTime) throw new Error('Nome e data/hora são obrigatórios');
      const primaryProjectId = selectedProjectIds[0] || null;
      const primaryProject = primaryProjectId ? projects.find(p => p.id === primaryProjectId) : null;
      const selectedClient = clients.find((c: any) => c.id === clientId);

      const meetingData = {
        title: title.trim(),
        date_time: dateTime.toISOString(),
        status,
        meeting_type: meetingType,
        client_id: clientId || null,
        client_name: selectedClient?.full_name || null,
        project_id: primaryProjectId,
        project_name: primaryProject?.name || null,
        department: department || null,
        meeting_url: meetingUrl || null,
        created_by: user?.id ?? null,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        recurrence_end_date: isRecurring && recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : null,
      };

      const { data, error } = await supabase.from('meetings').insert(meetingData as any).select('id').single();
      if (error) throw error;

      // Insert project links
      if (selectedProjectIds.length > 0) {
        const projRows = selectedProjectIds.map(pid => ({ meeting_id: data.id, project_id: pid }));
        await supabase.from('meeting_projects').insert(projRows);
      }

      // Insert participants
      if (selectedMembers.length > 0) {
        const rows = selectedMembers.map(pid => ({ meeting_id: data.id, profile_id: pid }));
        await supabase.from('meeting_participants').insert(rows);
      }

      // Create calendar event
      const isClientMeeting = meetingType === 'cliente';
      const { data: eventTypes } = await supabase.from('event_types')
        .select('id, slug')
        .in('slug', ['reuniao_interna', 'reuniao_cliente']);
      const typeSlug = isClientMeeting ? 'reuniao_cliente' : 'reuniao_interna';
      const eventTypeId = eventTypes?.find(t => t.slug === typeSlug)?.id ?? null;
      await supabase.from('events').insert({
        title: title.trim(),
        start_date: dateTime.toISOString(),
        event_type_id: eventTypeId,
        client_name: isClientMeeting ? (selectedClient?.full_name || null) : null,
        department: department || null,
        created_by: user?.id ?? null,
      });

      // Generate recurring occurrences
      if (isRecurring && dateTime) {
        const recurrenceBase = recurrenceStartDate || dateTime;
        const futureDates = generateRecurrenceDates(recurrenceBase, recurrenceFrequency, recurrenceEndDate);
        if (futureDates.length > 0) {
          const occurrences = futureDates.map(d => ({
            ...meetingData,
            date_time: d.toISOString(),
            parent_meeting_id: data.id,
            is_recurring: false, // child occurrences are not "recurring" themselves
          }));
          const { data: insertedOccurrences } = await supabase.from('meetings').insert(occurrences as any).select('id, date_time');

          // Create calendar events for each occurrence
          if (insertedOccurrences) {
            const occurrenceEvents = insertedOccurrences.map((occ: any) => ({
              title: title.trim(),
              start_date: occ.date_time,
              event_type_id: eventTypeId,
              client_name: isClientMeeting ? (selectedClient?.full_name || null) : null,
              department: department || null,
              created_by: user?.id ?? null,
            }));
            await supabase.from('events').insert(occurrenceEvents);

            // Insert participants for each occurrence
            if (selectedMembers.length > 0) {
              const participantRows = insertedOccurrences.flatMap((occ: any) =>
                selectedMembers.map(pid => ({ meeting_id: occ.id, profile_id: pid }))
              );
              await supabase.from('meeting_participants').insert(participantRows);
            }
          }
        }
      }

      return data.id;
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      logAudit('created', 'meeting', id, { title: title.trim(), meeting_type: meetingType, is_recurring: isRecurring });
      toast.success('Reunião criada');
      resetForm();
      onOpenChange(false);
      if (onMeetingCreated) {
        try { await onMeetingCreated(id); } catch (_) { /* swallow */ }
      }
      if (navigateAfterCreate) navigate(`/hub/reunioes/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <ProjectPickerDialog
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        projects={pendingClientProjects}
        onConfirm={handleProjectPickerConfirm}
      />
      <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{step === 'type' ? 'Tipo de Reunião' : `Nova ${MEETING_TYPES.find(t => t.value === meetingType)?.label}`}</DialogTitle>
          </DialogHeader>

          {step === 'type' ? (
            <MeetingTypeStep onSelect={handleTypeSelect} />
          ) : (
            <div className="space-y-4">
              {/* Back to type selection */}
              <Button variant="ghost" size="sm" onClick={() => setStep('type')} className="text-xs text-muted-foreground">
                ← Alterar tipo
              </Button>

              <div>
                <Label>Nome da reunião *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Reunião de Alinhamento Semanal" />
              </div>
              <div>
                <Label>Data e hora *</Label>
                <DateTimePickerField date={dateTime} onSelect={setDateTime} placeholder="Selecionar data" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as MeetingStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Link de acesso</Label>
                <Input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." />
              </div>

              <MemberPicker selectedIds={selectedMembers} onChange={setSelectedMembers} profiles={profiles} />

              {/* Client */}
              <div>
                <Label>Cliente associado {meetingType === 'cliente' ? '*' : ''}</Label>
                <Select value={clientId} onValueChange={handleClientChange}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhum</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div>
                <Label>Departamento</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project — for 'projeto' and 'cliente' types */}
              {(meetingType === 'projeto' || meetingType === 'cliente') && (
                <div>
                  <Label>Projeto associado {meetingType === 'projeto' ? '*' : ''}</Label>
                  <Select value={selectedProjectIds[0] || '_none_'} onValueChange={v => {
                    const id = v === '_none_' ? '' : v;
                    if (id) {
                      handleProjectToggle(id);
                      setSelectedProjectIds([id]);
                    } else {
                      setSelectedProjectIds([]);
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Nenhum</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.type ? ` (${p.type})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recurrence */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm">
                    <Repeat className="h-4 w-4" /> Reunião recorrente
                  </Label>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                </div>
              {isRecurring && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs">Frequência</Label>
                      <Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diaria">Diária</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="cada_3_semanas">Cada 3 semanas</SelectItem>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="bimestral">Bimestral</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">1ª data da recorrência (opcional)</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Se diferente da data da reunião, as próximas ocorrências baseiam-se nesta data.</p>
                      <DateTimePickerField date={recurrenceStartDate} onSelect={setRecurrenceStartDate} placeholder="Usar data da reunião" />
                    </div>
                    <div>
                      <Label className="text-xs">Data de fim (opcional)</Label>
                      <DateTimePickerField date={recurrenceEndDate} onSelect={setRecurrenceEndDate} placeholder="Sem data de fim (12 meses)" />
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'A criar...' : 'Criar reunião'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Meetings List Page ─────────────────────────────────────────

const REUNIOES_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'proximas', label: 'Próximas', icon: <Clock className="h-4 w-4" />, isDefault: true },
  { key: 'todas', label: 'Todas', isDefault: true },
];

export default function ReunioesPage() {
  const { allViews, addView, renameView, deleteView } = useUserViews('reunioes', REUNIOES_DEFAULT_VIEWS);
  const [view, setView] = useState<string>('proximas');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const meetingsQuery = useMeetings();
  const meetings = flattenInfiniteData(meetingsQuery.data?.pages);
  const meetingsTotal = getInfiniteCount(meetingsQuery.data?.pages);
  const isLoading = meetingsQuery.isLoading;
  const { data: profiles = [] } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClientsList();

  const filteredMeetings = view === 'proximas'
    ? meetings.filter(m => m.status === 'por_confirmar' || m.status === 'por_organizar' || m.status === 'confirmada')
    : meetings;

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Reuniões" />
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <ViewTabs
              views={allViews}
              activeKey={view}
              onSelect={setView}
              onAdd={(label) => addView(label)}
              onRename={(id, label) => renameView({ id, label })}
              onDelete={(id) => { if (view.startsWith('custom_')) setView('proximas'); deleteView(id); }}
            />
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Nova Reunião</Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <InlineLoader />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {view === 'proximas' ? 'Nenhuma reunião futura.' : 'Nenhuma reunião registada.'}
          </p>
        ) : (
          <InfiniteScrollList
            totalCount={meetingsTotal}
            loadedCount={meetings.length}
            hasNextPage={meetingsQuery.hasNextPage}
            isFetchingNextPage={meetingsQuery.isFetchingNextPage}
            fetchNextPage={meetingsQuery.fetchNextPage}
          >
            <div className="border rounded-lg overflow-hidden divide-y divide-border">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-primary text-xs font-medium text-primary-foreground rounded-t-lg">
                <div className="col-span-4">Reunião</div>
                <div className="col-span-3">Data / Hora</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Tipo / Contexto</div>
              </div>
              {filteredMeetings.map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/hub/reunioes/${m.id}`)}
                  className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="col-span-4 font-medium text-foreground truncate">{m.title}</div>
                  <div className="col-span-3 text-muted-foreground">
                    {format(parseISO(m.date_time), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                  </div>
                  <div className="col-span-2"><StatusBadge status={m.status} /></div>
                  <div className="col-span-3 flex items-center gap-2 text-muted-foreground truncate">
                    <MeetingTypeBadge type={m.meeting_type || 'recorrente'} />
                    <span className="truncate">
                      {m.client_name || m.project_name || (m.department ? DEPARTMENTS.find(d => d.value === m.department)?.label : '') || ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </InfiniteScrollList>
        )}
      </div>

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} profiles={profiles} projects={projects} clients={clients} />
    </AppLayout>
  );
}
