import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Recurrence helpers (mirror of src/pages/Reunioes.tsx) ──────

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

// Portuguese national holidays (fixed). Keep aligned with frontend lib.
function isPtHoliday(d: Date): boolean {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [
    '01-01', '04-25', '05-01', '06-10', '08-15',
    '10-05', '11-01', '12-01', '12-08', '12-25',
  ].includes(md);
}

function firstFridayOfMonth(d: Date, hour = 0, minute = 0): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (5 - first.getDay() + 7) % 7;
  let target = new Date(first.getFullYear(), first.getMonth(), 1 + offset, hour, minute, 0, 0);
  while (isPtHoliday(target) || target.getDay() === 0 || target.getDay() === 6) {
    target = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1, hour, minute, 0, 0);
  }
  return target;
}

function getAdvanceFn(frequency: string): (d: Date) => Date {
  switch (frequency) {
    case 'diaria': return (d) => addDays(d, 1);
    case 'semanal': return (d) => addWeeks(d, 1);
    case 'quinzenal': return (d) => addWeeks(d, 2);
    case 'cada_3_semanas': return (d) => addWeeks(d, 3);
    case 'mensal': return (d) => addMonths(d, 1);
    case 'bimestral': return (d) => addMonths(d, 2);
    case 'trimestral': return (d) => addMonths(d, 3);
    case 'semestral': return (d) => addMonths(d, 6);
    case 'mensal_primeira_sexta':
      return (d) => firstFridayOfMonth(addMonths(d, 1), d.getHours(), d.getMinutes());
    default: return (d) => addWeeks(d, 1);
  }
}

function generateDates(start: Date, frequency: string, end: Date): Date[] {
  const out: Date[] = [];
  const advance = getAdvanceFn(frequency);
  let cur = advance(new Date(start));
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur));
    cur = advance(cur);
  }
  return out;
}

// ─── Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const parentMeetingId: string | undefined = body.parent_meeting_id;
    if (!parentMeetingId) {
      return new Response(JSON.stringify({ error: 'parent_meeting_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch parent meeting (use service-role-equivalent: rely on RLS via user token)
    const { data: parent, error: pErr } = await supabase
      .from('meetings').select('*').eq('id', parentMeetingId).maybeSingle();
    if (pErr || !parent) {
      return new Response(JSON.stringify({ error: 'Parent meeting not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!parent.is_recurring || !parent.recurrence_frequency) {
      return new Response(JSON.stringify({ error: 'Meeting is not recurring' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine effective end date: min(recurrence_end_date, client.end_of_cycle if set)
    let effectiveEnd: Date | null = parent.recurrence_end_date
      ? new Date(parent.recurrence_end_date + 'T23:59:59')
      : null;
    if (parent.client_id) {
      const { data: client } = await supabase
        .from('clients').select('end_of_cycle').eq('id', parent.client_id).maybeSingle();
      const cycleStr = (client as any)?.end_of_cycle as string | null | undefined;
      if (cycleStr) {
        const cycleEnd = new Date(cycleStr + 'T23:59:59');
        if (!effectiveEnd || cycleEnd.getTime() > effectiveEnd.getTime()) {
          effectiveEnd = cycleEnd;
        }
      }
    }
    if (!effectiveEnd) {
      return new Response(JSON.stringify({ error: 'No end date defined (recurrence_end_date or client end_of_cycle)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Existing occurrences
    const { data: existing } = await supabase
      .from('meetings').select('id, date_time')
      .eq('parent_meeting_id', parentMeetingId);
    const existingTimestamps = new Set((existing ?? []).map((o: any) => new Date(o.date_time).getTime()));
    // Also include parent itself (it represents the first occurrence)
    existingTimestamps.add(new Date(parent.date_time).getTime());

    // Generate all candidate dates from parent.date_time
    const startDate = new Date(parent.date_time);
    const candidates = generateDates(startDate, parent.recurrence_frequency, effectiveEnd);

    // Filter out duplicates and past dates (only generate from "now" onwards)
    const now = Date.now();
    const newDates = candidates.filter(d =>
      !existingTimestamps.has(d.getTime()) && d.getTime() > now
    );

    if (newDates.length === 0) {
      return new Response(JSON.stringify({
        created: 0,
        message: 'Sem novas ocorrencias para gerar',
        effective_end: effectiveEnd.toISOString().slice(0, 10),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build occurrence rows by cloning parent (omit id/created/updated/parent metadata)
    const occurrences = newDates.map(d => ({
      title: parent.title,
      date_time: d.toISOString(),
      status: 'por_confirmar',
      meeting_type: parent.meeting_type,
      client_id: parent.client_id,
      client_name: parent.client_name,
      project_id: parent.project_id,
      project_name: parent.project_name,
      product_id: parent.product_id,
      product_name: parent.product_name,
      department: parent.department,
      duration_minutes: parent.duration_minutes,
      planned_duration_minutes: parent.planned_duration_minutes ?? parent.duration_minutes ?? null,
      actual_duration_minutes: null,
      meeting_url: parent.meeting_url,
      created_by: parent.created_by,
      parent_meeting_id: parent.id,
      is_recurring: false,
      visible_in_portal: parent.visible_in_portal,
      with_meet: parent.with_meet,
      icon: parent.icon,
      cover_url: parent.cover_url,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('meetings').insert(occurrences).select('id, date_time');
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mirror participants from parent to new occurrences
    const { data: parentParticipants } = await supabase
      .from('meeting_participants').select('profile_id').eq('meeting_id', parentMeetingId);
    if (parentParticipants && parentParticipants.length && inserted && inserted.length) {
      const rows = inserted.flatMap((occ: any) =>
        parentParticipants.map((p: any) => ({ meeting_id: occ.id, profile_id: p.profile_id }))
      );
      await supabase.from('meeting_participants').insert(rows);
    }

    // Create matching calendar events
    if (inserted && inserted.length) {
      const isClientMeeting = parent.meeting_type === 'cliente';
      const evRows = inserted.map((occ: any) => ({
        title: parent.title,
        start_date: occ.date_time,
        event_type_id: null,
        client_name: isClientMeeting ? parent.client_name : null,
        department: parent.department,
        created_by: parent.created_by,
      }));
      await supabase.from('events').insert(evRows);
    }

    return new Response(JSON.stringify({
      created: inserted?.length ?? 0,
      effective_end: effectiveEnd.toISOString().slice(0, 10),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('regenerate-recurring-meetings error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});