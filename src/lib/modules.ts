export const MODULES = {
  // Começa Aqui
  'comeca-aqui': { label: 'Começa Aqui', section: 'comeca-aqui', icon: 'Rocket' },

  // Hub de Equipa - Transversais
  'agenda': { label: 'Agenda do Negócio', section: 'transversais', icon: 'Calendar' },
  'reunioes': { label: 'Reuniões', section: 'transversais', icon: 'Users' },
  'processos': { label: 'Processos', section: 'transversais', icon: 'GitBranch' },
  'projetos': { label: 'Projetos', section: 'transversais', icon: 'FolderKanban' },
  'tarefas': { label: 'Tarefas', section: 'transversais', icon: 'CheckSquare' },
  'acessos': { label: 'Acessos', section: 'transversais', icon: 'Key' },
  'mural': { label: 'Mural de Comunicações', section: 'transversais', icon: 'MessageSquare' },
  'biblioteca': { label: 'Biblioteca de Documentos', section: 'transversais', icon: 'BookOpen' },

  // Hub de Equipa - Departamentos
  'administrativo': { label: 'Administrativo', section: 'departamentos', icon: 'Building2' },
  'marketing': { label: 'Marketing', section: 'departamentos', icon: 'Megaphone' },
  'financeiro': { label: 'Financeiro', section: 'departamentos', icon: 'DollarSign' },
  'comercial': { label: 'Comercial', section: 'departamentos', icon: 'ShoppingCart' },
  'clientes': { label: 'Clientes', section: 'departamentos', icon: 'UserCheck' },
  'equipa': { label: 'Equipa', section: 'departamentos', icon: 'UsersRound' },
  'operacao': { label: 'Operação', section: 'departamentos', icon: 'Headphones' },
  'produtos': { label: 'Produtos', section: 'departamentos', icon: 'Package' },
  'customer-success': { label: 'Customer Success', section: 'departamentos', icon: 'Heart' },
  'recursos-humanos': { label: 'Recursos Humanos', section: 'departamentos', icon: 'UsersRound' },

  // Executive Room
  'planeamento': { label: 'Planeamento', section: 'executive', icon: 'Target' },
  'weekly-align': { label: 'Weekly Align', section: 'executive', icon: 'CalendarCheck' },
  'gestao-equipa-ceo': { label: 'Gestão de Equipa (CEO)', section: 'executive', icon: 'Crown' },
} as const;

export type ModuleKey = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

export const DISPLAY_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'DM Serif Display',
] as const;

export const BODY_FONTS = [
  'DM Sans',
  'Inter',
  'Plus Jakarta Sans',
  'Nunito',
  'Raleway',
] as const;

// Keep GOOGLE_FONTS for backward compat
export const GOOGLE_FONTS = [...DISPLAY_FONTS, ...BODY_FONTS] as const;
