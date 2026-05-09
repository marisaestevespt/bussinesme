import type React from 'react';
import { Repeat, FolderOpen, UserCheck, Handshake, Users } from 'lucide-react';

export type MeetingTemplateType = 'recorrente' | 'projeto' | 'cliente' | 'diagnostico' | 'inicial';

export interface MeetingTemplate {
  value: MeetingTemplateType;
  label: string;
  description: string;
  icon: typeof Repeat;
  /** Default discussion_points (agenda) inserted on creation */
  defaultAgenda: string[];
  /** Default duration in minutes (used to suggest, not enforced) */
  defaultDurationMinutes?: number;
  /** Default department, when applicable */
  defaultDepartment?: string;
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    value: 'recorrente',
    label: 'Reunião recorrente',
    description: 'Encontros periódicos da equipa',
    icon: Repeat,
    defaultDurationMinutes: 30,
    defaultAgenda: [
      'Revisão da semana anterior',
      'Pontos em curso',
      'Bloqueios e ajuda necessária',
      'Prioridades para a próxima semana',
    ],
  },
  {
    value: 'projeto',
    label: 'Reunião de projeto',
    description: 'Alinhamento sobre um projeto interno',
    icon: FolderOpen,
    defaultDurationMinutes: 45,
    defaultAgenda: [
      'Status atual do projeto',
      'Entregáveis em curso',
      'Riscos e dependências',
      'Próximos passos',
    ],
  },
  {
    value: 'cliente',
    label: 'Reunião com cliente',
    description: 'Encontro com um cliente ativo',
    icon: UserCheck,
    defaultDurationMinutes: 60,
    defaultAgenda: [
      'Pontos do cliente',
      'Status do projeto',
      'Aprovações pendentes',
      'Próximos passos e responsáveis',
    ],
    defaultDepartment: 'clientes',
  },
  {
    value: 'inicial',
    label: 'Reunião inicial',
    description: 'Primeira reunião com o cliente (kickoff)',
    icon: Handshake,
    defaultDurationMinutes: 60,
    defaultAgenda: [
      'Apresentações e contexto',
      'Objetivos e expectativas',
      'Como vamos trabalhar (processo, comunicação, ferramentas)',
      'Próximos passos e marcos',
    ],
    defaultDepartment: 'clientes',
  },
  {
    value: 'diagnostico',
    label: 'Reunião de diagnóstico',
    description: 'Lead ou potencial cliente — comercial',
    icon: Users,
    defaultDurationMinutes: 45,
    defaultAgenda: [
      'Contexto do lead e desafio atual',
      'Objetivos e resultado desejado',
      'Apresentação da abordagem',
      'Próximos passos comerciais',
    ],
    defaultDepartment: 'comercial',
  },
];

export function getMeetingTemplate(type: MeetingTemplateType | string | null | undefined): MeetingTemplate | undefined {
  if (!type) return undefined;
  return MEETING_TEMPLATES.find(t => t.value === type);
}
