import { describe, it, expect } from 'vitest';
import { DEPARTMENTS, getDept, getDeptLabel } from '@/lib/departments';

describe('departments', () => {
  it('has 8 departments', () => {
    expect(DEPARTMENTS).toHaveLength(8);
  });

  it('each department has required fields', () => {
    for (const dept of DEPARTMENTS) {
      expect(dept.value).toBeTruthy();
      expect(dept.label).toBeTruthy();
      expect(dept.gradient).toBeTruthy();
      expect(dept.icon).toBeTruthy();
      expect(dept.lucideIcon).toBeTruthy();
    }
  });

  it('getDept returns correct department', () => {
    const dept = getDept('marketing');
    expect(dept).toBeDefined();
    expect(dept?.label).toBe('Marketing');
  });

  it('getDept returns undefined for unknown value', () => {
    expect(getDept('nonexistent')).toBeUndefined();
  });

  it('getDeptLabel returns label for valid value', () => {
    expect(getDeptLabel('financeiro')).toBe('Contabilidade');
  });

  it('getDeptLabel returns raw value for unknown', () => {
    expect(getDeptLabel('xyz')).toBe('xyz');
  });

  it('all department values are unique', () => {
    const values = DEPARTMENTS.map(d => d.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
