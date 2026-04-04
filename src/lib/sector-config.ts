/**
 * Sector-based configuration system.
 * Adapts terminology, visible modules, and sector-specific fields
 * based on the business_sector value in business_settings.
 */

export type BusinessSector = 'servicos_digitais' | 'saude_bem_estar' | 'educacao_formacao' | 'criativo_producao';

export const SECTOR_OPTIONS: { value: BusinessSector; label: string; description: string }[] = [
  { value: 'servicos_digitais', label: 'Serviços Digitais', description: 'Gestão de redes, design, consultoria, mentoria' },
  { value: 'saude_bem_estar', label: 'Saúde & Bem-estar', description: 'Psicologia, nutrição, estética, terapias' },
  { value: 'educacao_formacao', label: 'Educação & Formação', description: 'Formação, coaching, escolas online' },
  { value: 'criativo_producao', label: 'Criativo & Produção', description: 'Fotografia, vídeo, eventos, wedding planning' },
];

/* ── Terminology maps ── */

type TermKey =
  | 'clientes' | 'cliente' | 'produto' | 'produtos' | 'projeto' | 'projetos'
  | 'venda' | 'vendas' | 'reuniao' | 'reunioes' | 'lead' | 'leads'
  | 'contrato' | 'contratos' | 'entregavel' | 'entregaveis'
  | 'pipeline' | 'proposta' | 'propostas';

const BASE_TERMS: Record<TermKey, string> = {
  clientes: 'Clientes',
  cliente: 'Cliente',
  produto: 'Produto',
  produtos: 'Produtos',
  projeto: 'Projeto',
  projetos: 'Projetos',
  venda: 'Venda',
  vendas: 'Vendas',
  reuniao: 'Reunião',
  reunioes: 'Reuniões',
  lead: 'Lead',
  leads: 'Leads',
  contrato: 'Contrato',
  contratos: 'Contratos',
  entregavel: 'Entregável',
  entregaveis: 'Entregáveis',
  pipeline: 'Pipeline',
  proposta: 'Proposta',
  propostas: 'Propostas',
};

const SECTOR_TERMS: Record<BusinessSector, Partial<Record<TermKey, string>>> = {
  servicos_digitais: {
    // Uses all base terms
  },
  saude_bem_estar: {
    clientes: 'Pacientes',
    cliente: 'Paciente',
    produto: 'Especialidade',
    produtos: 'Especialidades',
    projeto: 'Acompanhamento',
    projetos: 'Acompanhamentos',
    venda: 'Consulta',
    vendas: 'Consultas',
    reuniao: 'Sessão',
    reunioes: 'Sessões',
    lead: 'Contacto',
    leads: 'Contactos',
    contrato: 'Acordo',
    contratos: 'Acordos',
    entregavel: 'Plano',
    entregaveis: 'Planos',
    proposta: 'Proposta',
    propostas: 'Propostas',
  },
  educacao_formacao: {
    clientes: 'Alunos',
    cliente: 'Aluno',
    produto: 'Programa',
    produtos: 'Programas',
    projeto: 'Curso',
    projetos: 'Cursos',
    venda: 'Inscrição',
    vendas: 'Inscrições',
    reuniao: 'Aula',
    reunioes: 'Aulas',
    lead: 'Interessado',
    leads: 'Interessados',
    contrato: 'Matrícula',
    contratos: 'Matrículas',
    entregavel: 'Módulo',
    entregaveis: 'Módulos',
    proposta: 'Proposta',
    propostas: 'Propostas',
  },
  criativo_producao: {
    produto: 'Serviço',
    produtos: 'Serviços',
    venda: 'Orçamento',
    vendas: 'Orçamentos',
    entregavel: 'Entrega',
    entregaveis: 'Entregas',
    proposta: 'Orçamento',
    propostas: 'Orçamentos',
  },
};

/* ── Module visibility ── */

type ModuleVisibility = 'active' | 'available' | 'hidden';

// Only override modules that differ from 'active' (default)
const SECTOR_MODULE_OVERRIDES: Record<BusinessSector, Partial<Record<string, ModuleVisibility>>> = {
  servicos_digitais: {
    // All active by default
  },
  saude_bem_estar: {
    marketing: 'available',
    comercial: 'available',
    'trafego-pago': 'hidden',
  },
  educacao_formacao: {
    'trafego-pago': 'available',
    comercial: 'available',
  },
  criativo_producao: {
    // All active
  },
};

/* ── Sector-specific fields ── */

export interface SectorField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'url';
}

const SECTOR_FIELDS: Record<BusinessSector, SectorField[]> = {
  servicos_digitais: [
    { key: 'ferramentas', label: 'Ferramentas utilizadas', placeholder: 'Ex: Canva, Meta Business, Notion', type: 'text' },
    { key: 'nichos', label: 'Nichos de atuação', placeholder: 'Ex: Saúde, Moda, Alimentação', type: 'text' },
  ],
  saude_bem_estar: [
    { key: 'cedula_profissional', label: 'Nº Cédula Profissional', placeholder: 'Ex: C-12345', type: 'text' },
    { key: 'especialidade', label: 'Especialidade', placeholder: 'Ex: Psicologia Clínica', type: 'text' },
    { key: 'seguro_profissional', label: 'Seguro Profissional', placeholder: 'Ex: Fidelidade Nº 123456', type: 'text' },
  ],
  educacao_formacao: [
    { key: 'plataforma_ensino', label: 'Plataforma de ensino', placeholder: 'Ex: Teachable, Hotmart', type: 'text' },
    { key: 'certificacao_dgert', label: 'Nº Certificação DGERT', placeholder: 'Ex: C-1234/2024', type: 'text' },
  ],
  criativo_producao: [
    { key: 'portfolio_url', label: 'Portfolio', placeholder: 'https://...', type: 'url' },
    { key: 'equipamento', label: 'Equipamento principal', placeholder: 'Ex: Canon R5, DJI Mini 4', type: 'text' },
  ],
};

/* ── Config builder ── */

export interface SectorConfig {
  sector: BusinessSector;
  label: string;
  /** Translate a term key to the sector-specific label */
  t: (key: TermKey) => string;
  /** Check if a module is active for this sector */
  isModuleActive: (moduleKey: string) => boolean;
  /** Check if a module is hidden for this sector */
  isModuleHidden: (moduleKey: string) => boolean;
  /** Get module visibility */
  getModuleVisibility: (moduleKey: string) => ModuleVisibility;
  /** Sector-specific form fields */
  fields: SectorField[];
}

export function buildSectorConfig(sector: BusinessSector): SectorConfig {
  const sectorTerms = SECTOR_TERMS[sector] || {};
  const moduleOverrides = SECTOR_MODULE_OVERRIDES[sector] || {};
  const sectorOption = SECTOR_OPTIONS.find(s => s.value === sector);

  return {
    sector,
    label: sectorOption?.label || 'Serviços Digitais',
    t: (key: TermKey) => sectorTerms[key] || BASE_TERMS[key] || key,
    isModuleActive: (moduleKey: string) => (moduleOverrides[moduleKey] || 'active') === 'active',
    isModuleHidden: (moduleKey: string) => (moduleOverrides[moduleKey] || 'active') === 'hidden',
    getModuleVisibility: (moduleKey: string) => moduleOverrides[moduleKey] || 'active',
    fields: SECTOR_FIELDS[sector] || [],
  };
}
