import type { AgendaEvent } from '@/components/agenda/AppleCalendarViews';
import type { UnifiedItem } from '@/hooks/useUnifiedResponsibilities';

// Source → color (HSL or hex). Aligned with SecretariaSemana legend.
const SOURCE_COLOR: Record<string, string> = {
  reuniao: '#3B82F6',     // blue
  projeto: '#8B5CF6',     // violet
  tarefa: 'hsl(var(--primary))',
  rotina: '#10B981',      // emerald
  crm: '#F59E0B',         // amber
  conteudo: '#EC4899',    // pink
  nps: '#14B8A6',         // teal
  marco: '#6366F1',       // indigo
  acao_venda: '#EF4444',  // red
};

function makeBase(): Omit<AgendaEvent, 'id' | 'title' | 'start_date' | 'end_date'> {
  return {
    event_type_id: null,
    product_name: null,
    department: null,
    client_name: null,
    notes: null,
    created_by: null,
    recurrence_type: null,
    recurrence_end: null,
    meeting_url: null,
  };
}

/** Map a UnifiedItem (responsibilities/tasks/meetings/etc) into AgendaEvent shape. */
export function unifiedItemToAgendaEvent(i: UnifiedItem): AgendaEvent | null {
  if (!i.date) return null;
  // Default to 30 min slot when only a date is provided
  let start = i.date;
  if (start.length === 10) start = `${start}T09:00:00`;
  const startD = new Date(start);
  if (isNaN(startD.getTime())) return null;
  const endD = new Date(startD.getTime() + 30 * 60000);
  const color = SOURCE_COLOR[i.source as string] ?? 'hsl(var(--primary))';
  return {
    ...makeBase(),
    id: `${i.source}-${i.id}`,
    title: i.title,
    start_date: startD.toISOString(),
    end_date: endD.toISOString(),
    // Used by AppleCalendarViews as a hint
    ...(i.source === 'reuniao' ? { _isMeeting: true } as any : {}),
    // Carry color via a fake event_type_id resolved by `types` array
    event_type_id: `__src_${i.source}`,
    _color: color,
    _source: i.source,
    _originalId: i.id,
  } as any;
}

/** Build a lightweight types[] mapping AgendaEvent.event_type_id → color. */
export function buildSourceTypes(): { id: string; name: string; color: string; slug: string }[] {
  return Object.entries(SOURCE_COLOR).map(([source, color]) => ({
    id: `__src_${source}`,
    name: source,
    color,
    slug: source,
  }));
}