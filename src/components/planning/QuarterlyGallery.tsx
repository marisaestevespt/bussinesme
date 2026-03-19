import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, ChevronRight, ExternalLink, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel, planAreaLabel } from '@/hooks/usePlanningData';
import { format, parseISO, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const QUARTERS = [
  { label: 'T1 — 1º Trimestre', short: 'T1', months: [0, 1, 2], monthNames: ['Janeiro', 'Fevereiro', 'Março'], range: '01/01 → 31/03' },
  { label: 'T2 — 2º Trimestre', short: 'T2', months: [3, 4, 5], monthNames: ['Abril', 'Maio', 'Junho'], range: '01/04 → 30/06' },
  { label: 'T3 — 3º Trimestre', short: 'T3', months: [6, 7, 8], monthNames: ['Julho', 'Agosto', 'Setembro'], range: '01/07 → 30/09' },
  { label: 'T4 — 4º Trimestre', short: 'T4', months: [9, 10, 11], monthNames: ['Outubro', 'Novembro', 'Dezembro'], range: '01/10 → 31/12' },
];

function quarterRange(qIdx: number, year: number) {
  const q = QUARTERS[qIdx];
  const start = new Date(year, q.months[0], 1);
  const end = endOfMonth(new Date(year, q.months[2], 1));
  return { start, end };
}

interface Props {
  planning: any;
  year: number;
}

export function QuarterlyGallery({ planning, year }: Props) {
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const goals = planning.allGoals || [];

  const quarterProgress = useMemo(() => {
    return QUARTERS.map(q => {
      const qGoals = goals.filter((g: any) => q.monthNames.includes(g.period));
      if (qGoals.length === 0) return 0;
      const achieved = qGoals.filter((g: any) => g.status === 'atingido').length;
      return Math.round((achieved / qGoals.length) * 100);
    });
  }, [goals]);

  if (selectedQ !== null) {
    return (
      <QuarterDetail
        qIdx={selectedQ}
        year={year}
        planning={planning}
        onBack={() => setSelectedQ(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {QUARTERS.map((q, idx) => {
        const progress = quarterProgress[idx];
        const currentQ = Math.floor(new Date().getMonth() / 3);
        const isCurrent = currentQ === idx && new Date().getFullYear() === year;
        const goalCount = goals.filter((g: any) => q.monthNames.includes(g.period)).length;

        return (
          <Card
            key={idx}
            className={cn(
              'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
              isCurrent && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedQ(idx)}
          >
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{q.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-muted-foreground">{q.range}</p>
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

/* ─── QUARTER DETAIL ─── */

function QuarterDetail({ qIdx, year, planning, onBack }: { qIdx: number; year: number; planning: any; onBack: () => void }) {
  const qc = useQueryClient();
  const q = QUARTERS[qIdx];
  const range = quarterRange(qIdx, year);
  const monthNums = q.months.map(m => m + 1);

  // ─── Data queries ─────────────────────────────────────────
  const salesQ = useQuery({
    queryKey: ['quarter-sales', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).in('sale_month', monthNums);
      return data || [];
    },
  });

  const salesActionsQ = useQuery({
    queryKey: ['quarter-sales-actions', year, qIdx],
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
    queryKey: ['quarter-leads', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*');
      return data || [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ['quarter-clients', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
  });

  const npsQ = useQuery({
    queryKey: ['quarter-nps', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*');
      return data || [];
    },
  });

  const projectsQ = useQuery({
    queryKey: ['quarter-projects', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return data || [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ['quarter-tasks', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*');
      return data || [];
    },
  });

  const eventsQ = useQuery({
    queryKey: ['quarter-events', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*');
      return data || [];
    },
  });

  const contentQ = useQuery({
    queryKey: ['quarter-content', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*');
      return data || [];
    },
  });

  const productsQ = useQuery({
    queryKey: ['quarter-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client');
      return data || [];
    },
  });

  const timeEntriesQ = useQuery({
    queryKey: ['quarter-time-entries', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('entry_year', year).in('entry_month', monthNums);
      return data || [];
    },
  });

  // Quarterly Analysis (reflection fields)
  const quarterNum = qIdx + 1;
  const analysisQ = useQuery({
    queryKey: ['quarter-analysis', year, quarterNum],
    queryFn: async () => {
      const { data } = await supabase.from('executive_quarterly_analysis').select('*').eq('year', year).eq('quarter', quarterNum).maybeSingle();
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
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ year, quarter: quarterNum, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarter-analysis', year, quarterNum] }),
    onError: () => toast.error('Erro ao guardar análise'),
  });

  // ─── Filtered data ────────────────────────────────────────
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const quarterGoals = goals.filter((g: any) => q.monthNames.includes(g.period));

  const sales = salesQ.data || [];
  const totalInvoiced = sales.reduce((s: number, v: any) => s + Number(v.invoice_total || 0), 0);
  const salesActions = salesActionsQ.data || [];

  // Monthly breakdown for bar chart
  const monthlyInvoiced = useMemo(() => {
    return q.monthNames.map((name, i) => {
      const mNum = q.months[i] + 1;
      const mSales = sales.filter((s: any) => s.sale_month === mNum);
      const total = mSales.reduce((sum: number, s: any) => sum + Number(s.invoice_total || 0), 0);
      return { name, total };
    });
  }, [sales, q]);

  const allLeads = leadsQ.data || [];
  const leadsThisQ = allLeads.filter((l: any) => {
    if (!l.added_at) return false;
    const d = parseISO(l.added_at);
    return d >= range.start && d <= range.end;
  });
  const leadsWon = allLeads.filter((l: any) => {
    if (l.status !== 'ganho') return false;
    const d = parseISO(l.updated_at || l.created_at);
    return d >= range.start && d <= range.end;
  });
  const conversionRate = leadsThisQ.length > 0 ? Math.round((leadsWon.length / leadsThisQ.length) * 100) : 0;
  const overdueFollowups = allLeads.filter((l: any) => {
    if (!l.next_followup || l.status === 'ganho' || l.status === 'perdido') return false;
    const d = parseISO(l.next_followup);
    return d <= range.end && d >= range.start;
  });

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

  // NPS average by product
  const products = productsQ.data || [];
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

  // Operation
  const activeProjects = (projectsQ.data || []).filter((p: any) => {
    if (!p.start_date) return false;
    const pStart = parseISO(p.start_date);
    return pStart <= range.end;
  });

  const qTasks = (tasksQ.data || []).filter((t: any) => {
    if (!t.deadline) return false;
    const d = parseISO(t.deadline);
    return d >= range.start && d <= range.end;
  });
  const tasksDone = qTasks.filter((t: any) => t.status === 'concluida' || t.status === 'done').length;
  const tasksOverdue = qTasks.filter((t: any) => {
    if (t.status === 'concluida' || t.status === 'done') return false;
    return parseISO(t.deadline) < new Date();
  }).length;
  const tasksTodo = qTasks.length - tasksDone - tasksOverdue;

  const qEvents = (eventsQ.data || []).filter((e: any) => {
    if (!e.start_date) return false;
    const d = parseISO(e.start_date);
    return d >= range.start && d <= range.end;
  });

  const qContent = (contentQ.data || []).filter((c: any) => {
    if (!c.scheduled_at) return false;
    const d = parseISO(c.scheduled_at);
    return d >= range.start && d <= range.end;
  });

  // Content count by status
  const contentByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    qContent.forEach((c: any) => {
      const s = c.status || 'rascunho';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map);
  }, [qContent]);

  // ─── Revisão Operacional ──────────────────────────────────
  const timeEntries = timeEntriesQ.data || [];
  const activeClientsForQ = allClients.filter((c: any) => c.status === 'ativo');

  const productReview = useMemo(() => {
    return products.map((p: any) => {
      const clientsWithProduct = activeClientsForQ.filter((c: any) => c.current_product === p.name);
      const estimatedHours = (p.monthly_hours_per_client || 0) * clientsWithProduct.length * 3;
      // Placeholder: no direct link between time_entries and products
      return {
        id: p.id,
        name: p.name,
        clientCount: clientsWithProduct.length,
        estimatedHours,
        realHours: 0,
        deviation: 0,
      };
    }).filter((p: any) => p.clientCount > 0);
  }, [products, activeClientsForQ, timeEntries]);

  // Goal target for the quarter
  const quarterGoalTarget = useMemo(() => {
    const facGoals = quarterGoals.filter((g: any) => {
      const obj = objectives.find((o: any) => o.id === g.objective_id);
      return obj?.area === 'financeiro' || obj?.area === 'comercial';
    });
    return facGoals.reduce((s: number, g: any) => s + Number(g.target_value || 0), 0);
  }, [quarterGoals, objectives]);

  // Analysis state
  const analysis = analysisQ.data;
  const [wentWell, setWentWell] = useState('');
  const [wentWrong, setWentWrong] = useState('');
  const [lessons, setLessons] = useState('');
  const [adjustments, setAdjustments] = useState('');
  const [analysisLoaded, setAnalysisLoaded] = useState(false);

  if (analysis && !analysisLoaded) {
    setWentWell(analysis.went_well || '');
    setWentWrong(analysis.went_wrong || '');
    setLessons(analysis.lessons || '');
    setAdjustments(analysis.adjustments || '');
    setAnalysisLoaded(true);
  }

  const saveAnalysis = () => {
    upsertAnalysis.mutate({ went_well: wentWell || null, went_wrong: wentWrong || null, lessons: lessons || null, adjustments: adjustments || null });
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
          <h2 className="text-xl font-bold">{q.label} — {year}</h2>
          <p className="text-xs text-muted-foreground">{q.range}</p>
        </div>
      </div>

      {/* 1 — Metas do Trimestre */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Metas do Trimestre</CardTitle>
        </CardHeader>
        <CardContent>
          {quarterGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem metas definidas para este trimestre.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Valor alvo</TableHead>
                  <TableHead className="text-right">Valor real</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                  <TableHead>Objetivo Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Group goals by objective, show month breakdown */}
                {(() => {
                  const byObj: Record<string, any[]> = {};
                  quarterGoals.forEach((g: any) => {
                    const key = g.objective_id || 'sem';
                    if (!byObj[key]) byObj[key] = [];
                    byObj[key].push(g);
                  });
                  return Object.entries(byObj).flatMap(([objId, objGoals]) => {
                    const obj = objectives.find((o: any) => o.id === objId);
                    const totalTarget = objGoals.reduce((s: number, g: any) => s + Number(g.target_value || 0), 0);
                    const totalActual = objGoals.reduce((s: number, g: any) => s + Number(g.actual_value || 0), 0);
                    const totalDev = totalActual - totalTarget;
                    const isNeg = totalDev < 0;
                    return [
                      // Summary row
                      <TableRow key={`sum-${objId}`} className="bg-muted/30 font-medium">
                        <TableCell>
                          <Badge variant={objGoals.every((g: any) => g.status === 'atingido') ? 'default' : 'secondary'} className="text-xs">
                            {objGoals.every((g: any) => g.status === 'atingido') ? 'Atingido' : 'Em curso'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{obj?.title || 'Sem objetivo'}</TableCell>
                        <TableCell className="text-sm">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold">{totalTarget || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold">{totalActual || '—'}</TableCell>
                        <TableCell className="text-right">
                          {totalTarget > 0 ? (
                            <Badge variant={isNeg ? 'destructive' : 'secondary'} className="text-xs">
                              {isNeg ? '' : '+'}{totalDev}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{obj?.title || '—'}</TableCell>
                      </TableRow>,
                      // Month breakdown rows
                      ...objGoals.sort((a: any, b: any) => q.monthNames.indexOf(a.period) - q.monthNames.indexOf(b.period)).map((g: any) => {
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
                            <TableCell className="text-right">
                              {target > 0 ? (
                                <span className={cn('text-xs', dev < 0 && 'text-destructive font-medium')}>
                                  {dev < 0 ? '' : '+'}{dev}
                                </span>
                              ) : '—'}
                            </TableCell>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Vendas & Faturação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Meta do trimestre</p>
              <p className="text-lg font-bold">{quarterGoalTarget > 0 ? `${quarterGoalTarget.toLocaleString('pt-PT')}€` : '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Faturado</p>
              <p className="text-lg font-bold">{totalInvoiced.toLocaleString('pt-PT')}€</p>
            </div>
            {quarterGoalTarget > 0 && (
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Progresso</p>
                <Progress value={Math.min(100, (totalInvoiced / quarterGoalTarget) * 100)} className="h-2 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round((totalInvoiced / quarterGoalTarget) * 100)}%</p>
              </div>
            )}
          </div>

          {/* Mini bar chart: monthly evolution */}
          {sales.length > 0 && (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyInvoiced}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString('pt-PT')}€`, 'Faturado']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {sales.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.sale_id}</TableCell>
                    <TableCell className="text-sm">{s.client || '—'}</TableCell>
                    <TableCell className="text-sm">{s.product || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{Number(s.invoice_total || 0).toLocaleString('pt-PT')}€</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-2">Sem vendas registadas.</p>}

          {salesActions.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Ações de venda do trimestre</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ação</TableHead><TableHead>Produto</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leads & Oportunidades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads adicionadas</p>
              <p className="text-xl font-bold">{leadsThisQ.length}</p>
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
              <p className="text-xs text-muted-foreground">Follow-ups em atraso</p>
              <p className="text-xl font-bold">{overdueFollowups.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 — Clientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Clientes</CardTitle>
        </CardHeader>
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
        </CardContent>
      </Card>

      {/* 5 — Operação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Projetos ativos</p>
              <p className="text-xl font-bold">{activeProjects.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Tarefas</p>
              <p className="text-xl font-bold">{qTasks.length}</p>
              <div className="flex gap-1 justify-center mt-1">
                <Badge variant="secondary" className="text-[9px]">✓ {tasksDone}</Badge>
                {tasksOverdue > 0 && <Badge variant="destructive" className="text-[9px]">! {tasksOverdue}</Badge>}
                <Badge variant="outline" className="text-[9px]">○ {tasksTodo}</Badge>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Reuniões</p>
              <p className="text-xl font-bold">{qEvents.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Conteúdos</p>
              <p className="text-xl font-bold">{qContent.length}</p>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revisão Operacional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {productReview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem produtos com clientes ativos para análise.</p>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">Horas estimadas</TableHead>
                  <TableHead className="text-right">Horas reais</TableHead>
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
                        {Math.abs(p.deviation) >= 30 ? (
                          <Badge variant="destructive" className="text-xs">
                            {p.deviation > 0 ? '+' : ''}{p.deviation}h
                          </Badge>
                        ) : (
                          <span className="text-sm">{p.deviation > 0 ? '+' : ''}{p.deviation}h</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {productReview.filter((p: any) => Math.abs(p.deviation) >= 30).map((p: any) => (
                <div key={p.id} className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      O produto <strong>{p.name}</strong> demorou <strong>{Math.abs(p.deviation)}h</strong> {p.deviation > 0 ? 'a mais' : 'a menos'} do que o estimado neste trimestre. Considera rever as horas definidas no produto.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                    <ExternalLink className="h-3 w-3" /> Ver produto
                  </Button>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 7 — Análise & Reflexão */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Análise & Reflexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que correu bem</label>
              <Textarea
                value={wentWell}
                onChange={e => setWentWell(e.target.value)}
                placeholder="Resultados positivos, conquistas..."
                className="min-h-[100px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que não correu</label>
              <Textarea
                value={wentWrong}
                onChange={e => setWentWrong(e.target.value)}
                placeholder="Desafios, problemas..."
                className="min-h-[100px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que aprender</label>
              <Textarea
                value={lessons}
                onChange={e => setLessons(e.target.value)}
                placeholder="Lições para o futuro..."
                className="min-h-[100px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">O que ajustar no próximo trimestre</label>
              <Textarea
                value={adjustments}
                onChange={e => setAdjustments(e.target.value)}
                placeholder="Ajustes, mudanças de estratégia..."
                className="min-h-[100px] text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAnalysis} disabled={upsertAnalysis.isPending}>
              Guardar Análise
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
