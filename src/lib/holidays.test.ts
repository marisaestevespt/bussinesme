import { describe, it, expect } from 'vitest';
import { getPortugueseHolidays, isHoliday, adjustToBusinessDay, isNonBusinessDay } from '@/lib/holidays';

describe('Portuguese holidays', () => {
  it('returns 14 holidays for a typical year', () => {
    const holidays = getPortugueseHolidays(2026);
    expect(holidays.length).toBe(14);
  });

  it('includes fixed holidays', () => {
    const holidays = getPortugueseHolidays(2026);
    const names = holidays.map(h => h.name);
    expect(names).toContain('Ano Novo');
    expect(names).toContain('Natal');
    expect(names).toContain('Dia da Liberdade');
    expect(names).toContain('Dia de Portugal');
  });

  it('includes movable holidays', () => {
    const holidays = getPortugueseHolidays(2026);
    const names = holidays.map(h => h.name);
    expect(names).toContain('Carnaval');
    expect(names).toContain('Sexta-feira Santa');
    expect(names).toContain('Domingo de Páscoa');
    expect(names).toContain('Corpo de Deus');
  });

  it('Easter 2026 is April 5', () => {
    const holidays = getPortugueseHolidays(2026);
    const easter = holidays.find(h => h.name === 'Domingo de Páscoa');
    expect(easter?.dateStr).toBe('2026-04-05');
  });

  it('isHoliday detects Dec 25', () => {
    expect(isHoliday(new Date(2026, 11, 25))).toBe(true);
  });

  it('isHoliday returns false for regular day', () => {
    expect(isHoliday(new Date(2026, 2, 10))).toBe(false);
  });

  it('adjustToBusinessDay skips weekends', () => {
    // 2026-03-29 is a Sunday
    const result = adjustToBusinessDay(new Date(2026, 2, 29));
    expect(result.getDay()).not.toBe(0);
    expect(result.getDay()).not.toBe(6);
  });

  it('adjustToBusinessDay skips holidays', () => {
    // 2026-12-25 is Friday (Christmas)
    const result = adjustToBusinessDay(new Date(2026, 11, 25));
    expect(result.getDate()).toBe(24); // Thursday Dec 24
  });

  it('isNonBusinessDay detects Saturday', () => {
    // 2026-03-28 is a Saturday
    expect(isNonBusinessDay(new Date(2026, 2, 28))).toBe(true);
  });
});
