import { useState, useMemo } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { getEntityDepartments } from '@/lib/departments';
import { useNavigate } from 'react-router-dom';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Plus, LayoutList, LayoutGrid, CalendarIcon, ChevronLeft, ChevronRight, FolderKanban, Archive, ArchiveRestore, Trash2, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isTaskDone } from '@/lib/taskStatus';
import { isDeliverableDone, isPhaseDone, deliverableProgress, phaseProgress } from '@/lib/projectProgress';
import { Card, CardContent } from '@/components/ui/card';
import { MentionTextarea } from '@/components/MentionTextarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { CollectionPage, CollectionHeader } from '@/components/layout/collection';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '@/components/project/PROJECT_TEMPLATES';
import { normalizeTaskModes } from '@/hooks/useProducts';

// ─── Constants ──────────────────────────────────────────────────

const PROJECT_TYPES = [
  { value: 'interno', label: 'Interno', color: 'bg-info/15 text-info border-info' },
  { value: 'lancamento', label: 'Interno - Lançamento', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'cliente_projeto_unico', label: 'Cliente - Projeto Único', color: 'bg-success/15 text-success border-success/30' },
  { value: 'cliente_servico_mensal', label: 'Cliente - Serviço Mensal', color: 'bg-success/15 text-success border-success' },
];

import { PROJECT_STATUSES, getProjectStatusInfo } from '@/lib/projectStatus';
import { useSectorConfig } from '@/hooks/useSectorConfig';

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'marketing', label: 'Marketing e Branding', color: 'bg-accent-violet/15 text-accent-violet border-accent-violet' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'comercial', label: 'Comercial e Vendas', color: 'bg-info/15 text-info border-info' },
  { value: 'clientes', label: 'Clientes', color: 'bg-accent-violet/15 text-accent-violet border-accent-violet' },
  { value: 'equipa', label: 'Equipa', color: 'bg-success/15 text-success border-success' },
  { value: 'produtos', label: 'Produtos', color: 'bg-info/15 text-info border-info/30' },
  { value: 'operacao', label: 'Operação', color: 'bg-warning/15 text-warning border-warning/30' },
];

function getTypeInfo(v: string) { return PROJECT_TYPES.find(t => t.value === v) || PROJECT_TYPES[0]; }
function getStatusInfo(v: string) { return getProjectStatusInfo(v); }
function getDeptInfo(v: string) { return DEPARTMENTS.find(d => d.value === v); }
function getDeptLabel(v: string) { return DEPARTMENTS.find(d => d.value === v)?.label || v; }
function getInitials(n: string | null) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'; }

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  department: string | null;
  departments?: string[] | null;
  client_name: string | null;
  start_date: string | null;
  deadline: string | null;
  progress: number;
  notes: string | null;
  created_at: string;
  cover_url: string | null;
  project_mode: string | null;
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
  const { getPhotoUrl } = useTeamPhotos();
  return (
    <div className="space-y-2">
      <Label className="text-xs">Membros/Responsáveis</Label>
      <ScrollArea className="max-h-32">
        <div className="space-y-1">
          {profiles.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded hover:bg-muted/50">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={c => onChange(c ? [...selected, p.id] : selected.filter(id => id !== p.id))} />
              <Avatar className="h-5 w-5"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar>
              <span className="text-sm">{p.full_name || 'Membro'}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Status Badge with dot ──────────────────────────────────────

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const info = getStatusInfo(status);
  return (
    <Badge className={cn(`${info.color} border font-medium gap-2 whitespace-nowrap`, className)}>
      <span className={cn('h-2 w-2 rounded-full', info.dot)} />
      {info.label}
    </Badge>
  );
}

function DeptBadge({ dept }: { dept: string }) {
  const info = getDeptInfo(dept);
  if (!info) return <span className="text-sm text-muted-foreground">—</span>;
  return <Badge className={cn(`${info.color} border font-medium text-xs`)}>{info.label}</Badge>;
}

function ProjectDeptBadges({ project }: { project: Project }) {
  const depts = getEntityDepartments(project);
  if (depts.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {depts.map(d => <DeptBadge key={d} dept={d} />)}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

type ViewMode = 'table' | 'gallery' | 'calendar';

const PROJETOS_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'table', label: 'Tabela', icon: <LayoutList className="h-4 w-4" />, isDefault: true },
  { key: 'gallery', label: 'Galeria', icon: <LayoutGrid className="h-4 w-4" />, isDefault: true },
  { key: 'calendar', label: 'Calendário', icon: <CalendarIcon className="h-4 w-4" />, isDefault: true },
];

export default function ProjetosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isOwner } = useAuth();
  const sectorConfig = useSectorConfig();
  const { allViews, addView, renameView, deleteView } = useUserViews('projetos', PROJETOS_DEFAULT_VIEWS);
  const { isAreaEnabled: areaOn } = useKpiSettings();
  const [view, setView] = useState<string>('table');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  // Form state
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('interno');
  const [fStatus, setFStatus] = useState('em_ideia');
  const [fDept, setFDept] = useState('');
  const [fClient, setFClient] = useState('');
  const [fStartDate, setFStartDate] = useState<Date | undefined>();
  const [fDeadline, setFDeadline] = useState<Date | undefined>();
  const [fMembers, setFMembers] = useState<string[]>([]);
  const [fNotes, setFNotes] = useState('');
  const [fMode, setFMode] = useState('pontual');
  const [fProduct, setFProduct] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<ProjectTemplate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function openWithTemplate(tpl: ProjectTemplate) {
    setActiveTemplate(tpl);
    setFType(tpl.defaultType);
    setFMode(tpl.defaultMode);
    setFStatus(tpl.defaultStatus);
    setFDept(tpl.defaultDept || '');
    setFNotes(tpl.defaultNotes || '');
    setPickerOpen(false);
    setDialogOpen(true);
  }

  const projectsQuery = useInfiniteQuery<InfinitePageResult<Project>>({
    queryKey: ['projects', { archived: showArchived }],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase.from('projects').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      q = showArchived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { data: (data || []) as Project[], count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });
  const allProjects = flattenInfiniteData(projectsQuery.data?.pages);
  const { userDepartments } = usePermissions();
  // Restrição por departamento: membros não-Owner só veem projetos do(s) seu(s) dept, multi-dept ou sem dept
  const projects = useMemo(() => {
    if (isOwner || userDepartments.includes('admin')) return allProjects;
    const userDepts = new Set(userDepartments);
    return allProjects.filter((p: any) => {
      const depts = getEntityDepartments(p);
      if (!depts || depts.length === 0) return true; // sem dept = transversal
      return depts.some((d: string) => userDepts.has(d));
    });
  }, [allProjects, isOwner, userDepartments]);
  const projectsTotal = getInfiniteCount(projectsQuery.data?.pages);
  const isLoading = projectsQuery.isLoading;

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

  const { data: allProjectPhases = [] } = useQuery({
    queryKey: ['projects-progress-phases'],
    queryFn: async () => {
      const { data } = await supabase.from('project_phases').select('id, project_id, status, is_offboarding');
      return (data || []) as { id: string; project_id: string; status: string; is_offboarding: boolean | null }[];
    },
  });

  const { data: allProjectDeliverables = [] } = useQuery({
    queryKey: ['projects-progress-deliverables'],
    queryFn: async () => {
      const { data } = await supabase.from('project_deliverables').select('project_id, status, phase_id');
      return (data || []) as { project_id: string; status: string; phase_id: string | null }[];
    },
  });

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: monthlyTasksByProject = [] } = useQuery({
    queryKey: ['projects-monthly-tasks', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, status, project_id')
        .not('project_id', 'is', null)
        .gte('deadline', monthStart)
        .lte('deadline', monthEnd);
      return (data || []) as { id: string; status: string; project_id: string }[];
    },
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients-for-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('clients' as any).select('id,full_name,status');
      return (data || []) as unknown as { id: string; full_name: string; status: string | null }[];
    },
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products-for-project-create'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, default_project_mode, task_mode, task_modes, session_count, session_duration_minutes, product_type, sales_type, cycle_duration, estimated_project_hours, status');
      return ((data || []) as any[]).filter((p) => p.status !== 'off');
    },
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const clientStatusById = new Map(allClients.map((c: any) => [c.id, c.status as string | null]));
  const phaseById = new Map(allProjectPhases.map(p => [p.id, p]));

  function getTaskProgress(projectId: string, projectType?: string, projectMode?: string, clientId?: string | null) {
    // Only recorrente serviço mensal uses monthly tasks
    if (projectType === 'cliente_servico_mensal' && projectMode === 'recorrente') {
      const tasks = monthlyTasksByProject.filter(t => t.project_id === projectId);
      if (tasks.length === 0) return 0;
      const completed = tasks.filter(isTaskDone).length;
      return Math.round((completed / tasks.length) * 100);
    }

    // Match portal logic: exclude deliverables of Offboarding phases when the
    // client is NOT yet in offboarding/terminado — otherwise the % shown here
    // doesn't match the % shown in the client portal.
    const clientStatus = clientId ? clientStatusById.get(clientId) : null;
    const includeOffboarding = clientStatus === 'em_offboarding' || clientStatus === 'terminado';
    const projectDeliverables = allProjectDeliverables.filter(d => {
      if (d.project_id !== projectId) return false;
      if (includeOffboarding) return true;
      const ph = d.phase_id ? phaseById.get(d.phase_id) : null;
      return !(ph && ph.is_offboarding);
    });
    if (projectDeliverables.length > 0) {
      return deliverableProgress(projectDeliverables);
    }

    const projectPhases = allProjectPhases.filter(p => p.project_id === projectId && (includeOffboarding || !p.is_offboarding));
    if (projectPhases.length > 0) {
      return phaseProgress(projectPhases);
    }

    return 0;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      const selectedProduct = fProduct ? allProducts.find(p => p.id === fProduct) : null;
      const taskModes = normalizeTaskModes((selectedProduct as any)?.task_modes, selectedProduct?.task_mode);
      const { data: proj, error } = await supabase.from('projects').insert({
        name: fName,
        type: fType,
        status: fStatus,
        department: fDept || null,
        client_name: fClient || null,
        start_date: fStartDate ? format(fStartDate, 'yyyy-MM-dd') : null,
        deadline: fMode === 'recorrente' ? null : (fDeadline ? format(fDeadline, 'yyyy-MM-dd') : null),
        notes: fNotes || null,
        created_by: user.id,
        project_mode: fMode,
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || null,
        task_mode: taskModes[0],
        task_modes: taskModes,
        session_count: (selectedProduct as any)?.session_count ?? null,
        session_duration_minutes: (selectedProduct as any)?.session_duration_minutes ?? null,
        budgeted_minutes: selectedProduct?.estimated_project_hours
          ? Math.round(Number(selectedProduct.estimated_project_hours) * 60)
          : null,
      } as any).select().single();
      if (error) throw error;

      if (fMembers.length > 0) {
        await supabase.from('project_members').insert(
          fMembers.map(pid => ({ project_id: proj.id, profile_id: pid }))
        );
      }

      // Auto-clone phases, deliverables and (for recurring) cycle occurrences from product
      if (selectedProduct?.id) {
        try {
          const { data: boot, error: bootErr } = await supabase.rpc(
            'bootstrap_project_from_product',
            { _project_id: proj.id }
          );
          if (bootErr) {
            console.warn('bootstrap_project_from_product:', bootErr);
          } else if (boot && typeof boot === 'object') {
            const b: any = boot;
            const parts: string[] = [];
            if (b.phases_created) parts.push(`${b.phases_created} fase(s)`);
            if (b.deliverables_created) parts.push(`${b.deliverables_created} entrega(s)`);
            if (b.occurrences?.inserted) parts.push(`${b.occurrences.inserted} ocorrência(s)`);
            if (parts.length > 0) toast.success(`Geradas automaticamente: ${parts.join(', ')}`);
          }
        } catch (err) {
          console.warn('bootstrap_project_from_product failed:', err);
        }
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const payload: Record<string, any> = { status };
      if (status === 'concluido') {
        const { data: directTime } = await supabase.from('time_entries').select('duration').eq('project_id', projectId);
        const { data: taskIds } = await supabase.from('tasks').select('id').eq('project_id', projectId);
        let taskTime: { duration: number }[] = [];
        if (taskIds && taskIds.length > 0) {
          const { data } = await supabase.from('time_entries').select('duration').in('task_id', taskIds.map(t => t.id));
          taskTime = (data || []) as { duration: number }[];
        }
        const { data: meetingDurations } = await supabase.from('meetings').select('duration_minutes').eq('project_id', projectId);
        const meetingTime = (meetingDurations || []).reduce((sum, m) => sum + ((m as any).duration_minutes || 0), 0);
        payload.total_time_minutes = [...(directTime || []), ...taskTime].reduce((sum, e) => sum + ((e as any).duration || 0), 0) + meetingTime;
      }
      const { error } = await supabase.from('projects').update(payload as any).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').update({ archived_at: null } as any).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto restaurado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto eliminado definitivamente');
    },
    onError: (e: Error) => toast.error('Não foi possível eliminar: ' + e.message + '. Verifica se ainda existem tarefas, reuniões ou vendas associadas.'),
  });

  function resetForm() {
    setFName(''); setFType('interno'); setFStatus('em_ideia'); setFDept(''); setFClient(''); setFStartDate(undefined); setFDeadline(undefined); setFMembers([]); setFNotes(''); setFMode('pontual'); setFProduct('');
    setDialogOpen(false);
    setActiveTemplate(null);
  }

  function getMembersForProject(projectId: string) {
    return projectMembers.filter(pm => pm.project_id === projectId).map(pm => profileMap.get(pm.profile_id)).filter(Boolean) as Profile[];
  }

  return (
    <AppLayout>
      <CollectionPage>
        <CollectionHeader
          title={sectorConfig.t('projetos')}
          icon={FolderKanban}
          description={`${sectorConfig.t('projetos')} internos, lançamentos e trabalhos com clientes.`}
          count={projects.length}
          actions={
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Novo Projeto
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="end">
                <div className="px-2 pt-1 pb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Escolhe um template</div>
                <div className="space-y-1">
                  {PROJECT_TEMPLATES.map(tpl => (
                    <button key={tpl.key} onClick={() => openWithTemplate(tpl)} className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left">
                      <span className="text-lg leading-none mt-0.5">{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{tpl.label}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          }
        />

        {/* Metrics strip */}
        {(() => {
          if (!areaOn('operacao')) return null;
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          const active = projects.filter(p => p.status === 'em_curso' || p.status === 'em_revisao');
          // Compare against today at 00:00 local to avoid timezone-induced false positives
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const overdue = projects.filter(p => p.deadline && parseISO(p.deadline) < todayMidnight && p.status !== 'concluido' && p.status !== 'cancelado' && p.status !== 'arquivo');
          const completedThisMonth = projects.filter(p => {
            if (p.status !== 'concluido') return false;
            // Use deadline as proxy for completion date
            if (!p.deadline) return false;
            const d = parseISO(p.deadline);
            return d >= monthStart && d <= monthEnd;
          });
          const completed = projects.filter(p => p.status === 'concluido' && p.start_date && p.deadline);
          // Tempo médio de entrega = média dos dias planeados (start → deadline) para projetos concluídos
          const avgDays = completed.length > 0
            ? Math.round(completed.reduce((sum, p) => {
                const days = differenceInDays(parseISO(p.deadline!), parseISO(p.start_date!));
                return sum + Math.max(0, days);
              }, 0) / completed.length)
            : null;

          const metrics = [
            { label: 'Projetos em curso', value: active.length, color: 'text-foreground' },
            { label: 'Projetos em atraso', value: overdue.length, color: overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
            { label: 'Concluídos este mês', value: completedThisMonth.length, color: 'text-foreground' },
            { label: 'Tempo médio de entrega', value: avgDays !== null ? `${avgDays}d` : '—', color: 'text-foreground' },
          ];

          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map(m => (
                <Card key={m.label} className="border-secondary bg-background">
                  <CardContent className="p-4 text-center">
                    <p className={cn("text-2xl font-bold", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })()}

        <div className="flex items-center justify-between">
          <div>
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowArchived(v => !v)}
              className="gap-2"
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? 'A ver arquivados' : 'Arquivados'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ViewTabs
              views={allViews}
              activeKey={view}
              onSelect={setView}
              onAdd={(label) => addView(label)}
              onRename={(id, label) => renameView({ id, label })}
              onDelete={(id) => { if (view.startsWith('custom_')) setView('table'); deleteView(id); }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><InlineLoader /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <EmptyHint>{showArchived ? 'Nenhum projeto arquivado' : 'Nenhum projeto registado'}</EmptyHint>
            {!showArchived && (
              <Button variant="outline" className="mt-4 gap-2" onClick={() => openWithTemplate(PROJECT_TEMPLATES[0])}><Plus className="h-4 w-4" /> Criar primeiro projeto</Button>
            )}
          </div>
        ) : showArchived ? (
          <ArchivedTable
            projects={projects}
            onOpen={(id) => navigate(`/hub/projetos/${id}`)}
            onRestore={(id) => restoreMutation.mutate(id)}
            onHardDelete={(id) => hardDeleteMutation.mutate(id)}
          />
        ) : (
          <>
            {view === 'table' && <TableView projects={projects} getMembersForProject={getMembersForProject} onOpen={id => navigate(`/hub/projetos/${id}`)} onStatusChange={(id, s) => updateStatusMutation.mutate({ projectId: id, status: s })} getTaskProgress={getTaskProgress} />}
            {view === 'gallery' && <GalleryView projects={projects} getMembersForProject={getMembersForProject} onOpen={id => navigate(`/hub/projetos/${id}`)} getTaskProgress={getTaskProgress} />}
            {view === 'calendar' && <CalendarView projects={projects} month={calMonth} onMonthChange={setCalMonth} onOpen={id => navigate(`/hub/projetos/${id}`)} />}
          </>
        )}

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Projeto</DialogTitle>
              {activeTemplate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Template: {activeTemplate.emoji} {activeTemplate.label}
                </p>
              )}
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Produto associado</Label>
                <Select value={fProduct || '_none_'} onValueChange={v => {
                  const pid = v === '_none_' ? '' : v;
                  setFProduct(pid);
                  if (pid) {
                    const prod = allProducts.find(p => p.id === pid);
                    if (prod) {
                      setFMode(prod.default_project_mode || 'pontual');
                      const isRecurring = prod.default_project_mode === 'recorrente' || prod.sales_type === 'avenca_mensal' || prod.sales_type === 'subscricao';
                      setFType(isRecurring ? 'cliente_servico_mensal' : 'cliente_projeto_unico');
                    }
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Nenhum</SelectItem>
                    {allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do projeto *</Label>
                <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Nome do projeto" />
              </div>
              <div className="space-y-2">
                <Label>Modo do projeto</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFMode('pontual')} className={cn("flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left", fMode === 'pontual' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                    <span className="text-sm font-semibold">📌 Pontual</span>
                    <span className="text-[11px] text-muted-foreground">Início, meio e fim definidos</span>
                  </button>
                  <button type="button" onClick={() => setFMode('recorrente')} className={cn("flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left", fMode === 'recorrente' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                    <span className="text-sm font-semibold">🔄 Recorrente</span>
                    <span className="text-[11px] text-muted-foreground">Entregas cíclicas mensais</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={fType} onValueChange={setFType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={fStatus} onValueChange={setFStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                            {s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={fDept} onValueChange={setFDept}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d.value} value={d.value}>
                          <Badge className={cn(`${d.color} border text-xs`)}>{d.label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cliente associado</Label>
                  <Select value={fClient || '_none_'} onValueChange={v => setFClient(v === '_none_' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Nenhum</SelectItem>
                      {allClients.map(c => (
                        <SelectItem key={c.id} value={c.full_name}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className={cn("grid gap-3", fMode === 'recorrente' ? "grid-cols-1" : "grid-cols-2")}>
                <div className="space-y-2">
                  <Label>Data de Início</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{fStartDate ? format(fStartDate, 'PPP', { locale: pt }) : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={fStartDate} onSelect={setFStartDate} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
                {fMode === 'pontual' && (
                  <div className="space-y-2">
                    <Label>Data de Fim</Label>
                    <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fDeadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{fDeadline ? format(fDeadline, 'PPP', { locale: pt }) : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={fDeadline} onSelect={setFDeadline} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                  </div>
                )}
              </div>
              <MemberPicker selected={fMembers} onChange={setFMembers} profiles={profiles} />
              <div className="space-y-2">
                <Label>Notas</Label>
                <MentionTextarea value={fNotes} onChange={setFNotes} rows={3} placeholder="Notas... usa @ para mencionar" />
              </div>
              <Button onClick={() => { if (!fName.trim()) { toast.error('Nome obrigatório'); return; } createMutation.mutate(); }} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'A criar...' : 'Criar Projeto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CollectionPage>
    </AppLayout>
  );
}

// ─── Table View ─────────────────────────────────────────────────

function TableView({ projects, getMembersForProject, onOpen, onStatusChange, getTaskProgress }: { projects: Project[]; getMembersForProject: (id: string) => Profile[]; onOpen: (id: string) => void; onStatusChange: (id: string, status: string) => void; getTaskProgress: (id: string, type?: string, mode?: string | null, clientId?: string | null) => number }) {
  const { getPhotoUrl } = useTeamPhotos();
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Data Início</TableHead>
            <TableHead>Data Fim</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Equipa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(p => {
            const typeI = getTypeInfo(p.type);
            const members = getMembersForProject(p.id);
            return (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p.id)}>
                <TableCell className="whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <Select value={p.status} onValueChange={s => onStatusChange(p.id, s)}>
                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none w-auto">
                      <StatusBadge status={p.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                            {s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{p.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Badge className={`${typeI.color} border font-medium`}>{typeI.label}</Badge>
                    {p.project_mode === 'recorrente' && (
                      <Badge variant="outline" className="text-[10px] font-medium gap-1">🔄 Operacional</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell><ProjectDeptBadges project={p} /></TableCell>
                <TableCell className="text-sm whitespace-nowrap">{p.start_date ? format(new Date(p.start_date), 'd MMM yyyy', { locale: pt }) : '—'}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{p.deadline ? format(new Date(p.deadline), 'd MMM yyyy', { locale: pt }) : '—'}</TableCell>
                <TableCell><div className="flex items-center gap-2 min-w-[100px]"><Progress value={getTaskProgress(p.id, p.type, p.project_mode, (p as any).client_id)} className="h-2 flex-1" /><span className="text-xs text-muted-foreground w-8">{getTaskProgress(p.id, p.type, p.project_mode, (p as any).client_id)}%</span></div></TableCell>
                <TableCell><div className="flex -space-x-1">{members.slice(0, 3).map(m => <Avatar key={m.id} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(m)} /><AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback></Avatar>)}{members.length > 3 && <span className="text-xs text-muted-foreground ml-1">+{members.length - 3}</span>}</div></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Gallery View ───────────────────────────────────────────────

function GalleryView({ projects, getMembersForProject, onOpen, getTaskProgress }: { projects: Project[]; getMembersForProject: (id: string) => Profile[]; onOpen: (id: string) => void; getTaskProgress: (id: string, type?: string, mode?: string | null, clientId?: string | null) => number }) {
  const { getPhotoUrl } = useTeamPhotos();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(p => {
        const typeI = getTypeInfo(p.type);
        const members = getMembersForProject(p.id);
        return (
          <div key={p.id} className="rounded-xl border bg-card shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpen(p.id)}>
            {p.cover_url && (
              <div className="h-44 overflow-hidden">
                <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${typeI.color} border text-[10px] font-medium`}>{typeI.label}</Badge>
                <StatusBadge status={p.status} className="text-[10px]" />
                {p.project_mode === 'recorrente' && (
                  <Badge variant="outline" className="text-[10px] font-medium gap-1">🔄 Operacional</Badge>
                )}
              </div>
              <h3 className="font-semibold mb-1">{p.name}</h3>
              {(() => {
                const depts = getEntityDepartments(p);
                return depts.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">{depts.map(d => <DeptBadge key={d} dept={d} />)}</div>
                ) : null;
              })()}
              <div className="flex items-center gap-2 mb-3">
                <Progress value={getTaskProgress(p.id, p.type, p.project_mode)} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{getTaskProgress(p.id, p.type, p.project_mode)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {p.start_date && <div>Início: {format(new Date(p.start_date), 'd MMM', { locale: pt })}</div>}
                  {p.deadline && <div>Fim: {format(new Date(p.deadline), 'd MMM yyyy', { locale: pt })}</div>}
                  {!p.start_date && !p.deadline && <span>Sem datas</span>}
                </div>
                <div className="flex -space-x-1">
                  {members.slice(0, 4).map(m => (
                    <Avatar key={m.id} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(m)} /><AvatarFallback className="text-[8px]">{getInitials(m.full_name)}</AvatarFallback></Avatar>
                  ))}
                </div>
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
  const today = new Date();

  function getProjectsForDay(day: Date) {
    return projects.filter(p => {
      if (p.start_date && p.deadline) {
        return isWithinInterval(day, { start: parseISO(p.start_date), end: parseISO(p.deadline) });
      }
      if (p.deadline && isSameDay(parseISO(p.deadline), day)) return true;
      if (p.start_date && isSameDay(parseISO(p.start_date), day)) return true;
      return false;
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" aria-label="Anterior" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="font-semibold capitalize text-lg">{format(month, 'MMMM yyyy', { locale: pt })}</h2>
        <Button variant="ghost" aria-label="Seguinte" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7">
        {weekDays.map(d => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b bg-muted/30">{d}</div>
        ))}
        {days.map(day => {
          const dayProjects = getProjectsForDay(day);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] p-1.5 border-b border-r relative",
                !isSameMonth(day, month) && "bg-muted/20",
              )}
            >
              <span className={cn(
                "text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full",
                isToday && "bg-primary text-primary-foreground",
                !isSameMonth(day, month) && !isToday && "text-muted-foreground/40"
              )}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayProjects.slice(0, 3).map(p => {
                  const statusI = getStatusInfo(p.status);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onOpen(p.id)}
                      className="w-full text-left rounded px-1.5 py-0.5 text-[10px] truncate hover:opacity-80 transition-opacity flex items-center gap-1"
                      style={{ background: 'hsl(var(--accent))' }}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusI.dot)} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
                {dayProjects.length > 3 && (
                  <span className="text-[9px] text-muted-foreground pl-1">+{dayProjects.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PROJECT_TYPES, PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getDeptInfo, getInitials, StatusBadge, DeptBadge, ProjectDeptBadges };

function ArchivedTable({
  projects,
  onOpen,
  onRestore,
  onHardDelete,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-foreground">Projeto</TableHead>
            <TableHead className="text-foreground">Cliente</TableHead>
            <TableHead className="text-foreground w-[160px]">Arquivado em</TableHead>
            <TableHead className="text-right w-[280px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => {
            const archivedAt = (p as any).archived_at as string | null;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.client_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {archivedAt ? format(parseISO(archivedAt), "d MMM yyyy", { locale: pt }) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => onOpen(p.id)}>
                      <Eye className="h-3.5 w-3.5" /> Abrir
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => onRestore(p.id)}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar definitivamente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação é irreversível. Tudo o que está em cascata (fases, entregas, anexos, membros) será apagado. Tarefas e reuniões só serão eliminadas se não tiverem dependências externas — caso contrário o sistema impede a eliminação.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onHardDelete(p.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar para sempre
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
