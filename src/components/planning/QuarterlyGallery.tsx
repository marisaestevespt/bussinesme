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
  /** Pre-selecciona um trimestre e abre directamente em modo detalhe. */
  initialQuarter?: number | null;
}

export function QuarterlyGallery({ planning, year, initialQuarter = null }: Props) {
  const [selectedQ, setSelectedQ] = useState<number | null>(initialQuarter);
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
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [objDialogOpen, setObjDialogOpen] = useState(false);

  // Goals & Objectives
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const quarterGoals = goals.filter((g: any) => q.monthNames.includes(g.period));
  const { pct: progress, achievedCount: achieved } = planning.getPeriodProgress(q.monthNames);

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

      {/* ─── 1. ÁREAS DO TRIMESTRE ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Áreas do trimestre</h3>
            <p className="text-xs text-muted-foreground">
              O que cada departamento está a entregar para atingir as metas anuais.
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setObjDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo objetivo
          </Button>
        </div>
        <TacticalAreasGrid
          goals={goals}
          objectives={objectives}
          isLoading={planning.goals?.isLoading || planning.objectives?.isLoading}
          periodMonths={q.monthNames}
          rangeStart={new Date(year, q.months[0], 1)}
          rangeEnd={endOfMonth(new Date(year, q.months[2], 1))}
          onSelectGoal={(g) => {
            const obj = objectives.find((o: any) => o.id === g.objective_id);
            if (obj) setSelectedObjective(obj);
          }}
        />
      </div>



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
