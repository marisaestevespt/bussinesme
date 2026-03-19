import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel, planAreaLabel } from '@/hooks/usePlanningData';
import { parseISO, endOfMonth } from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const SEMESTERS = [
  { label: 'S1 — 1º Semestre', short: 'S1', monthIndices: [0, 1, 2, 3, 4, 5], monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'], range: '01/01 → 30/06', quarters: ['T1', 'T2'] },
  { label: 'S2 — 2º Semestre', short: 'S2', monthIndices: [6, 7, 8, 9, 10, 11], monthNames: ['Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], range: '01/07 → 31/12', quarters: ['T3', 'T4'] },
];

function semesterRange(sIdx: number, year: number) {
  const s = SEMESTERS[sIdx];
  const start = new Date(year, s.monthIndices[0], 1);
  const end = endOfMonth(new Date(year, s.monthIndices[5], 1));
  return { start, end };
}

interface Props {
  planning: any;
  year: number;
}

export function SemesterGallery({ planning, year }: Props) {
  const [selectedS, setSelectedS] = useState<number | null>(null);
  const goals = planning.allGoals || [];

  const semesterProgress = useMemo(() => {
    return SEMESTERS.map(s => {
      const sGoals = goals.filter((g: any) => s.monthNames.includes(g.period));
      if (sGoals.length === 0) return 0;
      const achieved = sGoals.filter((g: any) => g.status === 'atingido').length;
      return Math.round((achieved / sGoals.length) * 100);
    });
  }, [goals]);

  if (selectedS !== null) {
    return (
      <SemesterDetail
        sIdx={selectedS}
        year={year}
        planning={planning}
        onBack={() => setSelectedS(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {SEMESTERS.map((s, idx) => {
        const progress = semesterProgress[idx];
        const currentS = new Date().getMonth() < 6 ? 0 : 1;
        const isCurrent = currentS === idx && new Date().getFullYear() === year;
        const goalCount = goals.filter((g: any) => s.monthNames.includes(g.period)).length;

        return (
          <Card
            key={idx}
            className={cn(
              'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
              isCurrent && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedS(idx)}
          >
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{s.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-muted-foreground">{s.range}</p>
              {goalCount > 0 ? (
                <div className="space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{progress}% das metas atingidas</p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">Sem metas definidas</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── SEMESTER DETAIL ─── */

function SemesterDetail({ sIdx, year, planning, onBack }: { sIdx: number; year: number; planning: any; onBack: () => void }) {
  const qc = useQueryClient();
  const s = SEMESTERS[sIdx];
  const range = semesterRange(sIdx, year);
  const monthNums = s.monthIndices.map(m => m + 1);

  // Use quarter 5/6 in executive_quarterly_analysis for semester reflections
  const analysisQuarter = sIdx === 0 ? 5 : 6;

  // ─── Data queries ─────────────────────────────────────────
  const salesQ = useQuery({
    queryKey: ['semester-sales', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).in('sale_month', monthNums);
      return data || [];
    },
  });

  const salesActionsQ = useQuery({
    queryKey: ['semester-sales-actions', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions').select('*');
      return (data || []).filter((a: any) => {
        if (!a.start_date) return false;
        const d = parseISO(a.start_date);
        return d >= range.start && d <= range.end;
      });
    },
  });

  const leadsQ = useQuery({
    queryKey: ['semester-leads', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*');
      return data || [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ['semester-clients', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
  });

  const npsQ = useQuery({
    queryKey: ['semester-nps', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*');
      return data || [];
    },
  });

  const projectsQ = useQuery({
    queryKey: ['semester-projects', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return data || [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ['semester-tasks', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*');
      return data || [];
    },
  });

  const contentQ = useQuery({
    queryKey: ['semester-content', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*');
      return data || [];
    },
  });

  const productsQ = useQuery({
    queryKey: ['semester-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client');
      return data || [];
    },
  });

  const timeEntriesQ = useQuery({
    queryKey: ['semester-time-entries', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('entry_year', year).in('entry_month', monthNums);
      return data || [];
    },
  });

  // Previous semester leads (for comparison)
  const prevRange = useMemo(() => {
    if (sIdx === 0) {
      // Previous S2 of last year
      return { start: new Date(year - 1, 6, 1), end: endOfMonth(new Date(year - 1, 11, 1)) };
    }
    // Previous S1 of same year
    return { start: new Date(year, 0, 1), end: endOfMonth(new Date(year, 5, 1)) };
  }, [sIdx, year]);

  // Analysis (reflection)
  const analysisQ = useQuery({
    queryKey: ['semester-analysis', year, analysisQuarter],
    queryFn: async () => {
      const { data } = await supabase.from('executive_quarterly_analysis').select('*').eq('year', year).eq('quarter', analysisQuarter).maybeSingle();
      return data;
    },
  });

  const upsertAnalysis = useMutation({
    mutationFn: async (fields: Record<string, string | null>) => {
      const existing = analysisQ.data;
      if (existing?.id) {
        const { error } = await supabase.from('executive_quarterly_analysis').update(fields).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ year, quarter: analysisQuarter, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-analysis', year, analysisQuarter] }),
    onError: () => toast.error('Erro ao guardar análise'),
  });

  // ─── Filtered data ────────────────────────────────────────
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const semesterGoals = goals.filter((g: any) => s.monthNames.includes(g.period));

  const sales = salesQ.data || [];
  const totalInvoiced = sales.reduce((sum: number, v: any) => sum + Number(v.invoice_total || 0), 0);
  const salesActions = salesActionsQ.data || [];

  // Monthly breakdown for bar chart
  const monthlyInvoiced = useMemo(() => {
    return s.monthNames.map((name, i) => {
      const mNum = s.monthIndices[i] + 1;
      const mSales = sales.filter((sl: any) => sl.sale_month === mNum);
      const total = mSales.reduce((sum: number, sl: any) => sum + Number(sl.invoice_total || 0), 0);
      return { name, total };
    });
  }, [sales, s]);

  // Quarterly comparison within semester
  const quarterlyComparison = useMemo(() => {
    const q1Months = s.monthIndices.slice(0, 3).map(m => m + 1);
    const q2Months = s.monthIndices.slice(3, 6).map(m => m + 1);
    const q1Total = sales.filter((sl: any) => q1Months.includes(sl.sale_month)).reduce((sum: number, sl: any) => sum + Number(sl.invoice_total || 0), 0);
    const q2Total = sales.filter((sl: any) => q2Months.includes(sl.sale_month)).reduce((sum: number, sl: any) => sum + Number(sl.invoice_total || 0), 0);
    return [
      { name: s.quarters[0], total: q1Total },
      { name: s.quarters[1], total: q2Total },
    ];
  }, [sales, s]);

  // Leads
  const allLeads = leadsQ.data || [];
  const leadsThisS = allLeads.filter((l: any) => {
    if (!l.added_at) return false;
    const d = parseISO(l.added_at);
    return d >= range.start && d <= range.end;
  });
  const leadsWon = allLeads.filter((l: any) => {
    if (l.status !== 'ganho') return false;
    const d = parseISO(l.updated_at || l.created_at);
    return d >= range.start && d <= range.end;
  });
  const conversionRate = leadsThisS.length > 0 ? Math.round((leadsWon.length / leadsThisS.length) * 100) : 0;

  // Previous semester comparison
  const prevLeads = allLeads.filter((l: any) => {
    if (!l.added_at) return false;
    const d = parseISO(l.added_at);
    return d >= prevRange.start && d <= prevRange.end;
  });
  const leadsVariation = prevLeads.length > 0 ? Math.round(((leadsThisS.length - prevLeads.length) / prevLeads.length) * 100) : null;

  // Clients
  const allClients = clientsQ.data || [];
  const onboardingClients = allClients.filter((c: any) => {
    if (!c.start_date) return false;
    const d = parseISO(c.start_date);
    return d >= range.start && d <= range.end;
  });
  const renewalClients = allClients.filter((c: any) => {
    if (!c.end_of_cycle) return false;
    const d = parseISO(c.end_of_cycle);
    return d >= range.start && d <= range.end;
  });

  const npsRecords = (npsQ.data || []).filter((n: any) => {
    if (!n.expected_date) return false;
    const d = parseISO(n.expected_date);
    return d >= range.start && d <= range.end;
  });

  const products = productsQ.data || [];

  // NPS average by product
  const npsByProduct = useMemo(() => {
    const map: Record<string, { name: string; scores: number[] }> = {};
    npsRecords.forEach((n: any) => {
      if (n.nps_score == null) return;
      const prod = products.find((p: any) => p.id === n.product_id);
      const key = prod?.id || 'sem_produto';
      if (!map[key]) map[key] = { name: prod?.name || 'Sem produto', scores: [] };
      map[key].scores.push(n.nps_score);
    });
    return Object.values(map).map(v => ({
      name: v.name,
      avg: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length * 10) / 10,
      count: v.scores.length,
    }));
  }, [npsRecords, products]);

  // NPS monthly evolution
  const npsMonthly = useMemo(() => {
    return s.monthNames.map((name, i) => {
      const mStart = new Date(year, s.monthIndices[i], 1);
      const mEnd = endOfMonth(mStart);
      const monthRecords = npsRecords.filter((n: any) => {
        const d = parseISO(n.expected_date);
        return d >= mStart && d <= mEnd && n.nps_score != null;
      });
      const avg = monthRecords.length > 0
        ? Math.round(monthRecords.reduce((sum: number, n: any) => sum + n.nps_score, 0) / monthRecords.length * 10) / 10
        : null;
      return { name, avg };
    });
  }, [npsRecords, s, year]);

  // Operation
  const allProjects = projectsQ.data || [];
  const completedProjects = allProjects.filter((p: any) => {
    if (!p.end_date || p.status === 'ativo') return false;
    const d = parseISO(p.end_date);
    return d >= range.start && d <= range.end;
  });
  const activeProjects = allProjects.filter((p: any) => {
    if (!p.start_date || p.status !== 'ativo') return false;
    const pStart = parseISO(p.start_date);
    return pStart <= range.end;
  });

  const sTasks = (tasksQ.data || []).filter((t: any) => {
    if (!t.deadline) return false;
    const d = parseISO(t.deadline);
    return d >= range.start && d <= range.end;
  });
  const tasksDone = sTasks.filter((t: any) => t.status === 'concluida' || t.status === 'done').length;
  const tasksOverdue = sTasks.filter((t: any) => {
    if (t.status === 'concluida' || t.status === 'done') return false;
    return parseISO(t.deadline) < new Date();
  }).length;
  const tasksTodo = sTasks.length - tasksDone - tasksOverdue;

  const sContent = (contentQ.data || []).filter((c: any) => {
    if (!c.scheduled_at) return false;
    const d = parseISO(c.scheduled_at);
    return d >= range.start && d <= range.end;
  });
  const contentByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    sContent.forEach((c: any) => { const st = c.status || 'rascunho'; map[st] = (map[st] || 0) + 1; });
    return Object.entries(map);
  }, [sContent]);

  // Revisão Operacional
  const timeEntries = timeEntriesQ.data || [];
  const activeClientsForS = allClients.filter((c: any) => c.status === 'ativo');
  const productReview = useMemo(() => {
    return products.map((p: any) => {
      const clientsWithProduct = activeClientsForS.filter((c: any) => c.current_product === p.name);
      const estimatedHours = (p.monthly_hours_per_client || 0) * clientsWithProduct.length * 6;
      return { id: p.id, name: p.name, clientCount: clientsWithProduct.length, estimatedHours, realHours: 0, deviation: 0 };
    }).filter((p: any) => p.clientCount > 0);
  }, [products, activeClientsForS, timeEntries]);

  // Goal target for semester
  const semesterGoalTarget = useMemo(() => {
    const facGoals = semesterGoals.filter((g: any) => {
      const obj = objectives.find((o: any) => o.id === g.objective_id);
      return obj?.area === 'financeiro' || obj?.area === 'comercial';
    });
    return facGoals.reduce((sum: number, g: any) => sum + Number(g.target_value || 0), 0);
  }, [semesterGoals, objectives]);

  // Analysis state
  const analysis = analysisQ.data;
  const [wentWell, setWentWell] = useState('');
  const [wentWrong, setWentWrong] = useState('');
  const [lessons, setLessons] = useState('');
  const [adjustments, setAdjustments] = useState('');
  const [notes, setNotes] = useState('');
  const [analysisLoaded, setAnalysisLoaded] = useState(false);

  if (analysis && !analysisLoaded) {
    setWentWell(analysis.went_well || '');
    setWentWrong(analysis.went_wrong || '');
    setLessons(analysis.lessons || '');
    setAdjustments(analysis.adjustments || '');
    setAnalysisLoaded(true);
  }

  const saveAnalysis = () => {
    upsertAnalysis.mutate({
      went_well: wentWell || null,
      went_wrong: wentWrong || null,
      lessons: lessons || null,
      adjustments: adjustments || null,
    });
    toast.success('Análise guardada');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div>
          <h2 className="text-xl font-bold">{s.label} — {year}</h2>
          <p className="text-xs text-muted-foreground">{s.range}</p>
        </div>
      </div>

      {/* 1 — Metas do Semestre */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Metas do Semestre</CardTitle></CardHeader>
        <CardContent>
          {semesterGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem metas definidas para este semestre.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead><TableHead>Meta</TableHead><TableHead>Área</TableHead>
                  <TableHead className="text-right">Valor alvo</TableHead><TableHead className="text-right">Valor real</TableHead>
                  <TableHead className="text-right">Desvio</TableHead><TableHead>Objetivo Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const byObj: Record<string, any[]> = {};
                  semesterGoals.forEach((g: any) => { const key = g.objective_id || 'sem'; if (!byObj[key]) byObj[key] = []; byObj[key].push(g); });
                  return Object.entries(byObj).flatMap(([objId, objGoals]) => {
                    const obj = objectives.find((o: any) => o.id === objId);
                    const totalTarget = objGoals.reduce((sum: number, g: any) => sum + Number(g.target_value || 0), 0);
                    const totalActual = objGoals.reduce((sum: number, g: any) => sum + Number(g.actual_value || 0), 0);
                    const totalDev = totalActual - totalTarget;
                    const isNeg = totalDev < 0;
                    return [
                      <TableRow key={`sum-${objId}`} className="bg-muted/30 font-medium">
                        <TableCell><Badge variant={objGoals.every((g: any) => g.status === 'atingido') ? 'default' : 'secondary'} className="text-xs">{objGoals.every((g: any) => g.status === 'atingido') ? 'Atingido' : 'Em curso'}</Badge></TableCell>
                        <TableCell className="text-sm font-semibold">{obj?.title || 'Sem objetivo'}</TableCell>
                        <TableCell className="text-sm">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold">{totalTarget || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold">{totalActual || '—'}</TableCell>
                        <TableCell className="text-right">{totalTarget > 0 ? <Badge variant={isNeg ? 'destructive' : 'secondary'} className="text-xs">{isNeg ? '' : '+'}{totalDev}</Badge> : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{obj?.title || '—'}</TableCell>
                      </TableRow>,
                      ...objGoals.sort((a: any, b: any) => s.monthNames.indexOf(a.period) - s.monthNames.indexOf(b.period)).map((g: any) => {
                        const target = Number(g.target_value || 0);
                        const actual = Number(g.actual_value || 0);
                        const dev = actual - target;
                        return (
                          <TableRow key={g.id} className="text-muted-foreground">
                            <TableCell><Badge variant="outline" className="text-[10px]">{planStatusLabel(g.status)}</Badge></TableCell>
                            <TableCell className="text-xs pl-6">↳ {g.period}</TableCell>
                            <TableCell className="text-xs">—</TableCell>
                            <TableCell className="text-xs text-right">{target || '—'}</TableCell>
                            <TableCell className="text-xs text-right">{actual || '—'}</TableCell>
                            <TableCell className="text-right">{target > 0 ? <span className={cn('text-xs', dev < 0 && 'text-destructive font-medium')}>{dev < 0 ? '' : '+'}{dev}</span> : '—'}</TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      }),
                    ];
                  });
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 2 — Vendas & Faturação */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas & Faturação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Meta do semestre</p>
              <p className="text-lg font-bold">{semesterGoalTarget > 0 ? `${semesterGoalTarget.toLocaleString('pt-PT')}€` : '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Faturado</p>
              <p className="text-lg font-bold">{totalInvoiced.toLocaleString('pt-PT')}€</p>
            </div>
            {semesterGoalTarget > 0 && (
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Progresso</p>
                <Progress value={Math.min(100, (totalInvoiced / semesterGoalTarget) * 100)} className="h-2 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round((totalInvoiced / semesterGoalTarget) * 100)}%</p>
              </div>
            )}
          </div>

          {/* Monthly evolution chart */}
          {sales.length > 0 && (
            <div className="h-44">
              <p className="text-xs font-medium text-muted-foreground mb-2">Evolução mensal</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyInvoiced}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString('pt-PT')}€`, 'Faturado']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quarterly comparison */}
          {sales.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {quarterlyComparison.map(qc => (
                <div key={qc.name} className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{qc.name}</p>
                  <p className="text-lg font-bold">{qc.total.toLocaleString('pt-PT')}€</p>
                </div>
              ))}
            </div>
          )}

          {sales.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sales.map((sl: any) => (
                  <TableRow key={sl.id}>
                    <TableCell className="text-xs">{sl.sale_id}</TableCell>
                    <TableCell className="text-sm">{sl.client || '—'}</TableCell>
                    <TableCell className="text-sm">{sl.product || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{Number(sl.invoice_total || 0).toLocaleString('pt-PT')}€</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{sl.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-2">Sem vendas registadas.</p>}

          {salesActions.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Ações de venda do semestre</p>
              <Table>
                <TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Produto</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salesActions.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.action_name}</TableCell>
                      <TableCell className="text-sm">{a.product || '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3 — Leads & Oportunidades */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Leads & Oportunidades</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads adicionadas</p>
              <p className="text-xl font-bold">{leadsThisS.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads ganhas</p>
              <p className="text-xl font-bold">{leadsWon.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Taxa conversão</p>
              <p className="text-xl font-bold">{conversionRate}%</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">vs Semestre anterior</p>
              <p className={cn('text-xl font-bold', leadsVariation !== null && leadsVariation > 0 ? 'text-emerald-600' : leadsVariation !== null && leadsVariation < 0 ? 'text-destructive' : '')}>
                {leadsVariation !== null ? `${leadsVariation > 0 ? '+' : ''}${leadsVariation}%` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 — Clientes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Clientes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Onboarding</p>
              <p className="text-xl font-bold">{onboardingClients.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Renovações</p>
              <p className="text-xl font-bold">{renewalClients.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">NPS recolhas</p>
              <p className="text-xl font-bold">{npsRecords.length}</p>
            </div>
          </div>

          {npsByProduct.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">NPS médio por produto</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {npsByProduct.map(p => (
                  <div key={p.name} className="bg-muted/30 border border-border/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                    <p className="text-lg font-bold">{p.avg}</p>
                    <p className="text-[10px] text-muted-foreground">{p.count} recolha{p.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* NPS monthly evolution */}
          {npsMonthly.some(m => m.avg !== null) && (
            <div className="h-36">
              <p className="text-xs font-medium text-muted-foreground mb-2">Evolução NPS mensal</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={npsMonthly}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5 — Operação */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Operação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Projetos concluídos</p>
              <p className="text-xl font-bold">{completedProjects.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Projetos em curso</p>
              <p className="text-xl font-bold">{activeProjects.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Tarefas</p>
              <p className="text-xl font-bold">{sTasks.length}</p>
              <div className="flex gap-1 justify-center mt-1">
                <Badge variant="secondary" className="text-[9px]">✓ {tasksDone}</Badge>
                {tasksOverdue > 0 && <Badge variant="destructive" className="text-[9px]">! {tasksOverdue}</Badge>}
                <Badge variant="outline" className="text-[9px]">○ {tasksTodo}</Badge>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Conteúdos</p>
              <p className="text-xl font-bold">{sContent.length}</p>
              {contentByStatus.length > 0 && (
                <div className="flex gap-1 justify-center mt-1 flex-wrap">
                  {contentByStatus.map(([status, count]) => (
                    <Badge key={status} variant="outline" className="text-[9px]">{status}: {count}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6 — Revisão Operacional */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revisão Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {productReview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem produtos com clientes ativos para análise.</p>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead><TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">Horas estimadas</TableHead><TableHead className="text-right">Horas reais</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {productReview.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-right">{p.clientCount}</TableCell>
                      <TableCell className="text-sm text-right">{p.estimatedHours}h</TableCell>
                      <TableCell className="text-sm text-right">{p.realHours}h</TableCell>
                      <TableCell className="text-right">
                        {Math.abs(p.deviation) >= 60 ? (
                          <Badge variant="destructive" className="text-xs">{p.deviation > 0 ? '+' : ''}{p.deviation}h</Badge>
                        ) : (
                          <span className="text-sm">{p.deviation > 0 ? '+' : ''}{p.deviation}h</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {productReview.filter((p: any) => Math.abs(p.deviation) >= 60).map((p: any) => (
                <div key={p.id} className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      O produto <strong>{p.name}</strong> demorou <strong>{Math.abs(p.deviation)}h</strong> {p.deviation > 0 ? 'a mais' : 'a menos'} do que o estimado neste semestre. Considera rever as horas definidas no produto.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0"><ExternalLink className="h-3 w-3" /> Ver produto</Button>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 7 — Análise & Reflexão */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Análise & Reflexão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que correu bem</label>
              <Textarea value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="Resultados positivos, conquistas..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que não correu</label>
              <Textarea value={wentWrong} onChange={e => setWentWrong(e.target.value)} placeholder="Desafios, problemas..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Principais aprendizagens</label>
              <Textarea value={lessons} onChange={e => setLessons(e.target.value)} placeholder="Lições para o futuro..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{sIdx === 0 ? 'O que ajustar no 2º semestre' : 'O que ajustar no ano seguinte'}</label>
              <Textarea value={adjustments} onChange={e => setAdjustments(e.target.value)} placeholder="Ajustes, mudanças de estratégia..." className="min-h-[100px] text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notas gerais</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais..." className="min-h-[80px] text-sm" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAnalysis} disabled={upsertAnalysis.isPending}>Guardar Análise</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
