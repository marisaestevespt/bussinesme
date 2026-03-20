import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPI_DEFINITIONS, AREA_LABELS } from '@/hooks/useKpiSettings';
import { cn } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

export function SettingsKpis() {
  const { settings } = useBusinessSettings();
  const businessId = settings?.id;
  const qc = useQueryClient();

  const { data: kpiRows = [] } = useQuery({
    queryKey: ['kpi-settings', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('kpi_settings')
        .select('*')
        .eq('business_id', businessId);
      return data || [];
    },
    enabled: !!businessId,
  });

  // Local state map: "area:key" → enabled
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const m: Record<string, boolean> = {};
    for (const row of kpiRows) {
      m[`${(row as any).area}:${(row as any).kpi_key}`] = (row as any).enabled;
    }
    setToggles(m);
  }, [kpiRows]);

  const getEnabled = (area: string, key: string): boolean => {
    const k = `${area}:${key}`;
    return k in toggles ? toggles[k] : true;
  };

  const isAreaEnabled = (area: string): boolean => getEnabled(area, '__area__');

  const handleToggle = useCallback(async (area: string, kpiKey: string, enabled: boolean) => {
    if (!businessId) return;
    const k = `${area}:${kpiKey}`;
    setToggles(prev => ({ ...prev, [k]: enabled }));

    await supabase.from('kpi_settings').upsert(
      { business_id: businessId, area, kpi_key: kpiKey, enabled } as any,
      { onConflict: 'business_id,area,kpi_key' }
    );
    qc.invalidateQueries({ queryKey: ['kpi-settings', businessId] });
  }, [businessId, qc]);

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {Object.entries(KPI_DEFINITIONS).map(([area, kpis]) => {
        const areaOn = isAreaEnabled(area);
        return (
          <Card key={area} className="border-secondary">
            <CardContent className="p-5 space-y-4">
              {/* Area header toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{AREA_LABELS[area]}</h3>
                </div>
                <Switch
                  checked={areaOn}
                  onCheckedChange={(v) => handleToggle(area, '__area__', v)}
                />
              </div>

              {/* Individual KPIs */}
              <div className={cn('space-y-2 transition-opacity', !areaOn && 'opacity-40 pointer-events-none')}>
                {kpis.map(kpi => (
                  <div key={kpi.key} className="flex items-center justify-between py-1.5 px-1">
                    <span className="text-sm text-foreground">{kpi.label}</span>
                    <Switch
                      checked={getEnabled(area, kpi.key)}
                      onCheckedChange={(v) => handleToggle(area, kpi.key, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
