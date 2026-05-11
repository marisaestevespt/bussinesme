import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Sparkles, Lightbulb, AlertCircle, MoreHorizontal, Star, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import type { PortalFeedback, PortalNpsPending, PortalNpsHistory } from '@/types/portal';

type Category = 'elogio' | 'sugestao' | 'problema' | 'outro';

const CATEGORIES: Array<{ key: Category; label: string; icon: any }> = [
  { key: 'elogio', label: 'Elogio', icon: Sparkles },
  { key: 'sugestao', label: 'Sugestão', icon: Lightbulb },
  { key: 'problema', label: 'Problema', icon: AlertCircle },
  { key: 'outro', label: 'Outro', icon: MoreHorizontal },
];

const CATEGORY_LABEL: Record<string, string> = {
  elogio: 'Elogio', sugestao: 'Sugestão', problema: 'Problema', outro: 'Outro',
};

interface Props {
  feedback: PortalFeedback[];
  feedbackText: string;
  setFeedbackText: (v: string) => void;
  feedbackCategory: Category;
  setFeedbackCategory: (c: Category) => void;
  sendFeedback: () => void | Promise<void>;
  npsPending: PortalNpsPending[];
  npsHistory: PortalNpsHistory[];
  submitNps: (recordId: string, score: number, notes: string) => void | Promise<void>;
  pc: string;
  pcAlpha: (a: number) => string;
}

export function PortalFeedbackSection({
  feedback, feedbackText, setFeedbackText, feedbackCategory, setFeedbackCategory,
  sendFeedback, npsPending, npsHistory, submitNps, pc, pcAlpha,
}: Props) {
  const pending = npsPending[0];
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [npsNotes, setNpsNotes] = useState('');

  // Timeline unificada (NPS + feedback) ordenada por data desc
  type TLItem =
    | { kind: 'feedback'; date: string; data: PortalFeedback }
    | { kind: 'nps'; date: string; data: PortalNpsHistory };
  const timeline: TLItem[] = [
    ...feedback.map(f => ({ kind: 'feedback' as const, date: f.submitted_at || f.created_at || '', data: f })),
    ...npsHistory.map(n => ({ kind: 'nps' as const, date: n.actual_date || '', data: n })),
  ]
    .filter(i => !!i.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastNps = npsHistory[0];
  const showNpsCard = !!pending || !lastNps || (() => {
    // Permite nova nota se a última tiver mais de 30 dias
    if (!lastNps?.actual_date) return true;
    const diff = Date.now() - new Date(lastNps.actual_date).getTime();
    return diff > 30 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div className="space-y-6">
      <SectionTitle icon={MessageSquare}>A tua opinião</SectionTitle>

      {/* ─── NPS (pendente ou proativo) ─── */}
      {showNpsCard && (
        <SectionCard className="p-6" style={{ backgroundColor: pcAlpha(0.04), borderColor: pcAlpha(0.25) }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pcAlpha(0.12) }}>
              <Heart className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-semibold mb-0.5">De 0 a 10, qual a probabilidade de nos recomendares?</h4>
              <p className="text-xs text-muted-foreground">
                {pending?.product_name ? `Sobre ${pending.product_name} · ` : ''}A tua nota ajuda-nos a melhorar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-11 gap-1.5 mb-4">
            {Array.from({ length: 11 }).map((_, n) => {
              const active = npsScore === n;
              return (
                <button
                  key={n}
                  onClick={() => setNpsScore(n)}
                  className={`h-10 rounded-lg text-sm font-semibold transition-all border ${
                    active ? 'text-white border-transparent shadow-sm scale-[1.05]' : 'border-border/40 hover:border-border bg-background'
                  }`}
                  style={active ? { backgroundColor: pc } : undefined}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {npsScore !== null && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
              <Textarea
                value={npsNotes}
                onChange={(e) => setNpsNotes(e.target.value)}
                placeholder="Queres deixar um comentário? (opcional)"
                rows={2}
                className="rounded-lg border-border/40 bg-background text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setNpsScore(null); setNpsNotes(''); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="text-white"
                  style={{ backgroundColor: pc }}
                  onClick={async () => {
                    await submitNps(pending?.id || '', npsScore, npsNotes);
                    setNpsScore(null);
                    setNpsNotes('');
                  }}
                >
                  Enviar nota
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ─── Última nota NPS (resumo, se não há pendente) ─── */}
      {!showNpsCard && lastNps && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/30 bg-muted/10">
          <Star className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Última nota: </span>
            <span className="font-semibold" style={{ color: pc }}>{lastNps.nps_score}/10</span>
            {lastNps.actual_date && (
              <span className="text-muted-foreground"> · {format(parseISO(lastNps.actual_date), "d 'de' MMMM yyyy", { locale: pt })}</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Feedback livre ─── */}
      <SectionCard className="p-5 space-y-4">
        <div>
          <p className="text-sm font-medium mb-3">Partilha o que pensas</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {CATEGORIES.map(({ key, label, icon: Icon }) => {
              const active = feedbackCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedbackCategory(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active ? 'text-white border-transparent' : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                  style={active ? { backgroundColor: pc } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {label}
                </button>
              );
            })}
          </div>
          <Textarea
            className="rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
            placeholder="Conta-nos mais... 💬"
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            rows={4}
            style={{ '--tw-ring-color': pcAlpha(0.25) } as any}
          />
        </div>
        <div className="flex justify-end">
          <Button className="rounded-xl text-white" style={{ backgroundColor: pc }} disabled={!feedbackText.trim()} onClick={sendFeedback}>
            <Send className="h-4 w-4 mr-2" />Enviar
          </Button>
        </div>
      </SectionCard>

      {/* ─── Timeline (histórico unificado) ─── */}
      {timeline.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold pl-1">Histórico</p>
          <div className="space-y-2.5">
            {timeline.map((item, i) => (
              <SectionCard key={`${item.kind}-${item.kind === 'feedback' ? item.data.id : item.data.id}-${i}`} className="p-4">
                {item.kind === 'nps' ? (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pcAlpha(0.1) }}>
                      <Star className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: pc }}>NPS {item.data.nps_score}/10</span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.data.actual_date && format(parseISO(item.data.actual_date), "d MMM yyyy", { locale: pt })}
                        </span>
                      </div>
                      {item.data.notes && <p className="text-sm leading-relaxed text-muted-foreground">{item.data.notes}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CategoryIcon category={item.data.category} pc={pc} pcAlpha={pcAlpha} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: pcAlpha(0.1), color: pc }}>
                          {CATEGORY_LABEL[item.data.category || 'outro']}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.data.submitted_at && format(parseISO(item.data.submitted_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{item.data.content}</p>
                      {item.data.team_response && (
                        <div className="mt-3 pl-3 border-l-2 rounded-sm bg-muted/20 py-2 pr-3" style={{ borderColor: pcAlpha(0.4) }}>
                          <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: pc }}>Resposta da equipa</p>
                          <p className="text-sm leading-relaxed text-muted-foreground">{item.data.team_response}</p>
                          {item.data.responded_at && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {format(parseISO(item.data.responded_at), "d MMM yyyy", { locale: pt })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ category, pc, pcAlpha }: { category?: string | null; pc: string; pcAlpha: (a: number) => string }) {
  const cat = (CATEGORIES.find(c => c.key === (category || 'outro')) || CATEGORIES[3]);
  const Icon = cat.icon;
  return (
    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pcAlpha(0.1) }}>
      <Icon className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
    </div>
  );
}
