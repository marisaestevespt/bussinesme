import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StrategicSection } from '@/components/planning/StrategicSection';
import { Compass, ArrowRight, FileText } from 'lucide-react';

/**
 * Planeamento Estratégico — define o negócio.
 *
 * Reúne num só sítio as quatro peças que respondem ao "porquê" e "para onde":
 *   1. Plano de Negócio (canvas) — link para /executive/business-plan
 *   2. Visão a longo prazo (3 / 5 anos) — embebido via StrategicSection
 *   3. Missão, Visão e Valores — embebido via StrategicSection
 *   4. Análise SWOT — embebido via StrategicSection
 *
 * Não duplica conteúdo: tudo o que aqui aparece edita as mesmas tabelas
 * (`business_settings`, `brand_swot_items`, `strategic_directives`)
 * usadas pelo Business Plan e pela Gestão de Marca.
 */
export default function ExecutivePlaneamentoEstrategico() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader
          title="Planeamento Estratégico"
          subtitle="Aqui defines o negócio: visão, missão, valores e SWOT"
        />

        {/* Atalho para o Business Plan (canvas) */}
        <Card className="hq-card border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5 flex items-start gap-4 flex-wrap">
            <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> Plano de Negócio
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Canvas com proposta de valor, segmentos, canais e relacionamento com o cliente.
              </p>
            </div>
            <Button onClick={() => navigate('/executive/business-plan')}>
              Abrir canvas <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Visão LP + MVV + SWOT — tudo num só componente já existente */}
        <StrategicSection />
      </div>
    </AppLayout>
  );
}