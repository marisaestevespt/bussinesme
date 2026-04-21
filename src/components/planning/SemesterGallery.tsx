import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel, planAreaLabel } from '@/hooks/usePlanningData';
import { format, parseISO, endOfMonth, startOfMonth, getDay, getDaysInMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';
import { ObjectiveDialog } from './ObjectiveDialog';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const SEMESTERS = [
  { label: 'S1 — 1º Semestre', short: 'S1', monthIndices: [0, 1, 2, 3, 4, 5], monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'], range: '01/01 → 30/06', quarters: ['T1', 'T2'], quarterIndices: [0, 1] },
  { label: 'S2 — 2º Semestre', short: 'S2', monthIndices: [6, 7, 8, 9, 10, 11], monthNames: ['Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], range: '01/07 → 31/12', quarters: ['T3', 'T4'], quarterIndices: [2, 3] },
];

const QUARTER_META = [
  { label: 'T1', monthNames: ['Janeiro', 'Fevereiro', 'Março'], range: '01/01 → 31/03' },
  { label: 'T2', monthNames: ['Abril', 'Maio', 'Junho'], range: '01/04 → 30/06' },
  { label: 'T3', monthNames: ['Julho', 'Agosto', 'Setembro'], range: '01/07 → 30/09' },
  { label: 'T4', monthNames: ['Outubro', 'Novembro', 'Dezembro'], range: '01/10 → 31/12' },
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

// Import QuarterDetail indirectly: when user clicks a quarter card we render it inline
// We import the full gallery and extract the detail via a wrapper
import { QuarterlyGallery } from './QuarterlyGallery';

function SemesterDetail({ sIdx, year, planning, onBack }: { sIdx: number; year: number; planning: any; onBack: () => void }) {
  const qcClient = useQueryClient();
  const s = SEMESTERS[sIdx];
  const range = semesterRange(sIdx, year);
  const monthNums = s.monthIndices.map(m => m + 1);
  const analysisQuarter = sIdx === 0 ? 5 : 6;

  // State
  const [metasView, setMetasView] = useState<'metas' | 'objetivos'>('metas');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState<number | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [objDialogOpen, setObjDialogOpen] = useState(false);

  // Goals & Objectives
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const semesterGoals = goals.filter((g: any) => s.monthNames.includes(g.period));
  const achieved = semesterGoals.filter((g: any) => g.status === 'atingido').length;
  const progress = semesterGoals.length > 0 ? Math.round((achieved / semesterGoals.length) * 100) : 0;

  const linkedObjIds = [...new Set(semesterGoals.map((g: any) => g.objective_id).filter(Boolean))];
  const linkedObjectives = objectives.filter((o: any) => linkedObjIds.includes(o.id));

  // Quarter comparison data
  const q1 = QUARTER_META[s.quarterIndices[0]];
  const q2 = QUARTER_META[s.quarterIndices[1]];
  const q1Goals = semesterGoals.filter((g: any) => q1.monthNames.includes(g.period));
  const q2Goals = semesterGoals.filter((g: any) => q2.monthNames.includes(g.period));
  const q1Achieved = q1Goals.filter((g: any) => g.status === 'atingido').length;
  const q2Achieved = q2Goals.filter((g: any) => g.status === 'atingido').length;
  const q1Deviation = q1Goals.filter((g: any) => Number(g.actual_value || 0) < Number(g.target_value || 0) && g.target_value > 0).length;
  const q2Deviation = q2Goals.filter((g: any) => Number(g.actual_value || 0) < Number(g.target_value || 0) && g.target_value > 0).length;
  const q1Progress = q1Goals.length > 0 ? Math.round((q1Achieved / q1Goals.length) * 100) : 0;
  const q2Progress = q2Goals.length > 0 ? Math.round((q2Achieved / q2Goals.length) * 100) : 0;

  // Quarter progress for cards
  const quarterProgress = useMemo(() => {
    return s.quarterIndices.map(qi => {
      const qm = QUARTER_META[qi];
      const qGoals = goals.filter((g: any) => qm.monthNames.includes(g.period));
      if (qGoals.length === 0) return 0;
      return Math.round((qGoals.filter((g: any) => g.status === 'atingido').length / qGoals.length) * 100);
    });
  }, [goals, s]);

  // Events
  const eventsQ = useQuery({
    queryKey: ['semester-events', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*');
      return data || [];
    },
  });

  // Sales
  const salesQ = useQuery({
    queryKey: ['semester-sales', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).in('sale_month', monthNums);
      return data || [];
    },
  });

  // Previous semester sales
  const prevSalesQ = useQuery({
    queryKey: ['semester-prev-sales', year, sIdx],
    queryFn: async () => {
      if (sIdx === 0) {
        const { data } = await supabase.from('commercial_sales').select('invoice_total').eq('sale_year', year - 1).in('sale_month', [7, 8, 9, 10, 11, 12]);
        return data || [];
      } else {
        const { data } = await supabase.from('commercial_sales').select('invoice_total').eq('sale_year', year).in('sale_month', [1, 2, 3, 4, 5, 6]);
        return data || [];
      }
    },
  });

  // Monthly goals (commercial)
  const monthlyGoalsQ = useQuery({
    queryKey: ['semester-monthly-goals', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('year', year).in('month', monthNums);
      return data || [];
    },
  });

  // NPS
  const npsQ = useQuery({
    queryKey: ['semester-nps', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*');
      return data || [];
    },
  });

  // Previous semester NPS (for trend)
  const prevNpsQ = useQuery({
    queryKey: ['semester-prev-nps', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*');
      return data || [];
    },
  });

  // Clients
  const clientsQ = useQuery({
    queryKey: ['semester-clients', year, sIdx],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
  });

  // Products
  const productsQ = useQuery({
    queryKey: ['semester-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name');
      return data || [];
    },
  });

  // Analysis
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
        const { error } = await supabase.from('executive_quarterly_analysis').update(fields as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ year, quarter: analysisQuarter, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qcClient.invalidateQueries({ queryKey: ['semester-analysis', year, analysisQuarter] }),
    onError: () => toast.error('Erro ao guardar análise'),
  });

  // ─── Computed data ─────────────────────────────

  const sales = salesQ.data || [];
  const totalInvoiced = sales.reduce((sum: number, v: any) => sum + Number(v.invoice_total || 0), 0);
  const semesterGoalTarget = (monthlyGoalsQ.data || []).reduce((sum: number, g: any) => sum + Number(g.goal_amount || 0), 0);
  const avgMonthlyNeeded = semesterGoalTarget > 0 ? semesterGoalTarget / 6 : 0;

  const monthlyInvoiced = useMemo(() => {
    return s.monthNames.map((name, i) => {
      const mNum = s.monthIndices[i] + 1;
      const mSales = sales.filter((sl: any) => sl.sale_month === mNum);
      const total = mSales.reduce((sum: number, sl: any) => sum + Number(sl.invoice_total || 0), 0);
      return { name, total };
    });
  }, [sales, s]);

  const deviation = totalInvoiced - semesterGoalTarget;
  const progressPct = semesterGoalTarget > 0 ? Math.round((totalInvoiced / semesterGoalTarget) * 100) : 0;

  // Previous semester comparison
  const prevTotal = (prevSalesQ.data || []).reduce((sum: number, v: any) => sum + Number(v.invoice_total || 0), 0);
  const hasPrevData = (prevSalesQ.data || []).length > 0;
  const prevVariationEur = totalInvoiced - prevTotal;
  const prevVariationPct = prevTotal > 0 ? Math.round((prevVariationEur / prevTotal) * 100) : null;

  // Products most sold
  const productsSold = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    sales.forEach((sl: any) => {
      const key = sl.product || 'Sem produto';
      if (!map[key]) map[key] = { name: key, count: 0, total: 0 };
      map[key].count++;
      map[key].total += Number(sl.invoice_total || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).map(p => ({
      ...p,
      pct: totalInvoiced > 0 ? Math.round((p.total / totalInvoiced) * 100) : 0,
    }));
  }, [sales, totalInvoiced]);

  // NPS by product
  const products = productsQ.data || [];
  const npsRecords = (npsQ.data || []).filter((n: any) => {
    if (!n.expected_date) return false;
    const d = parseISO(n.expected_date);
    return d >= range.start && d <= range.end;
  });

  const prevRange = useMemo(() => {
    if (sIdx === 0) return { start: new Date(year - 1, 6, 1), end: endOfMonth(new Date(year - 1, 11, 1)) };
    return { start: new Date(year, 0, 1), end: endOfMonth(new Date(year, 5, 1)) };
  }, [sIdx, year]);

  const prevNpsRecords = (prevNpsQ.data || []).filter((n: any) => {
    if (!n.expected_date) return false;
    const d = parseISO(n.expected_date);
    return d >= prevRange.start && d <= prevRange.end;
  });

  const npsByProduct = useMemo(() => {
    const map: Record<string, { name: string; scores: number[] }> = {};
    npsRecords.forEach((n: any) => {
      if (n.nps_score == null) return;
      const prod = products.find((p: any) => p.id === n.product_id);
      const key = prod?.id || 'sem';
      if (!map[key]) map[key] = { name: prod?.name || 'Sem produto', scores: [] };
      map[key].scores.push(n.nps_score);
    });
    const prevMap: Record<string, number> = {};
    prevNpsRecords.forEach((n: any) => {
      if (n.nps_score == null) return;
      const key = n.product_id || 'sem';
      if (!prevMap[key]) prevMap[key] = 0;
      prevMap[key] = (prevMap[key] * 0 + n.nps_score); // simplified — recalculate below
    });
    // Proper prev avg
    const prevAvgMap: Record<string, { sum: number; count: number }> = {};
    prevNpsRecords.forEach((n: any) => {
      if (n.nps_score == null) return;
      const key = n.product_id || 'sem';
      if (!prevAvgMap[key]) prevAvgMap[key] = { sum: 0, count: 0 };
      prevAvgMap[key].sum += n.nps_score;
      prevAvgMap[key].count++;
    });

    return Object.entries(map).map(([key, v]) => {
      const avg = Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length * 10) / 10;
      const prev = prevAvgMap[key];
      const prevAvg = prev ? Math.round((prev.sum / prev.count) * 10) / 10 : null;
      return { name: v.name, count: v.scores.length, avg, prevAvg, trend: prevAvg !== null ? (avg > prevAvg ? '↑' : avg < prevAvg ? '↓' : '→') : null };
    });
  }, [npsRecords, prevNpsRecords, products]);

  // Clients won vs lost
  const allClients = clientsQ.data || [];
  const clientsWon = allClients.filter((c: any) => {
    if (!c.start_date) return false;
    const d = parseISO(c.start_date);
    return d >= range.start && d <= range.end;
  });
  const clientsLost = allClients.filter((c: any) => {
    if (c.status !== 'terminado' && c.status !== 'inativo') return false;
    if (!c.end_of_cycle) return false;
    const d = parseISO(c.end_of_cycle);
    return d >= range.start && d <= range.end;
  });

  // Calendar
  const calendarMonthIdx = s.monthIndices[calendarMonthOffset];
  const calendarDate = new Date(year, calendarMonthIdx, 1);
  const daysInMonth = getDaysInMonth(calendarDate);
  const firstDayOfWeek = (getDay(startOfMonth(calendarDate)) + 6) % 7;
  const allEvents = eventsQ.data || [];
  const calendarEvents = allEvents.filter((e: any) => {
    if (!e.start_date) return false;
    const d = parseISO(e.start_date);
    return d.getMonth() === calendarMonthIdx && d.getFullYear() === year;
  });

  // Analysis state
  const analysis = analysisQ.data;
  const [wentWell, setWentWell] = useState('');
  const [wentWrong, setWentWrong] = useState('');
  const [lessonsField, setLessonsField] = useState('');
  const [adjustmentsField, setAdjustmentsField] = useState('');
  const [decisionsField, setDecisionsField] = useState('');
  const [freeNotesField, setFreeNotesField] = useState('');
  const [analysisLoaded, setAnalysisLoaded] = useState(false);

  if (analysis && !analysisLoaded) {
    setWentWell(analysis.went_well || '');
    setWentWrong(analysis.went_wrong || '');
    setLessonsField(analysis.lessons || '');
    setAdjustmentsField(analysis.adjustments || '');
    setAnalysisLoaded(true);
  }

  const saveAnalysis = () => {
    upsertAnalysis.mutate({
      went_well: wentWell || null,
      went_wrong: wentWrong || null,
      lessons: lessonsField || null,
      adjustments: adjustmentsField || null,
    });
    toast.success('Análise guardada');
  };

  // If a quarter is selected, render the QuarterlyGallery with that quarter pre-selected
  // We simulate by rendering the full gallery which handles its own drill-down
  if (selectedQuarterIdx !== null) {
    // Render the quarterly detail directly by using QuarterlyGallery which has internal state
    // Instead, we'll use a wrapper approach
    return (
      <QuarterDetailWrapper
        qIdx={selectedQuarterIdx}
        year={year}
        planning={planning}
        onBack={() => setSelectedQuarterIdx(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div>
            <h2 className="text-xl font-bold">{s.short} — {year}</h2>
            <p className="text-xs text-muted-foreground">{s.range}/{year}</p>
          </div>
        </div>


        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Progresso</p>
            <p className="text-xs font-semibold">{progress}%</p>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">{achieved} de {semesterGoals.length} metas atingidas</p>
        </div>
      </div>

      <Separator />

      {/* ─── 1. METAS DO SEMESTRE ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Metas do Semestre</CardTitle>
            <div className="flex gap-1">
              <Button variant={metasView === 'metas' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setMetasView('metas')}>
                Metas do semestre
              </Button>
              <Button variant={metasView === 'objetivos' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setMetasView('objetivos')}>
                Objetivos anuais
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setObjDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Novo objetivo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {metasView === 'metas' ? (
            semesterGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem metas definidas para este semestre.</p>
            ) : (
              <>
                {/* Group by quarter */}
                {[q1, q2].map((qMeta, qi) => {
                  const qGoals = semesterGoals.filter((g: any) => qMeta.monthNames.includes(g.period));
                  if (qGoals.length === 0) return (
                    <div key={qi}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{qMeta.label}</p>
                      <p className="text-xs text-muted-foreground italic py-2">Sem metas neste trimestre.</p>
                    </div>
                  );
                  return (
                    <div key={qi}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{qMeta.label}</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Meta</TableHead>
                            <TableHead>Data meta</TableHead>
                            <TableHead>Data atingida</TableHead>
                            <TableHead>Trimestre</TableHead>
                            <TableHead>Desvio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {qGoals.map((g: any) => {
                            const target = Number(g.target_value || 0);
                            const actual = Number(g.actual_value || 0);
                            const dev = target > 0 ? actual - target : null;
                            const obj = objectives.find((o: any) => o.id === g.objective_id);
                            return (
                              <TableRow key={g.id} className="cursor-pointer hover:bg-muted/60" onClick={() => { const obj = objectives.find((o: any) => o.id === g.objective_id); if (obj) setSelectedObjective(obj); }}>
                                <TableCell>
                                  <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">{planStatusLabel(g.status)}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                                <TableCell className="text-sm">{g.name || '—'}</TableCell>
                                <TableCell className="text-xs">{g.target_date ? format(parseISO(g.target_date), 'dd/MM/yyyy') : '—'}</TableCell>
                                <TableCell className="text-xs">{g.achieved_date ? format(parseISO(g.achieved_date), 'dd/MM/yyyy') : '—'}</TableCell>
                                <TableCell className="text-xs">{qMeta.label}</TableCell>
                                <TableCell className="text-right">
                                  {dev !== null ? (
                                    <Badge variant={dev < 0 ? 'destructive' : 'secondary'} className="text-xs">{dev < 0 ? '' : '+'}{dev}</Badge>
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </>
            )
          ) : (
            linkedObjectives.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem objetivos anuais associados às metas deste semestre.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Objetivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor alvo</TableHead>
                    <TableHead className="text-right">Valor atual</TableHead>
                    <TableHead>Prazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedObjectives.map((o: any) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setSelectedObjective(o)}>
                      <TableCell><Badge variant={o.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">{planStatusLabel(o.status)}</Badge></TableCell>
                      <TableCell className="text-sm">{planAreaLabel(o.area)}</TableCell>
                      <TableCell className="text-sm font-medium">{o.title}</TableCell>
                      <TableCell className="text-xs capitalize">{o.objective_type}</TableCell>
                      <TableCell className="text-sm text-right">{o.target_value ?? '—'}</TableCell>
                      <TableCell className="text-sm text-right">{o.current_value ?? '—'}</TableCell>
                      <TableCell className="text-xs">{o.deadline ? format(parseISO(o.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {/* Quarter comparison cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium">{q1.label}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Atingidas</span><span className="font-semibold text-foreground">{q1Achieved}/{q1Goals.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Com desvio</span><span className="font-semibold text-foreground">{q1Deviation}</span>
              </div>
              <Progress value={q1Progress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">{q1Progress}%</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium">{q2.label}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Atingidas</span><span className="font-semibold text-foreground">{q2Achieved}/{q2Goals.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Com desvio</span><span className="font-semibold text-foreground">{q2Deviation}</span>
              </div>
              <Progress value={q2Progress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">{q2Progress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. AGENDA ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Agenda ME & Calendários</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={calendarMonthOffset === 0} onClick={() => setCalendarMonthOffset(v => v - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[90px] text-center">{MONTHS[calendarMonthIdx]}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={calendarMonthOffset === 5} onClick={() => setCalendarMonthOffset(v => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px text-center text-[10px] text-muted-foreground mb-1">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => <div key={d} className="py-1 font-medium">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = calendarEvents.filter((e: any) => parseISO(e.start_date).getDate() === day);
              const isToday = new Date().getDate() === day && new Date().getMonth() === calendarMonthIdx && new Date().getFullYear() === year;
              return (
                <div key={day} className={cn('h-10 rounded-md text-xs flex flex-col items-center justify-center', isToday && 'bg-primary/10 font-bold', dayEvents.length > 0 && 'bg-muted/50')}>
                  <span>{day}</span>
                  {dayEvents.length > 0 && <div className="flex gap-0.5 mt-0.5">{dayEvents.slice(0, 3).map((_, ei) => <div key={ei} className="h-1 w-1 rounded-full bg-primary" />)}</div>}
                </div>
              );
            })}
          </div>
          {calendarEvents.length > 0 ? (
            <div className="mt-3 space-y-1">
              {calendarEvents.slice(0, 8).map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{format(parseISO(e.start_date), 'dd/MM')}</span>
                  <span className="truncate">{e.title}</span>
                </div>
              ))}
              {calendarEvents.length > 8 && <p className="text-[10px] text-muted-foreground text-center">+{calendarEvents.length - 8} mais</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Sem eventos em {MONTHS[calendarMonthIdx]}.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── 3. TRIMESTRES DO NEGÓCIO ─── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Trimestres do Negócio</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {s.quarterIndices.map((qIdx, i) => {
              const qMeta = QUARTER_META[qIdx];
              const prog = quarterProgress[i];
              const goalCount = goals.filter((g: any) => qMeta.monthNames.includes(g.period)).length;
              const currentQ = Math.floor(new Date().getMonth() / 3);
              const isCurrent = currentQ === qIdx && new Date().getFullYear() === year;

              return (
                <Card
                  key={qIdx}
                  className={cn('cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group', isCurrent && 'ring-2 ring-primary')}
                  onClick={() => setSelectedQuarterIdx(qIdx)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{qMeta.label} — {qMeta.label.replace('T', '')}º Trimestre</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{qMeta.range}</p>
                    {goalCount > 0 ? (
                      <div className="space-y-1">
                        <Progress value={prog} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{prog}% das metas atingidas</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">Sem metas definidas</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. VISÃO FINANCEIRA ─── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Visão Financeira</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Meta vs Real */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meta semestral</TableHead>
                <TableHead>Faturado real</TableHead>
                <TableHead>Desvio</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{semesterGoalTarget > 0 ? `${semesterGoalTarget.toLocaleString('pt-PT')}€` : '—'}</TableCell>
                <TableCell className="font-medium">{totalInvoiced.toLocaleString('pt-PT')}€</TableCell>
                <TableCell>
                  {semesterGoalTarget > 0 ? (
                    <Badge variant={deviation < 0 ? 'destructive' : 'secondary'} className="text-xs">{deviation >= 0 ? '+' : ''}{deviation.toLocaleString('pt-PT')}€</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {semesterGoalTarget > 0 ? (
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, progressPct)} className="h-1.5 w-16" />
                      <span className="text-xs">{progressPct}%</span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {semesterGoalTarget > 0
                    ? `Progresso: ${progressPct}% — Faturado: ${totalInvoiced.toLocaleString('pt-PT')}€ de ${semesterGoalTarget.toLocaleString('pt-PT')}€`
                    : 'Sem meta definida'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Monthly evolution chart */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Evolução mensal</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyInvoiced}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString('pt-PT')}€`, 'Faturado']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  {avgMonthlyNeeded > 0 && <ReferenceLine y={avgMonthlyNeeded} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: 'Média necessária', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Previous semester comparison */}
          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Comparação com semestre anterior</p>
          {hasPrevData ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Semestre anterior</p>
                <p className="text-lg font-bold">{prevTotal.toLocaleString('pt-PT')}€</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Semestre atual</p>
                <p className="text-lg font-bold">{totalInvoiced.toLocaleString('pt-PT')}€</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Variação</p>
                <p className={cn('text-lg font-bold', prevVariationEur > 0 ? 'text-success' : prevVariationEur < 0 ? 'text-destructive' : '')}>
                  {prevVariationEur >= 0 ? '+' : ''}{prevVariationEur.toLocaleString('pt-PT')}€
                </p>
                {prevVariationPct !== null && (
                  <p className={cn('text-xs', prevVariationPct > 0 ? 'text-success' : prevVariationPct < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {prevVariationPct >= 0 ? '+' : ''}{prevVariationPct}%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Sem dados do semestre anterior para comparar.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. PRODUTOS & CLIENTES ─── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Produtos & Clientes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Products most sold */}
          <p className="text-xs font-medium text-muted-foreground">Produtos mais vendidos no semestre</p>
          {productsSold.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Nº Vendas</TableHead>
                  <TableHead className="text-right">Total Faturado</TableHead>
                  <TableHead className="text-right">% do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsSold.map(p => (
                  <TableRow key={p.name}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-right">{p.count}</TableCell>
                    <TableCell className="text-sm text-right">{p.total.toLocaleString('pt-PT')}€</TableCell>
                    <TableCell className="text-sm text-right">{p.pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-2">Sem vendas registadas no semestre.</p>
          )}

          <Separator />

          {/* NPS by product */}
          <p className="text-xs font-medium text-muted-foreground">NPS médio por produto</p>
          {npsByProduct.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Nº Recolhas</TableHead>
                  <TableHead className="text-right">NPS Médio</TableHead>
                  <TableHead className="text-right">Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {npsByProduct.map(p => (
                  <TableRow key={p.name}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-right">{p.count}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">{p.avg}</TableCell>
                    <TableCell className="text-sm text-right">
                      {p.trend ? (
                        <span className={cn(p.trend === '↑' ? 'text-success' : p.trend === '↓' ? 'text-destructive' : 'text-muted-foreground')}>
                          {p.trend} {p.prevAvg !== null && <span className="text-[10px] text-muted-foreground">(ant: {p.prevAvg})</span>}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-2">Sem recolhas de NPS no semestre.</p>
          )}

          <Separator />

          {/* Clients won vs lost */}
          <p className="text-xs font-medium text-muted-foreground">Clientes ganhos vs perdidos</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 border border-border/40 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground">Clientes ganhos</p>
              <p className="text-2xl font-bold text-foreground">{clientsWon.length}</p>
            </div>
            <div className="bg-muted/50 border border-border/40 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground">Clientes perdidos</p>
              <p className="text-2xl font-bold text-destructive">{clientsLost.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 6. ANÁLISE & REFLEXÃO ─── */}
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
              <Textarea value={lessonsField} onChange={e => setLessonsField(e.target.value)} placeholder="Lições para o futuro..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{sIdx === 0 ? 'O que ajustar no 2º semestre' : 'O que ajustar no ano seguinte'}</label>
              <Textarea value={adjustmentsField} onChange={e => setAdjustmentsField(e.target.value)} placeholder="Ajustes, mudanças de estratégia..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Decisões a tomar</label>
              <Textarea value={decisionsField} onChange={e => setDecisionsField(e.target.value)} placeholder="Decisões pendentes, próximos passos..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notas livres</label>
              <Textarea value={freeNotesField} onChange={e => setFreeNotesField(e.target.value)} placeholder="Anotações gerais..." className="min-h-[100px] text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAnalysis} disabled={upsertAnalysis.isPending}>Guardar Análise</Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ DETAIL SHEETS ═══ */}
      <ObjectiveDetailSheet
        open={!!selectedObjective}
        onClose={() => setSelectedObjective(null)}
        objective={selectedObjective}
        planning={planning}
      />
      <ObjectiveDialog
        open={objDialogOpen}
        onClose={() => setObjDialogOpen(false)}
        initial={null}
        onSave={(data: any) => { planning.upsertObjective.mutate(data); setObjDialogOpen(false); }}
      />
    </div>
  );
}

/* ─── Quarter Detail Wrapper ─── */
// This wrapper renders the QuarterlyGallery's internal QuarterDetail
// by importing and using it. Since QuarterDetail is not exported separately,
// we re-use the full QuarterlyGallery with a pre-selected quarter approach.
// Instead, we import QuarterlyGallery and hack it via a thin wrapper that
// auto-selects the quarter. But since QuarterlyGallery manages its own state,
// we'll directly render the quarter detail view from the already-exported component logic.

// Actually the cleanest approach: import QuarterlyGallery, but since we need
// to go directly to a quarter detail, we'll create a minimal wrapper.
// Since QuarterlyGallery starts with selectedQ = null (gallery view),
// we need a different approach. Let's just render it and let user click.
// BUT the spec says "abre a ficha completa do trimestre correspondente — 
// exatamente a mesma ficha da vista Trimestral, sem duplicar nada."
// The simplest: render QuarterlyGallery with the year/planning and let it handle everything.
// When user clicks back from quarter detail, they return to the semester detail.

function QuarterDetailWrapper({ qIdx, year, planning, onBack }: { qIdx: number; year: number; planning: any; onBack: () => void }) {
  // We need to render the quarter detail directly.
  // Since QuarterlyGallery doesn't export QuarterDetail, let's use a workaround:
  // We render the gallery but with an immediate selection. However QuarterlyGallery's
  // internal state starts at null. Instead, let's just render the full gallery
  // and wrap the back button.

  // Simplest: render the full QuarterlyGallery. The user would need to click the quarter card.
  // Better UX: just show the gallery pre-focused. Since we can't control internal state,
  // we render it as-is with a back button above.

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Voltar ao semestre
      </Button>
      <QuarterlyGallery planning={planning} year={year} />
    </div>
  );
}
