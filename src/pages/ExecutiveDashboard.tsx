import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useCeoCockpit } from '@/hooks/useCeoCockpit';
import { BusinessPulse } from '@/components/executive/cockpit/BusinessPulse';
import { CeoAlerts } from '@/components/executive/cockpit/CeoAlerts';
import { StrategyShortcuts } from '@/components/executive/cockpit/StrategyShortcuts';
import { RitualBanner } from '@/components/executive/cockpit/RitualBanner';
import { ObjectivesBrainDump } from '@/components/executive/cockpit/ObjectivesBrainDump';

/**
 * Sala do CEO — vista DIÁRIA (2 minutos) para o Owner/Admin.
 *
 * Filosofia: cada vista responde a UMA pergunta.
 * Esta responde: "O que está a arder hoje? Onde tenho de decidir?"
 *
 * Para revisão semanal → /executive/weekly-align (Saúde por área + Foco da semana)
 * Para planeamento mensal → /executive/planeamento
 * Para estratégia trimestral → /executive/business-plan
 */
export default function ExecutiveDashboard() {
  const { derived, isLoading } = useCeoCockpit();

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Sala do CEO"
          subtitle="Vista diária · pulso do negócio, alertas e atalhos estratégicos"
          department="executive"
        />

        {isLoading || !derived ? (
          <div className="space-y-6">
            <Skeleton className="h-16" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            <RitualBanner />
            <BusinessPulse derived={derived} />
            <StrategyShortcuts />
            <CeoAlerts derived={derived} />
            <ObjectivesBrainDump />
          </>
        )}
      </div>
    </AppLayout>
  );
}
