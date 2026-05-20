import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VALUE_SOURCES } from '../usePlanningData';

/**
 * Smoke test: every `bd_*` entry declared in VALUE_SOURCES must have a
 * matching branch in the unified resolver inside useKpiAutoValue.ts.
 *
 * This guards against regressions where a new value_source is added to the
 * dropdown but the resolver silently returns null (progresso = 0%).
 */
describe('KPI auto-resolver coverage', () => {
  const resolverSrc = readFileSync(
    path.resolve(__dirname, '../useKpiAutoValue.ts'),
    'utf8',
  );

  const bdSources = VALUE_SOURCES
    .map((s) => s.value)
    .filter((v) => v.startsWith('bd_'));

  it('declares at least the 36 known bd_* sources', () => {
    expect(bdSources.length).toBeGreaterThanOrEqual(36);
  });

  it.each(bdSources)('resolver handles "%s"', (src) => {
    // Match either `src === 'bd_xxx'` or `src === "bd_xxx"`.
    const re = new RegExp(`src\\s*===\\s*['"]${src}['"]`);
    expect(resolverSrc).toMatch(re);
  });
});