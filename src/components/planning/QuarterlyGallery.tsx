import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BackNavigation } from '@/components/BackNavigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, endOfMonth } from 'date-fns';
import { MonthDetailView } from './MonthDetailView';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';
import { ObjectiveDialog } from './ObjectiveDialog';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { TacticalAreasGrid } from './TacticalAreasGrid';

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

interface Props {
  planning: any;
  year: number;
}

export function QuarterlyGallery({ planning, year }: Props) {
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const goals = planning.allGoals || [];

  const quarterProgress = useMemo(() => {
    return QUARTERS.map(q => planning.getPeriodProgress(q.monthNames).pct);
  }, [planning]);

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
                <EmptyHint>Sem metas definidas</EmptyHint>
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = QUARTERS[qIdx];
  const quarterNum = qIdx + 1;

  // State
  const [metasView, setMetasView] = useState<'metas' | 'objetivos'>('metas');
  const [calMonth, setCalMonth] = useState(new Date(year, q.months[0], 1));
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [objDialogOpen, setObjDialogOpen] = useState(false);

  // Goals & Objectives
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const quarterGoals = goals.filter((g: any) => q.monthNames.includes(g.period));
  const { pct: progress, achievedCount: achieved } = planning.getPeriodProgress(q.monthNames);

  // Linked objective IDs from quarter goals
  const linkedObjIds = [...new Set(quarterGoals.map((g: any) => g.objective_id).filter(Boolean))];
  const linkedObjectives = objectives.filter((o: any) => linkedObjIds.includes(o.id));

  // Events for calendar
  const eventsQ = useQuery({
    queryKey: ['quarter-events', year, qIdx],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*');
      return data || [];
    },
  });

  // Quarterly Analysis
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
        const { error } = await supabase.from('executive_quarterly_analysis').update(fields as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert({ year, quarter: quarterNum, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarter-analysis', year, quarterNum] }),
    onError: () => toast.error('Erro ao guardar análise'),
  });

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

  // Monthly progress for month cards
  const monthProgress = useMemo(() => {
    return q.months.map((mIdx) => planning.getPeriodProgress([MONTHS[mIdx]]).pct);
  }, [planning, q]);

  // Calendar logic
  const allEvents = eventsQ.data || [];

  function renderCalendarGrid() {
    const dm = getDaysInMonth(calMonth);
    const firstDay = (getDay(startOfMonth(calMonth)) + 6) % 7;
    const dayNames = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    const monthEvents = allEvents.filter((e: any) => {
      if (!e.start_date) return false;
      const d = parseISO(e.start_date);
      return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear();
    });
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
    for (let d = 1; d <= dm; d++) {
      const dayItems = monthEvents.filter((e: any) => parseISO(e.start_date).getDate() === d);
      const isToday = d === new Date().getDate() && calMonth.getMonth() === new Date().getMonth() && calMonth.getFullYear() === new Date().getFullYear();
      cells.push(
        <div key={d} className={cn('min-h-[60px] border border-border/30 rounded p-1', isToday && 'bg-primary/5 ring-1 ring-primary')}>
          <span className="text-[10px] font-medium text-muted-foreground">{d}</span>
          <div className="space-y-0.5 mt-0.5">
            {dayItems.map((e: any) => (
              <div key={e.id} className="text-[9px] bg-accent/50 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-accent" onClick={() => navigate('/hub/agenda')}>{e.title}</div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <span className="text-xs font-medium">{format(calMonth, 'MMMM yyyy', { locale: pt })}</span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {dayNames.map(dn => <div key={dn} className="text-center text-[10px] font-medium text-muted-foreground py-1">{dn}</div>)}
          {cells}
        </div>
      </div>
    );
  }

  // If a month is selected, show MonthDetailView
  if (selectedMonthIdx !== null) {
    return (
      <MonthDetailView
        monthIdx={selectedMonthIdx}
        year={year}
        planning={planning}
        onBack={() => setSelectedMonthIdx(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackNavigation parentRoute="/executive/planeamento" parentLabel="Planeamento" onBack={onBack} />
          <div>
            <h2 className="text-xl font-bold">{q.short} — {year}</h2>
            <p className="text-xs text-muted-foreground">{q.range}/{year}</p>
          </div>
        </div>


        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Progresso</p>
            <p className="text-xs font-semibold">{progress}%</p>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">{achieved} de {quarterGoals.length} metas atingidas</p>
        </div>
      </div>

      <Separator />

      {/* ─── 1. METAS ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Metas</CardTitle>
            <div className="flex gap-1">
              <Button variant={metasView === 'metas' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setMetasView('metas')}>
                Metas do trimestre
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
        <CardContent>
          {metasView === 'metas' ? (
            quarterGoals.length === 0 ? (
              <EmptyHint>Sem metas definidas para este trimestre.</EmptyHint>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Data meta</TableHead>
                    <TableHead>Data atingida</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Desvio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterGoals.map((g: any) => {
                    const target = Number(g.target_value || 0);
                    const actual = Number(g.actual_value || 0);
                    const dev = target > 0 ? actual - target : null;
                    const obj = objectives.find((o: any) => o.id === g.objective_id);
                    return (
                      <TableRow key={g.id} className="cursor-pointer hover:bg-muted/60" onClick={() => { const obj = objectives.find((o: any) => o.id === g.objective_id); if (obj) setSelectedObjective(obj); }}>
                        <TableCell>
                          <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">
                            {planStatusLabel(g.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                        <TableCell className="text-sm">{g.name || '—'}</TableCell>
                        <TableCell className="">{g.target_date ? format(parseISO(g.target_date), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="">{g.achieved_date ? format(parseISO(g.achieved_date), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="">{g.period || '—'}</TableCell>
                        <TableCell className="text-right">
                          {dev !== null ? (
                            <Badge variant={dev < 0 ? 'destructive' : 'secondary'} className="text-xs">
                              {dev < 0 ? '' : '+'}{dev}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            linkedObjectives.length === 0 ? (
              <EmptyHint>Sem objetivos anuais associados às metas deste trimestre.</EmptyHint>
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
                      <TableCell>
                        <Badge variant={o.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">
                          {planStatusLabel(o.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{planAreaLabel(o.area)}</TableCell>
                      <TableCell className="text-sm font-medium">{o.title}</TableCell>
                      <TableCell className="capitalize">{o.objective_type}</TableCell>
                      <TableCell className="text-sm text-right">{o.target_value ?? '—'}</TableCell>
                      <TableCell className="text-sm text-right">{o.current_value ?? '—'}</TableCell>
                      <TableCell className="">{o.deadline ? format(parseISO(o.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      {/* ─── 2. AGENDA ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Agenda ME & Calendários</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/agenda')}><Plus className="h-3 w-3" /> Novo Evento</Button>
          </div>
        </CardHeader>
        <CardContent>
          {renderCalendarGrid()}
        </CardContent>
      </Card>



      {/* ─── 3. MESES DO NEGÓCIO ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Meses do Negócio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {q.months.map((mIdx, i) => {
              const name = MONTHS[mIdx];
              const end = endOfMonth(new Date(year, mIdx, 1));
              const rangeLabel = `01/${String(mIdx + 1).padStart(2, '0')} → ${format(end, 'dd/MM')}`;
              const prog = monthProgress[i];
              const goalCount = goals.filter((g: any) => g.period === name).length;
              const isCurrent = new Date().getMonth() === mIdx && new Date().getFullYear() === year;

              return (
                <Card
                  key={mIdx}
                  className={cn(
                    'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
                    isCurrent && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedMonthIdx(mIdx)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{rangeLabel}</p>
                    {goalCount > 0 ? (
                      <div className="space-y-1">
                        <Progress value={prog} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{prog}% das metas atingidas</p>
                      </div>
                    ) : (
                      <EmptyHint>Sem metas definidas</EmptyHint>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. ANÁLISE DO TRIMESTRE ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Análise do Trimestre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">O que correu bem</label>
              <Textarea value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="Resultados positivos, conquistas..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">O que não correu</label>
              <Textarea value={wentWrong} onChange={e => setWentWrong(e.target.value)} placeholder="Desafios, problemas..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">O que aprender</label>
              <Textarea value={lessons} onChange={e => setLessons(e.target.value)} placeholder="Lições para o futuro..." className="min-h-[100px] text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">O que ajustar no próximo trimestre</label>
              <Textarea value={adjustments} onChange={e => setAdjustments(e.target.value)} placeholder="Ajustes, mudanças de estratégia..." className="min-h-[100px] text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAnalysis} disabled={upsertAnalysis.isPending}>
              Guardar Análise
            </Button>
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
