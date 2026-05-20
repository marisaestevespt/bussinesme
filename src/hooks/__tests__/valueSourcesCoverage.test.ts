import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { VALUE_SOURCES } from '../usePlanningData';

/**
 * Guards against the regression where a `value_source` referenced in code
 * (resolver or hooks) is missing from VALUE_SOURCES, which causes the UI to
 * silently fall back to the "Manual" label.
 */
describe('VALUE_SOURCES coverage', () => {
  const root = resolve(__dirname, '../..');

  const extractStringLiterals = (file: string, regex: RegExp): string[] => {
    const src = readFileSync(resolve(root, file), 'utf8');
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(src)) !== null) found.add(m[1]);
    return [...found];
  };

  it('every src checked in useKpiAutoValue is registered in VALUE_SOURCES', () => {
    const used = extractStringLiterals(
      'hooks/useKpiAutoValue.ts',
      /src\s*===\s*'([a-z_]+)'/g,
    );
    const known = new Set(VALUE_SOURCES.map((v) => v.value));
    const missing = used.filter((s) => !known.has(s));
    expect(missing, `Sources used in resolver but missing from VALUE_SOURCES: ${missing.join(', ')}`).toEqual([]);
  });

  it('every value_source written by hooks is registered in VALUE_SOURCES', () => {
    const written = [
      ...extractStringLiterals('hooks/useCommercialData.tsx', /value_source:\s*'([a-z_]+)'/g),
      ...extractStringLiterals('hooks/usePlanningData.tsx', /value_source:\s*'([a-z_]+)'/g),
      ...extractStringLiterals('components/planning/ObjectiveDialog.tsx', /value_source:\s*'([a-z_]+)'/g),
    ];
    const known = new Set(VALUE_SOURCES.map((v) => v.value));
    const missing = written.filter((s) => !known.has(s));
    expect(missing, `Sources written by hooks but missing from VALUE_SOURCES: ${missing.join(', ')}`).toEqual([]);
  });

  it('VALUE_SOURCES values are unique', () => {
    const values = VALUE_SOURCES.map((v) => v.value);
    expect(new Set(values).size).toBe(values.length);
  });
});