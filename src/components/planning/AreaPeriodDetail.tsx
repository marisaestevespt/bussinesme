import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BackNavigation } from '@/components/BackNavigation';
import { ChevronRight, Briefcase, Target, AlertTriangle, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel } from '@/hooks/usePlanningData';
import type { TacticalArea } from '@/hooks/useTacticalAreas';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';

interface Props {
  area: TacticalArea;
  responsibles: Array<{ id: string; full_name: string; photo_url: string | null }>;
  /** Visual label, e.g. 'T1 — Jan/Fev/Mar 2026' */
  periodLabel: string;
  /** Quarter index 1..4 (only when view === 'trimestral') */
  quarter?: number;
  /** Semester index 1..2 */
  semester?: number;
  year: number;
  goals: any[];          // executive_goals already filtered by area+period
  initiatives: any[];    // projects already filtered by department + range
  planning: any;         // usePlanningData (for ObjectiveDetailSheet)
  objectives: any[];     // executive_objectives list
  onBack: () => void;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function AreaPeriodDetail({
  area, responsibles, periodLabel, quarter, semester, year,
  goals, initiatives, planning, objectives, onBack,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const hasOwner = responsibles.length > 0;
  let achieved = 0;
  const progress = goals.length
    ? Math.round(
        goals
          .map((g: any) => {
            if (g.status === 'atingido') { achieved++; return 100; }
            const target = Number(g.target_value || 0);
            if (target <= 0) return 0;
            const actual = Number(g.actual_value || 0);
            const pct = Math.min(Math.round((actual / target) * 100), 100);
            if (pct >= 100) achieved++;
            return pct;
          })
          .reduce((a: number, b: number) => a + b, 0) / goals.length
      )
    : 0;

  // Quarter retrospective (shared across areas of the quarter for now).
  // For semester we show both quarters' retros.
  const quartersToLoad = quarter ? [quarter] : semester ? [semester * 2 - 1, semester * 2] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <BackNavigation onBack={onBack} parentLabel="Voltar às áreas" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-bold tracking-tight">
              {area.label} <span className="text-muted-foreground font-normal">· {periodLabel}</span>
            </h2>
            {hasOwner ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2">
                  {responsibles.slice(0, 5).map((m) => (
                    <Avatar key={m.id} className="h-6 w-6 ring-2 ring-background">
                      {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                      <AvatarFallback className="text-[10px]">{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {responsibles.map((r) => r.full_name).slice(0, 2).join(', ')}
                  {responsibles.length > 2 && ` +${responsibles.length - 2}`}
                </span>
              </div>
            ) : (
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs gap-1.5 text-warning border-warning/30"
                onClick={() => navigate('/hub/equipa')}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Sem responsável atribuído
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{progress}%</div>
            <div className="text-[11px] text-muted-foreground">{achieved}/{goals.length} metas</div>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Separator />

      {/* Goals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas do período ({goals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem metas definidas para esta área neste período.</p>
          ) : (
            <ul className="space-y-1.5">
              {goals.map((g) => {
                const target = Number(g.target_value || 0);
                const actual = Number(g.actual_value || 0);
                const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
                return (
                  <li
                    key={g.id}
                    onClick={() => {
                      const obj = objectives.find((o: any) => o.id === g.objective_id);
                      if (obj) setSelectedObjective(obj);
                    }}
                    className="flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5 transition-colors"
                  >
                    <span className="truncate flex-1">{g.meta || g.name || 'Sem nome'}</span>
                    {pct !== null ? (
                      <Badge variant="secondary" className="tabular-nums shrink-0">{pct}%</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">{planStatusLabel(g.status)}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Initiatives */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Iniciativas / Projetos ({initiatives.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {initiatives.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem projetos com deadline neste período para esta área.</p>
          ) : (
            <ul className="space-y-1.5">
              {initiatives.map((p) => (
                <li
                  key={p.id}
                  onClick={() => navigate(`/hub/projetos/${p.id}`)}
                  className="flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.client_name && <span className="text-[11px] text-muted-foreground truncate">· {p.client_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="tabular-nums">{p.progress ?? 0}%</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Quarterly retrospective(s) */}
      {quartersToLoad.map((q) => (
        <QuarterRetro key={q} quarter={q} year={year} />
      ))}

      <ObjectiveDetailSheet
        open={!!selectedObjective}
        onClose={() => setSelectedObjective(null)}
        objective={selectedObjective}
        planning={planning}
      />
    </div>
  );
}

function QuarterRetro({ quarter, year }: { quarter: number; year: number }) {
  const qc = useQueryClient();
  const { data: analysis } = useQuery({
    queryKey: ['executive_quarterly_analysis', year, quarter],
    queryFn: async () => {
      const { data } = await supabase
        .from('executive_quarterly_analysis')
        .select('*')
        .eq('year', year).eq('quarter', quarter).maybeSingle();
      return data;
    },
  });

  const [wentWell, setWentWell] = useState('');
  const [wentWrong, setWentWrong] = useState('');
  const [lessons, setLessons] = useState('');
  const [adjustments, setAdjustments] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (analysis && !loaded) {
      setWentWell(analysis.went_well || '');
      setWentWrong(analysis.went_wrong || '');
      setLessons(analysis.lessons || '');
      setAdjustments(analysis.adjustments || '');
      setLoaded(true);
    }
  }, [analysis, loaded]);

  const upsert = useMutation({
    mutationFn: async (vals: any) => {
      const payload = { quarter, year, ...vals };
      if (analysis?.id) {
        const { error } = await supabase.from('executive_quarterly_analysis').update(payload).eq('id', analysis.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('executive_quarterly_analysis').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['executive_quarterly_analysis', year, quarter] });
      toast.success('Retrospectiva guardada');
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Retrospectiva — T{quarter}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">O que correu bem</label>
            <Textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} className="min-h-[90px] text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">O que não correu</label>
            <Textarea value={wentWrong} onChange={(e) => setWentWrong(e.target.value)} className="min-h-[90px] text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Lições</label>
            <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} className="min-h-[90px] text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Ajustes</label>
            <Textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)} className="min-h-[90px] text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={upsert.isPending}
            onClick={() => upsert.mutate({ went_well: wentWell || null, went_wrong: wentWrong || null, lessons: lessons || null, adjustments: adjustments || null })}
          >
            Guardar Retrospectiva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}