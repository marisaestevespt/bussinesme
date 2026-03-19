import { AppLayout } from '@/components/AppLayout';
import { usePlanningData } from '@/hooks/usePlanningData';
import { PlanningObjectivesTab } from '@/components/planning/PlanningObjectivesTab';
import { PlanningGoalsTab } from '@/components/planning/PlanningGoalsTab';
import { PlanningTrackingTab } from '@/components/planning/PlanningTrackingTab';
import { Separator } from '@/components/ui/separator';

const currentYear = new Date().getFullYear();

export default function ExecutivePlaneamento() {
  const planning = usePlanningData(currentYear);

  return (
    <AppLayout>
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-bold">Planeamento Anual</h1>
          <p className="text-sm text-muted-foreground">{currentYear}</p>
        </div>

        {/* Objetivos */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Objetivos</h2>
          <PlanningObjectivesTab planning={planning} />
        </section>

        <Separator />

        {/* Metas */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Metas</h2>
          <PlanningGoalsTab planning={planning} />
        </section>

        <Separator />

        {/* Acompanhamento */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Acompanhamento</h2>
          <PlanningTrackingTab planning={planning} />
        </section>
      </div>
    </AppLayout>
  );
}
