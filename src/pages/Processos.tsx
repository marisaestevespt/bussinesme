import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, ArrowLeft, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo', gradient: 'from-slate-600 to-slate-800', icon: '🏢' },
  { value: 'marketing', label: 'Marketing', gradient: 'from-pink-500 to-rose-700', icon: '📣' },
  { value: 'comercial', label: 'Comercial', gradient: 'from-amber-500 to-orange-700', icon: '🤝' },
  { value: 'financeiro', label: 'Financeiro', gradient: 'from-emerald-500 to-green-800', icon: '💰' },
  { value: 'customer_success', label: 'Customer Success', gradient: 'from-cyan-500 to-teal-700', icon: '⭐' },
  { value: 'operacoes', label: 'Operações', gradient: 'from-violet-500 to-purple-800', icon: '⚙️' },
  { value: 'produto_servico', label: 'Produto/Serviço', gradient: 'from-blue-500 to-indigo-800', icon: '🚀' },
  { value: 'recursos_humanos', label: 'Recursos Humanos', gradient: 'from-rose-400 to-pink-700', icon: '👥' },
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

function getDept(val: string) {
  return DEPARTMENTS.find(d => d.value === val);
}

function getDeptLabel(val: string) {
  return getDept(val)?.label || val;
}

// ─── Main Page ──────────────────────────────────────────────────

export default function ProcessosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
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

  // ─── Derived data ────────────────────────────────────────────

  const sopCountByDept = DEPARTMENTS.map(d => ({
    ...d,
    count: sops.filter(s => s.department === d.value).length,
  }));

  const deptSops = selectedDept ? sops.filter(s => s.department === selectedDept) : [];

  const filteredRoutines = routineFilter === 'all' ? routines : routines.filter(r => r.department === routineFilter);

  // Group routines by department
  const routinesByDept: Record<string, typeof routines> = {};
  filteredRoutines.forEach(r => {
    if (!routinesByDept[r.department]) routinesByDept[r.department] = [];
    routinesByDept[r.department].push(r);
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  return (
    <AppLayout>
      <div className="space-y-10">
        {/* ═══ SECÇÃO 1: SOPs — Gallery ═══ */}
        <section>
          <div className="flex items-center justify-between mb-6">
            {selectedDept ? (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDept(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">
                  {getDeptLabel(selectedDept)}
                </h1>
                <span className="text-muted-foreground text-sm">({deptSops.length} processos)</span>
              </div>
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">Processos (SOPs)</h1>
            )}
            <Button onClick={() => { if (selectedDept) setNewSopDept(selectedDept); setShowNewSop(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Processo
            </Button>
          </div>

          {!selectedDept ? (
            /* ── Department Gallery ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sopCountByDept.map(dept => (
                <button
                  key={dept.value}
                  onClick={() => setSelectedDept(dept.value)}
                  className="group text-left rounded-xl overflow-hidden border border-border hover:shadow-lg hq-transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {/* Cover */}
                  <div className={cn('h-32 bg-gradient-to-br flex items-center justify-center relative', dept.gradient)}>
                    <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">{dept.icon}</span>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
                  </div>
                  {/* Info */}
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
            /* ── SOPs within department ── */
            deptSops.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Nenhum processo neste departamento.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {deptSops.map(sop => {
                  const statusInfo = getStatusInfo(sop.status);
                  return (
                    <Card
                      key={sop.id}
                      className="cursor-pointer hover:shadow-md hq-transition"
                      onClick={() => navigate(`/hub/processos/${sop.id}`)}
                    >
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
            )
          )}
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

          {/* Routines by department */}
          {Object.keys(routinesByDept).length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma rotina encontrada.</p>
          )}
          {Object.entries(routinesByDept).map(([dept, items]) => {
            const deptInfo = getDept(dept);
            const freqLabel = (val: string) => FREQUENCIES.find(f => f.value === val)?.label || val;
            return (
              <div key={dept} className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  {deptInfo?.icon && <span>{deptInfo.icon}</span>}
                  {getDeptLabel(dept)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map(routine => {
                    const assignee = routine.assigned_to ? profileMap[routine.assigned_to] : null;
                    return (
                      <Card key={routine.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{routine.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{freqLabel(routine.frequency)}</p>
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
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* ═══ Dialog: Novo Processo ═══ */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent className="max-w-2xl">
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
        <DialogContent className="max-w-2xl">
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
