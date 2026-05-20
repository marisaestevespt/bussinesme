/**
 * Maps the current pathname to a human-readable page title.
 * Used by AppLayout to set document.title dynamically.
 */

const STATIC_ROUTES: Record<string, string> = {
  '/': 'Início',
  '/secretaria': 'Secretária',
  '/comeca-aqui': 'Começa Aqui',
  '/hub-equipa': 'Hub da Equipa',
  '/ajuda': 'Ajuda',
  '/definicoes': 'Definições',
  '/tarefas': 'Tarefas',
  '/admin/diagnostics': 'Diagnóstico',
  // Executive
  '/executive': 'Executive Room',
  '/executive/dashboard': 'Dashboard Executivo',
  '/planeamento': 'Planeamento',
  '/executive/weekly-align': 'Weekly Align',
  '/executive/processos': 'Processos Executivos',
  '/executive/produtividade': 'Produtividade',
  '/executive/capacidade': 'Capacidade da Equipa',
  '/executive/gestao-equipa': 'Gestão de Equipa',
  '/executive/analise-empresarial': 'Análise Empresarial',
  '/executive/business-plan': 'Plano de Negócio',
  '/executive/innovation': 'Inovação',
  '/executive/recommendations': 'Recomendações',
  '/executive/brain-dump': 'Brain Dump',
};

const HUB_LABELS: Record<string, string> = {
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
  equipa: 'Equipa',
  operacao: 'Operação',
  produtos: 'Produtos',
  'recursos-humanos': 'Recursos Humanos',
  administrativo: 'Administrativo',
};

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function pageTitleForPath(pathname: string): string {
  if (STATIC_ROUTES[pathname]) return STATIC_ROUTES[pathname];

  // /portal/* is handled by the portal pages themselves
  if (pathname.startsWith('/portal/')) return 'Portal de Cliente';

  // /hub/<module>[/<rest>]
  const hubMatch = pathname.match(/^\/hub\/([^/]+)(?:\/(.+))?/);
  if (hubMatch) {
    const [, module, rest] = hubMatch;
    const base = HUB_LABELS[module] || titleCase(module);
    if (!rest) return base;
    // Detail routes — show base + a generic "Detalhe" suffix
    return `${base} · Detalhe`;
  }

  // /executive/<rest>
  if (pathname.startsWith('/executive/')) {
    const rest = pathname.replace('/executive/', '').split('/')[0];
    return STATIC_ROUTES[`/executive/${rest}`] || titleCase(rest);
  }

  // Fallback: humanise the last segment
  const last = pathname.split('/').filter(Boolean).pop() || '';
  return last ? titleCase(last) : 'Página';
}
