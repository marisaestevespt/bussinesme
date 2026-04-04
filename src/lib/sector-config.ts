/**
 * Sector-based configuration system.
 * Adapts terminology, visible modules, sector-specific fields,
 * CRM pipeline stages, suggested routines, and meeting types
 * based on the business_sector value in business_settings.
 */

export type BusinessSector =
  | 'servicos_digitais'
  | 'saude_bem_estar'
  | 'educacao_formacao'
  | 'criativo_producao'
  | 'consultoria_juridico'
  | 'oficina_automovel';

export const SECTOR_OPTIONS: { value: BusinessSector; label: string; description: string }[] = [
  { value: 'servicos_digitais', label: 'Serviços Digitais', description: 'Gestão de redes, design, consultoria, mentoria' },
  { value: 'saude_bem_estar', label: 'Saúde & Bem-estar', description: 'Psicologia, nutrição, estética, terapias' },
  { value: 'educacao_formacao', label: 'Educação & Formação', description: 'Formação, coaching, escolas online' },
  { value: 'criativo_producao', label: 'Criativo & Produção', description: 'Fotografia, vídeo, eventos, wedding planning' },
  { value: 'consultoria_juridico', label: 'Consultoria & Jurídico', description: 'Advogados, contabilistas, consultores de gestão' },
  { value: 'oficina_automovel', label: 'Oficina & Automóvel', description: 'Oficinas, mecânica, reparação, inspeções, autopeças' },
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
  servicos_digitais: {},
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
    produto: 'Produto',
    produtos: 'Produtos',
    venda: 'Orçamento',
    vendas: 'Orçamentos',
    entregavel: 'Entrega',
    entregaveis: 'Entregas',
    proposta: 'Orçamento',
    propostas: 'Orçamentos',
  },
  consultoria_juridico: {
    clientes: 'Clientes',
    cliente: 'Cliente',
    produto: 'Serviço',
    produtos: 'Serviços',
    projeto: 'Processo',
    projetos: 'Processos',
    venda: 'Avença',
    vendas: 'Avenças',
    reuniao: 'Consulta',
    reunioes: 'Consultas',
    lead: 'Prospeto',
    leads: 'Prospetos',
    contrato: 'Mandato',
    contratos: 'Mandatos',
    entregavel: 'Parecer',
    entregaveis: 'Pareceres',
    pipeline: 'Pipeline',
    proposta: 'Parecer',
    propostas: 'Pareceres',
  },
  oficina_automovel: {
    clientes: 'Clientes',
    cliente: 'Cliente',
    produto: 'Serviço',
    produtos: 'Serviços',
    projeto: 'Veículo',
    projetos: 'Veículos',
    venda: 'Reparação',
    vendas: 'Reparações',
    reuniao: 'Agendamento',
    reunioes: 'Agendamentos',
    lead: 'Contacto',
    leads: 'Contactos',
    contrato: 'Orçamento',
    contratos: 'Orçamentos',
    entregavel: 'Serviço',
    entregaveis: 'Serviços',
    pipeline: 'Pipeline',
    proposta: 'Orçamento',
    propostas: 'Orçamentos',
  },
};

/* ── Module visibility ── */

type ModuleVisibility = 'active' | 'available' | 'hidden';

const SECTOR_MODULE_OVERRIDES: Record<BusinessSector, Partial<Record<string, ModuleVisibility>>> = {
  servicos_digitais: {},
  saude_bem_estar: {
    marketing: 'available',
    comercial: 'available',
    'trafego-pago': 'hidden',
  },
  educacao_formacao: {
    'trafego-pago': 'available',
    comercial: 'available',
  },
  criativo_producao: {},
  consultoria_juridico: {
    'trafego-pago': 'hidden',
    marketing: 'available',
  },
  oficina_automovel: {
    'trafego-pago': 'hidden',
    marketing: 'available',
    comercial: 'available',
  },
};

/* ── Sector-specific fields ── */

export interface SectorField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'url';
  /** Which entity this field applies to: business (settings), client, product, project */
  entity?: 'business' | 'client' | 'product' | 'project';
}

const SECTOR_FIELDS: Record<BusinessSector, SectorField[]> = {
  servicos_digitais: [
    { key: 'ferramentas', label: 'Ferramentas utilizadas', placeholder: 'Ex: Canva, Meta Business, Notion', type: 'text', entity: 'business' },
    { key: 'nichos', label: 'Nichos de atuação', placeholder: 'Ex: Saúde, Moda, Alimentação', type: 'text', entity: 'business' },
  ],
  saude_bem_estar: [
    { key: 'cedula_profissional', label: 'Nº Cédula Profissional', placeholder: 'Ex: C-12345', type: 'text', entity: 'business' },
    { key: 'especialidade', label: 'Especialidade', placeholder: 'Ex: Psicologia Clínica', type: 'text', entity: 'business' },
    { key: 'seguro_profissional', label: 'Seguro Profissional', placeholder: 'Ex: Fidelidade Nº 123456', type: 'text', entity: 'business' },
    { key: 'num_utente', label: 'Nº Utente SNS', placeholder: 'Ex: 123456789', type: 'text', entity: 'client' },
    { key: 'alergias', label: 'Alergias / Condições', placeholder: 'Ex: Alergia a penicilina', type: 'text', entity: 'client' },
    { key: 'duracao_sessao', label: 'Duração da sessão (min)', placeholder: 'Ex: 50', type: 'text', entity: 'product' },
  ],
  educacao_formacao: [
    { key: 'plataforma_ensino', label: 'Plataforma de ensino', placeholder: 'Ex: Teachable, Hotmart', type: 'text', entity: 'business' },
    { key: 'certificacao_dgert', label: 'Nº Certificação DGERT', placeholder: 'Ex: C-1234/2024', type: 'text', entity: 'business' },
    { key: 'habilitacoes', label: 'Habilitações', placeholder: 'Ex: Licenciatura em Gestão', type: 'text', entity: 'client' },
    { key: 'carga_horaria', label: 'Carga horária (horas)', placeholder: 'Ex: 40', type: 'text', entity: 'product' },
    { key: 'certificado_conclusao', label: 'Emite certificado?', placeholder: 'Sim / Não', type: 'text', entity: 'product' },
  ],
  criativo_producao: [
    { key: 'portfolio_url', label: 'Portfolio', placeholder: 'https://...', type: 'url', entity: 'business' },
    { key: 'equipamento', label: 'Equipamento principal', placeholder: 'Ex: Canon R5, DJI Mini 4', type: 'text', entity: 'business' },
    { key: 'estilo_artistico', label: 'Estilo artístico', placeholder: 'Ex: Minimalista, Documental', type: 'text', entity: 'business' },
    { key: 'local_evento', label: 'Local do evento', placeholder: 'Ex: Quinta do Lago', type: 'text', entity: 'project' },
    { key: 'num_convidados', label: 'Nº de convidados', placeholder: 'Ex: 120', type: 'text', entity: 'project' },
  ],
  consultoria_juridico: [
    { key: 'cedula_oa', label: 'Nº Cédula OA', placeholder: 'Ex: 12345L', type: 'text', entity: 'business' },
    { key: 'area_pratica', label: 'Área de prática', placeholder: 'Ex: Direito Fiscal, Laboral', type: 'text', entity: 'business' },
    { key: 'seguro_responsabilidade', label: 'Seguro de responsabilidade', placeholder: 'Ex: Apólice Nº 123456', type: 'text', entity: 'business' },
    { key: 'nif_cliente', label: 'NIF', placeholder: 'Ex: 123456789', type: 'text', entity: 'client' },
    { key: 'tribunal_competente', label: 'Tribunal competente', placeholder: 'Ex: Tribunal de Lisboa', type: 'text', entity: 'project' },
    { key: 'num_processo', label: 'Nº do processo', placeholder: 'Ex: 1234/26.0YXLSB', type: 'text', entity: 'project' },
    { key: 'tipo_servico', label: 'Tipo de serviço', placeholder: 'Ex: Consultoria, Contencioso, Due Diligence', type: 'text', entity: 'product' },
  ],
  oficina_automovel: [
    { key: 'alvara', label: 'Nº Alvará / Licença', placeholder: 'Ex: ALV-12345', type: 'text', entity: 'business' },
    { key: 'especialidades_oficina', label: 'Especialidades', placeholder: 'Ex: Mecânica geral, Elétrica, Chapa e pintura', type: 'text', entity: 'business' },
    { key: 'marcas_autorizadas', label: 'Marcas autorizadas', placeholder: 'Ex: Bosch Car Service, Renault', type: 'text', entity: 'business' },
    { key: 'matricula', label: 'Matrícula', placeholder: 'Ex: AA-00-AA', type: 'text', entity: 'project' },
    { key: 'marca_veiculo', label: 'Marca', placeholder: 'Ex: BMW, Renault, Toyota', type: 'text', entity: 'project' },
    { key: 'modelo_veiculo', label: 'Modelo', placeholder: 'Ex: Série 3, Clio, Corolla', type: 'text', entity: 'project' },
    { key: 'ano_veiculo', label: 'Ano', placeholder: 'Ex: 2022', type: 'text', entity: 'project' },
    { key: 'vin', label: 'VIN', placeholder: 'Ex: WBAPH5C55BA123456', type: 'text', entity: 'project' },
    { key: 'quilometragem', label: 'Quilometragem', placeholder: 'Ex: 85.000 km', type: 'text', entity: 'project' },
    { key: 'combustivel', label: 'Combustível', placeholder: 'Ex: Gasolina, Diesel, Elétrico, Híbrido', type: 'text', entity: 'project' },
    { key: 'cor_veiculo', label: 'Cor', placeholder: 'Ex: Preto metalizado', type: 'text', entity: 'project' },
    { key: 'num_chassi', label: 'Nº Chassi', placeholder: 'Ex: ABC123456', type: 'text', entity: 'project' },
    { key: 'seguradora', label: 'Seguradora', placeholder: 'Ex: Fidelidade, Allianz', type: 'text', entity: 'project' },
    { key: 'tipo_reparacao', label: 'Tipo de reparação', placeholder: 'Ex: Revisão, Travões, Motor', type: 'text', entity: 'product' },
  ],
};

/* ── Workflow configuration per sector ── */

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
}

export interface SuggestedRoutine {
  name: string;
  frequency: 'diaria' | 'semanal' | 'mensal' | 'trimestral';
  description: string;
}

export interface SectorWorkflow {
  pipelineStages: PipelineStage[];
  meetingTypes: string[];
  suggestedRoutines: SuggestedRoutine[];
}

const SECTOR_WORKFLOWS: Record<BusinessSector, SectorWorkflow> = {
  servicos_digitais: {
    pipelineStages: [
      { key: 'contacto_inicial', label: 'Contacto Inicial', color: '#94a3b8' },
      { key: 'qualificacao', label: 'Qualificação', color: '#60a5fa' },
      { key: 'proposta', label: 'Proposta Enviada', color: '#fbbf24' },
      { key: 'negociacao', label: 'Negociação', color: '#f97316' },
      { key: 'fechado', label: 'Fechado', color: '#22c55e' },
    ],
    meetingTypes: ['Reunião de briefing', 'Reunião de follow-up', 'Apresentação de resultados', 'Kickoff de projeto'],
    suggestedRoutines: [
      { name: 'Relatório semanal de métricas', frequency: 'semanal', description: 'Compilar métricas de redes sociais e enviar ao cliente' },
      { name: 'Revisão de calendário editorial', frequency: 'semanal', description: 'Planear conteúdos da semana seguinte' },
      { name: 'Fecho mensal de projetos', frequency: 'mensal', description: 'Rever entregáveis e atualizar status dos projetos' },
      { name: 'Análise trimestral de resultados', frequency: 'trimestral', description: 'Apresentar evolução ao cliente com comparativo' },
    ],
  },
  saude_bem_estar: {
    pipelineStages: [
      { key: 'primeiro_contacto', label: 'Primeiro Contacto', color: '#94a3b8' },
      { key: 'triagem', label: 'Triagem', color: '#60a5fa' },
      { key: 'avaliacao', label: 'Avaliação Inicial', color: '#a78bfa' },
      { key: 'plano_tratamento', label: 'Plano de Tratamento', color: '#fbbf24' },
      { key: 'em_acompanhamento', label: 'Em Acompanhamento', color: '#22c55e' },
    ],
    meetingTypes: ['Consulta inicial', 'Sessão de acompanhamento', 'Reavaliação', 'Sessão de grupo'],
    suggestedRoutines: [
      { name: 'Follow-up pós-sessão', frequency: 'diaria', description: 'Enviar mensagem de acompanhamento 48h após a sessão' },
      { name: 'Revisão de planos de tratamento', frequency: 'semanal', description: 'Rever evolução dos pacientes ativos' },
      { name: 'Atualização de fichas clínicas', frequency: 'mensal', description: 'Garantir que as fichas estão atualizadas' },
      { name: 'Revisão de alta clínica', frequency: 'trimestral', description: 'Avaliar pacientes que podem ter alta' },
    ],
  },
  educacao_formacao: {
    pipelineStages: [
      { key: 'interessado', label: 'Interessado', color: '#94a3b8' },
      { key: 'inscricao', label: 'Inscrição', color: '#60a5fa' },
      { key: 'pagamento', label: 'Pagamento', color: '#fbbf24' },
      { key: 'em_formacao', label: 'Em Formação', color: '#22c55e' },
      { key: 'concluido', label: 'Concluído', color: '#8b5cf6' },
    ],
    meetingTypes: ['Aula ao vivo', 'Workshop', 'Mentoria individual', 'Webinar gratuito'],
    suggestedRoutines: [
      { name: 'Preparação de aulas', frequency: 'semanal', description: 'Preparar materiais e slides para as aulas da semana' },
      { name: 'Correção de trabalhos', frequency: 'semanal', description: 'Avaliar e dar feedback sobre trabalhos submetidos' },
      { name: 'Envio de newsletter educativa', frequency: 'mensal', description: 'Enviar conteúdo educativo à base de interessados' },
      { name: 'Revisão de programa curricular', frequency: 'trimestral', description: 'Atualizar conteúdos com base no feedback' },
    ],
  },
  criativo_producao: {
    pipelineStages: [
      { key: 'pedido_orcamento', label: 'Pedido de Orçamento', color: '#94a3b8' },
      { key: 'briefing', label: 'Briefing', color: '#60a5fa' },
      { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: '#fbbf24' },
      { key: 'producao', label: 'Em Produção', color: '#f97316' },
      { key: 'entrega', label: 'Entrega Final', color: '#22c55e' },
    ],
    meetingTypes: ['Reunião de briefing', 'Visita ao local', 'Sessão de revisão', 'Entrega de materiais'],
    suggestedRoutines: [
      { name: 'Backup de ficheiros', frequency: 'diaria', description: 'Fazer backup do trabalho produzido no dia' },
      { name: 'Edição e pós-produção', frequency: 'semanal', description: 'Bloco de tempo dedicado a edição' },
      { name: 'Atualização de portfolio', frequency: 'mensal', description: 'Adicionar trabalhos recentes ao portfolio' },
      { name: 'Manutenção de equipamento', frequency: 'trimestral', description: 'Verificar e limpar equipamento' },
    ],
  },
  consultoria_juridico: {
    pipelineStages: [
      { key: 'consulta_inicial', label: 'Consulta Inicial', color: '#94a3b8' },
      { key: 'analise', label: 'Análise do Caso', color: '#60a5fa' },
      { key: 'parecer', label: 'Parecer / Proposta', color: '#a78bfa' },
      { key: 'negociacao', label: 'Negociação', color: '#fbbf24' },
      { key: 'mandato', label: 'Mandato Assinado', color: '#22c55e' },
    ],
    meetingTypes: ['Consulta presencial', 'Consulta online', 'Audiência', 'Reunião com contraparte', 'Due diligence'],
    suggestedRoutines: [
      { name: 'Revisão de prazos processuais', frequency: 'diaria', description: 'Verificar prazos judiciais e administrativos do dia' },
      { name: 'Atualização de processos', frequency: 'semanal', description: 'Atualizar estado de cada processo ativo' },
      { name: 'Faturação de avenças', frequency: 'mensal', description: 'Emitir faturas de avenças mensais' },
      { name: 'Formação contínua obrigatória', frequency: 'trimestral', description: 'Registar horas de formação para a Ordem' },
    ],
  },
  oficina_automovel: {
    pipelineStages: [
      { key: 'contacto', label: 'Contacto', color: '#94a3b8' },
      { key: 'diagnostico', label: 'Diagnóstico', color: '#60a5fa' },
      { key: 'orcamento', label: 'Orçamento Enviado', color: '#fbbf24' },
      { key: 'aprovado', label: 'Aprovado', color: '#f97316' },
      { key: 'em_reparacao', label: 'Em Reparação', color: '#a78bfa' },
      { key: 'pronto', label: 'Pronto a Levantar', color: '#22c55e' },
    ],
    meetingTypes: ['Receção de viatura', 'Diagnóstico presencial', 'Entrega de viatura', 'Orçamentação', 'Inspeção'],
    suggestedRoutines: [
      { name: 'Verificação de viaturas em oficina', frequency: 'diaria', description: 'Rever estado de cada viatura em reparação' },
      { name: 'Contacto a clientes com orçamento pendente', frequency: 'semanal', description: 'Follow-up de orçamentos enviados sem resposta' },
      { name: 'Inventário de peças', frequency: 'mensal', description: 'Verificar stock de peças e consumíveis mais usados' },
      { name: 'Manutenção de equipamento de oficina', frequency: 'trimestral', description: 'Calibração e manutenção de ferramentas e elevadores' },
    ],
  },
};

/* ── Config builder ── */

export interface SectorConfig {
  sector: BusinessSector;
  label: string;
  t: (key: TermKey) => string;
  isModuleActive: (moduleKey: string) => boolean;
  isModuleHidden: (moduleKey: string) => boolean;
  getModuleVisibility: (moduleKey: string) => ModuleVisibility;
  fields: SectorField[];
  /** Fields filtered by entity type */
  getFieldsFor: (entity: 'business' | 'client' | 'product' | 'project') => SectorField[];
  workflow: SectorWorkflow;
}

export function buildSectorConfig(sector: BusinessSector): SectorConfig {
  const sectorTerms = SECTOR_TERMS[sector] || {};
  const moduleOverrides = SECTOR_MODULE_OVERRIDES[sector] || {};
  const sectorOption = SECTOR_OPTIONS.find(s => s.value === sector);
  const allFields = SECTOR_FIELDS[sector] || [];

  return {
    sector,
    label: sectorOption?.label || 'Serviços Digitais',
    t: (key: TermKey) => sectorTerms[key] || BASE_TERMS[key] || key,
    isModuleActive: (moduleKey: string) => (moduleOverrides[moduleKey] || 'active') === 'active',
    isModuleHidden: (moduleKey: string) => (moduleOverrides[moduleKey] || 'active') === 'hidden',
    getModuleVisibility: (moduleKey: string) => moduleOverrides[moduleKey] || 'active',
    fields: allFields,
    getFieldsFor: (entity) => allFields.filter(f => (f.entity || 'business') === entity),
    workflow: SECTOR_WORKFLOWS[sector] || SECTOR_WORKFLOWS.servicos_digitais,
  };
}
