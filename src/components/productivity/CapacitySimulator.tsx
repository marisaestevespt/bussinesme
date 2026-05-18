import { useState, useMemo, Fragment } from 'react';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Trash2, Users, Building2, ArrowLeftRight, UserPlus, Euro, AlertTriangle, Sparkles, Loader2, ChevronDown, ChevronRight, ListChecks, Save } from 'lucide-react';
import { PROCESS_DEPARTMENTS, getDeptLabel } from '@/lib/departments';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { WEEKS_PER_MONTH } from './productivity-constants';
import { isTaskDone, isTaskInProgress } from '@/lib/taskStatus';
import { formatEuro } from '@/lib/formatting';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  members: any[];
  entries: any[];
  clients: any[];
  products: any[];
}

/* ─── SUB-TAB: Análise por Departamento ─── */
function DepartmentView({ members, entries }: { members: any[]; entries: any[] }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });

  const departments = useMemo(() => {
    const deptMap: Record<string, { members: any[]; totalCapacity: number; totalRegistered: number; clientH: number; internalH: number }> = {};

    members.forEach(m => {
      const dept = m.department || 'Sem departamento';
      if (!deptMap[dept]) deptMap[dept] = { members: [], totalCapacity: 0, totalRegistered: 0, clientH: 0, internalH: 0 };
      const weeklyH = Number(m.expected_weekly_hours) || 0;
      const monthlyH = Math.round(weeklyH * WEEKS_PER_MONTH);
      const memberEntries = monthEntries.filter(e => e.member_id === m.id);
      const actualH = memberEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      const clientH = memberEntries.filter(e => e.client_id || e.category === 'cliente').reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

      deptMap[dept].members.push({ ...m, monthlyH, actualH, clientH });
      deptMap[dept].totalCapacity += monthlyH;
      deptMap[dept].totalRegistered += actualH;
      deptMap[dept].clientH += clientH;
      deptMap[dept].internalH += (actualH - clientH);
    });

    return Object.entries(deptMap).map(([name, data]) => ({
      name,
      ...data,
      usagePct: data.totalCapacity > 0 ? Math.round((data.totalRegistered / data.totalCapacity) * 100) : 0,
      remainingH: Number((data.totalCapacity - data.totalRegistered).toFixed(1)),
      clientPct: data.totalRegistered > 0 ? Math.round((data.clientH / data.totalRegistered) * 100) : 0,
    })).sort((a, b) => b.usagePct - a.usagePct);
  }, [members, monthEntries]);

  const chartData = departments.map(d => ({
    name: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name,
    capacidade: d.totalCapacity,
    registado: Number(d.totalRegistered.toFixed(1)),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map(d => (
          <Card key={d.name}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{d.name}</h3>
                <Badge variant={d.usagePct > 100 ? 'destructive' : d.usagePct > 85 ? 'secondary' : 'default'} className="text-xs">
                  {d.usagePct}%
                </Badge>
              </div>
              <Progress value={Math.min(d.usagePct, 100)} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{d.members.length} membro{d.members.length !== 1 ? 's' : ''}</span>
                <span className="text-right">{d.totalCapacity}h capacidade</span>
                <span>{d.totalRegistered.toFixed(1)}h registadas</span>
                <span className={`text-right ${d.remainingH < 0 ? 'text-destructive' : ''}`}>{d.remainingH}h restantes</span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                <div className="bg-primary h-full" style={{ width: `${d.clientPct}%` }} title="Cliente" />
                <div className="bg-accent h-full" style={{ width: `${100 - d.clientPct}%` }} title="Interno" />
              </div>
              <p className="text-[10px] text-muted-foreground">{d.clientPct}% cliente · {100 - d.clientPct}% interno</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Capacidade vs Registado por departamento</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="capacidade" name="Capacidade" fill="hsl(var(--muted-foreground) / 0.2)" radius={[4,4,0,0]} />
                <Bar dataKey="registado" name="Registado" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── SUB-TAB: Simulador de Contratação ─── */
interface PhantomMember {
  id: string;
  name: string;
  department: string;
  weeklyHours: number;
  clientPct: number;
  contractType: 'colaborador' | 'prestador';
  contractDurationMonths: number | null; // only for prestador
  grossSalary: number;
  startDate: string; // yyyy-MM-dd
  delegatedTaskIds: string[];
}
export function HiringSimulator({ members, entries }: { members: any[]; entries: any[] }) {
  const { user } = useAuth();
  const [phantoms, setPhantoms] = useState<PhantomMember[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedPhantom, setExpandedPhantom] = useState<string | null>(null);
  const [simulationName, setSimulationName] = useState('');
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Saved simulations
  const savedSimsQ = useQuery({
    queryKey: ['hiring-simulations'],
    queryFn: async () => {
      const { data } = await supabase.from('hiring_simulations').select('*').order('updated_at', { ascending: false });
      return data || [];
    },
  });

  const saveSimulation = async () => {
    if (!phantoms.length) return;
    setSaving(true);
    try {
      const payload = {
        name: simulationName || `Simulação ${new Date().toLocaleDateString('pt-PT')}`,
        phantoms: JSON.parse(JSON.stringify(phantoms)),
        created_by: user?.id || null,
      };
      if (activeSimId) {
        await supabase.from('hiring_simulations').update({ name: payload.name, phantoms: payload.phantoms }).eq('id', activeSimId);
      } else {
        const { data } = await supabase.from('hiring_simulations').insert(payload).select('id').single();
        if (data) setActiveSimId(data.id);
      }
      savedSimsQ.refetch();
    } finally {
      setSaving(false);
    }
  };

  const loadSimulation = (sim: any) => {
    setPhantoms(sim.phantoms || []);
    setSimulationName(sim.name);
    setActiveSimId(sim.id);
    setAiAnalysis(null);
  };

  const deleteSimulation = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('hiring_simulations').delete().eq('id', id);
    if (activeSimId === id) {
      setActiveSimId(null);
      setPhantoms([]);
      setSimulationName('');
    }
    savedSimsQ.refetch();
  };

  // Fetch all tasks by department (including done) for delegation analysis
  const tasksQ = useQuery({
    queryKey: ['simulator-dept-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, department, priority, deadline, estimated_time, assigned_to, status')
        .not('department', 'is', null)
        .order('estimated_time', { ascending: false, nullsFirst: false })
        .limit(500);
      return data || [];
    },
  });

  const tasksByDept = useMemo(() => {
    const map: Record<string, typeof tasksQ.data> = {};
    (tasksQ.data || []).forEach(t => {
      const dept = getDeptLabel(t.department || '');
      if (!map[dept]) map[dept] = [];
      map[dept]!.push(t);
    });
    return map;
  }, [tasksQ.data]);

  const departments = useMemo(() => {
    const depts = PROCESS_DEPARTMENTS.map(d => d.label);
    return depts;
  }, []);

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  const defaultStartDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const addPhantom = () => {
    setPhantoms(prev => [...prev, {
      id: crypto.randomUUID(),
      name: `Membro ${prev.length + 1}`,
      department: departments[0] || '__none__',
      weeklyHours: 40,
      clientPct: 70,
      contractType: 'colaborador',
      contractDurationMonths: null,
      grossSalary: 1000,
      startDate: defaultStartDate,
      delegatedTaskIds: [],
    }]);
  };

  const updatePhantom = (id: string, field: string, value: any) => {
    setPhantoms(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleTaskDelegation = (phantomId: string, taskId: string) => {
    setPhantoms(prev => prev.map(p => {
      if (p.id !== phantomId) return p;
      const ids = p.delegatedTaskIds.includes(taskId)
        ? p.delegatedTaskIds.filter(id => id !== taskId)
        : [...p.delegatedTaskIds, taskId];
      return { ...p, delegatedTaskIds: ids };
    }));
  };

  const removePhantom = (id: string) => {
    setPhantoms(prev => prev.filter(p => p.id !== id));
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });

  const simulation = useMemo(() => {
    const currentCapacity = members.reduce((s, m) => s + (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH, 0);
    const currentRegistered = monthEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
    const currentClientH = monthEntries.filter(e => e.client_id || e.category === 'cliente').reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

    const phantomCapacity = phantoms.reduce((s, p) => s + p.weeklyHours * WEEKS_PER_MONTH, 0);
    const phantomClientH = phantoms.reduce((s, p) => s + p.weeklyHours * WEEKS_PER_MONTH * (p.clientPct / 100), 0);

    const newCapacity = currentCapacity + phantomCapacity;
    const newUsage = newCapacity > 0 ? Math.round((currentRegistered / newCapacity) * 100) : 0;
    const currentUsage = currentCapacity > 0 ? Math.round((currentRegistered / currentCapacity) * 100) : 0;

    const deptImpact: Record<string, { current: number; added: number }> = {};
    members.forEach(m => {
      const dept = m.department || 'Sem departamento';
      if (!deptImpact[dept]) deptImpact[dept] = { current: 0, added: 0 };
      deptImpact[dept].current += (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
    });
    phantoms.forEach(p => {
      const dept = (!p.department || p.department === '__none__') ? 'Sem departamento' : p.department;
      if (!deptImpact[dept]) deptImpact[dept] = { current: 0, added: 0 };
      deptImpact[dept].added += p.weeklyHours * WEEKS_PER_MONTH;
    });

    // Financial calculations
    const financialPerMember = phantoms.map(p => {
      const gross = p.grossSalary;
      if (p.contractType === 'colaborador') {
        const ssEmployer = Math.round(gross * 0.2375 * 100) / 100;
        const mealAllowance = 6 * 22; // ~132€/month (6€/day * 22 days)
        const totalCostMonth = gross + ssEmployer + mealAllowance;
        const totalCostYear = totalCostMonth * 14; // 14 months (with holiday & christmas bonus)
        return {
          id: p.id,
          name: p.name,
          type: 'Colaborador' as const,
          gross,
          ssEmployer,
          mealAllowance,
          iva: 0,
          totalCostMonth: Math.round(totalCostMonth * 100) / 100,
          totalCostYear: Math.round(totalCostYear * 100) / 100,
          startDate: p.startDate,
        };
      } else {
        // Prestador — valor da fatura + IVA 23%, duration in months
        const durationMonths = p.contractDurationMonths || 12;
        const iva = Math.round(gross * 0.23 * 100) / 100;
        const totalCostMonth = gross + iva;
        return {
          id: p.id,
          name: p.name,
          type: 'Prestador' as const,
          gross,
          ssEmployer: 0,
          mealAllowance: 0,
          iva,
          totalCostMonth,
          totalCostYear: totalCostMonth * durationMonths,
          durationMonths,
          startDate: p.startDate,
        };
      }
    });

    const totalMonthlyCost = financialPerMember.reduce((s, f) => s + f.totalCostMonth, 0);
    const totalAnnualCost = financialPerMember.reduce((s, f) => s + f.totalCostYear, 0);

    // Financial viability: calculate cost from start date to end of year
    const costByMonth: { month: string; cost: number; cumulative: number }[] = [];
    let cumulative = 0;
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(now.getFullYear(), m, 1);
      const monthLabel = monthDate.toLocaleString('pt-PT', { month: 'short' }).replace('.', '');
      let monthlyCost = 0;
      financialPerMember.forEach(f => {
        const startD = new Date(f.startDate);
        if (monthDate >= new Date(startD.getFullYear(), startD.getMonth(), 1)) {
          monthlyCost += f.totalCostMonth;
          // Add extra month costs for colaborador (sub férias + natal in specific months)
        }
      });
      cumulative += monthlyCost;
      costByMonth.push({ month: monthLabel, cost: Math.round(monthlyCost), cumulative: Math.round(cumulative) });
    }

    return {
      currentCapacity: Math.round(currentCapacity),
      currentUsage,
      currentTeamSize: members.length,
      currentClientH,
      newCapacity: Math.round(newCapacity),
      newUsage,
      newTeamSize: members.length + phantoms.length,
      addedClientH: Math.round(phantomClientH),
      addedCapacity: Math.round(phantomCapacity),
      freeHoursGained: Math.round(phantomCapacity - (currentRegistered > currentCapacity ? currentRegistered - currentCapacity : 0)),
      deptImpact: Object.entries(deptImpact).map(([name, data]) => ({
        name,
        atual: Math.round(data.current),
        novo: Math.round(data.current + data.added),
      })),
      financialPerMember,
      totalMonthlyCost,
      totalAnnualCost,
      costByMonth,
    };
  }, [members, monthEntries, phantoms]);

  return (
    <div className="space-y-4">
      {/* Saved simulations */}
      {(savedSimsQ.data || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" /> Simulações guardadas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex flex-wrap gap-2">
              {(savedSimsQ.data || []).map(sim => (
                <div key={sim.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${activeSimId === sim.id ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}>
                  <button onClick={() => loadSimulation(sim)} className="font-medium">{sim.name}</button>
                  <button onClick={() => deleteSimulation(sim.id)} className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Nome da simulação..."
            value={simulationName}
            onChange={e => setSimulationName(e.target.value)}
            className="h-8 text-sm max-w-64"
          />
          {phantoms.length > 0 && (
            <Button size="sm" variant="outline" onClick={saveSimulation} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {activeSimId ? 'Atualizar' : 'Guardar'}
            </Button>
          )}
        </div>
        <Button size="sm" onClick={addPhantom}><UserPlus className="h-3.5 w-3.5 mr-1.5" />Adicionar membro</Button>
      </div>

      {phantoms.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor mensal (€)</TableHead>
                <TableHead>Data início</TableHead>
                <TableHead className="text-right">h/semana</TableHead>
                <TableHead className="text-right">% Cliente</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {phantoms.map(p => {
                  const deptTasks = tasksByDept[p.department] || [];
                  const isExpanded = expandedPhantom === p.id;
                  const delegatedCount = p.delegatedTaskIds.length;
                  const delegatedHours = (tasksQ.data || [])
                    .filter(t => p.delegatedTaskIds.includes(t.id))
                    .reduce((s, t) => s + (Number(t.estimated_time) || 0), 0);

                  return (
                    <Fragment key={p.id}>
                      <TableRow>
                        <TableCell>
                          <Select value={p.department} onValueChange={v => {
                            updatePhantom(p.id, 'department', v);
                            updatePhantom(p.id, 'delegatedTaskIds', []);
                          }}>
                            <SelectTrigger className="h-7 text-sm w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                              <SelectItem value="__none__">Sem departamento</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select value={p.contractType} onValueChange={v => {
                              updatePhantom(p.id, 'contractType', v);
                              if (v === 'colaborador') updatePhantom(p.id, 'contractDurationMonths', null);
                              else if (!p.contractDurationMonths) updatePhantom(p.id, 'contractDurationMonths', 12);
                            }}>
                              <SelectTrigger className="h-7 text-sm w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="colaborador">Colaborador</SelectItem>
                                <SelectItem value="prestador">Prestador</SelectItem>
                              </SelectContent>
                            </Select>
                            {p.contractType === 'prestador' && (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={p.contractDurationMonths || 12}
                                  onChange={e => updatePhantom(p.id, 'contractDurationMonths', Math.max(1, Number(e.target.value)))}
                                  className="h-7 text-sm w-14 text-right"
                                  min={1}
                                  max={60}
                                />
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">meses</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" value={p.grossSalary} onChange={e => updatePhantom(p.id, 'grossSalary', Number(e.target.value))} className="h-7 text-sm w-24 text-right ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Input type="date" value={p.startDate} onChange={e => updatePhantom(p.id, 'startDate', e.target.value)} className="h-7 text-sm w-36" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" value={p.weeklyHours} onChange={e => updatePhantom(p.id, 'weeklyHours', Number(e.target.value))} className="h-7 text-sm w-16 text-right ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" value={p.clientPct} onChange={e => updatePhantom(p.id, 'clientPct', Number(e.target.value))} className="h-7 text-sm w-16 text-right ml-auto" min={0} max={100} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button onClick={() => removePhantom(p.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Delegable tasks row */}
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={7} className="py-0 px-2">
                          <Collapsible open={isExpanded} onOpenChange={open => setExpandedPhantom(open ? p.id : null)}>
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors w-full">
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <ListChecks className="h-3 w-3" />
                                <span>Tarefas a delegar</span>
                                {delegatedCount > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    {delegatedCount} selecionada{delegatedCount > 1 ? 's' : ''}
                                    {delegatedHours > 0 && ` · ~${delegatedHours}h`}
                                  </Badge>
                                )}
                                {p.department !== '__none__' && deptTasks.length > 0 && delegatedCount === 0 && (
                                  <span className="text-muted-foreground/60">({deptTasks.length} disponíveis)</span>
                                )}
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {p.department === '__none__' ? (
                                <p className="text-xs text-muted-foreground py-2 pl-5">Seleciona um departamento para ver as tarefas.</p>
                              ) : deptTasks.length === 0 ? (
                                <EmptyHint className="pl-5">Sem tarefas neste departamento.</EmptyHint>
                              ) : (
                                <div className="py-2 pl-5 space-y-1 max-h-56 overflow-y-auto">
                                  <p className="text-[10px] text-muted-foreground/60 mb-1">Ordenado por tempo estimado · Inclui tarefas concluídas para referência</p>
                                  {[...deptTasks]
                                    .sort((a, b) => (Number(b.estimated_time) || 0) - (Number(a.estimated_time) || 0))
                                    .map(task => (
                                    <label key={task.id} className={`flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 ${isTaskDone(task) ? 'opacity-70' : ''}`}>
                                      <Checkbox
                                        checked={p.delegatedTaskIds.includes(task.id)}
                                        onCheckedChange={() => toggleTaskDelegation(p.id, task.id)}
                                        className="mt-0.5 h-3.5 w-3.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-foreground ${isTaskDone(task) ? 'line-through' : ''}`}>{task.name}</span>
                                        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                                          {isTaskDone(task) && <Badge variant="secondary" className="text-[10px] h-4 px-1">concluída</Badge>}
                                          {isTaskInProgress(task) && <Badge className="text-[10px] h-4 px-1 bg-primary/15 text-primary border-0">em curso</Badge>}
                                          {task.estimated_time ? (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{task.estimated_time}h</Badge>
                                          ) : (
                                            <span className="text-muted-foreground/50 italic">sem estimativa</span>
                                          )}
                                          {task.priority && <span className="capitalize">{task.priority}</span>}
                                          {task.deadline && <span>até {new Date(task.deadline + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Before / After comparison — Capacity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Situação atual</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>Equipa</span><span className="font-medium">{simulation.currentTeamSize} membros</span></div>
            <div className="flex justify-between text-sm"><span>Capacidade mensal</span><span className="font-medium">{simulation.currentCapacity}h</span></div>
            <div className="flex justify-between text-sm"><span>Ocupação</span><span className={`font-medium ${simulation.currentUsage > 100 ? 'text-destructive' : ''}`}>{simulation.currentUsage}%</span></div>
            <Progress value={Math.min(simulation.currentUsage, 100)} className="h-2" />
          </CardContent>
        </Card>
        <Card className={phantoms.length > 0 ? 'border-primary/30 bg-primary/5' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Com novas contratações</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>Equipa</span><span className="font-medium">{simulation.newTeamSize} membros</span></div>
            <div className="flex justify-between text-sm"><span>Capacidade mensal</span><span className="font-medium">{simulation.newCapacity}h</span></div>
            <div className="flex justify-between text-sm"><span>Ocupação</span><span className={`font-medium ${simulation.newUsage > 100 ? 'text-destructive' : ''}`}>{simulation.newUsage}%</span></div>
            <Progress value={Math.min(simulation.newUsage, 100)} className="h-2" />
            {phantoms.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                +{simulation.addedCapacity}h capacidade · +{simulation.addedClientH}h para clientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Impact */}
      {phantoms.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Euro className="h-4 w-4" /> Impacto financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Custo mensal adicional</p>
                <p className="text-lg font-bold text-destructive">{formatEuro(simulation.totalMonthlyCost)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Custo anual adicional</p>
                <p className="text-lg font-bold text-destructive">{formatEuro(simulation.totalAnnualCost)}</p>
                <p className="text-[10px] text-muted-foreground">Colaboradores: 14 meses · Prestadores: 12 meses</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Custo restante do ano</p>
                <p className="text-lg font-bold">{formatEuro(simulation.costByMonth[simulation.costByMonth.length - 1]?.cumulative || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Acumulado até dezembro</p>
              </div>
            </div>

            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead className="text-right">Valor base</TableHead>
                <TableHead className="text-right">SS Empresa (23,75%)</TableHead>
                <TableHead className="text-right">Sub. Alimentação</TableHead>
                <TableHead className="text-right">IVA (23%)</TableHead>
                <TableHead className="text-right font-semibold">Custo/mês</TableHead>
                <TableHead className="text-right font-semibold">Custo/ano</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {simulation.financialPerMember.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="text-sm">{f.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{f.type}</Badge></TableCell>
                    <TableCell className="">{f.startDate ? new Date(f.startDate + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(f.gross)}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Colaborador' ? formatEuro(f.ssEmployer) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Colaborador' ? formatEuro(f.mealAllowance) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Prestador' ? formatEuro(f.iva) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatEuro(f.totalCostMonth)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatEuro(f.totalCostYear)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell colSpan={7} className="text-sm font-semibold text-right">Total</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{formatEuro(simulation.totalMonthlyCost)}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{formatEuro(simulation.totalAnnualCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Cost timeline chart */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Projeção de custo mensal (a partir da data de início)</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulation.costByMonth}>
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={v => `${v}€`} />
                    <Tooltip formatter={(v: number) => formatEuro(v)} />
                    <Legend />
                    <Bar dataKey="cost" name="Custo mensal" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                    <Bar dataKey="cumulative" name="Acumulado" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department impact */}
      {phantoms.length > 0 && simulation.deptImpact.some(d => d.novo !== d.atual) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Impacto por departamento</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simulation.deptImpact}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="atual" name="Atual" fill="hsl(var(--muted-foreground) / 0.2)" radius={[4,4,0,0]} />
                <Bar dataKey="novo" name="Com contratações" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {phantoms.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Análise da simulação
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setAiLoading(true);
                  setAiAnalysis(null);
                  try {
                    const payload = {
                      currentTeamSize: simulation.currentTeamSize,
                      currentCapacity: simulation.currentCapacity,
                      currentUsage: simulation.currentUsage,
                      phantomCount: phantoms.length,
                      phantoms: simulation.financialPerMember.map((f, i) => {
                        const ph = phantoms[i];
                        const delegatedNames = (tasksQ.data || [])
                          .filter(t => ph?.delegatedTaskIds.includes(t.id))
                          .map(t => t.name);
                        return {
                          name: f.name,
                          type: f.type,
                          department: ph?.department || '—',
                          weeklyHours: ph?.weeklyHours || 0,
                          clientPct: ph?.clientPct || 0,
                          totalCostMonth: f.totalCostMonth,
                          startDate: f.startDate,
                          delegatedTasks: delegatedNames,
                        };
                      }),
                      newCapacity: simulation.newCapacity,
                      newUsage: simulation.newUsage,
                      totalMonthlyCost: simulation.totalMonthlyCost,
                      totalAnnualCost: simulation.totalAnnualCost,
                      addedCapacity: simulation.addedCapacity,
                      addedClientH: simulation.addedClientH,
                    };
                    const { data, error } = await supabase.functions.invoke('analyze-hiring-simulation', {
                      body: { simulation: payload },
                    });
                    if (error) throw error;
                    setAiAnalysis(data.analysis);
                  } catch (e: any) {
                    setAiAnalysis('Erro ao gerar análise: ' + (e.message || 'tente novamente.'));
                  } finally {
                    setAiLoading(false);
                  }
                }}
                disabled={aiLoading}
                className="gap-2"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiLoading ? 'A analisar...' : aiAnalysis ? 'Reanalisar' : 'Analisar simulação'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!aiAnalysis && !aiLoading && (
              <p className="text-sm text-muted-foreground">
                Clica em "Analisar simulação" para obter uma análise inteligente sobre a viabilidade, timing e custo-benefício desta contratação.
              </p>
            )}
            {aiLoading && (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">A analisar a simulação...</span>
              </div>
            )}
            {aiAnalysis && !aiLoading && (
              <div className="prose prose-sm max-w-none text-sm leading-relaxed space-y-2 [&_strong]:text-foreground [&_ul]:space-y-1 [&_li]:text-muted-foreground">
                {aiAnalysis.split('\n').map((line, i) => {
                  if (!line.trim()) return null;
                  // Bold headers
                  if (line.startsWith('**') || line.startsWith('# ') || line.startsWith('## ')) {
                    const clean = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                    return <p key={i} className="font-semibold text-foreground mt-3 first:mt-0">{clean}</p>;
                  }
                  // Bullet points
                  if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ')) {
                    const content = line.replace(/^\s*[-•*]\s*/, '');
                    return (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-primary mt-0.5">•</span>
                        <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')) }} />
                      </div>
                    );
                  }
                  // Regular text with bold support
                  return <p key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')) }} />;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}



/* ─── MAIN COMPONENT ─── */
export function CapacitySimulator({ members, entries, clients, products }: Props) {
  const activeMembers = members.filter(m => m.status === 'ativo');

  return (
    <div className="space-y-4">
      <Tabs defaultValue="department">
        <TabsList className="flex-wrap">
          <TabsTrigger value="department"><Building2 className="h-3.5 w-3.5 mr-1.5" />Por Departamento</TabsTrigger>
          <TabsTrigger value="hiring"><UserPlus className="h-3.5 w-3.5 mr-1.5" />Simular Contratação</TabsTrigger>
        </TabsList>

        <TabsContent value="department">
          <DepartmentView members={activeMembers} entries={entries} />
        </TabsContent>
        <TabsContent value="hiring">
          <HiringSimulator members={activeMembers} entries={entries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
