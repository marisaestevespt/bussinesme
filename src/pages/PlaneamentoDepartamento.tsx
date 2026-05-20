import { useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Gauge, CalendarRange, CalendarDays, FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { usePlanningData } from '@/hooks/usePlanningData';
import { TacticalByAreaView } from '@/components/planning/TacticalByAreaView';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { DepartmentKpiDashboard } from '@/components/planning/DepartmentKpiDashboard';
import { DepartmentQuarterlyPlanning } from '@/components/planning/DepartmentQuarterlyPlanning';
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

interface SectionHeadingProps {
  step: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

function SectionHeading({ step, icon: Icon, title, subtitle, action }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold tabular-nums">{step}</span>
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

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

  const areaInfo = tacticalAreas.find((a) => a.key === areaKey);

  const planAreaKey = planningAreaForDepartment(areaKey);
  const initiatives = projectsByDept[areaKey] || [];

  if (!areaParam) {
    return <Navigate to="/executive/planeamento/tatico" replace />;
  }

  const label = areaInfo?.label || getDeptLabel(areaKey);

  return (
    <AppLayout>
      <div className="space-y-10">
        <BackNavigation />
        <PageHeader
          title={`Planeamento & Análise — ${label}`}
          subtitle="Do objetivo anual ao mês: tudo num só fluxo"
        />

        {/* 1 — Objetivos anuais (porquê) */}
        <section className="space-y-4">
          <SectionHeading
            step="01"
            icon={Target}
            title="Objetivos Anuais"
            subtitle={`Big goals do ano para ${label}`}
            action={isOwner ? (
              <Button size="sm" onClick={() => setNewObjectiveOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
              </Button>
            ) : undefined}
          />
          <PlanningObjectivesTab
            planning={planning}
            showHeaderButton={false}
            layout="gallery"
            areaFilter={planAreaKey}
            newDialogOpen={newObjectiveOpen}
            onNewDialogChange={setNewObjectiveOpen}
          />
        </section>

        {/* 2 — Metas & KPRs (o quê medir) */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <SectionHeading
            step="02"
            icon={Gauge}
            title="Metas & KPRs"
            subtitle="Indicadores e metas anuais que dão sinal aos objetivos"
          />
          <DepartmentKpiDashboard
            department={areaKey}
            departmentLabel={label}
            year={year}
            view="cards"
          />
          <PlanningGoalsTab planning={planning} viewMode="metas" areaFilter={planAreaKey} />
        </section>

        {/* 3 — Trimestre (programação + retrospetiva) */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <SectionHeading
            step="03"
            icon={CalendarRange}
            title="Trimestre"
            subtitle="Retrospetiva e programação trimestral"
          />
          <DepartmentQuarterlyPlanning
            planning={planning}
            year={year}
            planAreaKey={planAreaKey}
            label={label}
            embedded
          />
        </section>

        {/* 4 — Mês (KPRs mês a mês + análise) */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <SectionHeading
            step="04"
            icon={CalendarDays}
            title="Mês a mês"
            subtitle="Metas e valores reais por KPR, com análise mensal"
          />
          <DepartmentKpiDashboard
            department={areaKey}
            departmentLabel={label}
            year={year}
            view="monthly"
          />
        </section>

        {/* 5 — Iniciativas & cronograma */}
        <section className="space-y-4 pt-6 border-t border-border/60">
          <SectionHeading
            step="05"
            icon={FolderKanban}
            title="Iniciativas & Cronograma"
            subtitle={`Projetos e blocos táticos de ${year}`}
          />
          <TacticalByAreaView planning={planning} year={year} onlyAreaKey={areaKey} />
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