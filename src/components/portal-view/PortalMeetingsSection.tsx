import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarDays, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import type { PortalMeeting } from '@/types/portal';

interface Props {
  meetings: PortalMeeting[];
  setMeetings: React.Dispatch<React.SetStateAction<PortalMeeting[]>>;
  portalToken: string;
  pc: string;
  meetingStatus: (s: string) => { text: string; cls: string };
}

const renderText = (item: unknown): string =>
  typeof item === 'string' ? item : ((item as { text?: string; action?: string })?.text || (item as { text?: string; action?: string })?.action || '');

export function PortalMeetingsSection({ meetings, setMeetings, portalToken, pc, meetingStatus }: Props) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={CalendarDays}>Reuniões</SectionTitle>
      {meetings.length === 0 ? (
        <SectionCard className="p-8 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <EmptyHint>Sem reuniões registadas.</EmptyHint>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} m={m} setMeetings={setMeetings} portalToken={portalToken} pc={pc} meetingStatus={meetingStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ m, setMeetings, portalToken, pc, meetingStatus }: { m: PortalMeeting } & Omit<Props, 'meetings'>) {
  const [noteDraft, setNoteDraft] = useState('');
  const status = m.status || '';
  const isPending = status === 'por_organizar' || status === 'por_confirmar';
  const ms = meetingStatus(status);

  const confirmMeeting = async () => {
    const { data, error } = await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }> })
      .rpc('portal_confirm_meeting', { _token: portalToken, _meeting_id: m.id });
    if (error) { toast.error('Erro ao confirmar: ' + error.message); return; }
    if (data) { setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'confirmada' } : x)); toast.success('Presença confirmada ✨'); }
    else toast.error('Não foi possível confirmar');
  };

  const sendNote = async () => {
    const val = noteDraft.trim();
    if (!val) { toast.error('Escreve uma sugestão primeiro'); return; }
    await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<unknown> })
      .rpc('portal_add_meeting_notes', { _token: portalToken, _meeting_id: m.id, _notes: val });
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, portal_notes: val } : x));
    toast.success('Sugestão enviada ✓');
    setNoteDraft('');
  };

  const points = Array.isArray(m.discussion_points) ? m.discussion_points.filter((p) => (typeof p === 'string' ? p.trim() : ((p as { text?: string })?.text || '').trim())) : [];
  const cActions = Array.isArray(m.client_actions) ? m.client_actions.filter((a) => (typeof a === 'string' ? a.trim() : ((a as { text?: string; action?: string })?.text || (a as { action?: string })?.action || '').trim())) : [];
  const fNotes = Array.isArray(m.final_notes) ? m.final_notes.filter((n) => (typeof n === 'string' ? n.trim() : ((n as { text?: string })?.text || '').trim())) : [];
  const prios = Array.isArray(m.priorities) ? m.priorities.filter((p) => (typeof p === 'string' ? p.trim() : ((p as { text?: string })?.text || '').trim())) : [];
  const docs = Array.isArray(m.documents) ? m.documents.filter((d): d is { url: string; name?: string } => !!(d as { url?: string })?.url) : [];
  const dNotes = (m.discussion_notes || '').trim();
  const showAta = (status === 'realizada' || status === 'concluida' || status === 'terminada') && (points.length || cActions.length || fNotes.length || prios.length || docs.length || dNotes);

  return (
    <SectionCard className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-muted/40 mt-0.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">{m.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {m.date_time ? format(parseISO(m.date_time), "EEEE, d 'de' MMMM · HH:mm", { locale: pt }) : '—'}
              {m.duration_minutes ? ` · ${m.duration_minutes} min` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          {m.meeting_url && (
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" asChild>
              <a href={/^https?:\/\//i.test(m.meeting_url) ? m.meeting_url : `https://${m.meeting_url}`} target="_blank" rel="noopener noreferrer">Entrar</a>
            </Button>
          )}
          {isPending ? (
            <Button size="sm" className="h-8 text-xs rounded-lg text-white" style={{ backgroundColor: pc }} onClick={(e) => { e.stopPropagation(); confirmMeeting(); }}>
              Confirmar
            </Button>
          ) : (
            <Badge variant="outline" className={`text-[10px] ${ms.cls}`}>{ms.text}</Badge>
          )}
        </div>
      </div>
      {isPending && !m.portal_notes && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-[11px] text-muted-foreground mb-1.5">💡 Se este horário não te der jeito, sugere alternativas:</p>
          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="text-xs rounded-lg border-border/30 bg-muted/10 min-h-[60px]" placeholder="Ex: Prefiro terça ou quinta da semana seguinte, à tarde..." />
          <Button size="sm" className="mt-2 h-7 text-xs rounded-lg text-white" style={{ backgroundColor: pc }} onClick={sendNote}>
            <Send className="h-3 w-3 mr-1" />Enviar sugestão
          </Button>
        </div>
      )}
      {isPending && m.portal_notes && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-[11px] text-muted-foreground">✅ Sugestão enviada:</p>
          <p className="text-xs mt-1 bg-muted/20 rounded-lg p-2">{m.portal_notes}</p>
        </div>
      )}
      {!isPending && m.portal_notes && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-[11px] text-muted-foreground">📝 As tuas notas:</p>
          <p className="text-xs mt-1">{m.portal_notes}</p>
        </div>
      )}
      {showAta && (
        <details className="mt-3 pt-3 border-t border-border/20 group">
          <summary className="cursor-pointer text-xs font-semibold flex items-center gap-2 select-none" style={{ color: pc }}>
            <span>📋 Ata da reunião</span>
            <span className="text-[10px] text-muted-foreground font-normal">(clica para abrir)</span>
          </summary>
          <div className="mt-3 space-y-3">
            {(points.length > 0 || dNotes) && (
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Pontos discutidos</p>
                {points.length > 0 && (<ul className="text-xs space-y-1 list-disc list-inside">{points.map((p, i) => <li key={i}>{renderText(p)}</li>)}</ul>)}
                {dNotes && <p className="text-xs whitespace-pre-wrap mt-1.5 bg-muted/20 rounded-lg p-2">{dNotes}</p>}
              </div>
            )}
            {cActions.length > 0 && (<div><p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">As tuas ações</p><ul className="text-xs space-y-1 list-disc list-inside">{cActions.map((a, i) => <li key={i}>{renderText(a)}</li>)}</ul></div>)}
            {prios.length > 0 && (<div><p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Prioridades</p><ul className="text-xs space-y-1 list-disc list-inside">{prios.map((p, i) => <li key={i}>{renderText(p)}</li>)}</ul></div>)}
            {fNotes.length > 0 && (<div><p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Notas finais</p><ul className="text-xs space-y-1 list-disc list-inside">{fNotes.map((n, i) => <li key={i}>{renderText(n)}</li>)}</ul></div>)}
            {docs.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Documentos</p>
                <div className="space-y-2">
                  {docs.map((d, i) => (
                    <a key={i} href={/^https?:\/\//i.test(d.url) ? d.url : `https://${d.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs hover:underline bg-muted/20 rounded-lg p-2">
                      <Download className="h-3 w-3 shrink-0" /><span className="truncate">{d.name || d.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </SectionCard>
  );
}