import { useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { useNavigate } from 'react-router-dom';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowLeft, FileText, List, RotateCw, UserPlus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, PROCESS_DEPARTMENTS, getDept, getDeptLabel } from '@/lib/departments';
import { usePlanningRoutines } from '@/hooks/usePlanningRoutines';

// ─── Constants ──────────────────────────────────────────────────

const SOP_STATUSES = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'off', label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
];

function getStatusInfo(status: string) {
  return SOP_STATUSES.find(s => s.value === status) || SOP_STATUSES[0];
}

// ─── Main Page ──────────────────────────────────────────────────

const PROCESSOS_DEFAULT_VIEWS: DefaultView[] = [
  { key: 'galeria', label: 'Galeria', icon: <FileText className="h-4 w-4" />, isDefault: true },
  { key: 'lista', label: 'Lista', icon: <List className="h-4 w-4" />, isDefault: true },
];

export default function ProcessosPage() {
  const navigate = useNavigate();
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
  const [activeTab, setActiveTab] = useState('galeria');

  // ─── Queries ──────────────────────────────────────────────────

  const { data: sops = [] } = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sops').select('*').order('sop_id', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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
      const { error } = await supabase.from('sops').insert({
        name: newSopName,
        department: newSopDepts[0] || 'marketing',
        departments: newSopDepts,
        status: newSopStatus,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      setShowNewSop(false);
      setNewSopName('');
      setNewSopDepts(['marketing']);
      toast.success('Processo criado');
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
      <BackNavigation />
      <PageHeader title="Processos (SOPs)" />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <ViewTabs
            views={allViews}
            activeKey={activeTab}
            onSelect={setActiveTab}
            onAdd={(label) => addView(label)}
            onRename={(id, label) => renameView({ id, label })}
            onDelete={(id) => { if (activeTab.startsWith('custom_')) setActiveTab('galeria'); deleteView(id); }}
          />
          <Button onClick={() => { if (selectedDept) setNewSopDepts([selectedDept]); setShowNewSop(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Processo
          </Button>
        </div>

        {/* ═══ TAB: Galeria ═══ */}
        <TabsContent value="galeria" className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              {selectedDept ? (
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDept(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h1 className="text-2xl font-bold tracking-tight">{getDeptLabel(selectedDept)}</h1>
                  <span className="text-muted-foreground text-sm">({deptSops.length} processos)</span>
                </div>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight">Processos (SOPs)</h1>
              )}
            </div>

            {!selectedDept ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sopCountByDept.map(dept => (
                  <button
                    key={dept.value}
                    onClick={() => setSelectedDept(dept.value)}
                    className="group text-left rounded-xl overflow-hidden border border-border hover:shadow-lg hq-transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className={cn('h-32 bg-gradient-to-br flex items-center justify-center relative', dept.gradient)}>
                      <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">{dept.icon}</span>
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
                    </div>
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
              <>
                {deptSops.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">Nenhum processo neste departamento.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {deptSops.map(sop => {
                      const statusInfo = getStatusInfo(sop.status);
                      return (
                        <Card key={sop.id} className="cursor-pointer hover:shadow-md hq-transition" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                              <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                            </div>
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="font-medium text-sm line-clamp-2">{sop.name}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Onboarding por Função */}
                <Separator className="my-6" />
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" /> Onboarding por Função
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setShowNewOnboarding(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Novo Template
                  </Button>
                </div>
                {onboardingTemplates.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      Sem templates de onboarding neste departamento.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {onboardingTemplates.map((tpl: any) => {
                      const items = (tpl.sop_onboarding_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
                      return (
                        <Card key={tpl.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <Badge variant="secondary" className="text-xs">{tpl.role_title}</Badge>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">{items.length} itens</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={async () => {
                                    await supabase.from('sop_onboarding_items').delete().eq('template_id', tpl.id);
                                    await supabase.from('sop_onboarding_templates').delete().eq('id', tpl.id);
                                    queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] });
                                    toast.success('Template eliminado');
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {items.map((item: any, idx: number) => (
                              <div key={item.id} className="flex items-center gap-2 text-sm py-0.5">
                                <span className="text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                                <span className="flex-1">{item.task}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">{item.deadline_days}d</Badge>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ═══ Rotinas ═══ */}
          {!selectedDept && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <RotateCw className="h-5 w-5 text-primary" /> Rotinas
                </h2>
                <Button onClick={() => setShowNewRoutineDialog(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Nova Rotina
                </Button>
              </div>
              {routinesData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma rotina configurada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {routinesData.map((pr: any) => {
                    const assignee = pr.profiles;
                    const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                    const recLabel = pr.recurrence_type === 'semanal'
                      ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                      : `Mensal — dia ${pr.month_day}${hourLabel}${pr.adjust_to_business_day ? ' (ajuste dia útil)' : ''}`;
                    return (
                      <Card key={pr.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{pr.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{recLabel}</p>
                            <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px] mt-1">
                              {pr.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <Switch
                              checked={pr.active}
                              onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                              className="scale-75"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {assignee && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={assignee.avatar_url || ''} />
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
          <h1 className="text-2xl font-bold tracking-tight mb-4">Lista Total de SOPs</h1>
          {allSopsSorted.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum SOP criado.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Nº SOP</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSopsSorted.map(sop => {
                    const statusInfo = getStatusInfo(sop.status);
                    return (
                      <TableRow key={sop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                        <TableCell className="font-mono text-sm">{sop.sop_id}</TableCell>
                        <TableCell className="font-medium">{sop.name}</TableCell>
                        <TableCell className="text-muted-foreground">{((sop as any).departments?.length ? (sop as any).departments : [sop.department]).map((d: string) => getDeptLabel(d)).join(', ')}</TableCell>
                        <TableCell><Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Dialog: Novo Processo ═══ */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Novo Processo (SOP)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do processo *</Label>
              <Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Onboarding de cliente" />
            </div>
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
            <Button className="w-full" disabled={!newSopName.trim() || newSopDepts.length === 0} onClick={() => createSop.mutate()}>Criar Processo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Nova Rotina ═══ */}
      <Dialog open={showNewRoutineDialog} onOpenChange={v => { if (!v) { setShowNewRoutineDialog(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título *</Label>
                <Input value={prTitle} onChange={e => setPrTitle(e.target.value)} placeholder="Ex: Revisão semanal de KPIs" />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Função responsável</Label>
                <Popover open={prRoleOpen} onOpenChange={setPrRoleOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {prRoleFunction || <span className="text-muted-foreground">Selecionar ou criar...</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Pesquisar ou criar função..."
                        value={prRoleCustom}
                        onValueChange={setPrRoleCustom}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {prRoleCustom.trim() && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded"
                              onClick={() => { setPrRoleFunction(prRoleCustom.trim()); setPrRoleOpen(false); }}
                            >
                              Criar "<strong>{prRoleCustom.trim()}</strong>"
                            </button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {existingRoles.map(role => (
                            <CommandItem
                              key={role}
                              value={role}
                              onSelect={() => { setPrRoleFunction(role); setPrRoleCustom(''); setPrRoleOpen(false); }}
                            >
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
                <Label>Tipo de recorrência</Label>
                <Select value={prRecurrence} onValueChange={v => setPrRecurrence(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {prRecurrence === 'semanal' && (
                <div>
                  <Label>Dia da semana</Label>
                  <Select value={prWeekday} onValueChange={setPrWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Segunda-feira</SelectItem>
                      <SelectItem value="2">Terça-feira</SelectItem>
                      <SelectItem value="3">Quarta-feira</SelectItem>
                      <SelectItem value="4">Quinta-feira</SelectItem>
                      <SelectItem value="5">Sexta-feira</SelectItem>
                      <SelectItem value="6">Sábado</SelectItem>
                      <SelectItem value="7">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {prRecurrence === 'mensal' && (
                <div>
                  <Label>Dia do mês</Label>
                  <Input type="number" min={1} max={31} value={prMonthDay} onChange={e => setPrMonthDay(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Hora</Label>
                <Input type="time" value={prHour} onChange={e => setPrHour(e.target.value)} className="w-32" />
              </div>
            </div>
            {prRecurrence === 'mensal' && (
              <div className="flex items-center gap-2">
                <Switch checked={prAdjustBiz} onCheckedChange={setPrAdjustBiz} />
                <Label className="text-sm">Ajustar para dia útil anterior (se cair em fim de semana)</Label>
              </div>
            )}

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

      {/* Dialog: Novo Template Onboarding */}
      <Dialog open={showNewOnboarding} onOpenChange={v => { if (!v) { setShowNewOnboarding(false); setObRoleTitle(''); setObItems([{ task: '', deadline_days: 2 }]); } else setShowNewOnboarding(true); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Template de Onboarding</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Função *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {obRoleTitle || <span className="text-muted-foreground">Selecionar ou escrever...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar ou criar função..." value={obRoleTitle} onValueChange={setObRoleTitle} />
                    <CommandList>
                      <CommandEmpty>
                        {obRoleTitle.trim() && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Função: <strong>{obRoleTitle.trim()}</strong></p>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {existingRoles.map(role => (
                          <CommandItem key={role} value={role} onSelect={() => setObRoleTitle(role)}>
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
              <Label>Checklist de Onboarding</Label>
              <div className="space-y-2 mt-2">
                {obItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}.</span>
                    <Input
                      value={item.task}
                      onChange={e => { const n = [...obItems]; n[i] = { ...n[i], task: e.target.value }; setObItems(n); }}
                      placeholder="Ex: Aceder à plataforma e preencher perfil"
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        value={item.deadline_days}
                        onChange={e => { const n = [...obItems]; n[i] = { ...n[i], deadline_days: parseInt(e.target.value) || 0 }; setObItems(n); }}
                        className="w-16 text-center"
                      />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setObItems(obItems.filter((_, idx) => idx !== i))} disabled={obItems.length <= 1}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setObItems([...obItems, { task: '', deadline_days: 2 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar item
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!obRoleTitle.trim() || !selectedDept || obItems.every(i => !i.task.trim())}
              onClick={async () => {
                const validItems = obItems.filter(i => i.task.trim());
                const { data: tpl, error } = await supabase
                  .from('sop_onboarding_templates')
                  .insert({ role_title: obRoleTitle.trim(), department: selectedDept! })
                  .select('id')
                  .single();
                if (error) {
                  toast.error(error.message.includes('unique') ? 'Já existe um template para esta função neste departamento.' : 'Erro ao criar template');
                  return;
                }
                const rows = validItems.map((item, i) => ({
                  template_id: tpl.id,
                  task: item.task.trim(),
                  deadline_days: item.deadline_days,
                  sort_order: i,
                }));
                await supabase.from('sop_onboarding_items').insert(rows);

                // Also create a linked SOP
                const { data: sopData } = await supabase.from('sops').insert({
                  name: `Onboarding — ${obRoleTitle.trim()}`,
                  department: selectedDept!,
                  departments: [selectedDept!],
                  status: 'ativo',
                  created_by: user?.id,
                } as any).select('id').single();

                if (sopData) {
                  await supabase.from('sop_onboarding_templates').update({ sop_id: sopData.id }).eq('id', tpl.id);
                }

                queryClient.invalidateQueries({ queryKey: ['onboarding-templates'] });
                queryClient.invalidateQueries({ queryKey: ['sops'] });
                setShowNewOnboarding(false);
                setObRoleTitle('');
                setObItems([{ task: '', deadline_days: 2 }]);
                toast.success('Template de onboarding criado!');
              }}
            >
              Criar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
