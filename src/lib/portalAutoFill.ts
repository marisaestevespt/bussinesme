/**
 * Auto-fill portal initial question answers based on known client and business data.
 * Matches question text patterns (case-insensitive) to pre-fill answers.
 */

interface ClientData {
  email?: string | null;
  nif?: string | null;
  fiscal_address?: string | null;
  full_name?: string | null;
}

interface BusinessSetup {
  business_legal_name?: string;
  nif?: string;
  morada_fiscal?: string;
  business_email?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  cae_principal?: string;
  cae_secundarios?: string;
  capital_social?: string;
  regime_fiscal?: string;
  regime_iva?: string;
  contabilista?: string;
  iban?: string;
  banco?: string;
}

interface QuestionRow {
  question: string;
  answer_type?: string;
  [key: string]: any;
}

type MatchRule = {
  patterns: string[];
  getValue: (client: ClientData, business: BusinessSetup) => string | null;
};

const MATCH_RULES: MatchRule[] = [
  {
    patterns: ['email principal', 'email do negócio', 'e-mail principal'],
    getValue: (c, b) => b.business_email || c.email || null,
  },
  {
    patterns: ['nome legal', 'nome da empresa', 'firma do negócio', 'designação social', 'nome comercial'],
    getValue: (c, b) => b.business_legal_name || c.full_name || null,
  },
  {
    patterns: ['nif', 'número de identificação fiscal', 'numero de identificação fiscal'],
    getValue: (c, b) => b.nif || c.nif || null,
  },
  {
    patterns: ['morada fiscal'],
    getValue: (c, b) => b.morada_fiscal || c.fiscal_address || null,
  },
  {
    patterns: ['cae principal'],
    getValue: (_c, b) => b.cae_principal || null,
  },
  {
    patterns: ['capital social'],
    getValue: (_c, b) => b.capital_social || null,
  },
  {
    patterns: ['regime de iva', 'regime iva', 'mensal ou trimestral'],
    getValue: (_c, b) => b.regime_iva || null,
  },
  {
    patterns: ['contabilista é interno', 'contabilista'],
    getValue: (_c, b) => b.contabilista || null,
  },
  {
    patterns: ['website', 'site do negócio'],
    getValue: (_c, b) => b.business_website || null,
  },
  {
    patterns: ['telefone', 'contacto principal'],
    getValue: (_c, b) => b.business_phone || null,
  },
  {
    patterns: ['iban'],
    getValue: (_c, b) => b.iban || null,
  },
  {
    patterns: ['banco'],
    getValue: (_c, b) => b.banco || null,
  },
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Given a question row, returns a pre-filled answer if the question matches known data,
 * or null if no match.
 */
export function getAutoFillAnswer(
  question: QuestionRow,
  client: ClientData,
  business: BusinessSetup | null
): string | null {
  if (question.answer_type && question.answer_type !== 'text') return null;

  const qNorm = normalize(question.question);

  for (const rule of MATCH_RULES) {
    if (rule.patterns.some(p => qNorm.includes(normalize(p)))) {
      const val = rule.getValue(client, business || ({} as BusinessSetup));
      if (val && val.trim()) return val;
    }
  }

  return null;
}

/**
 * Enrich an array of portal_initial_questions insert rows with auto-filled answers.
 */
export function enrichQuestionsWithAutoFill<T extends { question: string; answer_type?: string }>(
  rows: T[],
  client: ClientData,
  business: BusinessSetup | null
): (T & { answer?: string; answered_at?: string })[] {
  const now = new Date().toISOString();
  return rows.map(row => {
    const autoAnswer = getAutoFillAnswer(row, client, business);
    if (autoAnswer) {
      return { ...row, answer: autoAnswer, answered_at: now };
    }
    return row;
  });
}
