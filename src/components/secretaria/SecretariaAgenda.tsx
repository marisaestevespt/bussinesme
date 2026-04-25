import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, format, subMonths } from 'date-fns';
import { type AgendaEvent } from '@/components/agenda/AppleCalendarViews';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { useMyAgendaEvents } from '@/hooks/useMyAgendaEvents';

export default function SecretariaAgenda() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<Date>(new Date());

  const fetchRange = useMemo(() => ({
    from: format(subMonths(current, 6), 'yyyy-MM-dd'),
    to: format(addMonths(current, 18), 'yyyy-MM-dd'),
  }), [current.getFullYear(), current.getMonth()]);

  const { events, types, typeItems, productItems, isEventVisible } = useMyAgendaEvents(fetchRange, current);

  const handleEventClick = (ev: AgendaEvent) => {
    const anyEv = ev as any;
    if (anyEv._isMeeting && anyEv._meetingId) navigate(`/hub/reunioes/${anyEv._meetingId}`);
    else if (anyEv._isSalesAction && anyEv._salesActionId) navigate('/hub/produtos');
    else navigate('/hub/agenda');
  };

  return (
    <div className="space-y-6">
      <AgendaCalendarView
        storageKey="agenda-secretaria"
        cursor={current}
        onCursorChange={setCurrent}
        events={events}
        types={types}
        typeItems={typeItems}
        productItems={productItems}
        isEventVisible={isEventVisible}
        onEventClick={handleEventClick}
        defaultMode="week"
      />
    </div>
  );
}
