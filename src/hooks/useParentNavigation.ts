import { useLocation } from 'react-router-dom';

/**
 * Mapping of URL path segments to human-readable labels.
 * Covers all modules, sub-sections, and executive areas.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Top-level
  secretaria: 'Secretária',
  'hub-equipa': 'Hub de Equipa',
  'comeca-aqui': 'Começa Aqui',
  executive: 'Executive Room',
  definicoes: 'Definições',

  // Hub modules
  hub: 'Hub de Equipa',
  agenda: 'Agenda',
  reunioes: 'Reuniões',
  processos: 'Processos',
  projetos: 'Projetos',
  tarefas: 'Tarefas',
  acessos: 'Acessos',
  mural: 'Mural',
  biblioteca: 'Biblioteca',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  clientes: 'Clientes',
  produtos: 'Produtos',
  equipa: 'Equipa',
  operacao: 'Operação',
  'recursos-humanos': 'Recursos Humanos',
  'customer-success': 'Customer Success',

  // Marketing sub-sections
  'gestao-marca': 'Gestão de Marca',
  conteudos: 'Conteúdos',
  canal: 'Canal',
  estrategia: 'Estratégia',
  'processos-mkt': 'Processos',
  'recursos-mkt': 'Recursos',
  automacoes: 'Automações',
  funis: 'Funis',
  analise: 'Análise',
  'trafego-pago': 'Tráfego Pago',
  report: 'Relatório',
  criativo: 'Criativo',

  // Comercial sub-sections
  metas: 'Metas',
  vendas: 'Vendas',
  acoes: 'Ações',
  crm: 'CRM',
  'biblioteca-comercial': 'Biblioteca',

  // Financeiro sub-sections
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  entradas: 'Entradas',
  saidas: 'Saídas',
  iva: 'IVA',
  'seguranca-social': 'Segurança Social',
  documentos: 'Documentos',

  // RH sub-sections
  escala: 'Escala',
  performance: 'Performance',
  feedback: 'Feedback',
  'contratos-pagamentos': 'Contratos & Pagamentos',

  // Executive sub-sections
  planeamento: 'Planeamento',
  'weekly-align': 'Weekly Align',
  'gestao-equipa': 'Gestão de Equipa',
  'business-plan': 'Plano de Negócio',
  innovation: 'Inovação',
  productivity: 'Produtividade',
  recommendations: 'Recomendações',
};

/** Routes that are considered top-level (no back navigation) */
const TOP_LEVEL_ROUTES = new Set([
  '/secretaria',
  '/hub-equipa',
  '/comeca-aqui',
  '/executive',
  '/definicoes',
  '/hub/mural',
  '/hub/biblioteca',
  '/hub/marketing',
  '/hub/comercial',
  '/hub/financeiro',
  '/hub/clientes',
  '/hub/produtos',
  '/hub/equipa',
  '/hub/operacao',
  '/hub/recursos-humanos',
]);

function getLabel(segment: string): string {
  return SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export interface ParentNavInfo {
  parentRoute: string;
  parentLabel: string;
}

/**
 * Hook that derives the parent route and its label from the current pathname.
 * Returns null if the current page is a top-level page (no parent).
 */
export function useParentNavigation(): ParentNavInfo | null {
  const { pathname } = useLocation();

  // Normalize: remove trailing slash
  const clean = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Top-level pages have no parent
  if (TOP_LEVEL_ROUTES.has(clean)) return null;

  // Split into segments: e.g. /hub/clientes/abc → ['', 'hub', 'clientes', 'abc']
  const parts = clean.split('/');

  // Need at least 3 parts to have a parent (e.g. /hub/something)
  if (parts.length < 3) return null;

  // Parent is everything except the last segment
  const parentParts = parts.slice(0, -1);
  const parentRoute = parentParts.join('/') || '/';
  const parentSegment = parentParts[parentParts.length - 1];
  const parentLabel = getLabel(parentSegment);

  return { parentRoute, parentLabel };
}
