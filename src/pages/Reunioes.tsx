import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
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
import { MODULES } from '@/lib/modules';

const DEPARTMENTS = Object.entries(MODULES)
  .filter(([, v]) => v.section === 'departamentos')
  .map(([key, v]) => ({ value: key, label: v.label }));

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
  client_name: string | null;
  project_name: string | null;
  transcript_url: string | null;
  created_by: string | null;
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
      const { data, error } = await supabase.from('meetings').select('id, title, date_time, status, client_name, project_name, transcript_url, created_by').order('date_time', { ascending: false });
      if (error) throw error;
      return data as MeetingRow[];
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

// ─── New Meeting Dialog ─────────────────────────────────────────

function MeetingFormDialog({
  open, onOpenChange, profiles,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; profiles: Profile[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState<Date | undefined>();
  const [status, setStatus] = useState<MeetingStatus>('por_confirmar');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const resetForm = () => { setTitle(''); setDateTime(undefined); setStatus('por_confirmar'); setClientName(''); setProjectName(''); setDepartment(''); setSelectedMembers([]); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !dateTime) throw new Error('Nome e data/hora são obrigatórios');
      const { data, error } = await supabase.from('meetings').insert({
        title: title.trim(),
        date_time: dateTime.toISOString(),
        status,
        client_name: clientName.trim() || null,
        project_name: projectName.trim() || null,
        department: department || null,
        created_by: user?.id ?? null,
      }).select('id').single();
      if (error) throw error;
      // Insert participants
      if (selectedMembers.length > 0) {
        const rows = selectedMembers.map(pid => ({ meeting_id: data.id, profile_id: pid }));
        await supabase.from('meeting_participants').insert(rows);
      }
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Reunião criada');
      resetForm();
      onOpenChange(false);
      navigate(`/hub/reunioes/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Opcional" />
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
            <Label>Projeto associado</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Opcional" />
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'A criar...' : 'Criar reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Meetings List Page ─────────────────────────────────────────

export default function ReunioesPage() {
  const [view, setView] = useState<'proximas' | 'todas'>('proximas');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const { data: meetings = [], isLoading } = useMeetings();
  const { data: profiles = [] } = useProfiles();

  const filteredMeetings = view === 'proximas'
    ? meetings.filter(m => m.status === 'por_confirmar' || m.status === 'marcada')
    : meetings;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Reuniões</h1>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView('proximas')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors', view === 'proximas' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                <Clock className="h-4 w-4" /> Próximas
              </button>
              <button onClick={() => setView('todas')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors', view === 'todas' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                Todas
              </button>
            </div>
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
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground">
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
                  {[m.client_name, m.project_name].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} profiles={profiles} />
    </AppLayout>
  );
}
