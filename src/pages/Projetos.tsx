import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Plus, LayoutList, LayoutGrid, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MentionTextarea } from '@/components/MentionTextarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Constants ──────────────────────────────────────────────────

const PROJECT_TYPES = [
  { value: 'interno', label: 'Interno', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'servico', label: 'Serviço', color: 'bg-emerald-100 text-emerald-800' },
];

const PROJECT_STATUSES = [
  { value: 'em_ideia', label: 'Em ideia', color: 'bg-gray-100 text-gray-700' },
  { value: 'em_curso', label: 'Em curso', color: 'bg-blue-100 text-blue-800' },
  { value: 'em_pausa', label: 'Em pausa', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-purple-100 text-purple-800' },
  { value: 'concluido', label: 'Concluído', color: 'bg-green-100 text-green-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  { value: 'arquivo', label: 'Arquivo', color: 'bg-slate-100 text-slate-600' },
];

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'marketing', label: 'Marketing e Branding' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comercial', label: 'Comercial e Vendas' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'operacao', label: 'Operação' },
];

function getTypeInfo(v: string) { return PROJECT_TYPES.find(t => t.value === v) || PROJECT_TYPES[0]; }
function getStatusInfo(v: string) { return PROJECT_STATUSES.find(s => s.value === v) || PROJECT_STATUSES[0]; }
function getDeptLabel(v: string) { return DEPARTMENTS.find(d => d.value === v)?.label || v; }
function getInitials(n: string | null) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'; }

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  department: string | null;
  client_name: string | null;
  deadline: string | null;
  progress: number;
  notes: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
}

// ─── Member Picker ──────────────────────────────────────────────

function MemberPicker({ selected, onChange, profiles }: { selected: string[]; onChange: (ids: string[]) => void; profiles: Profile[] }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Membros/Responsáveis</Label>
      <ScrollArea className="max-h-32">
        <div className="space-y-1">
          {profiles.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded hover:bg-muted/50">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={c => onChange(c ? [...selected, p.id] : selected.filter(id => id !== p.id))} />
              <Avatar className="h-5 w-5"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar>
              <span className="text-sm">{p.full_name || 'Membro'}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

type ViewMode = 'table' | 'gallery' | 'calendar';

export default function ProjetosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  // Form state
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('interno');
  const [fStatus, setFStatus] = useState('em_ideia');
  const [fDept, setFDept] = useState('');
  const [fClient, setFClient] = useState('');
  const [fDeadline, setFDeadline] = useState<Date | undefined>();
  const [fMembers, setFMembers] = useState<string[]>([]);
  const [fNotes, setFNotes] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      return (data || []) as Profile[];
    },
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('*');
      return (data || []) as ProjectMember[];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      const { data: proj, error } = await supabase.from('projects').insert({
        name: fName,
        type: fType,
        status: fStatus,
        department: fDept || null,
        client_name: fClient || null,
        deadline: fDeadline ? format(fDeadline, 'yyyy-MM-dd') : null,
        notes: fNotes || null,
        created_by: user.id,
      }).select().single();
      if (error) throw error;

      if (fMembers.length > 0) {
        await supabase.from('project_members').insert(
          fMembers.map(pid => ({ project_id: proj.id, profile_id: pid }))
        );
      }
      return proj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      toast.success('Projeto criado');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() {
    setFName(''); setFType('interno'); setFStatus('em_ideia'); setFDept(''); setFClient(''); setFDeadline(undefined); setFMembers([]); setFNotes('');
    setDialogOpen(false);
  }

  function getMembersForProject(projectId: string) {
    return projectMembers.filter(pm => pm.project_id === projectId).map(pm => profileMap.get(pm.profile_id)).filter(Boolean) as Profile[];
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Projetos</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              {([['table', LayoutList], ['gallery', LayoutGrid], ['calendar', CalendarIcon]] as const).map(([v, Icon]) => (
                <Button key={v} variant={view === v ? 'default' : 'ghost'} size="sm" className="h-8 px-3" onClick={() => setView(v as ViewMode)}>
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Novo Projeto</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">Nenhum projeto registado</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Criar primeiro projeto</Button>
          </div>
        ) : (
          <>
            {view === 'table' && <TableView projects={projects} getMembersForProject={getMembersForProject} onOpen={id => navigate(`/hub/projetos/${id}`)} />}
            {view === 'gallery' && <GalleryView projects={projects} getMembersForProject={getMembersForProject} onOpen={id => navigate(`/hub/projetos/${id}`)} />}
            {view === 'calendar' && <CalendarView projects={projects} month={calMonth} onMonthChange={setCalMonth} onOpen={id => navigate(`/hub/projetos/${id}`)} />}
          </>
        )}

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); }}>
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome do projeto *</Label>
                <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Nome do projeto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={fType} onValueChange={setFType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <Select value={fDept} onValueChange={setFDept}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prazo</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fDeadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{fDeadline ? format(fDeadline, 'PPP', { locale: pt }) : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={fDeadline} onSelect={setFDeadline} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
              </div>
              {fType === 'servico' && (
                <div className="space-y-1.5">
                  <Label>Cliente associado</Label>
                  <Input value={fClient} onChange={e => setFClient(e.target.value)} placeholder="Nome do cliente" />
                </div>
              )}
              <MemberPicker selected={fMembers} onChange={setFMembers} profiles={profiles} />
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <MentionTextarea value={fNotes} onChange={setFNotes} rows={3} placeholder="Notas... usa @ para mencionar" />
              </div>
              <Button onClick={() => { if (!fName.trim()) { toast.error('Nome é obrigatório'); return; } createMutation.mutate(); }} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'A criar...' : 'Criar Projeto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// ─── Table View ─────────────────────────────────────────────────

function TableView({ projects, getMembersForProject, onOpen }: { projects: Project[]; getMembersForProject: (id: string) => Profile[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Equipa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(p => {
            const typeI = getTypeInfo(p.type);
            const statusI = getStatusInfo(p.status);
            const members = getMembersForProject(p.id);
            return (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p.id)}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge></TableCell>
                <TableCell><Badge className={`${statusI.color} border-0`}>{statusI.label}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.department ? getDeptLabel(p.department) : '—'}</TableCell>
                <TableCell className="text-sm">{p.deadline ? format(new Date(p.deadline), 'd MMM yyyy', { locale: pt }) : '—'}</TableCell>
                <TableCell><div className="flex items-center gap-2 min-w-[100px]"><Progress value={p.progress} className="h-2 flex-1" /><span className="text-xs text-muted-foreground w-8">{p.progress}%</span></div></TableCell>
                <TableCell><div className="flex -space-x-1">{members.slice(0, 3).map(m => <Avatar key={m.id} className="h-6 w-6 border-2 border-background"><AvatarImage src={m.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback></Avatar>)}{members.length > 3 && <span className="text-xs text-muted-foreground ml-1">+{members.length - 3}</span>}</div></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Gallery View ───────────────────────────────────────────────

function GalleryView({ projects, getMembersForProject, onOpen }: { projects: Project[]; getMembersForProject: (id: string) => Profile[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(p => {
        const typeI = getTypeInfo(p.type);
        const statusI = getStatusInfo(p.status);
        const members = getMembersForProject(p.id);
        return (
          <div key={p.id} className="rounded-xl border bg-card shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpen(p.id)}>
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`${typeI.color} border-0 text-[10px]`}>{typeI.label}</Badge>
              <Badge className={`${statusI.color} border-0 text-[10px]`}>{statusI.label}</Badge>
            </div>
            <h3 className="font-semibold mb-2">{p.name}</h3>
            <div className="flex items-center gap-2 mb-3">
              <Progress value={p.progress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{p.progress}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{p.deadline ? format(new Date(p.deadline), 'd MMM yyyy', { locale: pt }) : 'Sem prazo'}</span>
              <div className="flex -space-x-1">
                {members.slice(0, 4).map(m => (
                  <Avatar key={m.id} className="h-6 w-6 border-2 border-background"><AvatarImage src={m.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback></Avatar>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar View ──────────────────────────────────────────────

function CalendarView({ projects, month, onMonthChange, onOpen }: { projects: Project[]; month: Date; onMonthChange: (d: Date) => void; onOpen: (id: string) => void }) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: pt })}</h2>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
        {weekDays.map(d => <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b bg-muted/30">{d}</div>)}
        {days.map(day => {
          const dayProjects = projects.filter(p => p.deadline && isSameDay(new Date(p.deadline), day));
          return (
            <div key={day.toISOString()} className={cn("min-h-[80px] p-1 border-b border-r", !isSameMonth(day, month) && "bg-muted/20")}>
              <span className={cn("text-xs", !isSameMonth(day, month) && "text-muted-foreground/50")}>{format(day, 'd')}</span>
              <div className="space-y-0.5 mt-0.5">
                {dayProjects.slice(0, 2).map(p => {
                  const statusI = getStatusInfo(p.status);
                  return (
                    <button key={p.id} onClick={() => onOpen(p.id)} className="w-full text-left rounded px-1 py-0.5 text-[10px] truncate hover:opacity-80 transition-opacity" style={{ background: 'hsl(var(--accent))' }}>
                      <Badge className={`${statusI.color} border-0 text-[8px] mr-1 px-1 py-0`}>{statusI.label}</Badge>
                      <span className="text-[10px]">{p.name}</span>
                    </button>
                  );
                })}
                {dayProjects.length > 2 && <span className="text-[9px] text-muted-foreground pl-1">+{dayProjects.length - 2}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PROJECT_TYPES, PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getInitials };
