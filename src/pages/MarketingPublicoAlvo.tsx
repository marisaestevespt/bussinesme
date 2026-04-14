import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { SectionDefinicao } from '@/components/publico-alvo/SectionDefinicao';
import { SectionPersonas } from '@/components/publico-alvo/SectionPersonas';
import { SectionMapaMental } from '@/components/publico-alvo/SectionMapaMental';
import { SectionNiveisConsciencia, SectionNivelComprador } from '@/components/publico-alvo/SectionNiveis';
import { SectionJornada } from '@/components/publico-alvo/SectionJornada';
import { SectionDores } from '@/components/publico-alvo/SectionDores';
import { SectionDesejos } from '@/components/publico-alvo/SectionDesejos';
import { SectionTentativas } from '@/components/publico-alvo/SectionTentativas';
import { SectionObjecoes } from '@/components/publico-alvo/SectionObjecoes';
import { SectionTriggers } from '@/components/publico-alvo/SectionTriggers';
import { SectionAntiPersona } from '@/components/publico-alvo/SectionAntiPersona';
import { SectionLinguagem } from '@/components/publico-alvo/SectionLinguagem';
import { SectionFrases } from '@/components/publico-alvo/SectionFrases';
import { SectionInvestigar } from '@/components/publico-alvo/SectionInvestigar';

const NAV_GROUPS = [
  { label: 'Visão Geral', items: [
    { id: 'definicao', label: 'Definição central' },
    { id: 'personas', label: '3 Personas' },
    { id: 'mapa-mental', label: 'Mapa mental' },
  ]},
  { label: 'Psicografia', items: [
    { id: 'niveis-consciencia', label: 'Níveis de consciência' },
    { id: 'nivel-comprador', label: 'Nível de comprador' },
    { id: 'jornada-emocional', label: 'Jornada emocional' },
  ]},
  { label: 'Dores e Desejos', items: [
    { id: 'dores', label: 'Dores e frustrações' },
    { id: 'desejos', label: 'Desejos e sonhos' },
    { id: 'tentaram', label: 'O que já tentaram' },
  ]},
  { label: 'Decisão de Compra', items: [
    { id: 'objecoes', label: 'Objeções detalhadas' },
    { id: 'triggers', label: 'Triggers de compra' },
    { id: 'anti-persona', label: 'Anti-persona' },
  ]},
  { label: 'Comunicação', items: [
    { id: 'linguagem', label: 'Linguagem do público' },
    { id: 'frases', label: 'Frases para conteúdo' },
    { id: 'investigar', label: 'O que falta investigar' },
  ]},
];

const SECTION_COMPONENTS: Record<string, () => JSX.Element> = {
  'definicao': SectionDefinicao,
  'personas': SectionPersonas,
  'mapa-mental': SectionMapaMental,
  'niveis-consciencia': SectionNiveisConsciencia,
  'nivel-comprador': SectionNivelComprador,
  'jornada-emocional': SectionJornada,
  'dores': SectionDores,
  'desejos': SectionDesejos,
  'tentaram': SectionTentativas,
  'objecoes': SectionObjecoes,
  'triggers': SectionTriggers,
  'anti-persona': SectionAntiPersona,
  'linguagem': SectionLinguagem,
  'frases': SectionFrases,
  'investigar': SectionInvestigar,
};

export default function MarketingPublicoAlvo() {
  const [activeSection, setActiveSection] = useState('definicao');

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Mapa de Público-Alvo" subtitle="Personas, dores, desejos e comunicação estratégica." />

        <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          {/* ═══ HERO CARD ═══ */}
          <Card className="overflow-hidden border-none shadow-md">
            <CardContent className="p-8 sm:p-10 bg-primary/5">
              <p className="text-[10px] uppercase tracking-[3px] text-primary/60 mb-3">MAPA ESTRATÉGICO</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-3">
                Quem é a pessoa que precisamos de servir
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[600px]">
                Um documento vivo que concentra tudo o que sabemos sobre o nosso público — psicografia, jornada, linguagem, objeções e triggers. Atualizar sempre que chegar nova informação.
              </p>
              <div className="border-t border-border pt-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { value: '7', label: 'Conversas realizadas' },
                  { value: '3', label: 'Personas identificadas' },
                  { value: '5', label: 'Níveis de consciência' },
                  { value: '15', label: 'Secções de análise' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ═══ TAB NAV ═══ */}
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm border-b">
            <ScrollArea className="w-full">
              <div className="flex items-center gap-1">
                {NAV_GROUPS.map((group, gi) => (
                  <div key={group.label} className="flex items-center gap-1">
                    {gi > 0 && <div className="w-px h-5 bg-border mx-1 shrink-0" />}
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'whitespace-nowrap text-xs px-2.5 py-1.5 rounded-md transition-colors shrink-0',
                          activeSection === item.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>
          </div>

          {/* ═══ ACTIVE SECTION CONTENT ═══ */}
          <div className="min-h-[400px]">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
