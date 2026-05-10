/**
 * Regras puras de conversão de lead → cliente/portal.
 * Extraídas para serem testáveis e prevenir regressões dos bugs C1/C3.
 *
 * C1: Drag para "Ganho" tem que abrir conversão (validado no componente + trigger DB)
 * C3: Diagnóstico tem que ser copiado MESMO QUE FAQs estejam vazias
 */

export type ProductType =
  | 'projeto_1_1'
  | 'servico_pontual'
  | 'consulta'
  | 'consultoria_individual'
  | 'consultoria_grupo'
  | 'mentoria_individual'
  | 'mentoria_grupo'
  | 'programa_implementacao'
  | 'workshop'
  | 'servico_mensal'
  | string;

export type PortalType = 'projeto_unico' | 'servico_mensal' | null;

const PROJETO_TYPES: ProductType[] = [
  'projeto_1_1',
  'servico_pontual',
  'consulta',
  'consultoria_individual',
  'consultoria_grupo',
  'mentoria_individual',
  'mentoria_grupo',
  'programa_implementacao',
  'workshop',
];

/** Decide o tipo de portal a partir do tipo de produto. */
export function resolvePortalType(productType?: string | null): PortalType {
  if (!productType) return null;
  if (PROJETO_TYPES.includes(productType)) return 'projeto_unico';
  if (productType === 'servico_mensal') return 'servico_mensal';
  return null;
}

export interface RawFaq {
  question?: string | null;
  answer?: string | null;
}

/** Filtra FAQs ignorando entradas com question vazia. */
export function filterValidFaqs(faqs: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(faqs)) return [];
  return (faqs as RawFaq[])
    .filter((f) => typeof f?.question === 'string' && f.question.trim().length > 0)
    .map((f) => ({ question: f.question!.trim(), answer: (f.answer ?? '').toString() }));
}

/**
 * Decide se o diagnóstico deve ser copiado para o portal.
 * REGRA C3: copia SEMPRE que existirem perguntas de diagnóstico,
 * INDEPENDENTEMENTE de haver FAQs válidas.
 */
export function shouldCopyDiagnostic(opts: {
  hasPortal: boolean;
  diagnosticQuestionCount: number;
}): boolean {
  return opts.hasPortal && opts.diagnosticQuestionCount > 0;
}

/** Estados de lead que disparam a conversão obrigatória. */
export const WON_LEAD_STATUS = 'ganho';

export function isWonStatus(status: string | null | undefined): boolean {
  return status === WON_LEAD_STATUS;
}