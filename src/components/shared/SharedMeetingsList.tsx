import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { MEETING_STATUSES } from '@/lib/meetingStatus';
import { DEPARTMENTS } from '@/lib/departments';
import { CalendarDays } from 'lucide-react';

/**
 * Lista de reuniões partilhada — UI idêntica à página /hub/reunioes.
 * Usar sempre que mostrarmos uma sub-lista de reuniões dentro de um produto,
 * cliente, projeto, etc., para garantir consistência total (ordem das colunas,
 * cores de status, badges de tipo, formato de data).
 */

export interface SharedMeetingItem {
  id: string;
  title: string;
  date_time: string | null;
  status: string;
  /** @deprecated tipos de reunião foram unificados */
  meeting_type?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  department?: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const s = MEETING_STATUSES.find(x => x.value === status) ?? MEETING_STATUSES[0];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${s.dotColor}20`, color: s.dotColor }}
    >
      {s.label}
    </span>
  );
}

export function SharedMeetingsList({ items, emptyLabel }: { items: SharedMeetingItem[]; emptyLabel?: string }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
        <CalendarDays className="mx-auto h-5 w-5 mb-2 opacity-60" />
        {emptyLabel || 'Sem reuniões.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <div className="col-span-2">Status</div>
        <div className="col-span-4">Reunião</div>
        <div className="col-span-3">Data / Hora</div>
        <div className="col-span-3">Contexto</div>
      </div>
      {items.map(m => {
        const ctx =
          m.client_name ||
          m.project_name ||
          (m.department ? DEPARTMENTS.find(d => d.value === m.department)?.label : '') ||
          'Interna';
        return (
          <div
            key={m.id}
            className="grid grid-cols-12 gap-2 px-4 py-3 w-full text-left hover:bg-muted/50 transition-colors text-sm items-center"
          >
            <div className="col-span-2">
              <StatusBadge status={m.status} />
            </div>
            <button
              type="button"
              onClick={() => navigate(`/hub/reunioes/${m.id}`)}
              className="col-span-4 font-medium text-foreground truncate text-left hover:underline"
            >
              {m.title}
            </button>
            <div className="col-span-3 text-muted-foreground">
              {m.date_time ? format(parseISO(m.date_time), "dd MMM yyyy 'às' HH:mm", { locale: pt }) : '—'}
            </div>
            <div className="col-span-3 flex items-center gap-2 text-muted-foreground truncate">
              <span className="truncate">{ctx}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}