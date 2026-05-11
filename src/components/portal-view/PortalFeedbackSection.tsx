import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Send, Sparkles, Lightbulb, AlertCircle, MoreHorizontal,
  Star, Heart, ChevronDown, ChevronRight, Clock, CheckCircle2, Frown, Meh, Smile,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SectionCard, SectionTitle } from './SectionPrimitives';

/* ─── Auto-growing textarea ─── */
function AutoTextarea({
  value, onChange, placeholder, className, minRows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(() => { resize(); }, [value]);
  return (
    <Textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={e => { onChange(e.target.value); }}
      onInput={resize}
      className={`resize-none overflow-hidden ${className || ''}`}
    />
  );
}
import type {
  PortalFeedback, PortalRecolha, PortalRecolhaQuestion, PortalRecolhaResponse,
  PortalNpsCategory, PortalNpsCategoryScore,
} from '@/types/portal';

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
  recolhas: PortalRecolha[];
  submitNps: (
    recordId: string,
    score: number | null,
    notes: string,
    responses?: PortalRecolhaResponse[],
    categoryScores?: PortalNpsCategoryScore[],
  ) => void | Promise<void>;
  pc: string;
  pcAlpha: (a: number) => string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const isDone = (r: PortalRecolha) => r.status === 'feito' || r.status === 'concluido';
const isDue = (r: PortalRecolha) =>
  !isDone(r) && (!r.expected_date || r.expected_date <= todayISO());
const isFuture = (r: PortalRecolha) =>
  !isDone(r) && !!r.expected_date && r.expected_date > todayISO();

const NPS_CATEGORIES: Array<{
  key: string; label: string; range: [number, number]; icon: any; color: string;
}> = [
  { key: 'detrator', label: 'Detrator',   range: [0, 6],  icon: Frown, color: 'hsl(0 70% 55%)' },
  { key: 'passivo',  label: 'Passivo',    range: [7, 8],  icon: Meh,   color: 'hsl(38 90% 55%)' },
  { key: 'promotor', label: 'Promotor',   range: [9, 10], icon: Smile, color: 'hsl(150 55% 42%)' },
];

const npsCategoryFor = (n: number) =>
  NPS_CATEGORIES.find(c => n >= c.range[0] && n <= c.range[1])!;

export function PortalFeedbackSection({
  feedback, feedbackText, setFeedbackText, feedbackCategory, setFeedbackCategory,
  sendFeedback, recolhas, submitNps, pc, pcAlpha,
}: Props) {
  const due = recolhas.filter(isDue);
  const done = recolhas.filter(isDone);
  const upcoming = recolhas.filter(isFuture);

  return (
    <div className="space-y-6">
      <SectionTitle icon={MessageSquare}>A tua opinião</SectionTitle>

      {/* ─── 1. POR PREENCHER ─── */}
      {due.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold pl-1">
            Por preencher · {due.length}
          </p>
          <div className="space-y-2">
            {due.map(r => (
              <RecolhaCard key={r.id} recolha={r} submitNps={submitNps} pc={pc} pcAlpha={pcAlpha} />
            ))}
          </div>
        </div>
      )}

      {/* ─── 2. JÁ PREENCHIDAS ─── */}
      {done.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold pl-1">
            Já enviadas · {done.length}
          </p>
          <div className="space-y-2">
            {done
              .slice()
              .sort((a, b) => (b.actual_date || '').localeCompare(a.actual_date || ''))
              .map(r => <RecolhaDoneCard key={r.id} recolha={r} pc={pc} pcAlpha={pcAlpha} />)}
          </div>
        </div>
      )}

      {/* ─── 3. AGENDADAS (futuras) ─── */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold pl-1">
            Agendadas · {upcoming.length}
          </p>
          <div className="space-y-2">
            {upcoming.map(r => (
              <SectionCard key={r.id} className="px-4 py-3 flex items-center gap-3 bg-muted/10">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{r.title || (r.kind === 'feedback' ? 'Feedback' : 'NPS')}</span>
                    <span className="text-muted-foreground"> · {r.kind === 'feedback' ? 'Perguntas + nota' : 'Nota 0–10'}</span>
                  </p>
                  {r.expected_date && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Previsto para {format(parseISO(r.expected_date), "d 'de' MMMM yyyy", { locale: pt })}
                    </p>
                  )}
                </div>
              </SectionCard>
            ))}
          </div>
        </div>
      )}

      {/* ─── 4. FEEDBACK LIVRE (sempre) ─── */}
      <SectionCard className="p-5 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Tens algo a partilhar fora dos inquéritos?</p>
          <p className="text-xs text-muted-foreground mb-3">Manda-nos um recado a qualquer altura.</p>
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

      {/* ─── 5. HISTÓRICO DE FEEDBACK LIVRE ─── */}
      {feedback.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold pl-1">Mensagens enviadas</p>
          <div className="space-y-2.5">
            {feedback.map(item => (
              <SectionCard key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <CategoryIcon category={item.category} pc={pc} pcAlpha={pcAlpha} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: pcAlpha(0.1), color: pc }}>
                        {CATEGORY_LABEL[item.category || 'outro']}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.submitted_at && format(parseISO(item.submitted_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{item.content}</p>
                    {item.team_response && (
                      <div className="mt-3 pl-3 border-l-2 rounded-sm bg-muted/20 py-2 pr-3" style={{ borderColor: pcAlpha(0.4) }}>
                        <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: pc }}>Resposta da equipa</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.team_response}</p>
                        {item.responded_at && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {format(parseISO(item.responded_at), "d MMM yyyy", { locale: pt })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        </div>
      )}

      {recolhas.length === 0 && feedback.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Ainda não há recolhas agendadas. Vamos aparecendo por aqui à medida que avançamos.
        </p>
      )}
    </div>
  );
}

/* ─── Card (dueRecord) → abre Dialog ───────────────────────────────── */
function RecolhaCard({
  recolha, submitNps, pc, pcAlpha,
}: {
  recolha: PortalRecolha;
  submitNps: Props['submitNps'];
  pc: string;
  pcAlpha: (a: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const isFeedback = recolha.kind === 'feedback';
  const questions: PortalRecolhaQuestion[] = isFeedback ? (recolha.questions || []) : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl border px-5 py-4 flex items-center gap-3 transition-colors hover:bg-background/60"
        style={{ backgroundColor: pcAlpha(0.04), borderColor: pcAlpha(0.25) }}
      >
        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pcAlpha(0.12) }}>
          {isFeedback
            ? <MessageSquare className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            : <Heart className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{recolha.title || (isFeedback ? 'Feedback' : 'NPS')}</p>
          <p className="text-[11px] text-muted-foreground">
            {isFeedback ? `${questions.length} pergunta${questions.length === 1 ? '' : 's'} + nota 0–10` : 'Nota de 0 a 10'}
            {recolha.expected_date && (
              <> · Previsto para {format(parseISO(recolha.expected_date), "d MMM yyyy", { locale: pt })}</>
            )}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <RecolhaDialog
        open={open}
        onOpenChange={setOpen}
        recolha={recolha}
        submitNps={submitNps}
        pc={pc}
        pcAlpha={pcAlpha}
      />
    </>
  );
}

/* ─── Dialog ──────────────────────────────────────────────────────── */
function RecolhaDialog({
  open, onOpenChange, recolha, submitNps, pc, pcAlpha,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recolha: PortalRecolha;
  submitNps: Props['submitNps'];
  pc: string;
  pcAlpha: (a: number) => string;
}) {
  const isFeedback = recolha.kind === 'feedback';
  const questions: PortalRecolhaQuestion[] = isFeedback ? (recolha.questions || []) : [];
  const npsCats: PortalNpsCategory[] = !isFeedback ? (recolha.categories || []) : [];
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  const [catScores, setCatScores] = useState<Record<string, number>>({});
  const [catComments, setCatComments] = useState<Record<string, string>>({});

  const requiredQuestionsOk = questions.every((q, i) =>
    !q.required || (answers[i] && answers[i].trim().length > 0)
  );

  // For NPS: every category must have a score; if score ≤ 6, comment is required
  const allCatsScored = !isFeedback && npsCats.length > 0
    && npsCats.every(c => typeof catScores[c.key] === 'number');
  const lowScoreCommentsOk = !isFeedback
    && npsCats.every(c => {
      const s = catScores[c.key];
      if (s == null || s > 6) return true;
      return (catComments[c.key] || '').trim().length > 0;
    });

  const canSubmit = isFeedback
    ? score !== null && requiredQuestionsOk
    : allCatsScored && lowScoreCommentsOk;

  const avgCatScore = !isFeedback && allCatsScored
    ? Math.round(npsCats.reduce((s, c) => s + (catScores[c.key] || 0), 0) / npsCats.length)
    : null;

  const handleSubmit = async () => {
    if (isFeedback) {
      if (score === null) return;
      const responses = questions.map((q, i) => ({ question: q.text, answer: answers[i] || '' }));
      await submitNps(recolha.id, score, notes, responses);
    } else {
      if (!allCatsScored) return;
      const categoryScores: PortalNpsCategoryScore[] = npsCats.map(c => ({
        key: c.key,
        score: catScores[c.key],
        comment: (catComments[c.key] || '').trim() || null,
      }));
      await submitNps(recolha.id, null, notes, undefined, categoryScores);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recolha.title || (isFeedback ? 'Feedback' : 'NPS')}</DialogTitle>
          {recolha.product_name && (
            <DialogDescription>{recolha.product_name}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 py-2">
          {isFeedback && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {q.text}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <AutoTextarea
                    value={answers[i] || ''}
                    onChange={(v) => {
                      const next = [...answers];
                      next[i] = v;
                      setAnswers(next);
                    }}
                    placeholder="A tua resposta…"
                    className="rounded-lg border-border/40 bg-background text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* ─── kind='feedback': nota global ─── */}
          {isFeedback && (
            <div className="pt-4 border-t space-y-3" style={{ borderColor: pcAlpha(0.15) }}>
              <p className="text-sm font-medium">Para terminar, qual a probabilidade de nos recomendares?</p>
              <NpsScale value={score} onChange={setScore} />
            </div>
          )}

          {/* ─── kind='nps': nota por categoria temática ─── */}
          {!isFeedback && (
            <div className="space-y-4">
              {npsCats.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Não há categorias configuradas. Contacta a equipa.
                </p>
              )}
              {npsCats.map(c => {
                const s = catScores[c.key];
                const isLow = typeof s === 'number' && s <= 6;
                return (
                  <div
                    key={c.key}
                    className="rounded-xl border p-4 space-y-3"
                    style={{ borderColor: pcAlpha(0.15), backgroundColor: pcAlpha(0.03) }}
                  >
                    <div>
                      <p className="text-sm font-semibold">{c.label}</p>
                      {c.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <NpsScale
                      value={typeof s === 'number' ? s : null}
                      onChange={(n) => setCatScores(prev => ({ ...prev, [c.key]: n! }))}
                      compact
                    />
                    {isLow && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-destructive">
                          O que correu menos bem em "{c.label}"? <span>*</span>
                        </label>
                        <AutoTextarea
                          value={catComments[c.key] || ''}
                          onChange={(v) => setCatComments(prev => ({ ...prev, [c.key]: v }))}
                          placeholder="Ajuda-nos a melhorar..."
                          className="rounded-lg border-border/40 bg-background text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {avgCatScore !== null && (
                <div className="rounded-lg px-4 py-3 flex items-center justify-between" style={{ backgroundColor: pcAlpha(0.08) }}>
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: pc }}>Nota global desta recolha</span>
                  <span className="text-2xl font-bold" style={{ color: pc }}>{avgCatScore}<span className="text-sm text-muted-foreground">/10</span></span>
                </div>
              )}
            </div>
          )}

          {!isFeedback && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Comentário geral (opcional)</label>
              <AutoTextarea
                value={notes}
                onChange={setNotes}
                placeholder="Queres deixar um comentário?"
                className="rounded-lg border-border/40 bg-background text-sm"
              />
            </div>
          )}

          {isFeedback && !requiredQuestionsOk && score !== null && (
            <p className="text-[12px] text-destructive">Preenche as perguntas obrigatórias.</p>
          )}
          {!isFeedback && allCatsScored && !lowScoreCommentsOk && (
            <p className="text-[12px] text-destructive">
              Para notas iguais ou inferiores a 6, deixa-nos um comentário em cada categoria.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="text-white"
            style={{ backgroundColor: pc }}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reusable 0–10 scale with category grouping ───────────────────── */
function NpsScale({
  value, onChange, compact = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  compact?: boolean;
}) {
  const colorFor = (n: number) => {
    const cat = NPS_CATEGORIES.find(c => n >= c.range[0] && n <= c.range[1]);
    return cat?.color ?? 'hsl(var(--primary))';
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-lg p-1 border border-border/40 bg-background">
        {Array.from({ length: 11 }).map((_, n) => {
          const active = value === n;
          const color = colorFor(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex-1 ${compact ? 'h-8 text-xs' : 'h-10 text-sm'} rounded-md font-semibold transition-all border ${
                active ? 'text-white border-transparent shadow-sm scale-[1.05]' : 'hover:scale-[1.03]'
              }`}
              style={
                active
                  ? { backgroundColor: color, borderColor: 'transparent' }
                  : {
                      color,
                      backgroundColor: color.replace(')', ' / 0.08)'),
                      borderColor: color.replace(')', ' / 0.25)'),
                    }
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-1">
          <span>Nada provável</span>
          <span>Muito provável</span>
        </div>
      )}
    </div>
  );
}

/* ─── Done card (resumo + collapse de respostas) ──────────────────── */
function RecolhaDoneCard({ recolha, pc, pcAlpha }: { recolha: PortalRecolha; pc: string; pcAlpha: (a: number) => string }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    (recolha.responses && recolha.responses.length > 0) ||
    (recolha.category_scores && recolha.category_scores.length > 0) ||
    !!recolha.notes;
  return (
    <SectionCard className="p-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pcAlpha(0.1) }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium">{recolha.title || (recolha.kind === 'feedback' ? 'Feedback' : 'NPS')}</span>
            {recolha.nps_score != null && (
              <span className="text-sm font-semibold" style={{ color: pc }}>{recolha.nps_score}/10</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {recolha.actual_date && format(parseISO(recolha.actual_date), "d MMM yyyy", { locale: pt })}
            </span>
          </div>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Ver detalhe
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2">
              {recolha.category_scores?.map((cs, i) => {
                const cat = npsCategoryFor(cs.score);
                return (
                  <div key={i} className="text-xs flex items-start gap-2">
                    <span
                      className="inline-flex items-center justify-center min-w-[26px] h-5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cs.score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{cs.key}</p>
                      {cs.comment && <p className="text-muted-foreground">{cs.comment}</p>}
                    </div>
                  </div>
                );
              })}
              {recolha.responses?.map((resp, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium">{resp.question}</p>
                  <p className="text-muted-foreground">{resp.answer || <em>Sem resposta</em>}</p>
                </div>
              ))}
              {recolha.notes && (
                <div className="text-xs">
                  <p className="font-medium">Comentário</p>
                  <p className="text-muted-foreground">{recolha.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
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