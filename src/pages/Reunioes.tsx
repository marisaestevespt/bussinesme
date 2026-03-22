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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Plus, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/lib/departments';

// ─── Types ──────────────────────────────────────────────────────

type MeetingStatus = 'por_confirmar' | 'marcada' | 'terminada';

const STATUSES: { value: MeetingStatus; label: string; color: string }[] = [
  { value: 'por_confirmar', label: 'Por confirmar', color: '#f59e0b' },
  { value: 'marcada', label: 'Marcada', color: '#10b981' },
  { value: 'terminada', label: 'Terminada', color: '#6b7280' },
];

interface MeetingRow {
  id: string;
  title: string;
  date_time: string;
  status: MeetingStatus;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  department: string | null;
  transcript_url: string | null;
  created_by: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  department: string | null;
  type: string | null;
}

interface Profile {
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
  return useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select('id, title, date_time, status, client_id, client_name, project_id, project_name, transcript_url, created_by').order('date_time', { ascending: false });
      if (error) throw error;
      return data as MeetingRow[];
    },
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

function useMeetingParticipants(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_participants', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];
      const { data, error } = await supabase.from('meeting_participants').select('*').eq('meeting_id', meetingId);
      if (error) throw error;
      return data as MeetingParticipant[];
    },
    enabled: !!meetingId,
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
                <AvatarImage src={p.avatar_url ?? undefined} />
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

// ─── New Meeting Dialog ─────────────────────────────────────────

function MeetingFormDialog({
  open, onOpenChange, profiles, projects, clients,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; profiles: Profile[]; projects: ProjectOption[]; clients: { id: string; full_name: string }[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState<Date | undefined>();
  const [status, setStatus] = useState<MeetingStatus>('por_confirmar');
  const [clientId, setClientId] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [pendingClientProjects, setPendingClientProjects] = useState<ProjectOption[]>([]);

  // Suppress auto-fill side-effects during programmatic changes
  const skipAutoFillRef = useRef(false);

  const resetForm = () => {
    setTitle(''); setDateTime(undefined); setStatus('por_confirmar');
    setClientId(''); setSelectedProjectIds([]); setDepartment('');
    setSelectedMembers([]); skipAutoFillRef.current = false;
  };

  // Projects for selected client
  const clientProjects = useMemo(() => {
    if (!clientId) return [];
    return projects.filter(p => p.client_id === clientId);
  }, [clientId, projects]);

  // ─── Auto-fill: when CLIENT changes ───
  const handleClientChange = (newClientId: string) => {
    const actualId = newClientId === '__none' ? '' : newClientId;
    skipAutoFillRef.current = true;
    setClientId(actualId);

    if (actualId) {
      // Auto-set department to "clientes"
      setDepartment('clientes');

      // Find projects for this client
      const cProjects = projects.filter(p => p.client_id === actualId);
      if (cProjects.length === 1) {
        setSelectedProjectIds([cProjects[0].id]);
      } else if (cProjects.length > 1) {
        // Show picker dialog
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

  // ─── Auto-fill: when PROJECT changes (single select for quick add) ───
  const handleProjectToggle = (projId: string) => {
    const isAdding = !selectedProjectIds.includes(projId);
    const newIds = isAdding
      ? [...selectedProjectIds, projId]
      : selectedProjectIds.filter(x => x !== projId);
    setSelectedProjectIds(newIds);

    if (isAdding && !skipAutoFillRef.current) {
      const proj = projects.find(p => p.id === projId);
      if (proj) {
        // Auto-set department from project
        if (proj.department) setDepartment(proj.department);
        // Auto-set client if project has one
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
      const isClientMeeting = !!clientId;
      const { data, error } = await supabase.from('meetings').insert({
        title: title.trim(),
        date_time: dateTime.toISOString(),
        status,
        client_id: clientId || null,
        client_name: selectedClient?.full_name || null,
        project_id: primaryProjectId,
        project_name: primaryProject?.name || null,
        department: department || null,
        created_by: user?.id ?? null,
      }).select('id').single();
      if (error) throw error;

      // Insert all project links into junction table
      if (selectedProjectIds.length > 0) {
        const projRows = selectedProjectIds.map(pid => ({ meeting_id: data.id, project_id: pid }));
        await supabase.from('meeting_projects').insert(projRows);
      }

      // Insert participants
      if (selectedMembers.length > 0) {
        const rows = selectedMembers.map(pid => ({ meeting_id: data.id, profile_id: pid }));
        await supabase.from('meeting_participants').insert(rows);
      }
      // Create calendar event with appropriate type
      const { data: eventTypes } = await supabase.from('event_types')
        .select('id, slug')
        .in('slug', ['reuniao_interna', 'reuniao_cliente']);
      const typeSlug = isClientMeeting ? 'reuniao_cliente' : 'reuniao_interna';
      const eventTypeId = eventTypes?.find(t => t.slug === typeSlug)?.id ?? null;
      await supabase.from('events').insert({
        title: title.trim(),
        start_date: dateTime.toISOString(),
        event_type_id: eventTypeId,
        client_name: selectedClient?.full_name || null,
        department: department || null,
        created_by: user?.id ?? null,
      });
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Reunião criada');
      resetForm();
      onOpenChange(false);
      navigate(`/hub/reunioes/${id}`);
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
          <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
            <MemberPicker selectedIds={selectedMembers} onChange={setSelectedMembers} profiles={profiles} />
            <div>
              <Label>Cliente associado</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div>
              <Label>Projeto(s) associado(s)</Label>
              <div className="space-y-1.5 mt-1">
                {projects.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1">
                    <Checkbox
                      checked={selectedProjectIds.includes(p.id)}
                      onCheckedChange={() => handleProjectToggle(p.id)}
                    />
                    <span className="text-foreground">{p.name}</span>
                    {p.type && <span className="text-xs text-muted-foreground">({p.type})</span>}
                  </label>
                ))}
                {projects.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto disponível</p>}
              </div>
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'A criar...' : 'Criar reunião'}
            </Button>
          </div>
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

  const { data: meetings = [], isLoading } = useMeetings();
  const { data: profiles = [] } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClientsList();

  const filteredMeetings = view === 'proximas'
    ? meetings.filter(m => m.status === 'por_confirmar' || m.status === 'marcada')
    : meetings;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <BackNavigation />
        {/* Header */}
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
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {view === 'proximas' ? 'Nenhuma reunião futura.' : 'Nenhuma reunião registada.'}
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y divide-border">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-primary text-xs font-medium text-primary-foreground rounded-t-lg">
              <div className="col-span-4">Reunião</div>
              <div className="col-span-3">Data / Hora</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Cliente / Projeto</div>
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
                <div className="col-span-3 text-muted-foreground truncate">
                  {[m.department ? DEPARTMENTS.find(d => d.value === m.department)?.label : null, m.client_name, m.project_name].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} profiles={profiles} projects={projects} clients={clients} />
    </AppLayout>
  );
}
