import { describe, it, expect } from 'vitest';
import {
  resolvePortalType,
  filterValidFaqs,
  shouldCopyDiagnostic,
  isWonStatus,
} from './conversionRules';

describe('resolvePortalType', () => {
  it('mapeia tipos de projeto para projeto_unico', () => {
    expect(resolvePortalType('projeto_1_1')).toBe('projeto_unico');
    expect(resolvePortalType('consultoria_grupo')).toBe('projeto_unico');
    expect(resolvePortalType('workshop')).toBe('projeto_unico');
  });

  it('mapeia servico_mensal para portal mensal', () => {
    expect(resolvePortalType('servico_mensal')).toBe('servico_mensal');
  });

  it('devolve null para tipos desconhecidos ou ausentes', () => {
    expect(resolvePortalType(null)).toBeNull();
    expect(resolvePortalType(undefined)).toBeNull();
    expect(resolvePortalType('tipo_invalido')).toBeNull();
  });
});

describe('filterValidFaqs', () => {
  it('ignora FAQs com question vazia (bug C3)', () => {
    const input = [
      { question: '', answer: 'resposta' },
      { question: '   ', answer: 'r' },
      { question: 'P1', answer: 'R1' },
    ];
    expect(filterValidFaqs(input)).toEqual([{ question: 'P1', answer: 'R1' }]);
  });

  it('aceita FAQs sem answer', () => {
    expect(filterValidFaqs([{ question: 'P', answer: null }])).toEqual([
      { question: 'P', answer: '' },
    ]);
  });

  it('devolve [] para input não-array', () => {
    expect(filterValidFaqs(null)).toEqual([]);
    expect(filterValidFaqs(undefined)).toEqual([]);
    expect(filterValidFaqs('not array')).toEqual([]);
  });
});

describe('shouldCopyDiagnostic', () => {
  it('copia diagnóstico mesmo SEM FAQs válidas (regressão C3)', () => {
    expect(shouldCopyDiagnostic({ hasPortal: true, diagnosticQuestionCount: 5 })).toBe(true);
  });

  it('não copia se não há perguntas de diagnóstico', () => {
    expect(shouldCopyDiagnostic({ hasPortal: true, diagnosticQuestionCount: 0 })).toBe(false);
  });

  it('não copia se portal não foi criado', () => {
    expect(shouldCopyDiagnostic({ hasPortal: false, diagnosticQuestionCount: 5 })).toBe(false);
  });
});

describe('isWonStatus (bug C1)', () => {
  it('reconhece "ganho" como status que exige conversão', () => {
    expect(isWonStatus('ganho')).toBe(true);
  });

  it('rejeita outros estados', () => {
    expect(isWonStatus('novo')).toBe(false);
    expect(isWonStatus('contactado')).toBe(false);
    expect(isWonStatus(null)).toBe(false);
    expect(isWonStatus(undefined)).toBe(false);
  });
});