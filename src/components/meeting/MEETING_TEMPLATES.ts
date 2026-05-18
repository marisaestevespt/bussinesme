import { Calendar } from 'lucide-react';

// Reuniões usam um único template unificado. Os valores legacy
// ('recorrente' | 'projeto' | 'cliente' | 'diagnostico' | 'inicial')
// continuam aceites pelo tipo para compatibilidade com dados antigos.
export type MeetingTemplateType = 'standard' | 'recorrente' | 'projeto' | 'cliente' | 'diagnostico' | 'inicial';

export interface MeetingTemplate {
  value: MeetingTemplateType;
  label: string;
  description: string;
  icon: typeof Calendar;
  /** Default discussion_points (agenda) inserted on creation */
  defaultAgenda: string[];
  /** Default duration in minutes (used to suggest, not enforced) */
  defaultDurationMinutes?: number;
  /** Default department, when applicable */
  defaultDepartment?: string;
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    value: 'standard',
    label: 'Nova reunião',
    description: 'Reunião com agenda livre',
    icon: Calendar,
    defaultDurationMinutes: 45,
    defaultAgenda: [
      'Contexto e objetivos',
      'Pontos em curso',
      'Bloqueios e ajuda necessária',
      'Próximos passos e responsáveis',
    ],
  },
];

export function getMeetingTemplate(type: MeetingTemplateType | string | null | undefined): MeetingTemplate | undefined {
  // Qualquer valor legacy resolve para o template único.
  return MEETING_TEMPLATES[0];
}
