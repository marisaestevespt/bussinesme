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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowLeft, FileText, List, RotateCw } from 'lucide-react';
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
  const [prResponsible, setPrResponsible] = useState('');
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);

  const { allViews, addView, renameView, deleteView } = useUserViews('processos', PROCESSOS_DEFAULT_VIEWS);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [showNewSop, setShowNewSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopDept, setNewSopDept] = useState('administrativo');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
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

  function resetRoutineDialog() {
    setPrTitle(''); setPrResponsible(''); setPrRecurrence('semanal'); setPrWeekday('1'); setPrMonthDay('1'); setPrAdjustBiz(true);
  }

  // ─── Derived data ────────────────────────────────────────────

  const sopCountByDept = DEPARTMENTS.map(d => ({
    ...d,
    count: sops.filter(s => s.department === d.value).length,
  }));

  const deptSops = selectedDept ? sops.filter(s => s.department === selectedDept) : [];

  const allSopsSorted = [...sops].sort((a, b) => {
    const numA = parseInt(a.sop_id?.replace('SOP-', '') || '0');
    const numB = parseInt(b.sop_id?.replace('SOP-', '') || '0');
    return numA - numB;
  });

  const totalSopCount = sops.length;

  const routinesData = planningRoutines.routines.data || [];

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
                    const recLabel = pr.recurrence_type === 'semanal'
                      ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira`
                      : `Mensal — dia ${pr.month_day}${pr.adjust_to_business_day ? ' (ajuste dia útil)' : ''}`;
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

      {/* ═══ Dialog: Nova Rotina ═══ */}
      <Dialog open={showNewRoutineDialog} onOpenChange={v => { if (!v) { setShowNewRoutineDialog(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={prTitle} onChange={e => setPrTitle(e.target.value)} placeholder="Ex: Revisão semanal de KPIs" />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={prResponsible} onValueChange={setPrResponsible}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
              </Select>
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
              <>
                <div>
                  <Label>Dia do mês</Label>
                  <Input type="number" min={1} max={31} value={prMonthDay} onChange={e => setPrMonthDay(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={prAdjustBiz} onCheckedChange={setPrAdjustBiz} />
                  <Label className="text-sm">Ajustar para dia útil anterior (se cair em fim de semana)</Label>
                </div>
              </>
            )}
            <Button
              className="w-full"
              disabled={!prTitle.trim() || planningRoutines.createRoutine.isPending}
              onClick={() => {
                planningRoutines.createRoutine.mutate({
                  title: prTitle,
                  responsible: prResponsible || null,
                  recurrence_type: prRecurrence,
                  weekday: prRecurrence === 'semanal' ? Number(prWeekday) : null,
                  month_day: prRecurrence === 'mensal' ? Number(prMonthDay) : null,
                  adjust_to_business_day: prRecurrence === 'mensal' ? prAdjustBiz : true,
                  created_by: user?.id,
                }, {
                  onSuccess: () => {
                    setShowNewRoutineDialog(false);
                    resetRoutineDialog();
                  },
                });
              }}
            >
              {planningRoutines.createRoutine.isPending ? 'A criar...' : 'Criar Rotina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
