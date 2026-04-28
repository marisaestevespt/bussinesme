import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { usePlanningData } from '@/hooks/usePlanningData';
import { TacticalByAreaView } from '@/components/planning/TacticalByAreaView';
import { Building2 } from 'lucide-react';

export default function ExecutivePlaneamentoTatico() {
  const [params] = useSearchParams();
  const yearParam = parseInt(params.get('ano') || '', 10);
  const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
  const planning = usePlanningData(year);

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader
          title="Planeamento Tático"
          subtitle="O plano de cada área do negócio"
        />

        {/* Áreas / Departamentos — única entrada do tático.
            Clicar numa área leva a /planeamento/dep/:area, que mostra
            objetivos anuais, metas e projetos só dessa área. */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Áreas do negócio</h2>
              <p className="text-xs text-muted-foreground">Cada departamento e o que entrega no ano. Clica num bloco para ver objetivos, metas e projetos da área.</p>
            </div>
          </div>
          <TacticalByAreaView planning={planning} year={year} />
        </section>
      </div>
    </AppLayout>
  );
}
