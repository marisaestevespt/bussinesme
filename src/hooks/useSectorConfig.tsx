import { useMemo } from 'react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { buildSectorConfig, type BusinessSector, type SectorConfig } from '@/lib/sector-config';

/**
 * Returns the sector configuration for the current business.
 * Provides t() for terminology, module visibility checks, and sector-specific fields.
 */
export function useSectorConfig(): SectorConfig {
  const { settings } = useBusinessSettings();
  const sector = (settings?.business_sector as BusinessSector | undefined) || 'servicos_digitais';

  return useMemo(() => buildSectorConfig(sector), [sector]);
}
