import { format, parseISO } from 'date-fns';
import { ClipboardList, ChevronRight, FileText, Pencil, Send, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SectionCard, SectionTitle } from './SectionPrimitives';
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

  const allAnswered = questions.every(isQAnswered);
  const answeredCount = questions.filter(isQAnswered).length;
  const allSubmitted = allAnswered && !activeQuestionId;
  const currentOpen = activeQuestionId;

  const handleSubmitAll = async () => {
    for (const [qId, text] of Object.entries(draftAnswers)) {
      if (text.trim()) await answerQuestion(qId, text);
    }
    setDraftAnswers({});
    setActiveQuestionId(null);
    toast.success('Respostas submetidas!');
    if (client?.id && client?.full_name) {
      (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<unknown> })
        .rpc('notify_portal_questions_submitted', { _client_name: client.full_name, _client_id: client.id })
        .catch(() => {});
    }
  };

  const groups: { group: string; items: PortalQuestion[] }[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const g = (q as PortalQuestion & { question_group?: string }).question_group || 'Geral';
    if (!seen.has(g)) { seen.add(g); groups.push({ group: g, items: [] }); }
    groups.find(gr => gr.group === g)!.items.push(q);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={ClipboardList}>Perguntas Iniciais</SectionTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{answeredCount}/{questions.length} respondidas</span>
          {allSubmitted ? (
            <Badge variant="outline" className="text-[10px] font-medium text-success border-success/30 bg-success/15">✓ Submetido</Badge>
          ) : (
            <Badge className="text-[10px] font-semibold text-white border-0 px-2.5 py-0.5" style={{ backgroundColor: pc }}>Por preencher</Badge>
          )}
        </div>
      </div>

      {!allSubmitted && (
        <p className="text-sm text-muted-foreground -mt-2">
          Responde a todas as perguntas para nos ajudar a conhecer melhor o teu negócio. Podes guardar e voltar mais tarde.
        </p>
      )}

      <div className="space-y-3">
        {groups.map((section) => {
          const sectionAnswered = section.items.filter(isQAnswered).length;
          const sectionComplete = sectionAnswered === section.items.length;
          const isSectionOpen = expandedSections.has(section.group);

          return (
            <SectionCard key={section.group} className="overflow-hidden">
              <button
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                onClick={() => {
                  setExpandedSections(prev => {
                    const next = new Set(prev);
                    if (next.has(section.group)) next.delete(section.group);
                    else next.add(section.group);
                    return next;
                  });
                  if (isSectionOpen) {
                    const openInSection = section.items.find((q) => q.id === currentOpen);
                    if (openInSection) setActiveQuestionId(null);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSectionOpen ? 'rotate-90' : ''}`} />
                  <p className="text-sm font-semibold">{section.group}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${sectionComplete ? 'text-success border-success/30 bg-success/15' : ''}`}>
                  {sectionAnswered}/{section.items.length}
                </Badge>
              </button>

              {isSectionOpen && (
                <div className="divide-y divide-border/20 border-t border-border/20">
                  {section.items.map((q, i) => {
                    const isOpen = currentOpen === q.id;
                    const hasAnswer = q.answer?.trim() || draftAnswers[q.id]?.trim() || (Array.isArray(q.file_urls) && q.file_urls.length > 0);
                    return (
                      <div key={q.id} className="transition-all">
                        <button
                          className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors pl-10"
                          onClick={() => setActiveQuestionId(isOpen ? null : q.id)}
                        >
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                              hasAnswer ? 'text-white' : 'bg-muted text-muted-foreground'
                            }`}
                            style={hasAnswer ? { backgroundColor: pc } : undefined}
                          >
                            {hasAnswer ? '✓' : i + 1}
                          </div>
                          <p className={`text-sm flex-1 ${hasAnswer ? 'text-muted-foreground' : 'font-medium'}`}>{q.question}</p>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-4 pl-[4.5rem]">
                            {Array.isArray(q.file_urls) && q.file_urls.length > 0 && (
                              <div className="rounded-xl bg-success/15/50 border border-success p-3 mb-2">
                                <div className="flex flex-wrap gap-2">
                                  {(q.file_urls as string[]).map((url: string, fi: number) => {
                                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                    return (
                                      <div key={fi} className="relative group/file">
                                        {isImg ? (
                                          <a href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                                          </a>
                                        ) : (
                                          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline bg-white rounded-lg border px-2 py-1">
                                            <FileText className="h-3 w-3" />{url.split('/').pop()?.substring(0, 25)}
                                          </a>
                                        )}
                                        <button
                                          onClick={() => removeQuestionFile(q.id, fi)}
                                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity text-[10px] font-bold"
                                          title="Remover ficheiro"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {q.answered_at && <p className="text-[10px] text-muted-foreground mt-2">Enviado {format(parseISO(q.answered_at), 'dd/MM/yyyy')}</p>}
                              </div>
                            )}

                            {q.answer?.trim() && editingQuestionId !== q.id ? (
                              <div className="space-y-2">
                                <div className="rounded-xl bg-success/15/50 border border-success p-3">
                                  <p className="text-sm">{q.answer}</p>
                                  {q.answered_at && <p className="text-[10px] text-muted-foreground mt-1">Respondida {format(parseISO(q.answered_at), 'dd/MM/yyyy')}</p>}
                                </div>
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-xs text-muted-foreground"
                                  onClick={() => {
                                    setEditingQuestionId(q.id);
                                    setDraftAnswers(prev => ({ ...prev, [q.id]: q.answer || '' }));
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" /> Editar resposta
                                </Button>
                              </div>
                            ) : (
                              <Textarea
                                className="text-sm rounded-xl border-border/40 bg-muted/10 focus-visible:ring-1"
                                placeholder="A tua resposta..."
                                value={draftAnswers[q.id] ?? q.answer ?? ''}
                                onChange={e => setDraftAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                rows={3}
                                style={{ '--tw-ring-color': pcAlpha(0.25) } as React.CSSProperties}
                                autoFocus
                              />
                            )}
                            {(draftAnswers[q.id]?.trim() && draftAnswers[q.id] !== q.answer) && (
                              <Button
                                size="sm"
                                className="mt-2 rounded-lg text-white text-xs"
                                style={{ backgroundColor: pc }}
                                onClick={async () => {
                                  await answerQuestion(q.id, draftAnswers[q.id] || '');
                                  setDraftAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                  setEditingQuestionId(null);
                                  const nextUnanswered = questions.find((qq) => qq.id !== q.id && !qq.answer?.trim() && !(Array.isArray(qq.file_urls) && qq.file_urls.length));
                                  setActiveQuestionId(nextUnanswered?.id || null);
                                }}
                              >
                                ✓ Guardar resposta
                              </Button>
                            )}

                            <div className="space-y-2 mt-3">
                              <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                                <input
                                  type="file" className="hidden" multiple
                                  onChange={e => { if (e.target.files?.length) uploadQuestionFiles(q.id, e.target.files); }}
                                  disabled={uploadingQuestionFiles[q.id]}
                                />
                                {uploadingQuestionFiles[q.id] ? (
                                  <InlineLoader />
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Carregar ficheiro(s) ou imagem(ns)</span>
                                  </>
                                )}
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      {allAnswered && !allSubmitted && (
        <Button className="w-full rounded-xl text-white font-semibold py-3" style={{ backgroundColor: pc }} onClick={handleSubmitAll}>
          <Send className="h-4 w-4 mr-2" />Submeter Todas as Respostas
        </Button>
      )}
    </div>
  );
}