// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUSINESS_BRAND_FALLBACK_HSL, normalizePortalBranding } from './portalBranding';

describe('portalBranding', () => {
  it('usa sempre o bordeaux do negócio como fallback público', () => {
    expect(normalizePortalBranding({}).primary_color).toBe(BUSINESS_BRAND_FALLBACK_HSL);
    expect(normalizePortalBranding({ primary_color: '12 76% 52%' }).primary_color).toBe('12 76% 52%');
  });

  it('impede regressões para o fallback laranja antigo no portal', () => {
    const files = ['src/pages/PortalAuth.tsx', 'src/pages/PortalView.tsx'];
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, `${file} não pode voltar ao fallback laranja`).not.toContain('12 76% 52%');
      expect(source, `${file} não pode depender da cor coral do dark mode`).not.toContain('3 50% 65%');
    }
  });
});