export interface ProjectTemplate {
  key: string;
  label: string;
  emoji: string;
  description: string;
  defaultType: string;
  defaultMode: 'pontual' | 'recorrente';
  defaultStatus: string;
  defaultDept?: string;
  defaultNotes?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: 'blank',
    label: 'Em branco',
    emoji: '📄',
    description: 'Começa do zero, sem pré-definições',
    defaultType: 'interno',
    defaultMode: 'pontual',
    defaultStatus: 'em_ideia',
  },
  {
    key: 'cliente_unico',
    label: 'Cliente — Projeto Único',
    emoji: '🎯',
    description: 'Trabalho pontual com início, meio e fim',
    defaultType: 'cliente_projeto_unico',
    defaultMode: 'pontual',
    defaultStatus: 'em_ideia',
    defaultDept: 'clientes',
    defaultNotes: 'Objetivo:\n\nEntregáveis principais:\n\nCritérios de aceitação:',
  },
  {
    key: 'cliente_mensal',
    label: 'Cliente — Serviço Mensal',
    emoji: '🔄',
    description: 'Avença/serviço recorrente com entregas cíclicas',
    defaultType: 'cliente_servico_mensal',
    defaultMode: 'recorrente',
    defaultStatus: 'em_curso',
    defaultDept: 'clientes',
    defaultNotes: 'Âmbito mensal:\n\nEntregas recorrentes:\n\nReuniões previstas:',
  },
  {
    key: 'lancamento',
    label: 'Lançamento Interno',
    emoji: '🚀',
    description: 'Lançamento de produto/oferta com fases',
    defaultType: 'lancamento',
    defaultMode: 'pontual',
    defaultStatus: 'em_ideia',
    defaultDept: 'marketing',
    defaultNotes: 'Pré-lançamento:\n\nLançamento:\n\nPós-lançamento:',
  },
  {
    key: 'interno',
    label: 'Interno',
    emoji: '🏢',
    description: 'Projeto interno da equipa',
    defaultType: 'interno',
    defaultMode: 'pontual',
    defaultStatus: 'em_ideia',
    defaultDept: 'operacao',
    defaultNotes: 'Contexto:\n\nObjetivo:\n\nResultado esperado:',
  },
];