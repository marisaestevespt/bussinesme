import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Trash2, ChevronLeft, FileText, List } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BackNavigation } from '@/components/BackNavigation';

const DEPT = 'marketing';

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
];

function getStatusInfo(status: string) {
  return SOP_STATUSES.find(s => s.value === status) || SOP_STATUSES[0];
}

export default function MarketingProcessos() {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('galeria');
  const [showNewSop, setShowNewSop] = useState(false);
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [newSopName, setNewSopName] = useState('');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineFreq, setNewRoutineFreq] = useState('todos_os_dias');
  const [newRoutineAssignee, setNewRoutineAssignee] = useState('');
  const [routineSteps, setRoutineSteps] = useState('');

  const { data: sops = [] } = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').order('sop_id');
      return data || [];
    },
  });

  const { data: routines = [] } = useQuery({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await supabase.from('routines').select('*').order('created_at');
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
  });

  const mktSops = sops.filter(s => s.department === DEPT);
  const mktRoutines = routines.filter(r => r.department === DEPT);
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  const sortedSops = [...mktSops].sort((a, b) => {
    const numA = parseInt(a.sop_id?.replace('SOP-', '') || '0');
    const numB = parseInt(b.sop_id?.replace('SOP-', '') || '0');
    return numA - numB;
  });

  // Mutations
  const createSop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').insert({
        name: newSopName, department: DEPT, status: newSopStatus, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sops'] }); setShowNewSop(false); setNewSopName(''); toast.success('Processo criado'); },
    onError: () => toast.error('Erro ao criar processo'),
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      let sopId: string | null = null;
      if (routineSteps.trim()) {
        const steps = routineSteps.split('\n').filter(s => s.trim());
        const { data: sopData, error: sopError } = await supabase.from('sops').insert({
          name: `Rotina: ${newRoutineName}`, department: DEPT, status: 'ativo', created_by: user?.id, passos: steps,
        }).select('id').single();
        if (sopError) throw sopError;
        sopId = sopData.id;
      }
      const { error } = await supabase.from('routines').insert({
        name: newRoutineName, department: DEPT, frequency: newRoutineFreq,
        assigned_to: newRoutineAssignee || null, created_by: user?.id, sop_id: sopId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routines', 'sops'] }); setShowNewRoutine(false); resetRoutineForm(); toast.success('Rotina criada'); },
    onError: () => toast.error('Erro ao criar rotina'),
  });

  const updateRoutine = useMutation({
    mutationFn: async () => {
      if (!editingRoutine) return;
      let sopId = editingRoutine.sop_id;
      const steps = routineSteps.split('\n').filter(s => s.trim());
      if (sopId) {
        await supabase.from('sops').update({ passos: steps }).eq('id', sopId);
      } else if (steps.length > 0) {
        const { data: sopData } = await supabase.from('sops').insert({
          name: `Rotina: ${newRoutineName}`, department: DEPT, status: 'ativo', created_by: user?.id, passos: steps,
        }).select('id').single();
        sopId = sopData?.id || null;
      }
      await supabase.from('routines').update({
        name: newRoutineName, frequency: newRoutineFreq, assigned_to: newRoutineAssignee || null, sop_id: sopId,
      }).eq('id', editingRoutine.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routines', 'sops'] }); setEditingRoutine(null); resetRoutineForm(); toast.success('Rotina atualizada'); },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => { await supabase.from('routines').delete().eq('id', id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routines'] }); toast.success('Rotina eliminada'); },
  });

  function resetRoutineForm() {
    setNewRoutineName(''); setNewRoutineFreq('todos_os_dias'); setNewRoutineAssignee(''); setRoutineSteps('');
  }

  function openEditRoutine(routine: any) {
    setEditingRoutine(routine);
    setNewRoutineName(routine.name);
    setNewRoutineFreq(routine.frequency);
    setNewRoutineAssignee(routine.assigned_to || '');
    if (routine.sop_id) {
      const linked = sops.find(s => s.id === routine.sop_id);
      setRoutineSteps(linked && Array.isArray(linked.passos) ? (linked.passos as string[]).join('\n') : '');
    } else {
      setRoutineSteps('');
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Processos de Marketing" subtitle="Marketing 360" />

        <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewRoutine(true)}>
                <Plus className="h-4 w-4 mr-1" />Nova Rotina
              </Button>
              <Button size="sm" onClick={() => setShowNewSop(true)}>
                <Plus className="h-4 w-4 mr-1" />Novo Processo
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="galeria"><FileText className="h-4 w-4 mr-1" />Galeria</TabsTrigger>
              <TabsTrigger value="lista"><List className="h-4 w-4 mr-1" />Lista</TabsTrigger>
            </TabsList>

            {/* Galeria */}
            <TabsContent value="galeria" className="space-y-8 mt-6">
              {/* SOPs */}
              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4">SOPs ({mktSops.length})</h2>
                {mktSops.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum processo de marketing criado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedSops.map(sop => {
                      const st = getStatusInfo(sop.status);
                      return (
                        <Card key={sop.id} className="cursor-pointer hover:shadow-md hq-transition" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                              <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
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
              </section>

              {/* Rotinas */}
              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4">Rotinas ({mktRoutines.length})</h2>
                {mktRoutines.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma rotina de marketing criada.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {mktRoutines.map(routine => {
                      const assignee = routine.assigned_to ? profileMap[routine.assigned_to] : null;
                      const freqLabel = FREQUENCIES.find(f => f.value === routine.frequency)?.label || routine.frequency;
                      const linkedSop = routine.sop_id ? sops.find(s => s.id === routine.sop_id) : null;
                      return (
                        <Card key={routine.id} className="p-3 cursor-pointer hover:shadow-md hq-transition" onClick={() => openEditRoutine(routine)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">{routine.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{freqLabel}</p>
                              {linkedSop && <Badge variant="outline" className="text-[10px] mt-1">{linkedSop.sop_id}</Badge>}
                            </div>
                            {isOwner && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => { e.stopPropagation(); deleteRoutine.mutate(routine.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
            </TabsContent>

            {/* Lista */}
            <TabsContent value="lista" className="mt-6">
              <h2 className="text-xl font-bold tracking-tight mb-4">Lista de SOPs — Marketing</h2>
              {sortedSops.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum SOP de marketing.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Nº SOP</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSops.map(sop => {
                        const st = getStatusInfo(sop.status);
                        return (
                          <TableRow key={sop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                            <TableCell className="font-mono text-sm">{sop.sop_id}</TableCell>
                            <TableCell className="font-medium">{sop.name}</TableCell>
                            <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog: Novo SOP */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Processo (SOP)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Criação de conteúdo" /></div>
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

      {/* Dialog: Nova/Editar Rotina */}
      <Dialog open={showNewRoutine || !!editingRoutine} onOpenChange={v => { if (!v) { setShowNewRoutine(false); setEditingRoutine(null); resetRoutineForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRoutine ? 'Editar Rotina' : 'Nova Rotina'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} placeholder="Ex: Publicar stories" /></div>
            <div>
              <Label>Frequência</Label>
              <Select value={newRoutineFreq} onValueChange={setNewRoutineFreq}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
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
              <Label>Passo a passo (um por linha)</Label>
              <Textarea value={routineSteps} onChange={e => setRoutineSteps(e.target.value)} rows={5} placeholder={"1. Preparar conteúdo\n2. Publicar\n3. Monitorizar"} />
            </div>
            <Button className="w-full" disabled={!newRoutineName.trim()} onClick={() => editingRoutine ? updateRoutine.mutate() : createRoutine.mutate()}>
              {editingRoutine ? 'Guardar' : 'Criar Rotina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
