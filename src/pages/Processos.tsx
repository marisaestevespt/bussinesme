import { useState, useEffect } from 'react';
import { DepartmentProcessos } from '@/components/DepartmentProcessos';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowLeft, FileText, List, RotateCw, UserPlus, Workflow } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { InfiniteScrollList } from '@/components/InfiniteScrollList';
import { PAGE_SIZE, flattenInfiniteData, getInfiniteCount, type InfinitePageResult } from '@/hooks/useInfiniteSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, PROCESS_DEPARTMENTS, getDept, getDeptLabel } from '@/lib/departments';
import { usePlanningRoutines } from '@/hooks/usePlanningRoutines';
import { SOP_STATUSES, getSopStatusInfo as getStatusInfo } from '@/lib/sopStatus';
import { RoutineFormFields } from '@/components/routines/RoutineFormFields';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { CollectionPage, CollectionHeader } from '@/components/layout/collection';
import { SOP_TEMPLATES, getSopTemplate, type SopTemplate } from '@/components/sop/SOP_TEMPLATES';
import { ProcessCover } from '@/components/processes/ProcessCover';
import { BibliotecaSection } from '@/components/processes/BibliotecaSection';
import { BookOpen } from 'lucide-react';

// ─── Main Page ──────────────────────────────────────────────────

const PROCESSOS_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'galeria', label: 'Galeria', icon: <FileText className="h-4 w-4" />, isDefault: true },
  { key: 'lista', label: 'Lista', icon: <List className="h-4 w-4" />, isDefault: true },
  { key: 'biblioteca', label: 'Biblioteca', icon: <BookOpen className="h-4 w-4" />, isDefault: true },
];

export default function ProcessosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getPhotoUrl } = useTeamPhotos();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const planningRoutines = usePlanningRoutines();

  // Planning routine form state
  const [showNewRoutineDialog, setShowNewRoutineDialog] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prRoleFunction, setPrRoleFunction] = useState('');
  const [prRoleCustom, setPrRoleCustom] = useState('');
  const [prRoleOpen, setPrRoleOpen] = useState(false);
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);
  const [prHour, setPrHour] = useState('09:00');
  const [prDepartment, setPrDepartment] = useState('');
  const [prCreateProject, setPrCreateProject] = useState(true);

  const { allViews, addView, renameView, deleteView } = useUserViews('processos', PROCESSOS_DEFAULT_VIEWS);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [showNewSop, setShowNewSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopDepts, setNewSopDepts] = useState<string[]>(['marketing']);
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
  const [newSopType, setNewSopType] = useState('operacional');
  const [newSopRoleTitle, setNewSopRoleTitle] = useState('');
  const [newSopRoleOpen, setNewSopRoleOpen] = useState(false);
  const [newSopProductId, setNewSopProductId] = useState('');
  const [newSopTemplate, setNewSopTemplate] = useState<SopTemplate | null>(null);
  const [newSopObjetivo, setNewSopObjetivo] = useState('');
  const [sopTemplatePickerOpen, setSopTemplatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('galeria');
  const [filterRole, setFilterRole] = useState('');

  // Sync ?tab= query param with active tab (for deep-links e.g. /hub/biblioteca redirect)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Queries ──────────────────────────────────────────────────

  const sopsQuery = useInfiniteQuery<InfinitePageResult<any>>({
    queryKey: ['sops'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase.from('sops').select('*', { count: 'exact' }).order('sop_id', { ascending: true }).range(from, to);
      if (error) throw error;
      return { data: data || [], count, nextPage: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
  });
  const sops = flattenInfiniteData(sopsQuery.data?.pages);
  const sopsTotal = getInfiniteCount(sopsQuery.data?.pages);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('id, full_name, role_title, profile_id, photo_url').eq('status', 'ativo').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const existingRoles = [...new Set(teamMembers.map(m => m.role_title).filter(Boolean))] as string[];

  // Products list for SOP linking
  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name');
      return data || [];
    },
  });

  const SOP_TYPES = [
    { value: 'operacional', label: 'Operacional' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'rotina', label: 'Rotina' },
    { value: 'entrega', label: 'Entrega' },
    { value: 'outro', label: 'Outro' },
  ];

  // ─── Mutations ────────────────────────────────────────────────

  const createSop = useMutation({
    mutationFn: async () => {
      const { data: sopData, error } = await supabase.from('sops').insert({
        name: newSopName,
        department: newSopDepts[0] || 'marketing',
        departments: newSopDepts,
        status: newSopStatus,
        sop_type: newSopType,
        role_title: newSopRoleTitle || null,
        product_id: newSopProductId || null,
        objetivo: newSopObjetivo.trim() || null,
        created_by: user?.id,
      } as any).select('id').single();
      if (error) throw error;
      // Insert template steps as sop_steps
      if (newSopTemplate && newSopTemplate.defaultSteps.length > 0) {
        const stepRows = newSopTemplate.defaultSteps.map((description, idx) => ({
          sop_id: sopData.id,
          description,
          sort_order: idx,
        }));
        await (supabase.from as any)('sop_steps').insert(stepRows);
      }
      return sopData;
    },
    onSuccess: (sopData) => {
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      setShowNewSop(false);
      setNewSopName('');
      setNewSopDepts(['marketing']);
      setNewSopType('operacional');
      setNewSopRoleTitle('');
      setNewSopProductId('');
      setNewSopObjetivo('');
      setNewSopTemplate(null);
      toast.success('Processo criado');
      if (sopData?.id) navigate(`/hub/processos/${sopData.id}`);
    },
    onError: () => toast.error('Erro ao criar processo'),
  });

  function resetRoutineDialog() {
    setPrTitle(''); setPrRoleFunction(''); setPrRoleCustom(''); setPrRecurrence('semanal'); setPrWeekday('1'); setPrMonthDay('1'); setPrAdjustBiz(true); setPrHour('09:00'); setPrDepartment(''); setPrCreateProject(true);
  }

  // ─── Derived data ────────────────────────────────────────────

  const sopCountByDept = DEPARTMENTS.map(d => ({
    ...d,
    count: sops.filter(s => (s as any).departments?.includes(d.value) || s.department === d.value).length,
  }));

  const deptSops = selectedDept ? sops.filter(s => (s as any).departments?.includes(selectedDept) || s.department === selectedDept) : [];

  const allSopsSorted = [...sops].sort((a, b) => {
    const numA = parseInt(a.sop_id?.replace('SOP-', '') || '0');
    const numB = parseInt(b.sop_id?.replace('SOP-', '') || '0');
    return numA - numB;
  });

  const totalSopCount = sops.length;

  const routinesData = planningRoutines.routines.data || [];

  return (
    <AppLayout>
      <CollectionPage>
      <CollectionHeader
        title="Processos (SOPs)"
        icon={Workflow}
        description="Documentação operacional, rotinas e fluxos por departamento."
        count={totalSopCount}
        actions={
          <Popover open={sopTemplatePickerOpen} onOpenChange={setSopTemplatePickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Processo</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-1.5">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground">Escolher template</p>
              </div>
              <div className="space-y-0.5">
                {SOP_TEMPLATES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => {
                        if (selectedDept) setNewSopDepts([selectedDept]);
                        setNewSopTemplate(t);
                        setNewSopType(t.defaultSopType);
                        setNewSopObjetivo(t.defaultObjetivo || '');
                        setSopTemplatePickerOpen(false);
                        setShowNewSop(true);
                      }}
                      className="w-full flex items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.label}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        }
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <ViewTabs
            views={allViews}
            activeKey={activeTab}
            onSelect={setActiveTab}
            onAdd={(label) => addView(label)}
            onRename={(id, label) => renameView({ id, label })}
            onDelete={(id) => { if (activeTab.startsWith('custom_')) setActiveTab('galeria'); deleteView(id); }}
          />
        </div>

        {/* ═══ TAB: Galeria ═══ */}
        <TabsContent value="galeria" className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              {selectedDept ? (
                <div className="flex items-center gap-3">
                  <Button variant="ghost" aria-label="Voltar" size="icon" onClick={() => setSelectedDept(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h1 className="text-2xl sm:kpi-display-sm mt-1">{getDeptLabel(selectedDept)}</h1>
                  <span className="text-muted-foreground text-sm">({deptSops.length} processos)</span>
                </div>
              ) : (
                <h1 className="text-2xl sm:kpi-display-sm mt-1">Processos (SOPs)</h1>
              )}
            </div>

            {!selectedDept ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sopCountByDept.map(dept => (
                  <button
                    key={dept.value}
                    onClick={() => setSelectedDept(dept.value)}
                    className="group text-left rounded-xl overflow-hidden border border-border bg-card hover:shadow-md hq-transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <ProcessCover
                      className="h-32"
                      departmentKey={dept.value}
                      fallback={
                        <span className="text-3xl opacity-50 group-hover:opacity-70 transition-opacity">
                          {dept.icon}
                        </span>
                      }
                    />
                    <div className="bg-card p-4">
                      <h3 className="font-semibold text-foreground">{dept.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dept.count} {dept.count === 1 ? 'processo' : 'processos'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <DepartmentProcessos department={selectedDept} />
            )}
          </section>

          {/* ═══ Rotinas ═══ */}
          {!selectedDept && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="kpi-display-sm mt-1 flex items-center gap-2">
                  <RotateCw className="h-5 w-5 text-primary" /> Rotinas
                </h2>
                <Button onClick={() => setShowNewRoutineDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Nova Rotina
                </Button>
              </div>
              {routinesData.length === 0 ? (
                <EmptyHint>Nenhuma rotina configurada.</EmptyHint>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {routinesData.map((pr: any) => {
                    const assignee = pr.profiles;
                    const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                    const recLabel = pr.recurrence_type === 'semanal'
                      ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                      : `Mensal — dia ${pr.month_day}${hourLabel}${pr.adjust_to_business_day ? ' (ajuste dia útil)' : ''}`;
                    const linkedSop = sops.find((s: any) => s.routine_id === pr.id);
                    return (
                      <Card key={pr.id} className={cn("p-3", linkedSop && "cursor-pointer hover:shadow-md transition-shadow")} onClick={() => { if (linkedSop) navigate(`/hub/processos/${linkedSop.id}`); }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{pr.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{recLabel}</p>
                            <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px] mt-1">
                              {pr.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0" onClick={e => e.stopPropagation()}>
                            <Switch
                              checked={pr.active}
                              onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                              className="scale-75"
                            />
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {assignee && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getPhotoUrl(assignee)} />
                              <AvatarFallback className="text-[10px]">{(assignee.full_name || '?')[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate">{assignee.full_name}</span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </TabsContent>

        {/* ═══ TAB: Lista Total ═══ */}
        <TabsContent value="lista">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h1 className="text-2xl sm:kpi-display-sm mt-1">Lista Total de SOPs</h1>
            <div className="flex items-center gap-2">
              <Select value={selectedDept || '_all_'} onValueChange={v => setSelectedDept(v === '_all_' ? null : v)}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Filtrar por dept." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos os departamentos</SelectItem>
                  {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRole || '_all_'} onValueChange={v => setFilterRole(v === '_all_' ? '' : v)}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Filtrar por função" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todas as funções</SelectItem>
                  {existingRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(() => {
            let filtered = allSopsSorted;
            if (selectedDept) {
              filtered = filtered.filter(s => (s as any).departments?.includes(selectedDept) || s.department === selectedDept);
            }
            if (filterRole) {
              filtered = filtered.filter(s => (s as any).role_title === filterRole);
            }
            return filtered.length === 0 ? (
              <EmptyHint>Nenhum SOP encontrado.</EmptyHint>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Nº SOP</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(sop => {
                      const statusInfo = getStatusInfo(sop.status);
                      return (
                        <TableRow key={sop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                          <TableCell className="font-mono text-sm">{sop.sop_id}</TableCell>
                          <TableCell className="font-medium">{sop.name}</TableCell>
                          <TableCell className="text-muted-foreground">{(sop as any).role_title || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{((sop as any).departments?.length ? (sop as any).departments : [sop.department]).map((d: string) => getDeptLabel(d)).join(', ')}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{(sop as any).sop_type || 'operacional'}</Badge></TableCell>
                          <TableCell className="font-mono">v{(sop as any).version || 1}</TableCell>
                          <TableCell><Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </TabsContent>

        {/* ═══ TAB: Biblioteca ═══ */}
        <TabsContent value="biblioteca">
          <BibliotecaSection />
        </TabsContent>
      </Tabs>

      {/* ═══ Dialog: Novo Processo ═══ */}
      <Dialog open={showNewSop} onOpenChange={v => { if (!v) { setShowNewSop(false); setNewSopName(''); setNewSopType('operacional'); setNewSopRoleTitle(''); setNewSopProductId(''); setNewSopObjetivo(''); setNewSopTemplate(null); } else setShowNewSop(true); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Processo (SOP)</DialogTitle>
            {newSopTemplate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <FileText className="h-3 w-3" /> Template: <span className="font-medium text-foreground">{newSopTemplate.label}</span>
                {newSopTemplate.defaultSteps.length > 0 && (
                  <span>· {newSopTemplate.defaultSteps.length} passos pré-preenchidos</span>
                )}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do processo *</Label>
              <Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Onboarding Designer" />
            </div>
            <div>
              <Label>Tipo de SOP</Label>
              <Select value={newSopType} onValueChange={setNewSopType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Departamentos</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-9 text-sm font-normal">
                    {newSopDepts.length === 0
                      ? 'Selecionar departamentos...'
                      : newSopDepts.map(d => PROCESS_DEPARTMENTS.find(x => x.value === d)?.label || d).join(', ')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  {PROCESS_DEPARTMENTS.map(d => (
                    <label key={d.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={newSopDepts.includes(d.value)}
                        onCheckedChange={(checked) => setNewSopDepts(prev => checked ? [...prev, d.value] : prev.filter(v => v !== d.value))}
                      />
                      {d.label}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Função associada</Label>
              <Popover open={newSopRoleOpen} onOpenChange={setNewSopRoleOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {newSopRoleTitle || <span className="text-muted-foreground">Selecionar ou escrever...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar função..." value={newSopRoleTitle} onValueChange={setNewSopRoleTitle} />
                    <CommandList>
                      <CommandEmpty>
                        {newSopRoleTitle.trim() && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Função: <strong>{newSopRoleTitle.trim()}</strong></p>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {existingRoles.map(role => (
                          <CommandItem key={role} value={role} onSelect={() => { setNewSopRoleTitle(role); setNewSopRoleOpen(false); }}>
                            {role}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Produto associado</Label>
              <Select value={newSopProductId || '_none_'} onValueChange={v => setNewSopProductId(v === '_none_' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhum</SelectItem>
                  {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={newSopObjetivo} onChange={e => setNewSopObjetivo(e.target.value)} placeholder="O que se pretende alcançar com este processo?" />
            </div>
            <Button className="w-full" disabled={!newSopName.trim() || newSopDepts.length === 0} onClick={() => createSop.mutate()}>Criar Processo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Nova Rotina ═══ */}
      <Dialog open={showNewRoutineDialog} onOpenChange={v => { if (!v) { setShowNewRoutineDialog(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <RoutineFormFields
              layout="wide"
              hourInputClassName="w-32"
              title={prTitle} onTitleChange={setPrTitle}
              roleFunction={prRoleFunction} onRoleFunctionChange={setPrRoleFunction}
              roleCustom={prRoleCustom} onRoleCustomChange={setPrRoleCustom}
              roleOpen={prRoleOpen} onRoleOpenChange={setPrRoleOpen}
              existingRoles={existingRoles}
              recurrence={prRecurrence} onRecurrenceChange={setPrRecurrence}
              weekday={prWeekday} onWeekdayChange={setPrWeekday}
              monthDay={prMonthDay} onMonthDayChange={setPrMonthDay}
              hour={prHour} onHourChange={setPrHour}
              adjustBiz={prAdjustBiz} onAdjustBizChange={setPrAdjustBiz}
              extraTopField={
                <div>
                  <Label>Departamento</Label>
                  <Select value={prDepartment || '_none_'} onValueChange={v => setPrDepartment(v === '_none_' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Nenhum</SelectItem>
                      {PROCESS_DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              }
            />

            <Separator />

            <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm text-muted-foreground">
              <p>Será criado automaticamente um processo (SOP) com:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Nome: <strong className="text-foreground">{prTitle || '(título da rotina)'}</strong></li>
                <li>Departamento: <strong className="text-foreground">{prDepartment ? DEPARTMENTS.find(d => d.value === prDepartment)?.label : '(nenhum)'}</strong></li>
                <li>Frequência: <strong className="text-foreground">{prRecurrence === 'semanal' ? 'Semanal' : 'Mensal'}</strong></li>
              </ul>
              <p className="mt-2 text-xs">Após criar, serás redirecionado para a página do processo.</p>
            </div>

            <Button
              className="w-full"
              disabled={!prTitle.trim() || planningRoutines.createRoutine.isPending}
              onClick={async () => {
                const recLabel = prRecurrence === 'semanal'
                  ? `Semanal (${['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][Number(prWeekday)]})`
                  : `Mensal (dia ${prMonthDay})`;

                // Create routine first to get its ID
                const routineData: any = {
                  title: prTitle,
                  responsible: null,
                  role_function: prRoleFunction || null,
                  recurrence_type: prRecurrence,
                  weekday: prRecurrence === 'semanal' ? Number(prWeekday) : null,
                  month_day: prRecurrence === 'mensal' ? Number(prMonthDay) : null,
                  adjust_to_business_day: prRecurrence === 'mensal' ? prAdjustBiz : true,
                  hour_time: prHour || '09:00',
                  created_by: user?.id,
                  department: prDepartment || null,
                };

                const { data: routineResult, error: routineError } = await supabase
                  .from('planning_routines')
                  .insert(routineData)
                  .select('*')
                  .single();

                if (routineError || !routineResult) {
                  toast.error('Erro ao criar rotina: ' + (routineError?.message || ''));
                  return;
                }

                // Generate tasks for the routine
                const { generateTasksForRoutine } = await import('@/hooks/usePlanningRoutines');
                await generateTasksForRoutine(routineResult as any, new Date().getFullYear());

                // Find or create custom_role for the function
                let customRoleId: string | null = null;
                if (prRoleFunction) {
                  const { data: existingRole } = await supabase
                    .from('custom_roles')
                    .select('id')
                    .eq('name', prRoleFunction)
                    .single();
                  
                  if (existingRole) {
                    customRoleId = existingRole.id;
                  } else {
                    const { data: newRole } = await supabase
                      .from('custom_roles')
                      .insert({ name: prRoleFunction } as any)
                      .select('id')
                      .single();
                    if (newRole) customRoleId = newRole.id;
                  }
                }

                // Create SOP linked to the routine
                const { data: sopData } = await supabase.from('sops').insert({
                  name: prTitle,
                  department: prDepartment || null,
                  status: 'ativo',
                  created_by: user?.id,
                  routine_id: routineResult.id,
                  custom_role_id: customRoleId,
                } as any).select('id').single();
                
                queryClient.invalidateQueries({ queryKey: ['sops'] });
                queryClient.invalidateQueries({ queryKey: ['planning-routines'] });
                queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

                setShowNewRoutineDialog(false);
                resetRoutineDialog();
                toast.success('Rotina criada e tarefas geradas');

                if (sopData?.id) {
                  navigate(`/hub/processos/${sopData.id}`);
                }
              }}
            >
              Criar Rotina
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </CollectionPage>
    </AppLayout>
  );
}
