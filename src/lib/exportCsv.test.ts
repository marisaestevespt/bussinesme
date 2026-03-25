import { describe, it, expect } from 'vitest';
import { exportCsvString } from '@/lib/exportCsv';

describe('exportCsvString', () => {
  it('generates correct CSV with headers', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const csv = exportCsvString(data, ['name', 'age']);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('handles empty data', () => {
    const csv = exportCsvString([], ['name', 'age']);
    expect(csv).toBe('name,age');
  });

  it('escapes commas in values', () => {
    const data = [{ name: 'Smith, John', age: 40 }];
    const csv = exportCsvString(data, ['name', 'age']);
    expect(csv).toContain('"Smith, John"');
  });
});
