import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, Target, BookOpen, CalendarIcon, Link2, FileText, Users, Lightbulb, StickyNote, Plus, ChevronDown, CheckSquare, Upload, Trash2, Download, File, ImageIcon, X, Clock, MessageSquare, ExternalLink, AlertTriangle, DollarSign, Check } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { useTaskTimeTotals, formatDuration } from '@/components/TaskTimeTracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isTaskDone } from '@/lib/taskStatus';
import { MentionTextarea } from '@/components/MentionTextarea';
import { LinkedSopsSection } from '@/components/LinkedSopsSection';
import { PROJECT_TYPES, PROJECT_STATUSES, DEPARTMENTS, getTypeInfo, getStatusInfo, getDeptLabel, getDeptInfo, getInitials } from './Projetos';
import { LaunchDashboard } from '@/components/launch/LaunchDashboard';
import { ProjectDeliverables } from '@/components/project/ProjectDeliverables';
import { ProjectProcessosTab } from '@/components/project/ProjectProcessosTab';
import { ProjectPhasesTimeline } from '@/components/project/ProjectPhasesTimeline';
import { ProjectGestaoTab } from '@/components/project/ProjectGestaoTab';
import { ClientPortalSection } from '@/components/client/ClientPortalSection';
import { InvoiceUpload, type DocEntry } from '@/components/financial/InvoiceUpload';
import { MeetingFormDialog } from '@/pages/Reunioes';
import type { Profile as MeetingProfile, ProjectOption } from '@/pages/Reunioes';
import { useProjectDetailData, calcTotalTime, type ProjectFull, type Profile, type Task, type Meeting } from '@/hooks/useProjectDetailData';

import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Sub-page sections for Internal project ─────────────────────

type SubPage = null | 'objetivo' | 'diretrizes' | 'cronograma' | 'dependencias' | 'entregaveis' | 'reunioes' | 'recursos' | 'notas' | 'outras_info';

const TASK_STATUSES = [
  { value: 'pendente', label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  { value: 'em_curso', label: 'Em curso', color: 'bg-info/15 text-info' },
  { value: 'concluida', label: 'Concluída', color: 'bg-success/15 text-success' },
];

const TASK_PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
  { value: 'media', label: 'Média', color: 'bg-warning/15 text-warning' },
  { value: 'alta', label: 'Alta', color: 'bg-warning/15 text-warning' },
  { value: 'urgente', label: 'Urgente', color: 'bg-destructive/15 text-destructive' },
];

function getPriorityInfo(v: string) { return TASK_PRIORITIES.find(p => p.value === v) || TASK_PRIORITIES[1]; }
function getTaskStatusInfo(v: string) { return TASK_STATUSES.find(s => s.value === v) || TASK_STATUSES[0]; }

function ProjectTimeDisplay({ taskIds }: { taskIds: string[] }) {
  const { data: totalMinutes = 0 } = useTaskTimeTotals(taskIds);
  if (totalMinutes === 0) return null;
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Clock className="h-3 w-3" /> {formatDuration(totalMinutes)} investidas
    </Badge>
  );
}

// ─── Entregáveis Sub-Page Component ─────────────────────────────

function EntregaveisSubPage({ projectId, entregaveisText, onTextChange, onSave, saving, dirty, onBack }: { projectId: string; entregaveisText: string; onTextChange: (v: string) => void; onSave: () => void; saving: boolean; dirty: boolean; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data: files = [], refetch } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('project-files').list(projectId, { sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
    },
  });

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const path = `${projectId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('project-files').upload(path, file);
        if (error) throw error;
      }
      toast.success(`${arr.length} ficheiro(s) carregado(s)`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar ficheiro');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };

  const handleDelete = async (fileName: string) => {
    const { error } = await supabase.storage.from('project-files').remove([`${projectId}/${fileName}`]);
    if (error) { toast.error(error.message); return; }
    toast.success('Ficheiro eliminado');
    refetch();
  };

  const getFileUrl = (fileName: string) => {
    const { data } = supabase.storage.from('project-files').getPublicUrl(`${projectId}/${fileName}`);
    return data.publicUrl;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
    return '📎';
  };

  const displayName = (name: string) => name.replace(/^\d+_/, '');

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <h2 className="text-xl font-bold">Entregáveis</h2>
          </div>
          <div>
            <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'A carregar...' : 'Carregar ficheiros'}
            </Button>
          </div>
        </div>

        {/* Notes / links / text area */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Notas, links e descrição dos entregáveis</Label>
          <MentionTextarea
            value={entregaveisText}
            onChange={onTextChange}
            rows={6}
            placeholder="Descreve os entregáveis, adiciona links, referências..."
          />
        </div>

        {dirty && <Button onClick={onSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}

        <Separator />

        {/* Files section */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Label className="text-xs text-muted-foreground mb-2 block">Ficheiros</Label>
          {files.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl transition-colors cursor-pointer", dragging ? "border-primary bg-primary/5" : "border-border")} onClick={() => fileInputRef.current?.click()}>
              <Upload className={cn("h-10 w-10 mb-3 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm text-muted-foreground">{dragging ? 'Larga os ficheiros aqui' : 'Arrasta ficheiros ou clica para carregar'}</p>
              <p className="text-xs text-muted-foreground mt-1">Suporta qualquer tipo de ficheiro</p>
            </div>
          ) : (
            <>
              <div className={cn("border rounded-lg divide-y divide-border mb-3", dragging && "ring-2 ring-primary")}>
              {files.map(f => (
                <div key={f.name} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 border border-border/50 transition-colors">
                  <span className="text-lg">{getFileIcon(f.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName(f.name)}</p>
                    <p className="text-xs text-muted-foreground">{f.metadata?.size ? formatFileSize(f.metadata.size) : ''} {f.created_at ? `• ${format(new Date(f.created_at), 'd MMM yyyy', { locale: pt })}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={getFileUrl(f.name)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Download className="h-4 w-4" /></Button>
                    </a>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              </div>
              {dragging && (
                <div className="flex items-center justify-center py-4 text-sm text-primary font-medium border-2 border-dashed border-primary rounded-lg bg-primary/5">
                  <Upload className="h-4 w-4 mr-2" /> Larga os ficheiros aqui
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function ProjetoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getPhotoUrl } = useTeamPhotos();

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

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Compute monthly window (used by data hook for recorrente mensal projects)
  const isServicoMensal = local?.type === 'cliente_servico_mensal';
  const isRecorrenteMensal = isServicoMensal && (local as any)?.project_mode === 'recorrente';
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  // Aggregated data hook: 11 queries + 2 mutations extraídos para reduzir 200+ linhas
  const {
    allProjectsForMeeting,
    project,
    isLoading,
    profiles,
    teamMembersPhotos,
    projectMembers,
    tasks,
    clientsList,
    projectCost,
    clientForProject,
    projectPhases,
    projectDeliverables,
    monthlyTasks,
    meetings,
    toggleMember,
    deleteMutation,
  } = useProjectDetailData(id, { isRecorrenteMensal, monthStart, monthEnd });
  const resolvedClientId = clientForProject?.id;

  function getProjectProgress() {
    // Recorrente mensal: progress by current month tasks
    if (isRecorrenteMensal) {
      if (monthlyTasks.length === 0) return 0;
      const completed = monthlyTasks.filter(isTaskDone).length;
      return Math.round((completed / monthlyTasks.length) * 100);
    }

    // All other projects: deliverables > phases
    if (projectDeliverables.length > 0) {
      const completed = projectDeliverables.filter((d: any) => d.status === 'concluido').length;
      return Math.round((completed / projectDeliverables.length) * 100);
    }

    if (projectPhases.length > 0) {
      const completed = projectPhases.filter((p: any) => p.status === 'concluida').length;
      return Math.round((completed / projectPhases.length) * 100);
    }

    return 0;
  }

  function getProjectProgressSummary() {
    if (isRecorrenteMensal) {
      if (monthlyTasks.length === 0) return 'Sem tarefas este mês';
      const completed = monthlyTasks.filter(isTaskDone).length;
      return `${completed}/${monthlyTasks.length} tarefas do mês concluídas`;
    }

    if (projectDeliverables.length > 0) {
      const completed = projectDeliverables.filter((d: any) => d.status === 'concluido').length;
      return `${completed}/${projectDeliverables.length} points concluídos`;
    }

    if (projectPhases.length > 0) {
      const completed = projectPhases.filter((p: any) => p.status === 'concluida').length;
      return `${completed}/${projectPhases.length} fases concluídas`;
    }

    return 'Sem fases ou points definidos';
  }

  const autoProgress = getProjectProgress();
  useEffect(() => {
    if (local && autoProgress !== local.progress) {
      supabase.from('projects').update({ progress: autoProgress }).eq('id', local.id);
    }
  }, [autoProgress, local?.id, local?.progress]);

  // Deadline overdue check
  const isOverdue = local?.deadline && local.status !== 'concluido' && local.status !== 'cancelado' && new Date(local.deadline) < new Date();

  const formatCost = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k €` : `${v.toFixed(0)} €`;

  const teamPhotoByProfileId = new Map(
    teamMembersPhotos
      .filter((t) => t.profile_id && t.photo_url)
      .map((t) => [t.profile_id as string, t.photo_url as string])
  );
  const teamPhotoByName = new Map(
    teamMembersPhotos
      .filter((t) => t.full_name && t.photo_url)
      .map((t) => [t.full_name.trim().toLowerCase(), t.photo_url as string])
  );
  const profileMap = new Map(
    profiles.map((p) => [
      p.id,
      {
        ...p,
        avatar_url:
          p.avatar_url ||
          teamPhotoByProfileId.get(p.id) ||
          teamPhotoByProfileId.get(p.user_id) ||
          teamPhotoByName.get((p.full_name || '').trim().toLowerCase()) ||
          null,
      },
    ])
  );

  useEffect(() => { if (project && !local) setLocal(project); }, [project]);

  const updateField = (field: keyof ProjectFull, value: any) => {
    setLocal(prev => (prev ? { ...prev, [field]: value } : prev));
    setDirty(true);
  };

  // Auto-save with debounce when dirty
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !local) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate();
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [dirty, local]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!local) return;
      const payload: Record<string, any> = {
        name: local.name, type: local.type, status: local.status, department: local.department,
        departments: local.departments,
        client_name: local.client_name, client_id: local.client_id,
        product_id: local.product_id, product_name: local.product_name,
        start_date: local.start_date, deadline: local.deadline, notes: local.notes,
        objetivo: local.objetivo, diretrizes: local.diretrizes, cronograma: local.cronograma, dependencias: local.dependencias,
        entregaveis: local.entregaveis, recursos: local.recursos, project_notes: local.project_notes,
        closure_good: local.closure_good, closure_bad: local.closure_bad, closure_lessons: local.closure_lessons,
        cover_url: local.cover_url, contract_documents: local.contract_documents || [],
        payment_method: local.payment_method || null, payment_config: local.payment_config || null,
        project_mode: (local as any).project_mode || 'pontual',
        task_mode: (local as any).task_mode || 'fases',
      };
      // Auto-calculate total time when marking as concluded
      if (local.status === 'concluido' && project?.status !== 'concluido') {
        payload.total_time_minutes = await calcTotalTime(local.id);
      }
      const { error } = await supabase.from('projects').update(payload as any).eq('id', local.id);
      if (error) throw error;
    },
    onSuccess: () => { setDirty(false); queryClient.invalidateQueries({ queryKey: ['project', id] }); toast.success('Guardado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `covers/${id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('project-files').upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from('project-files').getPublicUrl(path);
    updateField('cover_url', data.publicUrl);
    // Auto-save cover
    await supabase.from('projects').update({ cover_url: data.publicUrl }).eq('id', id!);
    queryClient.invalidateQueries({ queryKey: ['project', id] });
    toast.success('Capa atualizada');
  };

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

  const generateMonthlyTasksMutation = useMutation({
    mutationFn: async () => {
      if (!local?.product_id) { toast.error('Sem produto associado — não é possível gerar tarefas.'); throw new Error('no product'); }
      const now = new Date();
      const monthLabel = format(now, 'MMMM yyyy', { locale: pt });
      // Get product deliverable templates
      const { data: templates } = await (supabase as any).from('product_deliverables').select('name, description, sort_order').eq('product_id', local.product_id).order('sort_order');
      if (!templates || templates.length === 0) { toast.error('Sem entregáveis configurados no produto.'); throw new Error('no templates'); }
      // Check if already generated this month
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const { data: existing } = await supabase.from('tasks').select('id').eq('project_id', id!).gte('deadline', monthStart).lte('deadline', monthEnd);
      if (existing && existing.length > 0) { toast.info(`Já existem ${existing.length} tarefas este mês.`); return; }
      // Create tasks
      const lastDay = format(endOfMonth(now), 'yyyy-MM-dd');
      const tasksToInsert = templates.map((t: any) => ({
        name: t.name,
        notes: t.description || null,
        project_id: id,
        department: local?.department || null,
        deadline: lastDay,
        created_by: user?.id,
        priority: 'media',
      }));
      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', id] });
      toast.success('Tarefas do mês geradas com sucesso!');
    },
  });

  if (isLoading || !local) return <AppLayout><div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-lg bg-muted" /></div><div className="h-64 animate-pulse rounded-lg bg-muted" /></div></AppLayout>;

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

  // ─── Cronograma sub-page (table with Macro + Prazo) ──────────
  if (subPage === 'cronograma') {
    // Parse cronograma JSON or init empty rows
    let rows: { macro: string; prazo: string }[] = [];
    try { rows = local.cronograma ? JSON.parse(local.cronograma) : []; } catch { rows = []; }
    if (rows.length === 0) rows = [{ macro: '', prazo: '' }];

    const updateRows = (newRows: { macro: string; prazo: string }[]) => {
      updateField('cronograma', JSON.stringify(newRows));
    };

    return (
      <AppLayout>
        <div className="space-y-4 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => setSubPage(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <h2 className="text-xl font-bold">Cronograma Geral</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Macro</TableHead><TableHead className="w-[180px]">Prazo</TableHead><TableHead className="w-[40px]" /></TableRow></TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={row.macro} onChange={e => { const r = [...rows]; r[i] = { ...r[i], macro: e.target.value }; updateRows(r); }} placeholder="Ex: Fase de pesquisa" className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                    <TableCell><Input type="date" value={row.prazo} onChange={e => { const r = [...rows]; r[i] = { ...r[i], prazo: e.target.value }; updateRows(r); }} className="border-0 focus-visible:ring-0 px-0" /></TableCell>
                    <TableCell><button onClick={() => { const r = rows.filter((_, j) => j !== i); updateRows(r.length ? r : [{ macro: '', prazo: '' }]); }} className="text-muted-foreground hover:text-destructive text-xs">✕</button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" size="sm" onClick={() => updateRows([...rows, { macro: '', prazo: '' }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar linha</Button>
          {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
        </div>
      </AppLayout>
    );
  }
  // ─── Outras Informações sub-page ────────────────────────────────
  if (subPage === 'outras_info') {
    return (
      <AppLayout>
        <div className="space-y-4 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => setSubPage(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <h2 className="text-xl font-bold">Outras Informações</h2>
          <MentionTextarea
            value={(local.project_notes as string) || ''}
            onChange={v => updateField('project_notes', v)}
            rows={12}
            placeholder="Informações adicionais sobre o projeto..."
          />
          {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
        </div>
      </AppLayout>
    );
  }

  // ─── Reuniões sub-page (table view like Reunioes page) ────────
  if (subPage === 'reunioes') {
    const MEETING_STATUSES = [
      { value: 'por_organizar', label: 'Por organizar', color: '#3b82f6' },
      { value: 'por_confirmar', label: 'Por confirmar', color: '#f59e0b' },
      { value: 'confirmada', label: 'Confirmada', color: '#22c55e' },
      { value: 'realizada', label: 'Realizada', color: '#8b5cf6' },
      { value: 'terminada', label: 'Terminada', color: '#6b7280' },
      { value: 'cancelada', label: 'Cancelada', color: '#ef4444' },
    ];
    const getMeetingStatusInfo = (s: string) => MEETING_STATUSES.find(x => x.value === s) || MEETING_STATUSES[0];

    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSubPage(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <h2 className="text-xl font-bold">Reuniões do Projeto</h2>
            </div>
            <Button size="sm" onClick={() => setMeetingDialogOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova Reunião</Button>
          </div>
          {meetings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhuma reunião ligada a este projeto.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y divide-border">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground">
                <div className="col-span-4">Reunião</div>
                <div className="col-span-3">Data / Hora</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Participantes</div>
              </div>
              {meetings.map(m => {
                const ms = getMeetingStatusInfo(m.status);
                return (
                  <button key={m.id} onClick={() => navigate(`/hub/reunioes/${m.id}`)} className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm">
                    <div className="col-span-4 font-medium text-foreground truncate">{m.title}</div>
                    <div className="col-span-3 text-muted-foreground">{format(new Date(m.date_time), "dd MMM yyyy 'às' HH:mm", { locale: pt })}</div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${ms.color}20`, color: ms.color }}>{ms.label}</span>
                    </div>
                    <div className="col-span-3">
                      <div className="flex -space-x-1">{projectMembers.slice(0, 5).map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}{projectMembers.length > 5 && <span className="text-xs text-muted-foreground ml-2">+{projectMembers.length - 5}</span>}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ─── Entregáveis sub-page (file upload + list) ────────────────
  if (subPage === 'entregaveis') {
    return <EntregaveisSubPage projectId={id!} entregaveisText={local.entregaveis || ''} onTextChange={v => updateField('entregaveis', v)} onSave={() => saveMutation.mutate()} saving={saveMutation.isPending} dirty={dirty} onBack={() => setSubPage(null)} />;
  }

    const field = fieldMap[subPage];
    if (!field) return null;
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

  // ─── Launch project ────────────────────────────────────────────
  if (local.type === 'lancamento') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation />
            {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
          </div>

          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
              {local.department && <span className="text-sm text-muted-foreground">{getDeptLabel(local.department)}</span>}
            </div>
            <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Prazo:</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("h-7 text-xs", !local.deadline && "text-muted-foreground")}><CalendarIcon className="mr-1 h-3 w-3" />{local.deadline ? format(new Date(local.deadline), 'd MMM yyyy', { locale: pt }) : '—'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
              <div className="flex -space-x-1">{projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-6 w-6 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[8px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}</div>
            </div>
          </div>

          <Separator />

          {/* Launch Dashboard */}
          <LaunchDashboard projectId={id!} projectName={local.name} profiles={profiles} />

          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5"><Trash2 className="h-4 w-4" /> Eliminar projeto</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar projeto?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    );
  }

  // ─── Client project (cliente_projeto_unico or cliente_servico_mensal) ──
  if (local.type === 'servico' || local.type === 'cliente_servico_mensal' || local.type === 'cliente_projeto_unico' || local.type === 'clientes') {
    const isRecorrente = (local as any).project_mode === 'recorrente';
    const taskMode: string = (local as any).task_mode || 'fases';
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation />
            <div className="flex items-center gap-2">
              {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
            </div>
          </div>

          {/* Cover image */}
          {local.cover_url ? (
            <div className="relative rounded-xl overflow-hidden h-48 group">
              <img src={local.cover_url} alt="Capa" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <label className="cursor-pointer"><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" /><Button variant="secondary" size="sm" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Alterar</Button></label>
                <Button variant="secondary" size="sm" className="gap-1.5 ml-2" onClick={() => { updateField('cover_url', null); supabase.from('projects').update({ cover_url: null }).eq('id', id!); }}><X className="h-3.5 w-3.5" /> Remover</Button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/60 border border-border/50 transition-colors">
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              <div className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-5 w-5" /><span className="text-sm">Adicionar capa</span></div>
            </label>
          )}

          {/* Deadline overdue banner */}
          {isOverdue && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                A deadline deste projeto ({format(new Date(local.deadline!), 'd MMM yyyy', { locale: pt })}) já passou. Atualiza o prazo ou conclui o projeto.
              </AlertDescription>
            </Alert>
          )}

          {/* Header - Name first, then tags, then fields in single column */}
          {/* Project title */}
          <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />

          {/* Notion-style property rows */}
          <div className="space-y-1">
            {/* Status */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Target className="h-4 w-4" /> Status</span>
              <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            {/* Tipo */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><FileText className="h-4 w-4" /> Tipo</span>
              <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
            </div>
            {/* Modo */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><FileText className="h-4 w-4" /> Modo</span>
              <Select value={(local as any).project_mode || 'pontual'} onValueChange={v => updateField('project_mode', v)}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pontual">Pontual</SelectItem>
                  <SelectItem value="recorrente">🔄 Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Modo Operacional */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><CheckSquare className="h-4 w-4" /> Operação</span>
              <Select value={taskMode} onValueChange={v => updateField('task_mode', v)}>
                <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fases">📊 Fases e Entregáveis</SelectItem>
                  <SelectItem value="tarefas_fixas">📋 Tarefas Fixas Mensais</SelectItem>
                  <SelectItem value="tarefas_livres">✏️ Tarefas Livres</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Progresso */}
            {taskMode !== 'tarefas_livres' && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Target className="h-4 w-4" /> {isRecorrenteMensal ? `Progresso de ${format(now, 'MMMM', { locale: pt })}` : 'Progresso'}</span>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={getProjectProgress()} className="h-2 max-w-xs" />
                  <span className="text-sm font-medium">{getProjectProgress()}%</span>
                  <span className="text-xs text-muted-foreground">{getProjectProgressSummary()}</span>
                </div>
              </div>
            )}
            {/* Cliente */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Users className="h-4 w-4" /> Cliente</span>
              <Select value={local.client_id || ''} onValueChange={v => {
                const selected = clientsList.find((c: any) => c.id === v);
                updateField('client_id', v || null);
                updateField('client_name', selected?.full_name || null);
              }}>
                <SelectTrigger className="w-64 h-8"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientsList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Departamentos */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-0.5"><BookOpen className="h-4 w-4" /> Departamentos</span>
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto min-h-[32px] w-full justify-start text-left font-normal py-1.5 border-0 bg-transparent hover:bg-muted/40">
                      {(() => {
                        const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                        if (depts.length === 0) return <span className="text-muted-foreground text-xs">Selecionar departamentos…</span>;
                        return <div className="flex flex-wrap gap-1">{depts.map(v => { const d = DEPARTMENTS.find(x => x.value === v); return d ? <Badge key={v} variant="secondary" className="text-xs">{d.label}</Badge> : null; })}</div>;
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="start">
                    <div className="space-y-1">
                      {DEPARTMENTS.map(d => {
                        const depts: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                        const active = depts.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => {
                              const current: string[] = (local.departments as string[]) || (local.department ? [local.department] : []);
                              const next = active ? current.filter(v => v !== d.value) : [...current, d.value];
                              updateField('departments', next);
                              updateField('department', next[0] || null);
                            }}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
                              active ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                            )}
                          >
                            <div className={cn("h-4 w-4 rounded border flex items-center justify-center", active ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                              {active && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Membros */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Users className="h-4 w-4" /> Membros</span>
              <button type="button" onClick={() => setMembersDialogOpen(true)} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <div className="flex -space-x-1">
                  {projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-7 w-7 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}
                </div>
                <div className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            </div>
            {/* Produto */}
            {local.product_name && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><Lightbulb className="h-4 w-4" /> Produto</span>
                <Badge className="bg-accent text-accent-foreground border-0">{local.product_name}</Badge>
              </div>
            )}
            {/* Datas */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><CalendarIcon className="h-4 w-4" /> Datas</span>
              <div className="flex items-center gap-2">
                <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("h-7 text-xs px-2", !local.start_date && "text-muted-foreground")}>{local.start_date ? format(new Date(local.start_date), 'd MMM yyyy', { locale: pt }) : 'Início'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.start_date ? new Date(local.start_date) : undefined} onSelect={d => updateField('start_date', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                <span className="text-muted-foreground">→</span>
                <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("h-7 text-xs px-2", !local.deadline && "text-muted-foreground")}>{local.deadline ? format(new Date(local.deadline), 'd MMM yyyy', { locale: pt }) : 'Prazo'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
            </div>
            {/* WhatsApp */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><MessageSquare className="h-4 w-4" /> WhatsApp</span>
              <div className="flex items-center gap-2 flex-1">
                <Input value={(local as any).whatsapp_group_url || ''} onChange={e => updateField('whatsapp_group_url', e.target.value)} placeholder="https://chat.whatsapp.com/..." className="h-8 text-sm max-w-sm" />
                {(local as any).whatsapp_group_url && (
                  <a href={(local as any).whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            {/* Contrato */}
            <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
              <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0 pt-1"><FileText className="h-4 w-4" /> Contrato</span>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {((local.contract_documents as DocEntry[]) || []).map((doc, i) => {
                  const isPdf = doc.name?.toLowerCase().endsWith('.pdf');
                  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.name || '');
                  return (
                    <div key={i} className="group relative rounded-lg border bg-muted/60 border border-border/50 hover:bg-muted/60 transition-colors w-48 overflow-hidden">
                      {isImage ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block h-28 overflow-hidden">
                          <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-28 bg-muted/50">
                          <span className="text-4xl">{isPdf ? '📄' : '📎'}</span>
                        </a>
                      )}
                      <div className="px-2.5 py-2 flex items-center gap-1.5">
                        <span className="text-xs truncate flex-1 font-medium">{doc.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); const docs = ((local.contract_documents as DocEntry[]) || []).filter((_, j) => j !== i); updateField('contract_documents', docs); }}
                          className="text-destructive/60 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Small upload button */}
                <label className="flex flex-col items-center justify-center w-48 h-[148px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer transition-colors">
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop();
                    const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error } = await supabase.storage.from('financial-files').upload(path, file);
                    if (error) { toast.error('Erro ao carregar'); return; }
                    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
                    updateField('contract_documents', [...((local.contract_documents as DocEntry[]) || []), { name: file.name, url: urlData.publicUrl }]);
                    e.target.value = '';
                  }} />
                  <Upload className="h-5 w-5 text-muted-foreground mb-1.5" />
                  <span className="text-xs text-muted-foreground">Carregar</span>
                </label>
              </div>
            </div>
            {/* Custo */}
            {projectCost > 0 && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/60 border border-border/50">
                <span className="flex items-center gap-2 text-sm text-muted-foreground w-40 shrink-0"><DollarSign className="h-4 w-4" /> Custo</span>
                <span className="text-sm font-medium">{formatCost(projectCost)}</span>
              </div>
            )}
          </div>


          {/* ─── 3 Tabs ──────────────────────────────────────── */}
          <div className="mt-6">
          <Tabs defaultValue="projeto" className="w-full">
            <TabsList className="bg-transparent w-full gap-2 border-b rounded-none pb-0 h-auto">
              <TabsTrigger value="projeto" className="flex-1 rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Projeto</TabsTrigger>
              <TabsTrigger value="processos" className="flex-1 rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Processos</TabsTrigger>
              <TabsTrigger value="gestao" className="flex-1 rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Gestão</TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: PROJETO ──────────────────────────── */}
            <TabsContent value="projeto" className="space-y-8 mt-6">
              {/* Deliverables (only for fases recorrente) */}
              {isRecorrente && taskMode === 'fases' && <ProjectDeliverables projectId={id!} profiles={profiles} />}

              {/* ── Section: Menu Inicial ─────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Target className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Menu Inicial</h3>
                </div>
                <div className={cn("grid gap-3", local.type === 'cliente_servico_mensal' ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
                  {(local.type === 'cliente_servico_mensal' ? [
                    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
                    { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
                    { key: 'outras_info' as SubPage, icon: StickyNote, label: 'Outras Informações' },
                  ] : [
                    { key: 'objetivo' as SubPage, icon: Target, label: 'Objetivo e Definição' },
                    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
                    { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
                    { key: 'dependencias' as SubPage, icon: Link2, label: 'Dependências' },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border/60 overflow-hidden h-36 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 text-center bg-card">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 group-hover:from-primary/10 group-hover:to-primary/15 transition-all" />
                      <div className="rounded-full bg-primary/15 p-3 relative z-10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground relative z-10 px-3">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Section: Desenvolvimento ──────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                  <FileText className="h-4.5 w-4.5 text-primary" />
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Desenvolvimento</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'entregaveis' as SubPage, icon: FileText, label: 'Entregáveis' },
                    { key: 'reunioes' as SubPage, icon: Users, label: `Reuniões (${meetings.length})` },
                    { key: 'recursos' as SubPage, icon: Lightbulb, label: 'Recursos' },
                    { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border/60 overflow-hidden h-36 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 text-center bg-card">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 group-hover:from-primary/10 group-hover:to-primary/15 transition-all" />
                      <div className="rounded-full bg-primary/12 p-3 relative z-10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground relative z-10 px-3">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Section: Estado e Prioridades (moved after Desenvolvimento) ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-info/10 border border-info/20 flex-1">
                    <CheckSquare className="h-4.5 w-4.5 text-info" />
                    <h3 className="text-sm font-bold text-info uppercase tracking-wide">{taskMode === 'tarefas_fixas' ? 'Tarefas do Mês' : taskMode === 'tarefas_livres' ? 'Tarefas' : 'Estado e Prioridades'}</h3>
                    <ProjectTimeDisplay taskIds={tasks.map(t => t.id)} />
                  </div>
                  <div className="flex gap-2 ml-3">
                    {taskMode === 'tarefas_fixas' && <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => generateMonthlyTasksMutation.mutate()}>📋 Gerar tarefas do mês</Button>}
                    <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => setTaskDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Tarefa</Button>
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
                    <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">{taskMode === 'tarefas_fixas' ? 'Usa o botão "Gerar tarefas" para criar as tarefas deste mês.' : taskMode === 'tarefas_livres' ? 'Adiciona tarefas conforme necessário.' : 'Nenhuma tarefa ligada a este projeto'}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader><TableRow className="bg-muted/60">
                        <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Prioridade</TableHead><TableHead className="font-semibold">Tarefa</TableHead><TableHead className="font-semibold">Data final</TableHead><TableHead className="font-semibold">Responsável</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {tasks.map(t => {
                          const si = getTaskStatusInfo(t.status);
                          const pi = getPriorityInfo(t.priority);
                          const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                          return (
                            <TableRow key={t.id} className="hover:bg-muted/30">
                              <TableCell><Badge className={`${si.color} border-0 text-[10px]`}>{si.label}</Badge></TableCell>
                              <TableCell><Badge className={`${pi.color} border-0 text-[10px]`}>{pi.label}</Badge></TableCell>
                              <TableCell className="font-medium text-sm">{t.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.deadline ? format(new Date(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                              <TableCell>{assignee ? <div className="flex items-center gap-1.5"><Avatar className="h-5 w-5"><AvatarImage src={getPhotoUrl(assignee)} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar><span className="text-xs">{assignee.full_name}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* ── Section: Portal de Cliente ────────────── */}
              {resolvedClientId && local.client_name && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-success/10 border border-success/20">
                    <Users className="h-4.5 w-4.5 text-success" />
                    <h3 className="text-sm font-bold text-success uppercase tracking-wide">Portal do Cliente</h3>
                  </div>
                  <ClientPortalSection
                    clientId={resolvedClientId}
                    clientName={local.client_name}
                    currentProduct={local.product_name || null}
                    productId={local.product_id}
                  />
                </div>
              )}

              {/* ── Section: Fecho de Projeto ────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border">
                  <Target className="h-4.5 w-4.5 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Fecho de Projeto</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { field: 'closure_good' as keyof ProjectFull, label: '✅ O que funcionou bem' },
                    { field: 'closure_bad' as keyof ProjectFull, label: '❌ O que não voltaria a fazer' },
                    { field: 'closure_lessons' as keyof ProjectFull, label: '💡 Lições finais' },
                  ].map(({ field, label }) => (
                    <Collapsible key={field}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full p-3.5 rounded-xl border-2 border-border/60 bg-card hover:bg-muted/40 transition-colors">
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
            </TabsContent>

            {/* ─── TAB 2: PROCESSOS ────────────────────────── */}
            <TabsContent value="processos" className="mt-4 space-y-6">
              {taskMode === 'fases' && <ProjectPhasesTimeline projectId={id!} projectStartDate={local.start_date} />}
              <ProjectProcessosTab
                projectId={id!}
                clientId={resolvedClientId}
                productId={local.product_id}
                projectStartDate={local.start_date}
              />
            </TabsContent>

            {/* ─── TAB 3: GESTÃO ───────────────────────────── */}
            <TabsContent value="gestao" className="mt-4">
              <ProjectGestaoTab
                projectId={id!}
                projectName={local.name}
                clientName={local.client_name}
                clientId={resolvedClientId}
                productName={local.product_name || null}
                startDate={local.start_date}
                deadline={local.deadline}
                projectPaymentMethod={local.payment_method}
                projectPaymentConfig={local.payment_config}
                onNewMeeting={() => setMeetingDialogOpen(true)}
                onUpdateProject={(field, value) => updateField(field as keyof ProjectFull, value)}
              />
            </TabsContent>
          </Tabs>
          </div>

          {dirty && <div className="sticky bottom-4"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 shadow-lg"><Save className="h-4 w-4" /> Guardar</Button></div>}
          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5"><Trash2 className="h-4 w-4" /> Eliminar projeto</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar projeto?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível. Todos os dados do projeto serão eliminados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Meeting dialog — full form */}
        <MeetingFormDialog
          open={meetingDialogOpen}
          onOpenChange={setMeetingDialogOpen}
          profiles={profiles as MeetingProfile[]}
          projects={allProjectsForMeeting}
          clients={clientsList}
          defaultClientId={local.client_id || undefined}
          defaultClientName={local.client_name || undefined}
          defaultProjectId={id}
          defaultProjectName={local.name}
        />

        {/* Task dialog */}
        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5"><Label>Nome da tarefa *</Label><Input value={taskName} onChange={e => setTaskName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Prioridade</Label>
                  <Select value={taskPriority} onValueChange={setTaskPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label>Data final</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskDeadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{taskDeadline ? format(taskDeadline, 'd MMM yyyy', { locale: pt }) : 'Data'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={taskDeadline} onSelect={setTaskDeadline} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Projeto: {local.name} {local.department ? `• ${getDeptLabel(local.department)}` : ''}</p>
              <Button onClick={() => { if (!taskName.trim()) { toast.error('Nome obrigatório'); return; } createTaskMutation.mutate(); }} disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? 'A criar...' : 'Criar Tarefa'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Members dialog */}
        <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Equipa do Projeto</DialogTitle></DialogHeader>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {profiles.map(p => {
                const resolvedProfile = profileMap.get(p.id) ?? p;
                const isMember = projectMembers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMember.mutate(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isMember ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={getPhotoUrl(resolvedProfile)} />
                      <AvatarFallback className="text-[9px]">{getInitials(resolvedProfile.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left">{resolvedProfile.full_name || 'Sem nome'}</span>
                    {isMember && <CheckSquare className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // ─── Internal project ─────────────────────────────────────────
  const isRecorrente = (local as any).project_mode === 'recorrente';
  const taskMode: string = (local as any).task_mode || 'fases';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <BackNavigation />
          {dirty && <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}
        </div>

        {/* Cover image */}
        {local.cover_url ? (
          <div className="relative rounded-xl overflow-hidden h-48 group">
            <img src={local.cover_url} alt="Capa" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <label className="cursor-pointer"><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" /><Button variant="secondary" size="sm" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Alterar</Button></label>
              <Button variant="secondary" size="sm" className="gap-1.5 ml-2" onClick={() => { updateField('cover_url', null); supabase.from('projects').update({ cover_url: null }).eq('id', id!); }}><X className="h-3.5 w-3.5" /> Remover</Button>
            </div>
          </div>
        ) : (
          <label className="flex items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/60 border border-border/50 transition-colors">
            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            <div className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-5 w-5" /><span className="text-sm">Adicionar capa</span></div>
          </label>
        )}

        {/* Deadline overdue banner */}
        {isOverdue && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              A deadline deste projeto ({format(new Date(local.deadline!), 'd MMM yyyy', { locale: pt })}) já passou. Atualiza o prazo ou conclui o projeto.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Input value={local.name} onChange={e => updateField('name', e.target.value)} className="text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto" />
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${typeI.color} border-0`}>{typeI.label}</Badge>
            {isRecorrente && <Badge variant="outline" className="text-xs">🔄 Recorrente</Badge>}
            <Select value={local.status} onValueChange={v => updateField('status', v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-4">
            {local.department && <div><Label className="text-xs">Departamento</Label><p className="text-sm mt-1">{getDeptLabel(local.department)}</p></div>}
            {taskMode === 'fases' && (
              <div>
                <Label className="text-xs">Prazo</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !local.deadline && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{local.deadline ? format(new Date(local.deadline), 'PPP', { locale: pt }) : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={local.deadline ? new Date(local.deadline) : undefined} onSelect={d => updateField('deadline', d ? format(d, 'yyyy-MM-dd') : null)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
              </div>
            )}
            {taskMode !== 'tarefas_livres' && (
              <div>
                <Label className="text-xs">Progresso ({getProjectProgress()}%)</Label>
                <Progress value={getProjectProgress()} className="h-2 mt-2" />
                <p className="text-[10px] text-muted-foreground mt-1">{getProjectProgressSummary()}</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Equipa</Label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex -space-x-1">{projectMembers.map(pid => { const p = profileMap.get(pid); return p ? <Avatar key={pid} className="h-7 w-7 border-2 border-background"><AvatarImage src={getPhotoUrl(p)} /><AvatarFallback className="text-[9px]">{getInitials(p.full_name)}</AvatarFallback></Avatar> : null; })}</div>
                <button type="button" onClick={() => setMembersDialogOpen(true)} className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:opacity-80">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <ProjectTimeDisplay taskIds={tasks.map(t => t.id)} />
                {projectCost > 0 && <Badge variant="outline" className="gap-1 text-xs"><DollarSign className="h-3 w-3" /> {formatCost(projectCost)}</Badge>}
              </div>
            </div>
            {local.status === 'concluido' && local.total_time_minutes != null && local.total_time_minutes > 0 && (
              <Badge variant="outline" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Tempo total: {formatDuration(local.total_time_minutes)}</Badge>
            )}
            <div>
              <Label className="text-xs flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Grupo WhatsApp</Label>
              <Input value={(local as any).whatsapp_group_url || ''} onChange={e => updateField('whatsapp_group_url', e.target.value)} placeholder="https://chat.whatsapp.com/..." className="mt-1" />
              {(local as any).whatsapp_group_url && (
                <a href={(local as any).whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                  Abrir grupo <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Deliverables - only for recorrente projects */}
        {isRecorrente && taskMode === 'fases' && (
          <>
            <ProjectDeliverables projectId={id!} profiles={profiles} />
            <Separator />
          </>
        )}

        {/* Section 1: Menu Inicial */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <Target className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Menu Inicial</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { key: 'objetivo' as SubPage, icon: Target, label: 'Objetivo e Definição' },
                { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais' },
                { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral' },
                { key: 'dependencias' as SubPage, icon: Link2, label: 'Dependências' },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border/60 overflow-hidden h-36 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 text-center bg-card">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 group-hover:from-primary/10 group-hover:to-primary/15 transition-all" />
                  <div className="rounded-full bg-primary/15 p-3 relative z-10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground relative z-10 px-3">{label}</span>
                </button>
              ))}
            </div>
          </div>

        {/* Section 2: Desenvolvimento */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <FileText className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Desenvolvimento</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { key: 'entregaveis' as SubPage, icon: FileText, label: 'Entregáveis' },
                { key: 'reunioes' as SubPage, icon: Users, label: `Reuniões (${meetings.length})` },
                { key: 'recursos' as SubPage, icon: Lightbulb, label: 'Recursos' },
                { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas' },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border/60 overflow-hidden h-36 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 text-center bg-card">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 group-hover:from-primary/10 group-hover:to-primary/15 transition-all" />
                  <div className="rounded-full bg-primary/12 p-3 relative z-10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground relative z-10 px-3">{label}</span>
                </button>
              ))}
            </div>
          </div>

        {/* Section 3: Estado e Prioridades */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-info/10 border border-info/20 flex-1">
              <CheckSquare className="h-4.5 w-4.5 text-info" />
              <h3 className="text-sm font-bold text-info uppercase tracking-wide">{taskMode === 'tarefas_fixas' ? 'Tarefas do Mês' : taskMode === 'tarefas_livres' ? 'Tarefas' : 'Estado e Prioridades'}</h3>
              <ProjectTimeDisplay taskIds={tasks.map(t => t.id)} />
            </div>
            <div className="flex gap-2 ml-3">
              {taskMode === 'tarefas_fixas' && <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => generateMonthlyTasksMutation.mutate()}>📋 Gerar tarefas</Button>}
              <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => setTaskDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Tarefa</Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => setMeetingDialogOpen(true)}><Plus className="h-3.5 w-3.5" /> Reunião</Button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
              <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{taskMode === 'tarefas_fixas' ? 'Usa o botão "Gerar tarefas" para criar as tarefas deste mês.' : taskMode === 'tarefas_livres' ? 'Adiciona tarefas conforme necessário.' : 'Nenhuma tarefa ligada a este projeto'}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/60">
                  <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Prioridade</TableHead><TableHead className="font-semibold">Tarefa</TableHead><TableHead className="font-semibold">Data final</TableHead><TableHead className="font-semibold">Responsável</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tasks.map(t => {
                    const si = getTaskStatusInfo(t.status);
                    const pi = getPriorityInfo(t.priority);
                    const assignee = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell><Badge className={`${si.color} border-0 text-[10px]`}>{si.label}</Badge></TableCell>
                        <TableCell><Badge className={`${pi.color} border-0 text-[10px]`}>{pi.label}</Badge></TableCell>
                        <TableCell className="font-medium text-sm">{t.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.deadline ? format(new Date(t.deadline), 'd MMM', { locale: pt }) : '—'}</TableCell>
                        <TableCell>{assignee ? <div className="flex items-center gap-1.5"><Avatar className="h-5 w-5"><AvatarImage src={getPhotoUrl(assignee)} /><AvatarFallback className="text-[8px]">{getInitials(assignee.full_name)}</AvatarFallback></Avatar><span className="text-xs">{assignee.full_name}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Linked SOPs */}
        {id && <LinkedSopsSection entityType="projeto" entityId={id} />}

        {/* Section 4: Fecho de Projeto */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border">
              <Target className="h-4.5 w-4.5 text-muted-foreground" />
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Fecho de Projeto</h3>
            </div>
            <div className="space-y-2">
              {[
                { field: 'closure_good' as keyof ProjectFull, label: '✅ O que funcionou bem' },
                { field: 'closure_bad' as keyof ProjectFull, label: '❌ O que não voltaria a fazer' },
                { field: 'closure_lessons' as keyof ProjectFull, label: '💡 Lições finais' },
              ].map(({ field, label }) => (
                <Collapsible key={field}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-3.5 rounded-xl border-2 border-border/60 bg-card hover:bg-muted/40 transition-colors">
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

        <Separator />
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5"><Trash2 className="h-4 w-4" /> Eliminar projeto</Button></AlertDialogTrigger>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar projeto?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível. Todos os dados do projeto serão eliminados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Task dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
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

      {/* Meeting dialog — full form */}
      <MeetingFormDialog
        open={meetingDialogOpen}
        onOpenChange={setMeetingDialogOpen}
        profiles={profiles as MeetingProfile[]}
        projects={allProjectsForMeeting}
        clients={clientsList}
        defaultClientId={local.client_id || undefined}
        defaultClientName={local.client_name || undefined}
        defaultProjectId={id}
        defaultProjectName={local.name}
      />

      {/* Members dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Equipa do Projeto</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {profiles.map(p => {
              const resolvedProfile = profileMap.get(p.id) ?? p;
              const isMember = projectMembers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleMember.mutate(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isMember ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={getPhotoUrl(resolvedProfile)} />
                    <AvatarFallback className="text-[9px]">{getInitials(resolvedProfile.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left">{resolvedProfile.full_name || 'Sem nome'}</span>
                  {isMember && <CheckSquare className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
