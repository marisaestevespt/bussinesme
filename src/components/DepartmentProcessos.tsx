import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanningRoutines, generateTasksForRoutine } from '@/hooks/usePlanningRoutines';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Trash2, FileText, RotateCw } from 'lucide-react';

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

interface DepartmentProcessosProps {
  department: string;
}

export function DepartmentProcessos({ department }: DepartmentProcessosProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const planningRoutines = usePlanningRoutines();

  // SOP dialog state
  const [showNewSop, setShowNewSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');

  // Routine dialog state
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prRoleFunction, setPrRoleFunction] = useState('');
  const [prRoleCustom, setPrRoleCustom] = useState('');
  const [prRoleOpen, setPrRoleOpen] = useState(false);
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);
  const [prHour, setPrHour] = useState('09:00');

  // Queries
  const { data: sops = [] } = useQuery({
    queryKey: ['sops', department],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').eq('department', department).order('sop_id');
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, role_title, profile_id, photo_url').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });

  const existingRoles = [...new Set(teamMembers.map(m => m.role_title).filter(Boolean))] as string[];

  const routinesData = (planningRoutines.routines.data || []).filter((r: any) => r.department === department);

  // Mutations
  const createSop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').insert({
        name: newSopName,
        department,
        status: newSopStatus,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      setShowNewSop(false);
      setNewSopName('');
      setNewSopStatus('para_criar');
      toast.success('Processo criado');
    },
    onError: () => toast.error('Erro ao criar processo'),
  });

  function resetRoutineDialog() {
    setPrTitle(''); setPrRoleFunction(''); setPrRoleCustom(''); setPrRecurrence('semanal');
    setPrWeekday('1'); setPrMonthDay('1'); setPrAdjustBiz(true); setPrHour('09:00');
  }

  async function handleCreateRoutine() {
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
      department: department,
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

    await generateTasksForRoutine(routineResult as any, new Date().getFullYear());

    // Create linked SOP
    const { data: sopData } = await supabase.from('sops').insert({
      name: prTitle,
      department,
      status: 'ativo',
      created_by: user?.id,
      routine_id: routineResult.id,
    } as any).select('id').single();

    qc.invalidateQueries({ queryKey: ['sops'] });
    qc.invalidateQueries({ queryKey: ['planning-routines'] });
    qc.invalidateQueries({ queryKey: ['my-tasks'] });

    setShowNewRoutine(false);
    resetRoutineDialog();
    toast.success('Rotina criada e tarefas geradas');

    if (sopData?.id) {
      navigate(`/hub/processos/${sopData.id}`);
    }
  }

  return (
    <>
      <div className="space-y-8">
        {/* SOPs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Processos (SOPs)</h3>
            <Button size="sm" onClick={() => setShowNewSop(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo Processo
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sops.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem processos neste departamento</TableCell></TableRow>
                )}
                {sops.map(s => {
                  const st = getStatusInfo(s.status);
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/hub/processos/${s.id}`)}>
                      <TableCell className="font-mono text-sm">{s.sop_id}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline" className={st.color}>{st.label}</Badge></TableCell>
                      <TableCell>{s.product_name || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>

        <Separator />

        {/* Rotinas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-primary" /> Rotinas
            </h3>
            <Button size="sm" variant="outline" onClick={() => setShowNewRoutine(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Rotina
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routinesData.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem rotinas neste departamento</TableCell></TableRow>
                )}
                {routinesData.map((pr: any) => {
                  const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                  const recLabel = pr.recurrence_type === 'semanal'
                    ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                    : `Mensal — dia ${pr.month_day}${hourLabel}`;
                  return (
                    <TableRow key={pr.id}>
                      <TableCell className="font-medium">{pr.title}</TableCell>
                      <TableCell>{recLabel}</TableCell>
                      <TableCell>
                        {pr.role_function ? (
                          <Badge variant="outline" className="text-xs">{pr.role_function}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px]">
                          {pr.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={pr.active}
                            onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                            className="scale-75"
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>

      {/* Dialog: Novo Processo */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Processo (SOP)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do processo *</Label>
              <Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Onboarding de cliente" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newSopName.trim() || createSop.isPending} onClick={() => createSop.mutate()}>
              {createSop.isPending ? 'A criar...' : 'Criar Processo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Rotina */}
      <Dialog open={showNewRoutine} onOpenChange={v => { if (!v) { setShowNewRoutine(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={prTitle} onChange={e => setPrTitle(e.target.value)} placeholder="Ex: Revisão semanal de KPIs" />
            </div>
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
                    <CommandInput placeholder="Pesquisar ou criar função..." value={prRoleCustom} onValueChange={setPrRoleCustom} />
                    <CommandList>
                      <CommandEmpty>
                        {prRoleCustom.trim() && (
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded" onClick={() => { setPrRoleFunction(prRoleCustom.trim()); setPrRoleOpen(false); }}>
                            Criar "<strong>{prRoleCustom.trim()}</strong>"
                          </button>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {existingRoles.map(role => (
                          <CommandItem key={role} value={role} onSelect={() => { setPrRoleFunction(role); setPrRoleCustom(''); setPrRoleOpen(false); }}>
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
                <Input type="time" value={prHour} onChange={e => setPrHour(e.target.value)} />
              </div>
            </div>
            {prRecurrence === 'mensal' && (
              <div className="flex items-center gap-2">
                <Switch checked={prAdjustBiz} onCheckedChange={setPrAdjustBiz} />
                <Label className="text-sm">Ajustar para dia útil anterior</Label>
              </div>
            )}

            <Separator />

            <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm text-muted-foreground">
              <p>Será criado automaticamente um processo (SOP) vinculado a esta rotina.</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Nome: <strong className="text-foreground">{prTitle || '(título da rotina)'}</strong></li>
                <li>Frequência: <strong className="text-foreground">{prRecurrence === 'semanal' ? 'Semanal' : 'Mensal'}</strong></li>
              </ul>
            </div>

            <Button
              className="w-full"
              disabled={!prTitle.trim()}
              onClick={handleCreateRoutine}
            >
              Criar Rotina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
