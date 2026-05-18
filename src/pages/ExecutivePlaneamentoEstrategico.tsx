import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { StrategicSection } from '@/components/planning/StrategicSection';
import { BusinessPlanCanvas } from '@/components/planning/BusinessPlanCanvas';
import { Visao5AnosBlock } from '@/components/planning/Visao5AnosBlock';
import { FileText, Compass } from 'lucide-react';

/**
 * Planeamento Estratégico — define o negócio.
 *
 * Reúne num só sítio as quatro peças que respondem ao "porquê" e "para onde":
 *   1. Plano de Negócio (Business Model Canvas) — embebido via BusinessPlanCanvas
 *   2. Visão a longo prazo (3 / 5 anos) — embebido via StrategicSection
 *   3. Missão, Visão e Valores — embebido via StrategicSection
 *   4. Análise SWOT — embebido via StrategicSection
 *
 * Não duplica conteúdo: tudo o que aqui aparece edita as mesmas tabelas
 * (`business_settings`, `brand_swot_items`) usadas pela Gestão de Marca,
 * e o canvas usa `business_plan_*`.
 * Click num bloco do canvas abre `/executive/business-plan/:columnKey` para edição detalhada.
 */
export default function ExecutivePlaneamentoEstrategico() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader
          title="Planeamento Estratégico"
          subtitle="Aqui defines o negócio: plano, visão, missão, valores e SWOT"
        />

        {/* 1. Plano de Negócio — Business Model Canvas embebido */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> Plano de Negócio
              </h2>
              <p className="text-xs text-muted-foreground">
                Business Model Canvas: proposta de valor, segmentos, canais e relacionamento com o cliente.
              </p>
            </div>
          </div>
          <BusinessPlanCanvas />
        </section>

        {/* 2-4. Visão LP + MVV + SWOT — tudo num só componente já existente */}
        <div className="pt-6 border-t border-border/60">
          <StrategicSection />
        </div>

        {/* 5. Visão a 5 Anos */}
        <div className="pt-6 border-t border-border/60">
          <Visao5AnosBlock />
        </div>
      </div>
    </AppLayout>
  );
}