/**
 * Sector seed templates — pre-filled data for SOPs, financial categories,
 * departmental processes, and suggested routines per business sector.
 * Applied additively (never deletes existing data).
 */

import type { BusinessSector } from './sector-config';

export interface SopTemplate {
  title: string;
  department: string;
  steps: string[];
}

export interface CategoryTemplate {
  name: string;
  type: 'receita' | 'despesa';
}

export interface ProcessTemplate {
  name: string;
  department: string;
  steps: string[];
}

export interface RoutineTemplate {
  name: string;
  frequency: 'diaria' | 'semanal' | 'mensal' | 'trimestral';
  department: string;
  description: string;
}

export interface SectorTemplateData {
  sops: SopTemplate[];
  categories: CategoryTemplate[];
  processes: ProcessTemplate[];
  routines: RoutineTemplate[];
}

export const SECTOR_TEMPLATES: Record<BusinessSector, SectorTemplateData> = {
  servicos_digitais: {
    sops: [
      { title: 'Onboarding de novo cliente', department: 'operacoes', steps: ['Reunião de kickoff', 'Recolha de acessos e passwords', 'Criação de pasta Drive', 'Setup de ferramentas', 'Primeiro relatório de diagnóstico'] },
      { title: 'Publicação de conteúdo', department: 'marketing', steps: ['Briefing com cliente', 'Criação de copy', 'Design gráfico', 'Aprovação do cliente', 'Agendamento e publicação', 'Análise de performance'] },
      { title: 'Relatório mensal ao cliente', department: 'operacoes', steps: ['Exportar métricas das plataformas', 'Compilar dados em template', 'Análise e insights', 'Revisão interna', 'Envio ao cliente'] },
      { title: 'Gestão de crise em redes sociais', department: 'marketing', steps: ['Identificar a situação', 'Notificar o cliente', 'Definir estratégia de resposta', 'Monitorizar comentários', 'Relatório pós-crise'] },
    ],
    categories: [
      { name: 'Serviços de gestão de redes', type: 'receita' },
      { name: 'Consultoria e mentoria', type: 'receita' },
      { name: 'Design e branding', type: 'receita' },
      { name: 'Tráfego pago (serviço)', type: 'receita' },
      { name: 'Ferramentas e software', type: 'despesa' },
      { name: 'Publicidade e ads', type: 'despesa' },
      { name: 'Formação e cursos', type: 'despesa' },
      { name: 'Equipamento', type: 'despesa' },
    ],
    processes: [
      { name: 'Processo de venda', department: 'comercial', steps: ['Qualificar lead', 'Reunião de diagnóstico', 'Enviar proposta', 'Follow-up', 'Fechar venda'] },
      { name: 'Processo de entrega mensal', department: 'operacoes', steps: ['Planeamento mensal', 'Produção de conteúdos', 'Revisão e aprovação', 'Publicação', 'Relatório'] },
    ],
    routines: [
      { name: 'Planeamento semanal de conteúdos', frequency: 'semanal', department: 'marketing', description: 'Planear os conteúdos de todos os clientes para a semana' },
      { name: 'Fecho mensal financeiro', frequency: 'mensal', department: 'financeiro', description: 'Categorizar despesas e confirmar recebimentos do mês' },
    ],
  },

  saude_bem_estar: {
    sops: [
      { title: 'Receção de novo paciente', department: 'operacoes', steps: ['Registo de dados pessoais', 'Recolha de consentimento informado', 'Ficha de anamnese', 'Marcação de consulta inicial', 'Envio de boas-vindas'] },
      { title: 'Sessão de avaliação inicial', department: 'operacoes', steps: ['Revisão da anamnese', 'Avaliação clínica', 'Definição de objetivos terapêuticos', 'Apresentação do plano de tratamento', 'Agendamento de sessões'] },
      { title: 'Processo de alta clínica', department: 'operacoes', steps: ['Reavaliação final', 'Relatório de evolução', 'Recomendações pós-alta', 'Agendamento de follow-up', 'Pedido de feedback/NPS'] },
      { title: 'Gestão de faltas e cancelamentos', department: 'operacoes', steps: ['Verificar política de cancelamento', 'Contactar paciente', 'Reagendar ou registar falta', 'Atualizar ficha', 'Cobrar taxa se aplicável'] },
    ],
    categories: [
      { name: 'Consultas individuais', type: 'receita' },
      { name: 'Sessões de grupo', type: 'receita' },
      { name: 'Avaliações', type: 'receita' },
      { name: 'Workshops', type: 'receita' },
      { name: 'Renda de consultório', type: 'despesa' },
      { name: 'Material clínico', type: 'despesa' },
      { name: 'Seguro profissional', type: 'despesa' },
      { name: 'Supervisão clínica', type: 'despesa' },
      { name: 'Formação contínua', type: 'despesa' },
    ],
    processes: [
      { name: 'Jornada do paciente', department: 'operacoes', steps: ['Primeiro contacto', 'Triagem', 'Avaliação inicial', 'Plano terapêutico', 'Sessões regulares', 'Reavaliação', 'Alta'] },
      { name: 'Gestão de agenda', department: 'operacoes', steps: ['Definir disponibilidade', 'Confirmar marcações (24h antes)', 'Gerir cancelamentos', 'Otimizar horários'] },
    ],
    routines: [
      { name: 'Confirmação de consultas', frequency: 'diaria', department: 'operacoes', description: 'Confirmar consultas do dia seguinte via WhatsApp/SMS' },
      { name: 'Revisão de casos clínicos', frequency: 'semanal', department: 'operacoes', description: 'Revisão e atualização das fichas dos pacientes da semana' },
      { name: 'Pagamento de renda e seguros', frequency: 'mensal', department: 'financeiro', description: 'Verificar e registar pagamentos fixos mensais' },
    ],
  },

  educacao_formacao: {
    sops: [
      { title: 'Inscrição de novo aluno', department: 'operacoes', steps: ['Registo na plataforma', 'Verificação de pagamento', 'Envio de acessos', 'Email de boas-vindas', 'Inclusão no grupo de alunos'] },
      { title: 'Criação de novo curso', department: 'operacoes', steps: ['Definir objetivos de aprendizagem', 'Estruturar módulos e aulas', 'Criar materiais de apoio', 'Gravar vídeos/aulas', 'Configurar na plataforma', 'Testar acesso'] },
      { title: 'Lançamento de formação', department: 'marketing', steps: ['Definir data e preço', 'Criar página de vendas', 'Preparar emails de lançamento', 'Ativar anúncios', 'Abrir inscrições', 'Acompanhar conversões'] },
      { title: 'Emissão de certificados', department: 'operacoes', steps: ['Verificar conclusão do programa', 'Gerar certificado', 'Enviar ao aluno', 'Registar na base de dados'] },
    ],
    categories: [
      { name: 'Inscrições em cursos', type: 'receita' },
      { name: 'Mentorias individuais', type: 'receita' },
      { name: 'Workshops e eventos', type: 'receita' },
      { name: 'Materiais educativos', type: 'receita' },
      { name: 'Plataforma de ensino', type: 'despesa' },
      { name: 'Ferramentas de gravação', type: 'despesa' },
      { name: 'Certificação DGERT', type: 'despesa' },
      { name: 'Marketing e anúncios', type: 'despesa' },
    ],
    processes: [
      { name: 'Funil de inscrição', department: 'comercial', steps: ['Atrair interessados', 'Webinar gratuito', 'Oferta de inscrição', 'Follow-up', 'Conversão'] },
      { name: 'Ciclo de formação', department: 'operacoes', steps: ['Planeamento', 'Produção de conteúdos', 'Execução (aulas)', 'Avaliação de alunos', 'Certificação'] },
    ],
    routines: [
      { name: 'Preparação de aulas semanais', frequency: 'semanal', department: 'operacoes', description: 'Preparar materiais e testar plataforma para as aulas da semana' },
      { name: 'Análise de progresso dos alunos', frequency: 'mensal', department: 'operacoes', description: 'Verificar taxas de conclusão e engagement' },
    ],
  },

  criativo_producao: {
    sops: [
      { title: 'Briefing de projeto criativo', department: 'operacoes', steps: ['Reunião com cliente', 'Questionário de briefing', 'Definir estilo e referências', 'Orçamento e cronograma', 'Aprovação e início'] },
      { title: 'Produção e pós-produção', department: 'operacoes', steps: ['Preparação logística', 'Dia de produção', 'Seleção de material', 'Edição e pós-produção', 'Preview ao cliente', 'Revisões', 'Entrega final'] },
      { title: 'Entrega de projeto', department: 'operacoes', steps: ['Preparar ficheiros finais', 'Upload para plataforma de entrega', 'Enviar link ao cliente', 'Confirmar download', 'Pedir feedback/testemunho'] },
    ],
    categories: [
      { name: 'Sessões fotográficas', type: 'receita' },
      { name: 'Produção de vídeo', type: 'receita' },
      { name: 'Eventos e cobertura', type: 'receita' },
      { name: 'Licenciamento de imagens', type: 'receita' },
      { name: 'Equipamento', type: 'despesa' },
      { name: 'Software de edição', type: 'despesa' },
      { name: 'Deslocações e viagens', type: 'despesa' },
      { name: 'Assistentes e freelancers', type: 'despesa' },
      { name: 'Armazenamento cloud', type: 'despesa' },
    ],
    processes: [
      { name: 'Pipeline de orçamentação', department: 'comercial', steps: ['Pedido recebido', 'Visita ao local', 'Enviar orçamento', 'Negociação', 'Confirmação'] },
      { name: 'Fluxo de produção', department: 'operacoes', steps: ['Pré-produção', 'Produção', 'Pós-produção', 'Review', 'Entrega'] },
    ],
    routines: [
      { name: 'Backup diário de ficheiros', frequency: 'diaria', department: 'operacoes', description: 'Backup de todo o material produzido para disco externo/cloud' },
      { name: 'Atualização de portfolio', frequency: 'mensal', department: 'marketing', description: 'Selecionar e publicar trabalhos recentes no site/redes' },
    ],
  },

  consultoria_juridico: {
    sops: [
      { title: 'Receção de novo mandato', department: 'operacoes', steps: ['Consulta inicial com o cliente', 'Análise preliminar do caso', 'Verificação de conflitos de interesses', 'Assinatura de procuração/mandato', 'Abertura de processo interno', 'Definir estratégia jurídica'] },
      { title: 'Preparação de parecer jurídico', department: 'operacoes', steps: ['Análise documental', 'Pesquisa de jurisprudência', 'Redação do parecer', 'Revisão interna', 'Envio ao cliente'] },
      { title: 'Gestão de prazos judiciais', department: 'operacoes', steps: ['Registar prazo no sistema', 'Definir alertas (5 dias, 2 dias, véspera)', 'Preparar peça processual', 'Revisão interna', 'Submissão no tribunal', 'Confirmar receção'] },
      { title: 'Processo de due diligence', department: 'operacoes', steps: ['Definir scope com o cliente', 'Solicitar documentação', 'Análise documental', 'Identificar riscos e contingências', 'Elaborar relatório', 'Reunião de apresentação de resultados'] },
      { title: 'Faturação e cobrança', department: 'financeiro', steps: ['Registar horas/serviços prestados', 'Emitir nota de honorários', 'Enviar ao cliente', 'Acompanhar pagamento', 'Registar recebimento'] },
    ],
    categories: [
      { name: 'Avenças mensais', type: 'receita' },
      { name: 'Honorários avulsos', type: 'receita' },
      { name: 'Consultas', type: 'receita' },
      { name: 'Due diligence', type: 'receita' },
      { name: 'Pareceres jurídicos', type: 'receita' },
      { name: 'Renda de escritório', type: 'despesa' },
      { name: 'Quotas da Ordem', type: 'despesa' },
      { name: 'Seguro de responsabilidade', type: 'despesa' },
      { name: 'Bases de dados jurídicas', type: 'despesa' },
      { name: 'Formação contínua', type: 'despesa' },
      { name: 'Custas judiciais (adiantadas)', type: 'despesa' },
    ],
    processes: [
      { name: 'Pipeline comercial', department: 'comercial', steps: ['Consulta inicial', 'Análise do caso', 'Proposta de honorários', 'Negociação', 'Mandato assinado'] },
      { name: 'Fluxo processual', department: 'operacoes', steps: ['Abertura de processo', 'Instrução', 'Peças processuais', 'Audiências', 'Sentença/Decisão', 'Recurso (se aplicável)', 'Encerramento'] },
      { name: 'Consultoria estratégica', department: 'operacoes', steps: ['Diagnóstico', 'Análise de riscos', 'Recomendações', 'Implementação', 'Acompanhamento'] },
    ],
    routines: [
      { name: 'Verificação de prazos judiciais', frequency: 'diaria', department: 'operacoes', description: 'Consultar agenda de prazos processuais e administrativos' },
      { name: 'Atualização de processos ativos', frequency: 'semanal', department: 'operacoes', description: 'Atualizar o estado de cada processo em curso' },
      { name: 'Faturação de avenças', frequency: 'mensal', department: 'financeiro', description: 'Emitir faturas de avenças mensais a todos os clientes' },
      { name: 'Registo de formação contínua', frequency: 'trimestral', department: 'operacoes', description: 'Registar horas de formação para cumprimento de obrigações da Ordem' },
    ],
  },
};
