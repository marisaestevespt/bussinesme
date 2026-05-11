import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from './useBusinessSettings';

// All KPI definitions per area
export const KPI_DEFINITIONS: Record<string, { key: string; label: string }[]> = {
  comercial: [
    { key: 'receita_vs_meta', label: 'Receita vs meta' },
    { key: 'ticket_medio', label: 'Ticket médio' },
    { key: 'taxa_conversao', label: 'Taxa de conversão' },
    { key: 'tempo_medio_pipeline', label: 'Tempo médio no pipeline' },
    { key: 'leads_novas', label: 'Leads novas' },
    { key: 'followups_realizados', label: 'Follow-ups realizados' },
    { key: 'taxa_renovacao', label: 'Taxa de renovação' },
    { key: 'comparativo_produtos', label: 'Comparativo de produtos' },
  ],
  clientes: [
    { key: 'novos_clientes', label: 'Novos clientes' },
    { key: 'churn', label: 'Churn' },
    { key: 'nps_medio', label: 'NPS médio actual' },
    { key: 'taxa_renovacao', label: 'Taxa de renovação' },
    { key: 'saude_carteira', label: 'Saúde da relação com clientes' },
  ],
  marketing: [
    { key: 'publicados_vs_planeados', label: 'Publicados vs planeados' },
    { key: 'taxa_execucao', label: 'Taxa de execução do plano' },
    { key: 'crescimento_canal', label: 'Crescimento por canal' },
    { key: 'top_publicacoes', label: 'Top publicações' },
    { key: 'objetivos_marketing', label: 'Objetivos de marketing atingidos' },
    { key: 'criativos_trafego', label: 'Criativos de tráfego pago' },
  ],
  operacao: [
    { key: 'projetos_em_curso', label: 'Projetos em curso' },
    { key: 'projetos_em_atraso', label: 'Projetos em atraso' },
    { key: 'tempo_medio_entrega', label: 'Tempo médio de entrega' },
    { key: 'projetos_concluidos_mes', label: 'Projetos concluídos este mês' },
  ],
  financeiro: [
    { key: 'entradas_vs_saidas', label: 'Entradas vs saídas' },
    { key: 'margem_lucro', label: 'Margem de lucro' },
    { key: 'iva_a_pagar', label: 'IVA a pagar' },
    { key: 'seguranca_social', label: 'Segurança Social' },
  ],
};

export const AREA_LABELS: Record<string, string> = {
  comercial: 'Comercial',
  clientes: 'Clientes',
  marketing: 'Marketing',
  operacao: 'Operação',
  financeiro: 'Financeiro',
};

type KpiMap = Record<string, boolean>; // "area:kpi_key" → enabled

interface KpiSettingsContextType {
  isKpiEnabled: (area: string, kpiKey: string) => boolean;
  isAreaEnabled: (area: string) => boolean;
  loading: boolean;
}

const KpiSettingsContext = createContext<KpiSettingsContextType | undefined>(undefined);

export function KpiSettingsProvider({ children }: { children: ReactNode }) {
  const { settings } = useBusinessSettings();
  const businessId = settings?.id;

  const { data: kpiRows = [], isLoading } = useQuery({
    queryKey: ['kpi-settings', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('kpi_settings')
        .select('area, kpi_key, enabled')
        .eq('business_id', businessId);
      return data || [];
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  // Build a map: "area:key" → enabled. Missing = true (default)
  const map = useMemo(() => {
    const m: KpiMap = {};
    for (const row of kpiRows) {
      m[`${row.area}:${row.kpi_key}`] = row.enabled;
    }
    return m;
  }, [kpiRows]);

  const isKpiEnabled = useCallback((area: string, kpiKey: string): boolean => {
    // Check area-level toggle first
    const areaKey = `${area}:__area__`;
    if (areaKey in map && !map[areaKey]) return false;
    // Check individual KPI
    const key = `${area}:${kpiKey}`;
    return key in map ? map[key] : true;
  }, [map]);

  const isAreaEnabled = useCallback((area: string): boolean => {
    const areaKey = `${area}:__area__`;
    return areaKey in map ? map[areaKey] : true;
  }, [map]);

  return (
    <KpiSettingsContext.Provider value={{ isKpiEnabled, isAreaEnabled, loading: isLoading }}>
      {children}
    </KpiSettingsContext.Provider>
  );
}

export function useKpiSettings() {
  const context = useContext(KpiSettingsContext);
  if (!context) throw new Error('useKpiSettings must be used within KpiSettingsProvider');
  return context;
}
