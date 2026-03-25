import { useState, useMemo, Fragment } from 'react';
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
import { Plus, Trash2, Users, Building2, TrendingUp, ArrowLeftRight, UserPlus, Euro, AlertTriangle, Sparkles, Loader2, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { PROCESS_DEPARTMENTS, getDeptLabel } from '@/lib/departments';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

const WEEKS_PER_MONTH = 4.33;

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
  grossSalary: number;
  startDate: string; // yyyy-MM-dd
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

function HiringSimulator({ members, entries }: { members: any[]; entries: any[] }) {
  const [phantoms, setPhantoms] = useState<PhantomMember[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
      name: `Novo membro ${prev.length + 1}`,
      department: departments[0] || '__none__',
      weeklyHours: 40,
      clientPct: 70,
      contractType: 'colaborador',
      grossSalary: 1000,
      startDate: defaultStartDate,
    }]);
  };

  const updatePhantom = (id: string, field: string, value: any) => {
    setPhantoms(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
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
        // Prestador — valor da fatura + IVA 23%, 12 months
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
          totalCostYear: totalCostMonth * 12,
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Adicione membros fictícios para simular o impacto na capacidade e nos custos.</p>
        <Button size="sm" onClick={addPhantom}><UserPlus className="h-3.5 w-3.5 mr-1.5" />Adicionar membro</Button>
      </div>

      {phantoms.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor mensal (€)</TableHead>
                <TableHead>Data início</TableHead>
                <TableHead className="text-right">h/semana</TableHead>
                <TableHead className="text-right">% Cliente</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {phantoms.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Input value={p.name} onChange={e => updatePhantom(p.id, 'name', e.target.value)} className="h-7 text-sm w-36" />
                    </TableCell>
                    <TableCell>
                      <Select value={p.department} onValueChange={v => updatePhantom(p.id, 'department', v)}>
                        <SelectTrigger className="h-7 text-sm w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          <SelectItem value="__none__">Sem departamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={p.contractType} onValueChange={v => updatePhantom(p.id, 'contractType', v)}>
                        <SelectTrigger className="h-7 text-sm w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="colaborador">Colaborador</SelectItem>
                          <SelectItem value="prestador">Prestador</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <button onClick={() => removePhantom(p.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
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
                <p className="text-lg font-bold text-destructive">{fmt(simulation.totalMonthlyCost)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Custo anual adicional</p>
                <p className="text-lg font-bold text-destructive">{fmt(simulation.totalAnnualCost)}</p>
                <p className="text-[10px] text-muted-foreground">Colaboradores: 14 meses · Prestadores: 12 meses</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Custo restante do ano</p>
                <p className="text-lg font-bold">{fmt(simulation.costByMonth[simulation.costByMonth.length - 1]?.cumulative || 0)}</p>
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
                    <TableCell className="text-xs">{f.startDate ? new Date(f.startDate + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(f.gross)}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Colaborador' ? fmt(f.ssEmployer) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Colaborador' ? fmt(f.mealAllowance) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm">{f.type === 'Prestador' ? fmt(f.iva) : <span className="text-muted-foreground">n/a</span>}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(f.totalCostMonth)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(f.totalCostYear)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell colSpan={7} className="text-sm font-semibold text-right">Total</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{fmt(simulation.totalMonthlyCost)}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{fmt(simulation.totalAnnualCost)}</TableCell>
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
                    <Tooltip formatter={(v: number) => fmt(v)} />
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
                      phantoms: simulation.financialPerMember.map((f, i) => ({
                        name: f.name,
                        type: f.type,
                        department: phantoms[i]?.department || '—',
                        weeklyHours: phantoms[i]?.weeklyHours || 0,
                        clientPct: phantoms[i]?.clientPct || 0,
                        totalCostMonth: f.totalCostMonth,
                        startDate: f.startDate,
                      })),
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
                className="gap-1.5"
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
                        <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    );
                  }
                  // Regular text with bold support
                  return <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── SUB-TAB: Cenários de Crescimento ─── */
function GrowthScenarios({ members, clients, products }: { members: any[]; clients: any[]; products: any[] }) {
  const [newClients, setNewClients] = useState(5);
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');

  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');
  const activeClients = clients.filter(c => c.status === 'ativo');

  const product = products.find(p => p.id === selectedProduct);
  const hoursPerClient = product?.monthly_hours_per_client || 0;

  const simulation = useMemo(() => {
    // Current load per member (based on assigned clients)
    const memberLoad: Record<string, { name: string; dept: string; capacity: number; committed: number; clients: number }> = {};
    activeMembers.forEach(m => {
      const monthlyH = (Number(m.expected_weekly_hours) || 0) * WEEKS_PER_MONTH;
      const assignedClients = activeClients.filter(c => c.dp === m.full_name);
      let committed = 0;
      assignedClients.forEach(c => {
        const prod = products.find(p => p.name === c.current_product);
        committed += prod?.monthly_hours_per_client || 0;
      });
      memberLoad[m.id] = { name: m.full_name, dept: m.department || '—', capacity: Math.round(monthlyH), committed, clients: assignedClients.length };
    });

    const totalNeededHours = newClients * hoursPerClient;
    const totalFreeHours = Object.values(memberLoad).reduce((s, m) => s + Math.max(0, m.capacity - m.committed), 0);
    const hoursDeficit = Math.max(0, totalNeededHours - totalFreeHours);
    const membersNeeded = hoursDeficit > 0 ? Math.ceil(hoursDeficit / (40 * WEEKS_PER_MONTH * 0.7)) : 0;

    // Distribution suggestion: fill least loaded members first
    const sortedMembers = Object.values(memberLoad).sort((a, b) => {
      const aFree = a.capacity - a.committed;
      const bFree = b.capacity - b.committed;
      return bFree - aFree;
    });

    let remaining = newClients;
    const distribution: { name: string; dept: string; newClients: number; newLoad: number; totalLoad: number; capacity: number }[] = [];
    sortedMembers.forEach(m => {
      if (remaining <= 0) return;
      const freeH = Math.max(0, m.capacity - m.committed);
      const canTake = hoursPerClient > 0 ? Math.floor(freeH / hoursPerClient) : 0;
      const takes = Math.min(canTake, remaining);
      if (takes > 0) {
        distribution.push({
          name: m.name,
          dept: m.dept,
          newClients: takes,
          newLoad: takes * hoursPerClient,
          totalLoad: m.committed + takes * hoursPerClient,
          capacity: m.capacity,
        });
        remaining -= takes;
      }
    });

    return {
      totalNeededHours,
      totalFreeHours: Math.round(totalFreeHours),
      hoursDeficit: Math.round(hoursDeficit),
      membersNeeded,
      distribution,
      remainingUnassigned: remaining,
    };
  }, [activeMembers, activeClients, products, newClients, hoursPerClient]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Novos clientes</label>
              <Input type="number" value={newClients} onChange={e => setNewClients(Number(e.target.value))} className="h-8 w-24 text-sm" min={1} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Produto</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="h-8 w-48 text-sm"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.monthly_hours_per_client || 0}h/mês)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground pb-1">
              = <strong>{simulation.totalNeededHours}h/mês</strong> necessárias
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Horas necessárias</p>
          <p className="text-2xl font-bold">{simulation.totalNeededHours}h</p>
          <p className="text-xs text-muted-foreground">{newClients} × {hoursPerClient}h</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Horas livres na equipa</p>
          <p className="text-2xl font-bold">{simulation.totalFreeHours}h</p>
        </CardContent></Card>
        <Card className={simulation.hoursDeficit > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Défice de horas</p>
            <p className={`text-2xl font-bold ${simulation.hoursDeficit > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {simulation.hoursDeficit > 0 ? `${simulation.hoursDeficit}h` : 'Nenhum'}
            </p>
          </CardContent>
        </Card>
        <Card className={simulation.membersNeeded > 0 ? 'border-primary/50 bg-primary/5' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contratações necessárias</p>
            <p className="text-2xl font-bold">{simulation.membersNeeded}</p>
            <p className="text-xs text-muted-foreground">membros (40h/sem, 70% cliente)</p>
          </CardContent>
        </Card>
      </div>

      {simulation.distribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sugestão de distribuição</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead className="text-right">Novos clientes</TableHead>
                <TableHead className="text-right">Horas adicionais</TableHead>
                <TableHead className="text-right">Carga total</TableHead>
                <TableHead className="text-right">Capacidade</TableHead>
                <TableHead>Ocupação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {simulation.distribution.map((d, i) => {
                  const pct = d.capacity > 0 ? Math.round((d.totalLoad / d.capacity) * 100) : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.dept}</TableCell>
                      <TableCell className="text-sm text-right">+{d.newClients}</TableCell>
                      <TableCell className="text-sm text-right">+{d.newLoad}h</TableCell>
                      <TableCell className="text-sm text-right">{d.totalLoad}h</TableCell>
                      <TableCell className="text-sm text-right">{d.capacity}h</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
                            <div className={`h-full rounded-full ${pct > 100 ? 'bg-destructive' : pct > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs">{pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {simulation.remainingUnassigned > 0 && (
        <Card className="border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              ⚠ {simulation.remainingUnassigned} cliente{simulation.remainingUnassigned > 1 ? 's' : ''} sem capacidade na equipa atual.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Será necessário contratar {simulation.membersNeeded} pessoa{simulation.membersNeeded > 1 ? 's' : ''} para absorver a carga adicional de {simulation.hoursDeficit}h/mês.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export function CapacitySimulator({ members, entries, clients, products }: Props) {
  const activeMembers = members.filter(m => m.status === 'ativo' || m.status === 'prestador');

  return (
    <div className="space-y-4">
      <Tabs defaultValue="department">
        <TabsList className="flex-wrap">
          <TabsTrigger value="department"><Building2 className="h-3.5 w-3.5 mr-1.5" />Por Departamento</TabsTrigger>
          <TabsTrigger value="hiring"><UserPlus className="h-3.5 w-3.5 mr-1.5" />Simular Contratação</TabsTrigger>
          <TabsTrigger value="growth"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Cenários de Crescimento</TabsTrigger>
        </TabsList>

        <TabsContent value="department">
          <DepartmentView members={activeMembers} entries={entries} />
        </TabsContent>
        <TabsContent value="hiring">
          <HiringSimulator members={activeMembers} entries={entries} />
        </TabsContent>
        <TabsContent value="growth">
          <GrowthScenarios members={activeMembers} clients={clients} products={products} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
