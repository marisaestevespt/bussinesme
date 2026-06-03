import { useState, useMemo, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { usePublicoAlvoSections, useUpdateSection, PASection } from '@/hooks/usePublicoAlvoData';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { Json } from '@/integrations/supabase/types';
import { EntityTabs, EntityTabsContent, EntityTabsList, EntityTabsTrigger } from '@/components/layout/entity/EntityTabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockPerfil, PerfilData } from '@/components/publico-alvo/blocks/BlockPerfil';
import { BlockPersonas, PersonasData } from '@/components/publico-alvo/blocks/BlockPersonas';
import { BlockMapaEmocional, MapaEmocionalData } from '@/components/publico-alvo/blocks/BlockMapaEmocional';
import { BlockJornada, JornadaData } from '@/components/publico-alvo/blocks/BlockJornada';
import { BlockVoz, VozData } from '@/components/publico-alvo/blocks/BlockVoz';

type BlockKey = 'perfil' | 'personas' | 'mapa-emocional' | 'jornada' | 'voz';

const TAB_ORDER: BlockKey[] = ['perfil', 'personas', 'mapa-emocional', 'jornada', 'voz'];
const TAB_LABELS: Record<BlockKey, string> = {
  perfil: 'Perfil',
  personas: 'Personas',
  'mapa-emocional': 'Mapa Emocional',
  jornada: 'Jornada',
  voz: 'Voz & Comunicação',
};

export default function MarketingPublicoAlvo() {
  const { data: sections, isLoading } = usePublicoAlvoSections();
  const updateSection = useUpdateSection();
  const [activeTab, setActiveTab] = useState<BlockKey>('perfil');
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const byKey = useMemo(() => {
    const map: Partial<Record<BlockKey, PASection>> = {};
    for (const s of sections ?? []) {
      if ((TAB_ORDER as string[]).includes(s.section_key)) {
        map[s.section_key as BlockKey] = s;
      }
    }
    return map;
  }, [sections]);

  const saveContent = useCallback(
    (id: string, content: Json) => {
      if (debounceRef.current[id]) clearTimeout(debounceRef.current[id]);
      debounceRef.current[id] = setTimeout(() => {
        updateSection.mutate({ id, content });
      }, 600);
    },
    [updateSection],
  );

  if (isLoading) {
    return (
      <AppLayout>
        <InlineLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Mapa de Público-Alvo" subtitle="Framework completo do público-alvo do negócio." />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          <EntityTabs value={activeTab} onValueChange={(v) => setActiveTab(v as BlockKey)}>
            {/* Desktop tabs */}
            <div className="hidden md:block">
              <EntityTabsList>
                {TAB_ORDER.map((k) => (
                  <EntityTabsTrigger key={k} value={k}>
                    {TAB_LABELS[k]}
                  </EntityTabsTrigger>
                ))}
              </EntityTabsList>
            </div>
            {/* Mobile dropdown */}
            <div className="md:hidden">
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as BlockKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAB_ORDER.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TAB_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-6">
              <EntityTabsContent value="perfil">
                {byKey.perfil && (
                  <BlockPerfil
                    data={byKey.perfil.content as unknown as PerfilData}
                    onChange={(d) => saveContent(byKey.perfil!.id, d as unknown as Json)}
                  />
                )}
              </EntityTabsContent>
              <EntityTabsContent value="personas">
                {byKey.personas && (
                  <BlockPersonas
                    data={byKey.personas.content as unknown as PersonasData}
                    onChange={(d) => saveContent(byKey.personas!.id, d as unknown as Json)}
                  />
                )}
              </EntityTabsContent>
              <EntityTabsContent value="mapa-emocional">
                {byKey['mapa-emocional'] && (
                  <BlockMapaEmocional
                    data={byKey['mapa-emocional'].content as unknown as MapaEmocionalData}
                    onChange={(d) => saveContent(byKey['mapa-emocional']!.id, d as unknown as Json)}
                  />
                )}
              </EntityTabsContent>
              <EntityTabsContent value="jornada">
                {byKey.jornada && (
                  <BlockJornada
                    data={byKey.jornada.content as unknown as JornadaData}
                    onChange={(d) => saveContent(byKey.jornada!.id, d as unknown as Json)}
                  />
                )}
              </EntityTabsContent>
              <EntityTabsContent value="voz">
                {byKey.voz && (
                  <BlockVoz
                    data={byKey.voz.content as unknown as VozData}
                    onChange={(d) => saveContent(byKey.voz!.id, d as unknown as Json)}
                  />
                )}
              </EntityTabsContent>
            </div>
          </EntityTabs>
        </div>
      </div>
    </AppLayout>
  );
}
