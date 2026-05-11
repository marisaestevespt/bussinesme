import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, FileText, Music, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import type { PortalQuestion } from '@/types/portal';

interface Props {
  questions: PortalQuestion[];
  client: Record<string, any>;
  activeQuestionId: string | null;
  setActiveQuestionId: (id: string | null) => void;
  draftAnswers: Record<string, string>;
  setDraftAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingQuestionId: string | null;
  setEditingQuestionId: (id: string | null) => void;
  uploadingQuestionFiles: Record<string, boolean>;
  uploadQuestionFiles: (qId: string, files: FileList) => Promise<void>;
  removeQuestionFile: (qId: string, fileIndex: number) => Promise<void>;
  answerQuestion: (qId: string, answer: string) => Promise<void>;
  pc: string;
  pcAlpha: (a: number) => string;
}

const isQAnswered = (q: PortalQuestion) => !!(q.answer?.trim() || (Array.isArray(q.file_urls) && q.file_urls.length > 0));

export function PortalQuestionsSection(props: Props) {
  const {
    questions, client, activeQuestionId, setActiveQuestionId,
    draftAnswers, setDraftAnswers, expandedSections, setExpandedSections,
    editingQuestionId, setEditingQuestionId, uploadingQuestionFiles,
    uploadQuestionFiles, removeQuestionFile, answerQuestion, pc, pcAlpha,
  } = props;

  const ordered = useMemo(() => questions.slice(), [questions]);
  const total = ordered.length;
  const answeredCount = ordered.filter(isQAnswered).length;
  const allAnswered = total > 0 && answeredCount === total;

  // Find first unanswered to start at
  const firstUnansweredIdx = Math.max(0, ordered.findIndex(q => !isQAnswered(q)));

  type View = 'intro' | 'question' | 'done';
  const initialView: View = allAnswered ? 'done' : 'intro';
  const [view, setView] = useState<View>(initialView);
  const [idx, setIdx] = useState<number>(firstUnansweredIdx === -1 ? 0 : firstUnansweredIdx);

  // Keep activeQuestionId in sync (used by parent for upload state etc.)
  useEffect(() => {
    if (view === 'question' && ordered[idx]) setActiveQuestionId(ordered[idx].id);
    else setActiveQuestionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, idx]);

  const current = ordered[idx];
  const currentDraft = current ? (draftAnswers[current.id] ?? current.answer ?? '') : '';
  const currentHasFiles = current && Array.isArray(current.file_urls) && current.file_urls.length > 0;
  const currentHasContent = !!currentDraft.trim() || !!currentHasFiles;

  const saveCurrent = async () => {
    if (!current) return;
    const text = (draftAnswers[current.id] ?? '').trim();
    if (text && text !== (current.answer || '')) {
      await answerQuestion(current.id, text);
      setDraftAnswers(prev => { const n = { ...prev }; delete n[current.id]; return n; });
    }
  };

  const goNext = async () => {
    await saveCurrent();
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      // last → finish
      await finish();
    }
  };

  const goPrev = async () => {
    await saveCurrent();
    if (idx > 0) setIdx(idx - 1);
  };

  const finish = async () => {
    // Save any pending drafts
    for (const [qId, text] of Object.entries(draftAnswers)) {
      if (text.trim()) await answerQuestion(qId, text);
    }
    setDraftAnswers({});
    setEditingQuestionId(null);
    setActiveQuestionId(null);
    setView('done');
    toast.success('Respostas submetidas!');
    if (client?.id && client?.full_name) {
      (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<unknown> })
        .rpc('notify_portal_questions_submitted', { _client_name: client.full_name, _client_id: client.id })
        .catch(() => {});
    }
  };

  const startPlaylist = () => {
    window.dispatchEvent(new CustomEvent('portal-playlist-open'));
  };

  const progress = total > 0 ? Math.round(((idx + (view === 'done' ? 1 : 0)) / total) * 100) : 0;

  // ─── INTRO ──────────────────────────────────────
  if (view === 'intro') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 border" style={{ borderColor: pcAlpha(0.3), color: pc, backgroundColor: pcAlpha(0.06) }}>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold">Perguntas iniciais</span>
          </div>
          <h1
            className="text-4xl sm:text-5xl leading-[1.05] tracking-tight"
            style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
          >
            Conta-nos sobre ti.
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            {total} {total === 1 ? 'pergunta' : 'perguntas'} para nos ajudares a conhecer melhor o teu negócio. Demora cerca de {Math.max(2, Math.round(total * 1.5))} min. Podes guardar e voltar mais tarde.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              className="rounded-full text-white font-semibold px-8 py-6 text-base group"
              style={{ backgroundColor: pc }}
              onClick={() => setView('question')}
            >
              {answeredCount > 0 ? 'Continuar' : 'Começar'}
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <button
              type="button"
              onClick={startPlaylist}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 border text-sm font-medium hover:bg-muted/40 transition-colors"
              style={{ borderColor: pcAlpha(0.3), color: pc }}
            >
              <Music className="h-4 w-4" />
              Tocar playlist
            </button>
          </div>
          {answeredCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Já respondeste a {answeredCount} de {total} · vamos retomar onde paraste
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── DONE ──────────────────────────────────────
  if (view === 'done') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className="mx-auto h-20 w-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: pcAlpha(0.12), color: pc }}
          >
            <Check className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <h2
            className="text-3xl sm:text-4xl leading-[1.1] tracking-tight"
            style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
          >
            Obrigado!
          </h2>
          <p className="text-sm text-muted-foreground">
            Recebemos as tuas respostas. Vamos rever e voltamos com os próximos passos.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setIdx(0); setView('question'); }}
          >
            Rever respostas
          </Button>
        </div>
      </div>
    );
  }

  // ─── QUESTION ──────────────────────────────────────
  if (!current) return null;
  const isLast = idx === total - 1;
  const groupLabel = (current as PortalQuestion & { question_group?: string }).question_group;

  return (
    <div className="h-[70vh] min-h-[560px] flex flex-col max-w-2xl mx-auto w-full">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-10 shrink-0">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((idx + 1) / total) * 100}%`, backgroundColor: pc }}
          />
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium tabular-nums">
          {idx + 1} / {total}
        </span>
      </div>

      <div key={current.id} className="flex-1 min-h-0 w-full overflow-y-auto space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pr-1">
        <div className="space-y-2">
          {groupLabel && (
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: pc }}>
              {groupLabel}
            </p>
          )}
          <h2
            className="text-xl sm:text-2xl leading-[1.25] tracking-tight font-medium"
            style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
          >
            {current.question}
          </h2>
        </div>

        <Textarea
          key={current.id}
          className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-2 min-h-[120px] resize-none"
          placeholder="A tua resposta..."
          value={currentDraft}
          onChange={e => setDraftAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              goNext();
            }
          }}
          rows={4}
          style={{ '--tw-ring-color': pcAlpha(0.25) } as React.CSSProperties}
          autoFocus
        />

        {/* Existing files */}
        {currentHasFiles && (
          <div className="rounded-xl bg-muted/20 border border-border/30 p-3">
            <div className="flex flex-wrap gap-2">
              {(current.file_urls as string[]).map((url: string, fi: number) => {
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                return (
                  <div key={fi} className="relative group/file">
                    {isImg ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                      </a>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline bg-card rounded-lg border px-2 py-1">
                        <FileText className="h-3 w-3" />{url.split('/').pop()?.substring(0, 25)}
                      </a>
                    )}
                    <button
                      onClick={() => removeQuestionFile(current.id, fi)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity"
                      title="Remover ficheiro"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {current.answered_at && <p className="text-[10px] text-muted-foreground mt-2">Enviado {format(parseISO(current.answered_at as string), 'dd/MM/yyyy')}</p>}
          </div>
        )}

        {/* Upload */}
        <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/10 p-3 cursor-pointer hover:bg-muted/20 transition-colors">
          <input
            type="file" className="hidden" multiple
            onChange={e => { if (e.target.files?.length) uploadQuestionFiles(current.id, e.target.files); }}
            disabled={uploadingQuestionFiles[current.id]}
          />
          {uploadingQuestionFiles[current.id] ? (
            <InlineLoader />
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Anexar ficheiro (opcional)</span>
            </>
          )}
        </label>

        <p className="text-[11px] text-muted-foreground pb-2">
          Dica: <kbd className="px-1.5 py-0.5 rounded border border-border/50 bg-muted/40 text-[10px] font-mono">⌘ Enter</kbd> para avançar
        </p>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/30 shrink-0">
        <Button
          variant="ghost"
          onClick={goPrev}
          disabled={idx === 0}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar
        </Button>

        <div className="flex items-center gap-2">
          {!isLast && !currentHasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIdx(idx + 1)}
              className="text-xs text-muted-foreground"
            >
              Saltar
            </Button>
          )}
          <Button
            onClick={goNext}
            className="rounded-full text-white font-semibold px-6 group"
            style={{ backgroundColor: pc }}
          >
            {isLast ? 'Submeter' : 'Continuar'}
            {isLast ? <Check className="h-4 w-4 ml-2" /> : <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />}
          </Button>
        </div>
      </div>
    </div>
  );
}