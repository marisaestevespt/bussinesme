import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarDays, Send, Download, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import type { PortalMeeting } from '@/types/portal';
import { isMeetingDone, isMeetingPending } from '@/lib/meetingStatus';

interface Props {
  meetings: PortalMeeting[];
  setMeetings: React.Dispatch<React.SetStateAction<PortalMeeting[]>>;
  portalToken: string;
  pc: string;
  meetingStatus: (s: string) => { text: string; cls: string };
}

const renderText = (item: unknown): string =>
  typeof item === 'string'
    ? item
    : ((item as { text?: string; action?: string })?.text || (item as { text?: string; action?: string })?.action || '');

const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

export function PortalMeetingsSection({ meetings, setMeetings, portalToken, pc, meetingStatus }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openMeeting = meetings.find((m) => m.id === openId) || null;

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
            <MeetingRow key={m.id} m={m} pc={pc} meetingStatus={meetingStatus} onClick={() => setOpenId(m.id)} />
          ))}
        </div>
      )}

      <MeetingDialog
        meeting={openMeeting}
        onClose={() => setOpenId(null)}
        setMeetings={setMeetings}
        portalToken={portalToken}
        pc={pc}
        meetingStatus={meetingStatus}
      />
    </div>
  );
}

function MeetingRow({
  m,
  pc,
  meetingStatus,
  onClick,
}: {
  m: PortalMeeting;
  pc: string;
  meetingStatus: (s: string) => { text: string; cls: string };
  onClick: () => void;
}) {
  const ms = meetingStatus(m.status || '');
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <SectionCard className="p-5 transition hover:border-border/60 hover:shadow-sm cursor-pointer">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-muted/40 mt-0.5 shrink-0">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {m.date_time ? format(parseISO(m.date_time), "EEEE, d 'de' MMMM · HH:mm", { locale: pt }) : '—'}
                {m.duration_minutes ? ` · ${m.duration_minutes} min` : ''}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${ms.cls}`}>{ms.text}</Badge>
        </div>
      </SectionCard>
    </button>
  );
}

function MeetingDialog({
  meeting,
  onClose,
  setMeetings,
  portalToken,
  pc,
  meetingStatus,
}: {
  meeting: PortalMeeting | null;
  onClose: () => void;
  setMeetings: React.Dispatch<React.SetStateAction<PortalMeeting[]>>;
  portalToken: string;
  pc: string;
  meetingStatus: (s: string) => { text: string; cls: string };
}) {
  const [noteDraft, setNoteDraft] = useState('');

  if (!meeting) return null;
  const m = meeting;
  const status = m.status || '';
  const isPending = isMeetingPending({ status });
  const ms = meetingStatus(status);

  const confirmMeeting = async () => {
    const { data, error } = await (
      supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }> }
    ).rpc('portal_confirm_meeting', { _token: portalToken, _meeting_id: m.id });
    if (error) { toast.error('Erro ao confirmar: ' + error.message); return; }
    if (data) {
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'confirmada' } : x)));
      toast.success('Presença confirmada ✨');
    } else toast.error('Não foi possível confirmar');
  };

  const sendNote = async () => {
    const val = noteDraft.trim();
    if (!val) { toast.error('Escreve uma sugestão primeiro'); return; }
    await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<unknown> })
      .rpc('portal_add_meeting_notes', { _token: portalToken, _meeting_id: m.id, _notes: val });
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, portal_notes: val } : x)));
    toast.success('Sugestão enviada ✓');
    setNoteDraft('');
  };

  const points = Array.isArray(m.discussion_points)
    ? m.discussion_points.filter((p) => (typeof p === 'string' ? p.trim() : ((p as { text?: string })?.text || '').trim()))
    : [];
  const cActions = Array.isArray(m.client_actions)
    ? m.client_actions.filter((a) => (typeof a === 'string' ? a.trim() : ((a as { text?: string; action?: string })?.text || (a as { action?: string })?.action || '').trim()))
    : [];
  const fNotes = Array.isArray(m.final_notes)
    ? m.final_notes.filter((n) => (typeof n === 'string' ? n.trim() : ((n as { text?: string })?.text || '').trim()))
    : [];
  const prios = Array.isArray(m.priorities)
    ? m.priorities.filter((p) => (typeof p === 'string' ? p.trim() : ((p as { text?: string })?.text || '').trim()))
    : [];
  const docs = Array.isArray(m.documents)
    ? m.documents.filter((d): d is { url: string; name?: string } => !!(d as { url?: string })?.url)
    : [];
  const dNotes = (m.discussion_notes || '').trim();
  const isDone = isMeetingDone({ status });
  const hasAta = isDone && (points.length || cActions.length || fNotes.length || prios.length || docs.length || dNotes);

  return (
    <Dialog open={!!meeting} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base pr-6 leading-snug">{m.title}</DialogTitle>
        </DialogHeader>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <Badge variant="outline" className={`text-[10px] ${ms.cls}`}>{ms.text}</Badge>
          {m.date_time && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(parseISO(m.date_time), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
            </span>
          )}
          {m.date_time && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(parseISO(m.date_time), 'HH:mm')}
              {m.duration_minutes ? ` · ${m.duration_minutes} min` : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {m.meeting_url && (
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" asChild>
              <a href={normalizeUrl(m.meeting_url)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Entrar na reunião
              </a>
            </Button>
          )}
          {isPending && (
            <Button size="sm" className="h-8 text-xs rounded-lg text-white" style={{ backgroundColor: pc }} onClick={confirmMeeting}>
              Confirmar presença
            </Button>
          )}
        </div>

        {/* Note suggestion (pending only) */}
        {isPending && !m.portal_notes && (
          <div className="mt-4 pt-4 border-t border-border/20">
            <p className="text-[11px] text-muted-foreground mb-1.5">💡 Se este horário não te der jeito, sugere alternativas:</p>
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="text-xs rounded-lg border-border/30 bg-muted/10 min-h-[60px]"
              placeholder="Ex: Prefiro terça ou quinta da semana seguinte, à tarde..."
            />
            <Button size="sm" className="mt-2 h-7 text-xs rounded-lg text-white" style={{ backgroundColor: pc }} onClick={sendNote}>
              <Send className="h-3 w-3 mr-1" /> Enviar sugestão
            </Button>
          </div>
        )}
        {isPending && m.portal_notes && (
          <div className="mt-4 pt-4 border-t border-border/20">
            <p className="text-[11px] text-muted-foreground">✅ Sugestão enviada:</p>
            <p className="text-xs mt-1 bg-muted/20 rounded-lg p-2">{m.portal_notes}</p>
          </div>
        )}
        {!isPending && m.portal_notes && (
          <div className="mt-4 pt-4 border-t border-border/20">
            <p className="text-[11px] text-muted-foreground">📝 As tuas notas:</p>
            <p className="text-xs mt-1">{m.portal_notes}</p>
          </div>
        )}

        {/* Ata */}
        {hasAta ? (
          <div className="mt-4 pt-4 border-t border-border/20">
            <p className="text-xs font-semibold mb-3" style={{ color: pc }}>📋 Ata da reunião</p>
            <div className="space-y-4">
              {(points.length > 0 || dNotes) && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Pontos discutidos</p>
                  {points.length > 0 && (
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      {points.map((p, i) => <li key={i}>{renderText(p)}</li>)}
                    </ul>
                  )}
                  {dNotes && <p className="text-xs whitespace-pre-wrap mt-1.5 bg-muted/20 rounded-lg p-2">{dNotes}</p>}
                </div>
              )}
              {cActions.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">As tuas ações</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {cActions.map((a, i) => <li key={i}>{renderText(a)}</li>)}
                  </ul>
                </div>
              )}
              {prios.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Prioridades</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {prios.map((p, i) => <li key={i}>{renderText(p)}</li>)}
                  </ul>
                </div>
              )}
              {fNotes.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Notas finais</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {fNotes.map((n, i) => <li key={i}>{renderText(n)}</li>)}
                  </ul>
                </div>
              )}
              {docs.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Documentos</p>
                  <div className="space-y-2">
                    {docs.map((d, i) => (
                      <a
                        key={i}
                        href={normalizeUrl(d.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs hover:underline bg-muted/20 rounded-lg p-2"
                      >
                        <Download className="h-3 w-3 shrink-0" />
                        <span className="truncate">{d.name || d.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          isDone && (
            <div className="mt-4 pt-4 border-t border-border/20">
              <p className="text-xs text-muted-foreground italic">Ainda não há ata disponível para esta reunião.</p>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}