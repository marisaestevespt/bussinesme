import { Workflow, UserPlus, Repeat, Package, FileText } from 'lucide-react';

export type SopTemplateType = 'operacional' | 'onboarding' | 'rotina' | 'entrega' | 'outro';

export interface SopTemplate {
  value: SopTemplateType;
  label: string;
  description: string;
  icon: typeof Workflow;
  /** Default `objetivo` (free-text goal of the SOP) */
  defaultObjetivo?: string;
  /** Default steps inserted into sop_steps right after creation */
  defaultSteps: string[];
  /** Default sop_type stored on the row (mirrors `value` except for "outro") */
  defaultSopType: string;
}

export const SOP_TEMPLATES: SopTemplate[] = [
  {
    value: 'operacional',
    label: 'Processo operacional',
    description: 'Fluxo recorrente de execução interna',
    icon: Workflow,
    defaultSopType: 'operacional',
    defaultObjetivo: 'Garantir execução consistente e replicável deste processo pela equipa.',
    defaultSteps: [
      'Pré-requisitos: o que é preciso antes de começar',
      'Passo 1: ação inicial',
      'Passo 2: execução principal',
      'Validação / controlo de qualidade',
      'Comunicação / handover ao próximo responsável',
    ],
  },
  {
    value: 'onboarding',
    label: 'Onboarding',
    description: 'Processo de entrada de cliente, membro ou parceiro',
    icon: UserPlus,
    defaultSopType: 'onboarding',
    defaultObjetivo: 'Acolher e preparar a entrada com toda a informação, acessos e expectativas alinhadas.',
    defaultSteps: [
      'Boas-vindas e apresentação do contexto',
      'Recolha de dados e documentos necessários',
      'Acessos a ferramentas e plataformas',
      'Apresentação do processo de trabalho',
      'Reunião de kickoff e alinhamento de objetivos',
      'Confirmação final e marcos seguintes',
    ],
  },
  {
    value: 'rotina',
    label: 'Rotina',
    description: 'Tarefa periódica (diária, semanal, mensal…)',
    icon: Repeat,
    defaultSopType: 'rotina',
    defaultObjetivo: 'Executar de forma sistemática esta rotina garantindo continuidade e controlo.',
    defaultSteps: [
      'Verificar inputs e estado atual',
      'Executar as ações da rotina',
      'Registar resultados / atualizar dashboard',
      'Sinalizar bloqueios ou desvios',
    ],
  },
  {
    value: 'entrega',
    label: 'Entrega',
    description: 'Processo de produção e entrega de um deliverable',
    icon: Package,
    defaultSopType: 'entrega',
    defaultObjetivo: 'Produzir e entregar este deliverable com qualidade, prazo e aprovação confirmada.',
    defaultSteps: [
      'Briefing e recolha de requisitos',
      'Produção / execução do deliverable',
      'Revisão interna',
      'Apresentação ao cliente / aprovação',
      'Ajustes finais e entrega definitiva',
      'Arquivo e fecho',
    ],
  },
  {
    value: 'outro',
    label: 'Em branco',
    description: 'Cria um processo vazio para definires do zero',
    icon: FileText,
    defaultSopType: 'outro',
    defaultSteps: [],
  },
];

export function getSopTemplate(value: string | null | undefined): SopTemplate | undefined {
  if (!value) return undefined;
  return SOP_TEMPLATES.find(t => t.value === value);
}
