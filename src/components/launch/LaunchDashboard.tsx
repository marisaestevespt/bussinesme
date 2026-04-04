import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MentionTextarea } from '@/components/MentionTextarea';
import {
  Plus, CalendarIcon, Trash2, Save, Target, Rocket, BookOpen, Brain, Clock,
  Link2, Package, Users, BarChart3, FileText, ChevronLeft, ChevronRight,
  Lightbulb, MessageSquare, Star, HelpCircle, Heart, Layout, Layers, Zap,
  TrendingUp, Globe, ShoppingCart, ArrowLeft,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, endOfWeek, addDays, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────

const PHASES = [
  { value: 'estrategia', label: 'Estratégia', color: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  { value: 'antecipacao', label: 'Antecipação', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  { value: 'captacao', label: 'Captação', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  { value: 'produto_servico', label: 'Produto', color: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  { value: 'venda', label: 'Venda', color: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
  { value: 'debriefing_pos_fecho', label: 'Debriefing & Pós Fecho', color: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500' },
];

const TASK_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  { value: 'em_curso', label: 'Em curso', color: 'bg-info/10 text-info', dot: 'bg-info' },
  { value: 'concluido', label: 'Concluído', color: 'bg-success/10 text-success', dot: 'bg-success' },
  { value: 'bloqueado', label: 'Bloqueado', color: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
];

const SECTOR_AREAS = ['Copywriting', 'Design', 'Estratégia', 'Vídeo', 'Operações', 'Comercial', 'Especialista/CEO', 'Outro'];

const MATERIAL_CATEGORIES = ['Tema & Branding', 'Instagram', 'Conteúdos', 'E-mails', 'Mensagens/WhatsApp', 'Anúncios', 'Apresentações', 'Páginas', 'Automações & Funis'];

function getPhaseInfo(v: string) { return PHASES.find(p => p.value === v) || PHASES[0]; }
function getTaskStatusInfo(v: string) { return TASK_STATUSES.find(s => s.value === v) || TASK_STATUSES[0]; }
function getInitials(n: string | null) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'; }

// ─── Hooks ──────────────────────────────────────────────────────

interface Profile { id: string; full_name: string | null; avatar_url: string | null; }

function useLaunchTasks(projectId: string) {
  return useQuery({
    queryKey: ['launch-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('launch_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}

function useLaunchData(projectId: string) {
  return useQuery({
    queryKey: ['launch-data', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('launch_data')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Main Component ─────────────────────────────────────────────

interface LaunchDashboardProps {
  projectId: string;
  projectName: string;
  profiles: Profile[];
}

export function LaunchDashboard({ projectId, projectName, profiles }: LaunchDashboardProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState('visao');
  const [contentSection, setContentSection] = useState<string | null>(null);
  const tasks = useLaunchTasks(projectId);
  const launchData = useLaunchData(projectId);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Ensure launch_data record exists
  const ensureLaunchData = async () => {
    if (!launchData.data) {
      await supabase.from('launch_data').insert({ project_id: projectId });
      qc.invalidateQueries({ queryKey: ['launch-data', projectId] });
    }
  };

  return (
    <Tabs value={mainTab} onValueChange={setMainTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="visao">Visão Geral</TabsTrigger>
        <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
      </TabsList>

      <TabsContent value="visao">
        <VisaoGeralTab
          projectId={projectId}
          tasks={tasks.data || []}
          launchData={launchData.data}
          profiles={profiles}
          profileMap={profileMap}
          qc={qc}
          userId={user?.id}
          onNavigateContent={(section) => { setMainTab('conteudo'); setContentSection(section); }}
          ensureLaunchData={ensureLaunchData}
        />
      </TabsContent>

      <TabsContent value="conteudo">
        <ConteudoTab
          projectId={projectId}
          launchData={launchData.data}
          profiles={profiles}
          qc={qc}
          initialSection={contentSection}
          onClearSection={() => setContentSection(null)}
          ensureLaunchData={ensureLaunchData}
        />
      </TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISÃO GERAL TAB
// ═══════════════════════════════════════════════════════════════

function VisaoGeralTab({ projectId, tasks, launchData, profiles, profileMap, qc, userId, onNavigateContent, ensureLaunchData }: any) {
  const [taskView, setTaskView] = useState('cronograma');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Objective editing
  const [editingObj, setEditingObj] = useState(false);
  const [objText, setObjText] = useState(launchData?.objetivo_geral || '');

  const saveObjective = async () => {
    await ensureLaunchData();
    await supabase.from('launch_data').update({ objetivo_geral: objText }).eq('project_id', projectId);
    qc.invalidateQueries({ queryKey: ['launch-data', projectId] });
    setEditingObj(false);
    toast.success('Objetivo guardado');
  };

  return (
    <div className="space-y-6">
      {/* Objetivo Geral */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary mb-1">Objetivo Geral do Lançamento</p>
              {editingObj ? (
                <div className="space-y-2">
                  <MentionTextarea value={objText} onChange={setObjText} rows={3} placeholder="Define o objetivo geral..." />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveObjective}><Save className="h-3.5 w-3.5 mr-1" /> Guardar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingObj(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-foreground cursor-pointer hover:bg-primary/10 rounded px-2 py-1 -mx-2 transition-colors"
                  onClick={() => { setObjText(launchData?.objetivo_geral || ''); setEditingObj(true); }}
                >
                  {launchData?.objetivo_geral || 'Clica para definir o objetivo geral...'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Setup */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Setup</p>
          {[
            { key: 'sobre', icon: BookOpen, label: 'Sobre o Lançamento' },
            { key: 'brainstorming', icon: Brain, label: 'Brainstorming' },
            { key: 'cronograma_content', icon: CalendarIcon, label: 'Cronograma' },
          ].map(i => (
            <button key={i.key} onClick={() => onNavigateContent(i.key)} className="w-full flex items-center gap-2.5 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
              <i.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">{i.label}</span>
            </button>
          ))}
        </div>
        {/* Áreas */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Áreas</p>
          {[
            { key: 'links', icon: Link2, label: 'Links Úteis' },
            { key: 'materiais', icon: Package, label: 'Materiais & Recursos' },
            { key: 'produto', icon: Layers, label: 'Produto/Serviço' },
          ].map(i => (
            <button key={i.key} onClick={() => onNavigateContent(i.key)} className="w-full flex items-center gap-2.5 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
              <i.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">{i.label}</span>
            </button>
          ))}
        </div>
        {/* Estratégia */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estratégia</p>
          {[
            { key: 'analise_publico', icon: Users, label: 'Análise do Público' },
            { key: 'estrategia_lanc', icon: Zap, label: 'Estratégia de Lançamento' },
            { key: 'tracking', icon: BarChart3, label: 'Tracking de Resultados' },
          ].map(i => (
            <button key={i.key} onClick={() => onNavigateContent(i.key)} className="w-full flex items-center gap-2.5 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
              <i.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">{i.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Visão do Lançamento</h3>
          <Button size="sm" onClick={() => setTaskDialogOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Introduzir tarefas</Button>
        </div>

        {/* Task view tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {[
            { key: 'cronograma', label: 'Cronograma Geral' },
            { key: 'fases', label: 'Fases do Lanç.' },
            { key: 'por_data', label: 'Tarefas por data' },
            { key: 'planner', label: 'Planner Semanal' },
            { key: 'por_responsavel', label: 'Por responsável' },
          ].map(v => (
            <Button key={v.key} variant={taskView === v.key ? 'default' : 'outline'} size="sm" onClick={() => setTaskView(v.key)}>
              {v.label}
            </Button>
          ))}
        </div>

        {taskView === 'cronograma' && <CronogramaGeralView tasks={tasks} profileMap={profileMap} qc={qc} projectId={projectId} userId={userId} />}
        {taskView === 'fases' && <FasesKanbanView tasks={tasks} profileMap={profileMap} qc={qc} projectId={projectId} />}
        {taskView === 'por_data' && <TarefasPorDataView tasks={tasks} profileMap={profileMap} />}
        {taskView === 'planner' && <PlannerSemanalView tasks={tasks} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />}
        {taskView === 'por_responsavel' && <PorResponsavelView tasks={tasks} profileMap={profileMap} profiles={profiles} />}
      </div>

      {/* Task creation dialog */}
      <LaunchTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        projectId={projectId}
        profiles={profiles}
        qc={qc}
        userId={userId}
      />
    </div>
  );
}

// ─── Task Dialog ────────────────────────────────────────────────

function LaunchTaskDialog({ open, onOpenChange, projectId, profiles, qc, userId }: any) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('estrategia');
  const [responsibleId, setResponsibleId] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [sector, setSector] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create the launch task
      const { data: lt, error } = await supabase.from('launch_tasks').insert({
        project_id: projectId,
        title,
        phase: phase as any,
        responsible_id: responsibleId || null,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        sector_area: sector || null,
      } as any).select().single();
      if (error) throw error;

      // If responsible assigned, create task in main tasks table
      if (responsibleId && lt) {
        const { data: mainTask, error: taskError } = await supabase.from('tasks').insert({
          name: title,
          assigned_to: responsibleId,
          deadline: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
          tag: 'Lançamento',
          project_id: projectId,
          created_by: userId,
        }).select().single();
        if (!taskError && mainTask) {
          await supabase.from('launch_tasks').update({ task_id: mainTask.id }).eq('id', lt.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['launch-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Tarefa criada');
      onOpenChange(false);
      setTitle(''); setPhase('estrategia'); setResponsibleId(''); setDueDate(undefined); setSector('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Introduzir Tarefa de Lançamento</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5"><Label>Título *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da tarefa" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PHASES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Setor/Área</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{SECTOR_AREAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{profiles.map((p: Profile) => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'd MMM yyyy', { locale: pt }) : '—'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={() => { if (!title.trim()) { toast.error('Título obrigatório'); return; } createMutation.mutate(); }} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'A criar...' : 'Criar Tarefa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Status Inline Select ──────────────────────────────────

function TaskStatusSelect({ task, qc, projectId, userId }: any) {
  const updateStatus = async (newStatus: string) => {
    await supabase.from('launch_tasks').update({ status: newStatus as any }).eq('id', task.id);
    // Sync with main task if linked
    if (task.task_id) {
      const mainStatus = newStatus === 'concluido' ? 'done' : newStatus === 'em_curso' ? 'a_fazer' : 'por_comecar';
      await supabase.from('tasks').update({ status: mainStatus }).eq('id', task.task_id);
    }
    qc.invalidateQueries({ queryKey: ['launch-tasks', projectId] });
    qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
  };

  const info = getTaskStatusInfo(task.status);
  return (
    <Select value={task.status} onValueChange={updateStatus}>
      <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none w-auto">
        <Badge className={cn(info.color, 'border-0 text-[10px] cursor-pointer')}>{info.label}</Badge>
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map(s => (
          <SelectItem key={s.value} value={s.value}>
            <span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Cronograma Geral (grouped by phase) ────────────────────────

function CronogramaGeralView({ tasks, profileMap, qc, projectId, userId }: any) {
  return (
    <div className="space-y-4">
      {PHASES.map(phase => {
        const phaseTasks = tasks.filter((t: any) => t.phase === phase.value);
        if (phaseTasks.length === 0) return null;
        return (
          <div key={phase.value}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', phase.dot)} />
              <h4 className="text-sm font-semibold">{phase.label}</h4>
              <Badge variant="secondary" className="text-[10px]">{phaseTasks.length}</Badge>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-[140px]">Responsável</TableHead>
                  <TableHead className="w-[100px]">Data final</TableHead>
                  <TableHead className="w-[120px]">Setor/Área</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {phaseTasks.map((t: any) => {
                    const assignee = t.responsible_id ? profileMap.get(t.responsible_id) : null;
                    return (
                      <TableRow key={t.id}>
                        <TableCell onClick={e => e.stopPropagation()}><TaskStatusSelect task={t} qc={qc} projectId={projectId} userId={userId} /></TableCell>
                        <TableCell className="font-medium text-sm">{t.title}</TableCell>
                        <TableCell>
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5"><AvatarImage src={assignee.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar>
                              <span className="text-xs truncate">{assignee.full_name}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.due_date ? format(parseISO(t.due_date), 'd MMM', { locale: pt }) : '—'}</TableCell>
                        <TableCell>{t.sector_area ? <Badge variant="outline" className="text-[10px]">{t.sector_area}</Badge> : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa de lançamento criada</p>}
    </div>
  );
}

// ─── Fases Kanban ───────────────────────────────────────────────

function FasesKanbanView({ tasks, profileMap, qc, projectId }: any) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {PHASES.map(phase => {
        const phaseTasks = tasks.filter((t: any) => t.phase === phase.value);
        return (
          <div key={phase.value} className="rounded-lg border bg-muted/30 p-2 min-h-[200px]">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn('h-2 w-2 rounded-full', phase.dot)} />
              <p className="text-xs font-semibold truncate">{phase.label}</p>
              <Badge variant="secondary" className="text-[9px] ml-auto">{phaseTasks.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {phaseTasks.map((t: any) => {
                const si = getTaskStatusInfo(t.status);
                const assignee = t.responsible_id ? profileMap.get(t.responsible_id) : null;
                return (
                  <div key={t.id} className="bg-background rounded-md border p-2 space-y-1">
                    <p className="text-xs font-medium">{t.title}</p>
                    <div className="flex items-center justify-between">
                      <Badge className={cn(si.color, 'border-0 text-[9px]')}>{si.label}</Badge>
                      {assignee && <Avatar className="h-4 w-4"><AvatarImage src={assignee.avatar_url || ''} /><AvatarFallback className="text-[7px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar>}
                    </div>
                    {t.due_date && <p className="text-[9px] text-muted-foreground">{format(parseISO(t.due_date), 'd MMM', { locale: pt })}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tarefas por Data ───────────────────────────────────────────

function TarefasPorDataView({ tasks, profileMap }: any) {
  const sorted = useMemo(() =>
    [...tasks].sort((a: any, b: any) => (a.due_date || '9999') > (b.due_date || '9999') ? 1 : -1),
    [tasks]
  );
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-[120px]">Fase</TableHead>
          <TableHead className="w-[90px]">Status</TableHead>
          <TableHead>Tarefa</TableHead>
          <TableHead className="w-[100px]">Data final</TableHead>
          <TableHead className="w-[140px]">Responsável</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {sorted.map((t: any) => {
            const pi = getPhaseInfo(t.phase);
            const si = getTaskStatusInfo(t.status);
            const assignee = t.responsible_id ? profileMap.get(t.responsible_id) : null;
            return (
              <TableRow key={t.id}>
                <TableCell><Badge className={cn(pi.color, 'border-0 text-[10px]')}>{pi.label}</Badge></TableCell>
                <TableCell><Badge className={cn(si.color, 'border-0 text-[10px]')}>{si.label}</Badge></TableCell>
                <TableCell className="font-medium text-sm">{t.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.due_date ? format(parseISO(t.due_date), 'd MMM', { locale: pt }) : '—'}</TableCell>
                <TableCell>
                  {assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5"><AvatarImage src={assignee.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar>
                      <span className="text-xs truncate">{assignee.full_name}</span>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {tasks.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Sem tarefas</p>}
    </div>
  );
}

// ─── Planner Semanal ────────────────────────────────────────────

function PlannerSemanalView({ tasks, weekOffset, setWeekOffset }: any) {
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w: number) => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold min-w-[220px] text-center">
          {format(weekStart, 'd MMM', { locale: pt })} — {format(weekEnd, 'd MMM yyyy', { locale: pt })}
        </p>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w: number) => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter((t: any) => t.due_date === dayStr);
          return (
            <div key={dayStr} className={cn('min-h-[180px] rounded-lg border p-2', isToday(day) && 'border-primary bg-primary/5')}>
              <p className={cn('text-xs font-medium mb-2', isToday(day) && 'text-primary font-bold')}>
                {format(day, 'EEE d', { locale: pt })}
              </p>
              <div className="space-y-1">
                {dayTasks.map((t: any) => {
                  const pi = getPhaseInfo(t.phase);
                  return (
                    <div key={t.id} className={cn('text-[10px] px-1.5 py-1 rounded', pi.color)}>
                      {t.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Por Responsável Kanban ─────────────────────────────────────

function PorResponsavelView({ tasks, profileMap, profiles }: any) {
  const assignedProfiles = useMemo(() => {
    const ids = [...new Set(tasks.filter((t: any) => t.responsible_id).map((t: any) => t.responsible_id))];
    return ids.map((id: string) => profileMap.get(id)).filter(Boolean);
  }, [tasks, profileMap]);

  const unassigned = tasks.filter((t: any) => !t.responsible_id);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {unassigned.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-2 min-w-[220px] max-w-[260px] shrink-0">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Sem responsável</p>
          <div className="space-y-1.5">
            {unassigned.map((t: any) => {
              const si = getTaskStatusInfo(t.status);
              return (
                <div key={t.id} className="bg-background rounded-md border p-2">
                  <p className="text-xs font-medium">{t.title}</p>
                  <Badge className={cn(si.color, 'border-0 text-[9px] mt-1')}>{si.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {assignedProfiles.map((p: any) => {
        const pTasks = tasks.filter((t: any) => t.responsible_id === p.id);
        return (
          <div key={p.id} className="rounded-lg border bg-muted/30 p-2 min-w-[220px] max-w-[260px] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-5 w-5"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar>
              <p className="text-xs font-semibold truncate">{p.full_name}</p>
              <Badge variant="secondary" className="text-[9px] ml-auto">{pTasks.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {pTasks.map((t: any) => {
                const si = getTaskStatusInfo(t.status);
                return (
                  <div key={t.id} className="bg-background rounded-md border p-2">
                    <p className="text-xs font-medium">{t.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge className={cn(si.color, 'border-0 text-[9px]')}>{si.label}</Badge>
                      {t.due_date && <span className="text-[9px] text-muted-foreground">{format(parseISO(t.due_date), 'd MMM', { locale: pt })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center w-full">Sem tarefas</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTEÚDO TAB
// ═══════════════════════════════════════════════════════════════

function ConteudoTab({ projectId, launchData, profiles, qc, initialSection, onClearSection, ensureLaunchData }: any) {
  const [section, setSection] = useState<string | null>(initialSection);

  // Navigate to initial section when it changes
  useMemo(() => { if (initialSection) setSection(initialSection); }, [initialSection]);

  const saveField = async (field: string, value: any) => {
    await ensureLaunchData();
    await supabase.from('launch_data').update({ [field]: value }).eq('project_id', projectId);
    qc.invalidateQueries({ queryKey: ['launch-data', projectId] });
    toast.success('Guardado');
  };

  if (section) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSection(null); onClearSection(); }} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar ao índice
        </Button>
        {section === 'sobre' && <RichTextSection title="Sobre o Lançamento" field="sobre_lancamento" value={launchData?.sobre_lancamento} onSave={saveField} />}
        {section === 'brainstorming' && <RichTextSection title="Brainstorming" field="brainstorming" value={launchData?.brainstorming} onSave={saveField} />}
        {section === 'cronograma_content' && <CronogramaSection data={launchData} onSave={saveField} profiles={profiles} />}
        {section === 'analise_publico' && <AnalisePublicoSection data={launchData} onSave={saveField} />}
        {section === 'estrategia_lanc' && <EstrategiaSection data={launchData} onSave={saveField} />}
        {section === 'produto' && <ProdutoSection data={launchData} onSave={saveField} />}
        {section === 'materiais' && <MateriaisSection data={launchData} onSave={saveField} />}
        {section === 'links' && <LinksUteisSection data={launchData} onSave={saveField} />}
        {section === 'tracking' && <TrackingSection data={launchData} onSave={saveField} />}
      </div>
    );
  }

  // Index
  const sections = [
    { key: 'sobre', icon: BookOpen, label: 'Sobre o Lançamento' },
    { key: 'brainstorming', icon: Brain, label: 'Brainstorming' },
    { key: 'cronograma_content', icon: CalendarIcon, label: 'Cronograma' },
    { key: 'analise_publico', icon: Users, label: 'Análise do Público' },
    { key: 'estrategia_lanc', icon: Zap, label: 'Estratégia de Lançamento' },
    { key: 'produto', icon: Layers, label: 'Produto/Serviço' },
    { key: 'materiais', icon: Package, label: 'Materiais & Recursos' },
    { key: 'links', icon: Link2, label: 'Links Úteis' },
    { key: 'tracking', icon: BarChart3, label: 'Tracking de Resultados' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {sections.map(s => (
        <button key={s.key} onClick={() => setSection(s.key)} className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border overflow-hidden h-32 transition-all hover:shadow-md text-center">
          <div className="absolute inset-0 bg-primary opacity-[0.07] group-hover:opacity-[0.12] transition-opacity" />
          <s.icon className="h-7 w-7 text-primary relative z-10" />
          <span className="text-sm font-semibold text-primary relative z-10 px-3">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Rich Text Section ──────────────────────────────────────────

function RichTextSection({ title, field, value, onSave }: { title: string; field: string; value?: string; onSave: (f: string, v: any) => Promise<void> }) {
  const [content, setContent] = useState(value || '');
  const [dirty, setDirty] = useState(false);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <RichTextEditor content={content} onChange={v => { setContent(v); setDirty(true); }} />
      {dirty && <Button onClick={() => { onSave(field, content); setDirty(false); }} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
    </div>
  );
}

// ─── Cronograma Section ─────────────────────────────────────────

function CronogramaSection({ data, onSave, profiles }: any) {
  const [rows, setRows] = useState<{ marco: string; data: string; responsavel: string }[]>(
    data?.cronograma || [{ marco: '', data: '', responsavel: '' }]
  );

  const save = () => onSave('cronograma', rows);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Cronograma</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow><TableHead>Marco</TableHead><TableHead className="w-[150px]">Data</TableHead><TableHead className="w-[180px]">Responsável</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell><Input value={row.marco} onChange={e => { const r = [...rows]; r[i] = { ...r[i], marco: e.target.value }; setRows(r); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                <TableCell><Input type="date" value={row.data} onChange={e => { const r = [...rows]; r[i] = { ...r[i], data: e.target.value }; setRows(r); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                <TableCell><Input value={row.responsavel} onChange={e => { const r = [...rows]; r[i] = { ...r[i], responsavel: e.target.value }; setRows(r); }} className="border-0 focus-visible:ring-0 px-0" placeholder="Nome" /></TableCell>
                <TableCell><button onClick={() => { const r = rows.filter((_, j) => j !== i); setRows(r.length ? r : [{ marco: '', data: '', responsavel: '' }]); }} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, { marco: '', data: '', responsavel: '' }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Linha</Button>
        <Button size="sm" onClick={save} className="gap-1"><Save className="h-3.5 w-3.5" /> Guardar</Button>
      </div>
    </div>
  );
}

// ─── Análise do Público ─────────────────────────────────────────

function AnalisePublicoSection({ data, onSave }: any) {
  const [desc, setDesc] = useState(data?.analise_publico_descricao || '');
  const [dores, setDores] = useState<string[]>(data?.analise_publico_dores || []);
  const [objeccoes, setObjections] = useState<{ objeccao: string; argumento: string }[]>(data?.mapa_objeccoes || []);

  const save = async () => {
    await onSave('analise_publico_descricao', desc);
    await onSave('analise_publico_dores', dores);
    await onSave('mapa_objeccoes', objeccoes);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Análise do Público</h2>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Descrição Geral</Label>
        <MentionTextarea value={desc} onChange={setDesc} rows={4} placeholder="Descreve o público-alvo..." />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Dores / Dificuldades</Label>
        {dores.map((d, i) => (
          <div key={i} className="flex gap-2">
            <Input value={d} onChange={e => { const n = [...dores]; n[i] = e.target.value; setDores(n); }} />
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setDores(dores.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setDores([...dores, ''])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Mapa de Objeções</Label>
        <div className="rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Objeção</TableHead><TableHead>Material / Argumento</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
            <TableBody>
              {objeccoes.map((o, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={o.objeccao} onChange={e => { const n = [...objeccoes]; n[i] = { ...n[i], objeccao: e.target.value }; setObjections(n); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><Input value={o.argumento} onChange={e => { const n = [...objeccoes]; n[i] = { ...n[i], argumento: e.target.value }; setObjections(n); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><button onClick={() => setObjections(objeccoes.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setObjections([...objeccoes, { objeccao: '', argumento: '' }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Linha</Button>
      </div>

      <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Guardar Tudo</Button>
    </div>
  );
}

// ─── Estratégia de Lançamento ───────────────────────────────────

function EstrategiaSection({ data, onSave }: any) {
  const [objetivo, setObjetivo] = useState(data?.estrategia_objetivo || '');
  const [fases, setFases] = useState<{ nome: string; tarefas: string[] }[]>(data?.estrategia_macro_fases || []);
  const [pilares, setPilares] = useState<{ pilar: string; funcao: string }[]>(data?.estrategia_pilares || []);
  const [indicadores, setIndicadores] = useState<string[]>(data?.estrategia_indicadores || []);

  const save = async () => {
    await onSave('estrategia_objetivo', objetivo);
    await onSave('estrategia_macro_fases', fases);
    await onSave('estrategia_pilares', pilares);
    await onSave('estrategia_indicadores', indicadores);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Estratégia de Lançamento</h2>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Objetivo Central</Label>
        <MentionTextarea value={objetivo} onChange={setObjetivo} rows={3} placeholder="Qual é o objetivo central da estratégia?" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Macro-Fases</Label>
        {fases.map((f, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-bold text-muted-foreground shrink-0">{i + 1}.</span>
              <Input value={f.nome} onChange={e => { const n = [...fases]; n[i] = { ...n[i], nome: e.target.value }; setFases(n); }} placeholder="Nome da fase" />
              <Button variant="ghost" size="sm" onClick={() => setFases(fases.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="pl-6 space-y-1">
              {f.tarefas.map((t, ti) => (
                <div key={ti} className="flex gap-2">
                  <Input value={t} onChange={e => { const n = [...fases]; n[i].tarefas[ti] = e.target.value; setFases(n); }} placeholder="Tarefa chave" className="text-sm" />
                  <Button variant="ghost" size="sm" onClick={() => { const n = [...fases]; n[i].tarefas = n[i].tarefas.filter((_, j) => j !== ti); setFases(n); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => { const n = [...fases]; n[i].tarefas = [...n[i].tarefas, '']; setFases(n); }}>
                <Plus className="h-3 w-3" /> Tarefa
              </Button>
            </div>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={() => setFases([...fases, { nome: '', tarefas: [] }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Fase</Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Pilares da Estratégia</Label>
        <div className="rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Pilar</TableHead><TableHead>Utilidade / Função</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
            <TableBody>
              {pilares.map((p, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={p.pilar} onChange={e => { const n = [...pilares]; n[i] = { ...n[i], pilar: e.target.value }; setPilares(n); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><Input value={p.funcao} onChange={e => { const n = [...pilares]; n[i] = { ...n[i], funcao: e.target.value }; setPilares(n); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                  <TableCell><button onClick={() => setPilares(pilares.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPilares([...pilares, { pilar: '', funcao: '' }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Pilar</Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Indicadores de Sucesso</Label>
        {indicadores.map((ind, i) => (
          <div key={i} className="flex gap-2">
            <Input value={ind} onChange={e => { const n = [...indicadores]; n[i] = e.target.value; setIndicadores(n); }} />
            <Button variant="ghost" size="sm" onClick={() => setIndicadores(indicadores.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setIndicadores([...indicadores, ''])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Indicador</Button>
      </div>

      <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Guardar Tudo</Button>
    </div>
  );
}

// ─── Produto/Serviço ────────────────────────────────────────────

function ProdutoSection({ data, onSave }: any) {
  const [sub, setSub] = useState<string | null>(null);

  const cards = [
    { key: 'produto_oferta', label: 'Oferta', icon: ShoppingCart },
    { key: 'produto_por_dentro', label: 'Por Dentro', icon: Layers },
    { key: 'produto_cliente_ideal', label: 'Cliente Ideal', icon: Users },
    { key: 'produto_faqs', label: "FAQ's", icon: HelpCircle },
    { key: 'produto_feedbacks', label: 'Feedbacks', icon: Star },
  ];

  if (sub) {
    const card = cards.find(c => c.key === sub)!;
    return <RichTextSection title={card.label} field={sub} value={data?.[sub]} onSave={async (f, v) => { await onSave(f, v); }} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Produto/Serviço</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <button key={c.key} onClick={() => setSub(c.key)} className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border overflow-hidden h-28 transition-all hover:shadow-md text-center">
            <div className="absolute inset-0 bg-primary opacity-[0.07] group-hover:opacity-[0.12] transition-opacity" />
            <c.icon className="h-6 w-6 text-primary relative z-10" />
            <span className="text-xs font-semibold text-primary relative z-10">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Materiais & Recursos ───────────────────────────────────────

function MateriaisSection({ data, onSave }: any) {
  const [antecipacao, setAntecipacao] = useState<any>(data?.materiais_antecipacao || {});
  const [venda, setVenda] = useState<any>(data?.materiais_venda || {});

  const save = async () => {
    await onSave('materiais_antecipacao', antecipacao);
    await onSave('materiais_venda', venda);
  };

  const MaterialBlock = ({ title, value, onChange }: { title: string; value: any; onChange: (v: any) => void }) => (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={value.data || ''} onChange={e => onChange({ ...value, data: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Nome do evento</Label><Input value={value.nome_evento || ''} onChange={e => onChange({ ...value, nome_evento: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Landing Page</Label><Input value={value.lp || ''} onChange={e => onChange({ ...value, lp: e.target.value })} placeholder="URL" /></div>
      </div>
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground">Galeria de materiais</p>
      <div className="grid grid-cols-3 gap-2">
        {MATERIAL_CATEGORIES.map(cat => (
          <div key={cat} className="space-y-1">
            <Label className="text-[10px]">{cat}</Label>
            <MentionTextarea
              value={value[`mat_${cat}`] || ''}
              onChange={v => onChange({ ...value, [`mat_${cat}`]: v })}
              rows={2}
              placeholder="Links, notas..."
            />
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Materiais & Recursos</h2>
      <MaterialBlock title="Evento / Anúncio de Lançamento / Antecipação" value={antecipacao} onChange={setAntecipacao} />
      <MaterialBlock title="Venda do Produto/Serviço" value={venda} onChange={setVenda} />
      <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>
    </div>
  );
}

// ─── Links Úteis ────────────────────────────────────────────────

function LinksUteisSection({ data, onSave }: any) {
  const defaultLinks: { fonte: string; link: string; categoria: string }[] = [
    { fonte: '', link: '', categoria: 'geral' },
    { fonte: 'Página de Captação', link: '', categoria: 'antecipacao' },
    { fonte: 'Página de Vendas', link: '', categoria: 'venda' },
    { fonte: 'Formulário', link: '', categoria: 'venda' },
    { fonte: 'Página Obrigado', link: '', categoria: 'venda' },
    { fonte: 'Marcação de Sessões', link: '', categoria: 'venda' },
    { fonte: 'Apresentação Comercial', link: '', categoria: 'venda' },
  ];

  const [links, setLinks] = useState<{ fonte: string; link: string; categoria: string }[]>(
    data?.links_uteis?.length ? data.links_uteis : defaultLinks
  );

  const categories = [
    { value: 'geral', label: 'Geral' },
    { value: 'antecipacao', label: 'Antecipação / Captação' },
    { value: 'venda', label: 'Venda do Produto/Serviço' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Links Úteis</h2>
      {categories.map(cat => {
        const catLinks = links.filter(l => l.categoria === cat.value);
        const catIndices = links.map((l, i) => l.categoria === cat.value ? i : -1).filter(i => i >= 0);
        return (
          <div key={cat.value} className="space-y-2">
            <p className="text-sm font-semibold">{cat.label}</p>
            <div className="rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Fonte</TableHead><TableHead>Link</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
                <TableBody>
                  {catIndices.map(idx => (
                    <TableRow key={idx}>
                      <TableCell><Input value={links[idx].fonte} onChange={e => { const n = [...links]; n[idx] = { ...n[idx], fonte: e.target.value }; setLinks(n); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                      <TableCell><Input value={links[idx].link} onChange={e => { const n = [...links]; n[idx] = { ...n[idx], link: e.target.value }; setLinks(n); }} className="border-0 focus-visible:ring-0 px-0" placeholder="https://..." /></TableCell>
                      <TableCell><button onClick={() => setLinks(links.filter((_, j) => j !== idx))} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLinks([...links, { fonte: '', link: '', categoria: cat.value }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Linha</Button>
          </div>
        );
      })}
      <Button onClick={() => onSave('links_uteis', links)} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>
    </div>
  );
}

// ─── Tracking de Resultados ─────────────────────────────────────

function TrackingSection({ data, onSave }: any) {
  const [resultados, setResultados] = useState<any>(data?.tracking_resultados_globais || {});
  const [trafego, setTrafego] = useState<any[]>(data?.tracking_trafego || []);
  const [performance, setPerformance] = useState<any[]>(data?.tracking_performance_diaria || []);

  const save = async () => {
    await onSave('tracking_resultados_globais', resultados);
    await onSave('tracking_trafego', trafego);
    await onSave('tracking_performance_diaria', performance);
  };

  const resultadosFields = [
    'lancamento', 'visitantes_lp', 'leads_captadas', 'inicios_checkout', 'compras',
    'faturacao_total', 'investimento_ads', 'outros_custos', 'taxa_conversao_lp',
    'taxa_conversao_checkout', 'conversao_global', 'ticket_medio', 'receita_por_lead', 'roi',
  ];
  const resultadosLabels: Record<string, string> = {
    lancamento: 'Lançamento', visitantes_lp: 'Visitantes LP', leads_captadas: 'Leads Captadas',
    inicios_checkout: 'Inícios de Checkout', compras: 'Compras', faturacao_total: 'Faturação Total',
    investimento_ads: 'Investimento em Ads', outros_custos: 'Outros Custos',
    taxa_conversao_lp: 'Taxa Conversão LP', taxa_conversao_checkout: 'Taxa Conversão Checkout',
    conversao_global: 'Conversão Global', ticket_medio: 'Ticket Médio', receita_por_lead: 'Receita por Lead', roi: 'ROI',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Tracking de Resultados</h2>

      {/* Resultados Globais */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Resultados Globais</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {resultadosFields.map(f => (
            <div key={f} className="space-y-1">
              <Label className="text-[10px]">{resultadosLabels[f]}</Label>
              <Input value={resultados[f] || ''} onChange={e => setResultados({ ...resultados, [f]: e.target.value })} className="h-8 text-sm" />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Tráfego */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Tráfego</p>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Plataforma</TableHead><TableHead>Visitantes</TableHead><TableHead>Leads</TableHead>
              <TableHead>Compras</TableHead><TableHead>Receita</TableHead><TableHead>Conversão</TableHead>
              <TableHead>Receita/Visitante</TableHead><TableHead className="w-[40px]" />
            </TableRow></TableHeader>
            <TableBody>
              {trafego.map((r: any, i: number) => (
                <TableRow key={i}>
                  {['plataforma', 'visitantes', 'leads', 'compras', 'receita', 'conversao', 'receita_por_visitante'].map(col => (
                    <TableCell key={col}><Input value={r[col] || ''} onChange={e => { const n = [...trafego]; n[i] = { ...n[i], [col]: e.target.value }; setTrafego(n); }} className="border-0 focus-visible:ring-0 px-0 min-w-[80px]" /></TableCell>
                  ))}
                  <TableCell><button onClick={() => setTrafego(trafego.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTrafego([...trafego, {}])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Linha</Button>
      </div>

      <Separator />

      {/* Performance Diária */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Análise de Performance Diária</p>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Diário</TableHead><TableHead>Data</TableHead><TableHead>Visitas</TableHead>
              <TableHead>Leads</TableHead><TableHead>Compras</TableHead><TableHead>Receita</TableHead>
              <TableHead>Conversão</TableHead><TableHead className="w-[40px]" />
            </TableRow></TableHeader>
            <TableBody>
              {performance.map((r: any, i: number) => (
                <TableRow key={i}>
                  {['diario', 'data', 'visitas', 'leads', 'compras', 'receita', 'conversao'].map(col => (
                    <TableCell key={col}><Input type={col === 'data' ? 'date' : 'text'} value={r[col] || ''} onChange={e => { const n = [...performance]; n[i] = { ...n[i], [col]: e.target.value }; setPerformance(n); }} className="border-0 focus-visible:ring-0 px-0 min-w-[80px]" /></TableCell>
                  ))}
                  <TableCell><button onClick={() => setPerformance(performance.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPerformance([...performance, {}])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Linha</Button>
      </div>

      <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Guardar Tudo</Button>
    </div>
  );
}
