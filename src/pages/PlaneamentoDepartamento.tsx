import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Building2, FolderKanban, Plus, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { usePlanningData } from '@/hooks/usePlanningData';
import { TacticalByAreaView } from '@/components/planning/TacticalByAreaView';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { useTacticalAreas, useProjectsByDepartmentInRange } from '@/hooks/useTacticalAreas';
import { endOfMonth } from 'date-fns';
import { getDeptLabel } from '@/lib/departments';
import { planningAreaForDepartment } from '@/lib/planningAreaFilters';

// Map department key (used in DepartmentLinks / DEPARTMENTS) → tactical area key
const DEPT_TO_AREA: Record<string, string> = {
  comercial: 'comercial',
  marketing: 'marketing',
  financeiro: 'financeiro',
  operacao: 'operacao',
  clientes: 'clientes',
  produtos: 'produtos',
  equipa: 'recursos-humanos',
  'recursos-humanos': 'recursos-humanos',
  admin: 'admin',
};

export default function PlaneamentoDepartamento() {
  const { area: areaParam } = useParams<{ area: string }>();
  const [params] = useSearchParams();
  const yearParam = parseInt(params.get('ano') || '', 10);
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const { isOwner } = useAuth();

  const areaKey = areaParam ? (DEPT_TO_AREA[areaParam] || areaParam) : '';
  const planning = usePlanningData(year);
  const { data: tacticalAreas = [] } = useTacticalAreas();
  const [newObjectiveOpen, setNewObjectiveOpen] = useState(false);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = endOfMonth(new Date(year, 11, 1));
  const { data: projectsByDept = {} } = useProjectsByDepartmentInRange(yearStart, yearEnd);

  const areaInfo = useMemo(
    () => tacticalAreas.find((a) => a.key === areaKey),
    [tacticalAreas, areaKey],
  );

  const planAreaKey = planningAreaForDepartment(areaKey);
  const initiatives = projectsByDept[areaKey] || [];

  // Local notes state — keyed by goal id
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filter monthly+quarterly goals belonging to this area via parent objective
  const areaGoals = useMemo(() => {
    const objs = (planning.objectives.data || []) as any[];
    const objIds = new Set(objs.filter(o => o.area === planAreaKey).map(o => o.id));
    return ((planning.goals.data || []) as any[]).filter(g => objIds.has(g.objective_id));
  }, [planning.goals.data, planning.objectives.data, planAreaKey]);

  const saveNotes = async (goalId: string) => {
    setSavingId(goalId);
    const value = notesDraft[goalId] ?? '';
    const { error } = await supabase.from('planning_goals').update({ notes: value }).eq('id', goalId);
    setSavingId(null);
    if (error) { toast.error('Erro ao guardar nota'); return; }
    toast.success('Nota guardada');
    planning.goals.refetch?.();
  };

  if (!areaParam) {
    return <Navigate to="/executive/planeamento/tatico" replace />;
  }

  const label = areaInfo?.label || getDeptLabel(areaKey);

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader
          title={`Planeamento — ${label}`}
          subtitle="Tudo o que está planeado para este departamento"
        />

        {/* Objetivos Anuais do dept */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Objetivos Anuais</h2>
                <p className="text-xs text-muted-foreground">Big goals do ano para {label}</p>
              </div>
            </div>
            {isOwner && (
              <Button size="sm" onClick={() => setNewObjectiveOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
              </Button>
            )}
          </div>
          <PlanningObjectivesTab
            planning={planning}
            showHeaderButton={false}
            layout="gallery"
            areaFilter={planAreaKey}
            newDialogOpen={newObjectiveOpen}
            onNewDialogChange={setNewObjectiveOpen}
          />
        </section>

        {/* Metas do dept */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Metas</h2>
              <p className="text-xs text-muted-foreground">Só metas associadas a {label}</p>
            </div>
          </div>
          <PlanningGoalsTab planning={planning} viewMode="metas" areaFilter={planAreaKey} />
        </section>

        {/* Notas do departamento por meta — editável por qualquer membro */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Notas do departamento</h2>
              <p className="text-xs text-muted-foreground">Comentários do departamento sobre cada meta. Visível para o CEO.</p>
            </div>
          </div>
          {areaGoals.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Sem metas para comentar.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {areaGoals.map((g: any) => {
                const draft = notesDraft[g.id] ?? g.notes ?? '';
                const dirty = draft !== (g.notes ?? '');
                return (
                  <Card key={g.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{g.period}</Badge>
                          <span className="text-sm">Alvo: <strong className="tabular-nums">{g.target_value || '—'}</strong></span>
                          <span className="text-sm text-muted-foreground">Real: {g.actual_value || '—'}</span>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Notas do departamento sobre esta meta…"
                        value={draft}
                        onChange={(e) => setNotesDraft({ ...notesDraft, [g.id]: e.target.value })}
                        rows={2}
                      />
                      {dirty && (
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => saveNotes(g.id)} disabled={savingId === g.id}>
                            {savingId === g.id ? 'A guardar…' : 'Guardar nota'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Tático filtrado a esta área */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Cronograma do ano</h2>
              <p className="text-xs text-muted-foreground">Trimestres / semestres deste departamento. Clica num bloco para o detalhe.</p>
            </div>
          </div>
          <TacticalByAreaView planning={planning} year={year} onlyAreaKey={areaKey} />
        </section>

        {/* Iniciativas / Projetos do dept no ano */}
        <section className="space-y-3 pt-6 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Iniciativas & Projetos</h2>
              <p className="text-xs text-muted-foreground">Projetos com deadline em {year} associados a este departamento</p>
            </div>
          </div>
          {initiatives.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma iniciativa ou projeto associado.
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {initiatives.map((p: any) => (
                <Link key={p.id} to={`/hub/projetos/${p.id}`} className="block">
                  <Card className="hover:border-primary/40 hq-transition h-full">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{p.name}</h3>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{p.status}</Badge>
                      </div>
                      {p.client_name && (
                        <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress ?? 0} className="h-1.5 flex-1" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">{p.progress ?? 0}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}