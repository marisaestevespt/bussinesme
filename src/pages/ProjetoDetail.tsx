import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, Target, BookOpen, CalendarIcon, Link2, FileText, Users, Lightbulb, StickyNote, Plus, ChevronDown, CheckSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MentionTextarea } from '@/components/MentionTextarea';
import { PROJECT_TYPES, PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getDeptInfo, getInitials } from './Projetos';

// ─── Types ──────────────────────────────────────────────────────

interface ProjectFull {
  id: string; name: string; type: string; status: string; department: string | null;
  client_name: string | null; deadline: string | null; progress: number; notes: string | null;
  objetivo: string | null; diretrizes: string | null; cronograma: string | null; dependencias: string | null;
  entregaveis: string | null; recursos: string | null; project_notes: string | null;
  closure_good: string | null; closure_bad: string | null; closure_lessons: string | null;
  created_by: string | null; created_at: string;
}

interface Profile { id: string; user_id: string; full_name: string | null; avatar_url: string | null; }
interface Task { id: string; name: string; status: string; priority: string; deadline: string | null; assigned_to: string | null; project_id: string | null; department: string | null; }
interface Meeting { id: string; title: string; date_time: string; status: string; project_id: string | null; }

// ─── Sub-page sections for Internal project ─────────────────────

type SubPage = null | 'objetivo' | 'diretrizes' | 'cronograma' | 'dependencias' | 'entregaveis' | 'reunioes' | 'recursos' | 'notas';

const TASK_STATUSES = [
  { value: 'pendente', label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  { value: 'em_curso', label: 'Em curso', color: 'bg-blue-100 text-blue-800' },
  { value: 'concluida', label: 'Concluída', color: 'bg-green-100 text-green-800' },
];

const TASK_PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
  { value: 'media', label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800' },
];

function getPriorityInfo(v: string) { return TASK_PRIORITIES.find(p => p.value === v) || TASK_PRIORITIES[1]; }
function getTaskStatusInfo(v: string) { return TASK_STATUSES.find(s => s.value === v) || TASK_STATUSES[0]; }

// ─── Main Component ─────────────────────────────────────────────

export default function ProjetoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [subPage, setSubPage] = useState<SubPage>(null);
  const [dirty, setDirty] = useState(false);
  const [local, setLocal] = useState<ProjectFull | null>(null);

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskPriority, setTaskPriority] = useState('media');
  const [taskDeadline, setTaskDeadline] = useState<Date | undefined>();

  // Meeting dialog
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState<Date | undefined>();
  const [meetingTime, setMeetingTime] = useState('10:00');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as ProjectFull;
    },
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url'); return (data || []) as Profile[]; },
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members', id],
    queryFn: async () => { const { data } = await supabase.from('project_members').select('profile_id').eq('project_id', id!); return (data || []).map((d: any) => d.profile_id as string); },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: async () => { const { data } = await supabase.from('tasks').select('*').eq('project_id', id!).order('created_at'); return (data || []) as Task[]; },
    enabled: !!id,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['project-meetings', id],
    queryFn: async () => { const { data } = await supabase.from('meetings').select('id, title, date_time, status, project_id').eq('project_id', id!).order('date_time'); return (data || []) as Meeting[]; },
    enabled: !!id,
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  useEffect(() => { if (project && !local) setLocal(project); }, [project]);

  const updateField = (field: keyof ProjectFull, value: any) => {
    if (!local) return;
    setLocal({ ...local, [field]: value });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!local) return;
      const { error } = await supabase.from('projects').update({
        name: local.name, type: local.type, status: local.status, department: local.department,
        client_name: local.client_name, deadline: local.deadline, progress: local.progress, notes: local.notes,
        objetivo: local.objetivo, diretrizes: local.diretrizes, cronograma: local.cronograma, dependencias: local.dependencias,
        entregaveis: local.entregaveis, recursos: local.recursos, project_notes: local.project_notes,
        closure_good: local.closure_good, closure_bad: local.closure_bad, closure_lessons: local.closure_lessons,
      }).eq('id', local.id);
      if (error) throw error;
    },
    onSuccess: () => { setDirty(false); queryClient.invalidateQueries({ queryKey: ['project', id] }); toast.success('Guardado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').insert({
        name: taskName, priority: taskPriority, project_id: id,
        department: local?.department || null,
        deadline: taskDeadline ? format(taskDeadline, 'yyyy-MM-dd') : null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      toast.success('Tarefa criada');
      setTaskDialogOpen(false); setTaskName(''); setTaskPriority('media'); setTaskDeadline(undefined);
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      const dateTime = meetingDate ? new Date(`${format(meetingDate, 'yyyy-MM-dd')}T${meetingTime}`) : new Date();
      const { data: meeting, error } = await supabase.from('meetings').insert({
        title: meetingTitle, date_time: dateTime.toISOString(), project_id: id,
        project_name: local?.name || '', created_by: user?.id,
      }).select().single();
      if (error) throw error;
      // Add project members as meeting participants
      if (projectMembers.length > 0 && meeting) {
        await supabase.from('meeting_participants').insert(
          projectMembers.map(pid => ({ meeting_id: meeting.id, profile_id: pid }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-meetings', id] });
      toast.success('Reunião marcada');
      setMeetingDialogOpen(false); setMeetingTitle(''); setMeetingDate(undefined); setMeetingTime('10:00');
    },
  });

  if (isLoading || !local) return <AppLayout><div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>;

  const typeI = getTypeInfo(local.type);
  const statusI = getStatusInfo(local.status);

  // ─── Render sub-page ──────────────────────────────────────────
  if (subPage) {
    const fieldMap: Record<string, keyof ProjectFull> = {
      objetivo: 'objetivo', diretrizes: 'diretrizes', cronograma: 'cronograma',
      dependencias: 'dependencias', entregaveis: 'entregaveis', recursos: 'recursos', notas: 'project_notes',
    };
    const titleMap: Record<string, string> = {
      objetivo: 'Objetivo e Definição', diretrizes: 'Diretrizes Iniciais', cronograma: 'Cronograma Geral',
      dependencias: 'Dependências e Pré-requisitos', entregaveis: 'Entregáveis', recursos: 'Recursos', notas: 'Notas',
    };

    if (subPage === 'reunioes') {
      return (
        <AppLayout>
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSubPage(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <h2 className="text-xl font-bold">Reuniões do Projeto</h2>
            {meetings.length === 0 ? <p className="text-muted-foreground">Nenhuma reunião ligada</p> : (
              <div className="space-y-2">{meetings.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/hub/reunioes/${m.id}`)}>
                  <div><p className="font-medium text-sm">{m.title}</p><p className="text-xs text-muted-foreground">{format(new Date(m.date_time), "d MMM yyyy 'às' HH:mm", { locale: pt })}</p></div>
                  <Badge className={`${m.status === 'terminada' ? 'bg-green-100 text-green-800' : m.status === 'marcada' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'} border-0`}>{m.status === 'terminada' ? 'Terminada' : m.status === 'marcada' ? 'Marcada' : 'Por confirmar'}</Badge>
                </div>
              ))}</div>
            )}
          </div>
        </AppLayout>
      );
    }

    const field = fieldMap[subPage];
    return (
      <AppLayout>
        <div className="space-y-4 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => setSubPage(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <h2 className="text-xl font-bold">{titleMap[subPage]}</h2>
          <MentionTextarea
            value={(local[field] as string) || ''}
            onChange={v => updateField(field, v)}
            rows={12}
            placeholder="Escreve aqui... usa @ para mencionar membros"
          />
          {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
        </div>
      </AppLayout>
    );
  }

  // ─── Service project ──────────────────────────────────────────
  if (local.type === 'servico') {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/projetos')} className="gap-1"><ArrowLeft className="h-4 w-4" /> Projetos</Button>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-xl font-bold border-none px-0 focus-visible:ring-0" />
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Cliente</Label><Input value={local.client_name || ''} onChange={e => updateField('client_name', e.target.value)} /></div>
              <div><Label className="text-xs">Departamento</Label><Select value={local.department || ''} onValueChange={v => updateField('department', v)}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Prazo</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !local.deadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{local.deadline ? format(new Date(local.deadline), 'PPP', { locale: pt }) : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
              <div><Label className="text-xs">Progresso ({local.progress}%)</Label><Slider value={[local.progress]} onValueChange={v => updateField('progress', v[0])} max={100} step={5} className="mt-3" /></div>
            </div>
            <div><Label className="text-xs">Equipa</Label><div className="flex gap-1 mt-1">{projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-7 w-7"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}</div></div>
            <Separator />
            <div><Label className="text-xs">Notas</Label><MentionTextarea value={local.notes || ''} onChange={v => updateField('notes', v)} rows={6} placeholder="Notas do projeto..." /></div>
          </div>
          {dirty && <div className="sticky bottom-4"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 shadow-lg"><Save className="h-4 w-4" /> Guardar</Button></div>}
        </div>
      </AppLayout>
    );
  }

  // ─── Internal project ─────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/projetos')} className="gap-1"><ArrowLeft className="h-4 w-4" /> Projetos</Button>
          {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
            <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            {local.department && <span className="text-sm text-muted-foreground">{getDeptLabel(local.department)}</span>}
          </div>
          <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-xl font-bold border-none px-0 focus-visible:ring-0" />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Prazo:</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-7 text-xs", !local.deadline && "text-muted-foreground")}><CalendarIcon className="mr-1 h-3 w-3" />{local.deadline ? format(new Date(local.deadline), 'd MMM yyyy', { locale: pt }) : '—'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
            </div>
            <div className="flex items-center gap-2 min-w-[160px]">
              <Progress value={local.progress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{local.progress}%</span>
              <Slider value={[local.progress]} onValueChange={v => updateField('progress', v[0])} max={100} step={5} className="w-24" />
            </div>
            <div className="flex -space-x-1">{projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-6 w-6 border-2 border-background"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}</div>
          </div>
        </div>

        <Separator />

        {/* Section 1: Menu Inicial */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Menu Inicial</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'objetivo' as SubPage, icon: Target, label: 'Objetivo e Definição' },
              { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
              { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
              { key: 'dependencias' as SubPage, icon: Link2, label: 'Dependências' },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setSubPage(key)} className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Estado e Prioridades */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estado e Prioridades</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setTaskDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Tarefa</Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setMeetingDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Reunião</Button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma tarefa ligada a este projeto</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead>Tarefa</TableHead><TableHead>Data final</TableHead><TableHead>Responsável</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tasks.map(t => {
                    const si = getTaskStatusInfo(t.status);
                    const pi = getPriorityInfo(t.priority);
                    const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                    return (
                      <TableRow key={t.id}>
                        <TableCell><Badge className={`${si.color} border-0 text-[10px]`}>{si.label}</Badge></TableCell>
                        <TableCell><Badge className={`${pi.color} border-0 text-[10px]`}>{pi.label}</Badge></TableCell>
                        <TableCell className="font-medium text-sm">{t.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.deadline ? format(new Date(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                        <TableCell>{assignee ? <div className="flex items-center gap-1.5"><Avatar className="h-5 w-5"><AvatarImage src={assignee.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar><span className="text-xs">{assignee.full_name}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Section 3: Desenvolvimento */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Desenvolvimento</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'entregaveis' as SubPage, icon: FileText, label: 'Entregáveis' },
              { key: 'reunioes' as SubPage, icon: Users, label: `Reuniões (${meetings.length})` },
              { key: 'recursos' as SubPage, icon: Lightbulb, label: 'Recursos' },
              { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas' },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setSubPage(key)} className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Fecho de Projeto */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fecho de Projeto</h3>
          <div className="space-y-2">
            {[
              { field: 'closure_good' as keyof ProjectFull, label: '✅ O que funcionou bem' },
              { field: 'closure_bad' as keyof ProjectFull, label: '❌ O que não voltaria a fazer' },
              { field: 'closure_lessons' as keyof ProjectFull, label: '💡 Lições finais' },
            ].map(({ field, label }) => (
              <Collapsible key={field}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <span className="text-sm font-medium">{label}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3 pt-2">
                  <MentionTextarea
                    value={(local[field] as string) || ''}
                    onChange={v => updateField(field, v)}
                    rows={4}
                    placeholder="Escreve aqui..."
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </div>

      {/* Task dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Nome da tarefa *</Label><Input value={taskName} onChange={e => setTaskName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Prioridade</Label><Select value={taskPriority} onValueChange={setTaskPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Data final</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskDeadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{taskDeadline ? format(taskDeadline, 'd MMM', { locale: pt }) : '—'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={taskDeadline} onSelect={setTaskDeadline} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Projeto: {local.name} {local.department ? `• ${getDeptLabel(local.department)}` : ''}</p>
            <Button onClick={() => { if (!taskName.trim()) { toast.error('Nome obrigatório'); return; } createTaskMutation.mutate(); }} disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? 'A criar...' : 'Criar Tarefa'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting dialog */}
      <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Marcar Reunião</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Nome da reunião *</Label><Input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data e hora</Label>
              <div className="flex gap-2">
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !meetingDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{meetingDate ? format(meetingDate, 'd MMM yyyy', { locale: pt }) : 'Data'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={meetingDate} onSelect={setMeetingDate} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="w-24" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Projeto: {local.name} • {projectMembers.length} participante(s) adicionado(s) automaticamente</p>
            <Button onClick={() => { if (!meetingTitle.trim() || !meetingDate) { toast.error('Nome e data obrigatórios'); return; } createMeetingMutation.mutate(); }} disabled={createMeetingMutation.isPending}>{createMeetingMutation.isPending ? 'A marcar...' : 'Marcar Reunião'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
