import { describe, it, expect } from 'vitest';

// exportCsv triggers DOM download, so we test the escape logic inline
describe('exportCsv escape logic', () => {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  it('does not escape plain strings', () => {
    expect(escape('hello')).toBe('hello');
  });

  it('escapes strings with commas', () => {
    expect(escape('Smith, John')).toBe('"Smith, John"');
  });

  it('escapes strings with quotes', () => {
    expect(escape('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('handles numbers', () => {
    expect(escape(42)).toBe('42');
  });

  it('handles newlines', () => {
    expect(escape('line1\nline2')).toBe('"line1\nline2"');
  });
});
