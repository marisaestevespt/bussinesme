import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'produto_servico', label: 'Produto/Serviço' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
];

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

function getDeptLabel(val: string) {
  return DEPARTMENTS.find(d => d.value === val)?.label || val;
}

// ─── Main Page ──────────────────────────────────────────────────

export default function ProcessosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [sopFilter, setSopFilter] = useState<string>('all');
  const [routineFilter, setRoutineFilter] = useState<string>('all');
  const [showNewSop, setShowNewSop] = useState(false);
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopDept, setNewSopDept] = useState('administrativo');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDept, setNewRoutineDept] = useState('administrativo');
  const [newRoutineFreq, setNewRoutineFreq] = useState('todos_os_dias');
  const [newRoutineAssignee, setNewRoutineAssignee] = useState<string>('');

  // ─── Queries ──────────────────────────────────────────────────

  const { data: sops = [] } = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sops').select('*').order('created_at', { ascending: false });
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
      const { error } = await supabase.from('routines').insert({
        name: newRoutineName,
        department: newRoutineDept,
        frequency: newRoutineFreq,
        assigned_to: newRoutineAssignee || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      setShowNewRoutine(false);
      setNewRoutineName('');
      toast.success('Rotina criada');
    },
    onError: () => toast.error('Erro ao criar rotina'),
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

  // ─── Filtered data ───────────────────────────────────────────

  const filteredSops = sopFilter === 'all' ? sops : sops.filter(s => s.department === sopFilter);
  const filteredRoutines = routineFilter === 'all' ? routines : routines.filter(r => r.department === routineFilter);

  // Group SOPs by department
  const sopsByDept: Record<string, typeof sops> = {};
  filteredSops.forEach(sop => {
    if (!sopsByDept[sop.department]) sopsByDept[sop.department] = [];
    sopsByDept[sop.department].push(sop);
  });

  // Profile lookup
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  return (
    <AppLayout>
      <div className="space-y-10">
        {/* ═══ SECÇÃO 1: SOPs ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Processos (SOPs)</h1>
            <Button onClick={() => setShowNewSop(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Processo
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant={sopFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSopFilter('all')}>
              Todos
            </Button>
            {DEPARTMENTS.map(d => (
              <Button
                key={d.value}
                variant={sopFilter === d.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSopFilter(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>

          {/* Gallery by department */}
          {Object.keys(sopsByDept).length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum processo encontrado.</p>
          )}
          {Object.entries(sopsByDept).map(([dept, items]) => (
            <div key={dept} className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {getDeptLabel(dept)}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(sop => {
                  const statusInfo = getStatusInfo(sop.status);
                  return (
                    <Card
                      key={sop.id}
                      className="cursor-pointer hover:shadow-md hq-transition"
                      onClick={() => navigate(`/hub/processos/${sop.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                          <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium text-sm line-clamp-2">{sop.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{getDeptLabel(sop.department)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* ═══ SECÇÃO 2: Rotinas ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Rotinas</h2>
            <Button onClick={() => setShowNewRoutine(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Rotina
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant={routineFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setRoutineFilter('all')}>
              Todos
            </Button>
            {DEPARTMENTS.map(d => (
              <Button
                key={d.value}
                variant={routineFilter === d.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoutineFilter(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>

          {/* Kanban */}
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4 min-w-max">
              {FREQUENCIES.map(freq => {
                const items = filteredRoutines.filter(r => r.frequency === freq.value);
                return (
                  <div key={freq.value} className="w-60 shrink-0">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold mb-3">{freq.label}</h4>
                      <div className="space-y-2 min-h-[60px]">
                        {items.map(routine => {
                          const assignee = routine.assigned_to ? profileMap[routine.assigned_to] : null;
                          return (
                            <Card key={routine.id} className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-2">{routine.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{getDeptLabel(routine.department)}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => deleteRoutine.mutate(routine.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              {assignee && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={assignee.avatar_url || ''} />
                                    <AvatarFallback className="text-[10px]">
                                      {(assignee.full_name || '?')[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {assignee.full_name}
                                  </span>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                        {items.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Sem rotinas</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </section>
      </div>

      {/* ═══ Dialog: Novo Processo ═══ */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Processo (SOP)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do processo *</Label>
              <Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Onboarding de cliente" />
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={newSopDept} onValueChange={setNewSopDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOP_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newSopName.trim()} onClick={() => createSop.mutate()}>
              Criar Processo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Nova Rotina ═══ */}
      <Dialog open={showNewRoutine} onOpenChange={setShowNewRoutine}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Rotina</DialogTitle>
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
                <SelectContent>
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={newRoutineDept} onValueChange={setNewRoutineDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={newRoutineAssignee} onValueChange={setNewRoutineAssignee}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newRoutineName.trim()} onClick={() => createRoutine.mutate()}>
              Criar Rotina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
