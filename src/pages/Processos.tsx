import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowLeft, FileText, List, RotateCw, Power, PowerOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, getDept, getDeptLabel } from '@/lib/departments';
import { usePlanningRoutines } from '@/hooks/usePlanningRoutines';

// ─── Constants ──────────────────────────────────────────────────

const SOP_STATUSES = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'off', label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
];

const FREQUENCIES = [
  { value: 'todos_os_dias', label: 'Todos os dias' },
  { value: 'segunda', label: '2ª feira' },
  { value: 'terca', label: '3ª feira' },
  { value: 'quarta', label: '4ª feira' },
  { value: 'quinta', label: '5ª feira' },
  { value: 'sexta', label: '6ª feira' },
  { value: 'primeiro_dia_util', label: '1º dia útil do mês' },
  { value: 'dia_x_mes', label: 'Dia X do mês' },
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
  const [showNewPlanningRoutine, setShowNewPlanningRoutine] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prResponsible, setPrResponsible] = useState('');
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);

  const { allViews, addView, renameView, deleteView } = useUserViews('processos', PROCESSOS_DEFAULT_VIEWS);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [routineFilter, setRoutineFilter] = useState<string>('all');
  const [showNewSop, setShowNewSop] = useState(false);
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [newSopName, setNewSopName] = useState('');
  const [newSopDept, setNewSopDept] = useState('administrativo');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDept, setNewRoutineDept] = useState('administrativo');
  const [newRoutineFreq, setNewRoutineFreq] = useState('todos_os_dias');
  const [newRoutineAssignee, setNewRoutineAssignee] = useState<string>('');
  const [routineSteps, setRoutineSteps] = useState('');
  const [newRoutineMonthlyDay, setNewRoutineMonthlyDay] = useState('');
  const [newRoutineStartDate, setNewRoutineStartDate] = useState('');
  const [newRoutineEndDate, setNewRoutineEndDate] = useState('');
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

  const { data: routines = [] } = useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data, error } = await supabase.from('routines').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  // ─── Mutations ────────────────────────────────────────────────

  const createSop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').insert({
        name: newSopName,
        department: newSopDept,
        status: newSopStatus,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      setShowNewSop(false);
      setNewSopName('');
      toast.success('Processo criado');
    },
    onError: () => toast.error('Erro ao criar processo'),
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      // First create a SOP for the routine steps
      let sopId: string | null = null;
      if (routineSteps.trim()) {
        const steps = routineSteps.split('\n').filter(s => s.trim());
        const { data: sopData, error: sopError } = await supabase.from('sops').insert({
          name: `Rotina: ${newRoutineName}`,
          department: newRoutineDept,
          status: 'ativo',
          created_by: user?.id,
          passos: steps,
        }).select('id').single();
        if (sopError) throw sopError;
        sopId = sopData.id;
      }

      const { error } = await supabase.from('routines').insert({
        name: newRoutineName,
        department: newRoutineDept,
        frequency: newRoutineFreq,
        assigned_to: newRoutineAssignee || null,
        created_by: user?.id,
        sop_id: sopId,
        monthly_day: newRoutineFreq === 'dia_x_mes' && newRoutineMonthlyDay ? Number(newRoutineMonthlyDay) : null,
        start_date: newRoutineFreq === 'dia_x_mes' && newRoutineStartDate ? newRoutineStartDate : null,
        end_date: newRoutineFreq === 'dia_x_mes' && newRoutineEndDate ? newRoutineEndDate : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      setShowNewRoutine(false);
      resetRoutineForm();
      toast.success('Rotina criada');
    },
    onError: () => toast.error('Erro ao criar rotina'),
  });

  const updateRoutine = useMutation({
    mutationFn: async () => {
      if (!editingRoutine) return;
      
      // Update or create linked SOP
      let sopId = editingRoutine.sop_id;
      const steps = routineSteps.split('\n').filter(s => s.trim());
      
      if (sopId) {
        await supabase.from('sops').update({ passos: steps }).eq('id', sopId);
      } else if (steps.length > 0) {
        const { data: sopData, error: sopError } = await supabase.from('sops').insert({
          name: `Rotina: ${newRoutineName}`,
          department: newRoutineDept,
          status: 'ativo',
          created_by: user?.id,
          passos: steps,
        }).select('id').single();
        if (sopError) throw sopError;
        sopId = sopData.id;
      }

      const { error } = await supabase.from('routines').update({
        name: newRoutineName,
        department: newRoutineDept,
        frequency: newRoutineFreq,
        assigned_to: newRoutineAssignee || null,
        sop_id: sopId,
        monthly_day: newRoutineFreq === 'dia_x_mes' && newRoutineMonthlyDay ? Number(newRoutineMonthlyDay) : null,
        start_date: newRoutineFreq === 'dia_x_mes' && newRoutineStartDate ? newRoutineStartDate : null,
        end_date: newRoutineFreq === 'dia_x_mes' && newRoutineEndDate ? newRoutineEndDate : null,
      } as any).eq('id', editingRoutine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      setEditingRoutine(null);
      resetRoutineForm();
      toast.success('Rotina atualizada');
    },
    onError: () => toast.error('Erro ao atualizar rotina'),
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast.success('Rotina eliminada');
    },
  });

  function resetRoutineForm() {
    setNewRoutineName('');
    setNewRoutineDept('administrativo');
    setNewRoutineFreq('todos_os_dias');
    setNewRoutineAssignee('');
    setRoutineSteps('');
    setNewRoutineMonthlyDay('');
    setNewRoutineStartDate('');
    setNewRoutineEndDate('');
  }

  function openEditRoutine(routine: any) {
    setEditingRoutine(routine);
    setNewRoutineName(routine.name);
    setNewRoutineDept(routine.department);
    setNewRoutineFreq(routine.frequency);
    setNewRoutineAssignee(routine.assigned_to || '');
    setNewRoutineMonthlyDay(routine.monthly_day?.toString() || '');
    setNewRoutineStartDate(routine.start_date || '');
    setNewRoutineEndDate(routine.end_date || '');
    // Load SOP steps if linked
    if (routine.sop_id) {
      const linkedSop = sops.find(s => s.id === routine.sop_id);
      if (linkedSop && Array.isArray(linkedSop.passos)) {
        setRoutineSteps((linkedSop.passos as string[]).join('\n'));
      }
    } else {
      setRoutineSteps('');
    }
  }

  // ─── Derived data ────────────────────────────────────────────

  const sopCountByDept = DEPARTMENTS.map(d => ({
    ...d,
    count: sops.filter(s => s.department === d.value).length,
  }));

  const deptSops = selectedDept ? sops.filter(s => s.department === selectedDept) : [];
  const deptRoutines = selectedDept ? routines.filter(r => r.department === selectedDept) : [];

  const filteredRoutines = routineFilter === 'all' ? routines : routines.filter(r => r.department === routineFilter);

  const routinesByDept: Record<string, typeof routines> = {};
  filteredRoutines.forEach(r => {
    if (!routinesByDept[r.department]) routinesByDept[r.department] = [];
    routinesByDept[r.department].push(r);
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  // Sort SOPs by sop_id number for Lista Total
  const allSopsSorted = [...sops].sort((a, b) => {
    const numA = parseInt(a.sop_id?.replace('SOP-', '') || '0');
    const numB = parseInt(b.sop_id?.replace('SOP-', '') || '0');
    return numA - numB;
  });

  // Total count including routine SOPs
  const totalSopCount = sops.length;

  const renderRoutineCard = (routine: any, showDept = false) => {
    const assignee = routine.assigned_to ? profileMap[routine.assigned_to] : null;
    const freqLabel = FREQUENCIES.find(f => f.value === routine.frequency)?.label || routine.frequency;
    const linkedSop = routine.sop_id ? sops.find(s => s.id === routine.sop_id) : null;
    return (
      <Card
        key={routine.id}
        className="p-3 cursor-pointer hover:shadow-md hq-transition"
        onClick={() => openEditRoutine(routine)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{routine.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{freqLabel}</p>
            {showDept && <p className="text-xs text-muted-foreground">{getDeptLabel(routine.department)}</p>}
            {linkedSop && (
              <Badge variant="outline" className="text-[10px] mt-1">{linkedSop.sop_id}</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => { e.stopPropagation(); deleteRoutine.mutate(routine.id); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
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
  };

  return (
    <AppLayout>
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
          <Button onClick={() => { if (selectedDept) setNewSopDept(selectedDept); setShowNewSop(true); }} size="sm">
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

                {/* Rotinas deste departamento */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold tracking-tight">Rotinas</h2>
                    <Button onClick={() => { setNewRoutineDept(selectedDept!); setShowNewRoutine(true); }} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Nova Rotina
                    </Button>
                  </div>
                  {deptRoutines.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma rotina neste departamento.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {deptRoutines.map(routine => renderRoutineCard(routine))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Rotinas (vista galeria geral) */}
          {!selectedDept && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold tracking-tight">Rotinas</h2>
                <Button onClick={() => setShowNewRoutine(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Nova Rotina
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                <Button variant={routineFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setRoutineFilter('all')}>Todos</Button>
                {DEPARTMENTS.map(d => (
                  <Button key={d.value} variant={routineFilter === d.value ? 'default' : 'outline'} size="sm" onClick={() => setRoutineFilter(d.value)}>
                    {d.label}
                  </Button>
                ))}
              </div>
              {Object.keys(routinesByDept).length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma rotina encontrada.</p>
              )}
              {Object.entries(routinesByDept).map(([dept, items]) => {
                const deptInfo = getDept(dept);
                return (
                  <div key={dept} className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      {deptInfo?.icon && <span>{deptInfo.icon}</span>}
                      {getDeptLabel(dept)}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {items.map(routine => renderRoutineCard(routine))}
                    </div>
                  </div>
                );
              })}
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
                        <TableCell className="text-muted-foreground">{getDeptLabel(sop.department)}</TableCell>
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
              <Label>Departamento</Label>
              <Select value={newSopDept} onValueChange={setNewSopDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newSopName.trim()} onClick={() => createSop.mutate()}>Criar Processo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Nova Rotina / Editar Rotina ═══ */}
      <Dialog open={showNewRoutine || !!editingRoutine} onOpenChange={v => { if (!v) { setShowNewRoutine(false); setEditingRoutine(null); resetRoutineForm(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoutine ? 'Editar Rotina' : 'Nova Rotina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da rotina *</Label>
              <Input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} placeholder="Ex: Verificar emails de suporte" />
            </div>
            <div>
              <Label>Frequência</Label>
              <Select value={newRoutineFreq} onValueChange={setNewRoutineFreq}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {newRoutineFreq === 'dia_x_mes' && (
              <>
                <div>
                  <Label>Dia do mês *</Label>
                  <Input type="number" min={1} max={31} value={newRoutineMonthlyDay} onChange={e => setNewRoutineMonthlyDay(e.target.value)} placeholder="Ex: 15" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de início *</Label>
                    <Input type="date" value={newRoutineStartDate} onChange={e => setNewRoutineStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data de fim</Label>
                    <Input type="date" value={newRoutineEndDate} onChange={e => setNewRoutineEndDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Departamento</Label>
              <Select value={newRoutineDept} onValueChange={setNewRoutineDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={newRoutineAssignee} onValueChange={setNewRoutineAssignee}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Passo a passo (um passo por linha)</Label>
              <Textarea
                value={routineSteps}
                onChange={e => setRoutineSteps(e.target.value)}
                rows={6}
                placeholder={"1. Abrir o email\n2. Verificar mensagens pendentes\n3. Responder a cada uma\n4. Arquivar"}
              />
              <p className="text-xs text-muted-foreground mt-1">Cada rotina gera um SOP associado com estes passos.</p>
            </div>
            <Button
              className="w-full"
              disabled={!newRoutineName.trim()}
              onClick={() => editingRoutine ? updateRoutine.mutate() : createRoutine.mutate()}
            >
              {editingRoutine ? 'Guardar Alterações' : 'Criar Rotina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
