import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ExternalLink, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { ExportInitialQuestionsButton } from '@/components/project/ExportInitialQuestionsButton';
import { SubPageShell } from './SubPageShell';

interface Props {
  projectId: string;
  clientId: string | null;
  clientName: string | null;
  projectName: string | null;
  onBack: () => void;
}

interface PortalRow {
  id: string;
  token: string | null;
  is_active: boolean | null;
}

interface QuestionRow {
  id: string;
  question: string;
  answer: string | null;
  file_urls: any;
  sort_order: number | null;
  answered_at: string | null;
}

function parseFileUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter(Boolean) : [];
  } catch { return []; }
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || url);
    return last.replace(/^\d{10,}[-_]/, '');
  } catch {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || url);
  }
}

export function BriefingSubPage({ projectId, clientId, clientName, projectName, onBack }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['project-briefing', projectId, clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: portals } = await supabase
        .from('client_portals')
        .select('id, token, is_active')
        .eq('client_id', clientId!);
      const list = (portals || []) as PortalRow[];
      if (list.length === 0) return { portals: [] as PortalRow[], questions: [] as QuestionRow[] };
      const portalIds = list.map(p => p.id);
      const { data: questions } = await supabase
        .from('portal_initial_questions')
        .select('id, question, answer, file_urls, sort_order, answered_at')
        .in('portal_id', portalIds)
        .order('sort_order');
      return { portals: list, questions: (questions || []) as QuestionRow[] };
    },
  });

  const portals = data?.portals || [];
  const questions = data?.questions || [];
  const activePortal = portals.find(p => p.is_active && p.token) || portals[0];
  const answered = questions.filter(q => (q.answer && q.answer.trim()) || parseFileUrls(q.file_urls).length > 0).length;
  const total = questions.length;

  const headerAction = (
    <div className="flex items-center gap-2">
      {activePortal?.token && (
        <Button variant="outline" size="sm" asChild className="gap-1">
          <a href={`/portal/${activePortal.token}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do cliente
          </a>
        </Button>
      )}
      {clientId && questions.length > 0 && (
        <ExportInitialQuestionsButton clientId={clientId} clientName={clientName} projectName={projectName} />
      )}
    </div>
  );

  return (
    <SubPageShell
      title="Briefing"
      description="Perguntas iniciais respondidas pelo cliente no portal. Atualizam-se automaticamente sempre que o cliente edita."
      icon={ClipboardList}
      onBack={onBack}
    >
      {!clientId ? (
        <EntitySection title="Sem cliente associado" icon={AlertCircle}>
          <EmptyHint>
            Este projeto não está ligado a um cliente, por isso não tem briefing.
            Liga um cliente nas definições do projeto para ver as perguntas iniciais aqui.
          </EmptyHint>
        </EntitySection>
      ) : isLoading ? (
        <EntitySection title="A carregar…" icon={ClipboardList}>
          <div className="space-y-2">
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
          </div>
        </EntitySection>
      ) : portals.length === 0 ? (
        <EntitySection title="Cliente sem portal" icon={AlertCircle}>
          <EmptyHint>
            Este cliente ainda não tem portal configurado, por isso não há perguntas para mostrar.
            Cria o portal a partir do detalhe do cliente.
          </EmptyHint>
        </EntitySection>
      ) : questions.length === 0 ? (
        <EntitySection title="Sem perguntas" icon={ClipboardList} action={headerAction}>
          <EmptyHint>
            O portal existe mas ainda não tem perguntas iniciais configuradas.
            Adiciona perguntas no portal ou no produto para que o cliente as possa responder.
          </EmptyHint>
        </EntitySection>
      ) : (
        <EntitySection
          title="Respostas do cliente"
          icon={MessageSquare}
          description={`${answered} de ${total} perguntas respondidas`}
          action={headerAction}
        >
          <div className="space-y-3">
            {questions.map((q, i) => {
              const files = parseFileUrls(q.file_urls);
              const hasAnswer = (q.answer && q.answer.trim()) || files.length > 0;
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-border/60 bg-card p-4 space-y-3 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {q.question || <span className="text-muted-foreground italic">(pergunta sem texto)</span>}
                      </p>
                    </div>
                    {hasAnswer ? (
                      <Badge variant="secondary" className="shrink-0 bg-success/15 text-success border-success/20">
                        Respondida
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {q.answer && q.answer.trim() ? (
                    <div className="ml-8 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {q.answer}
                    </div>
                  ) : files.length === 0 ? (
                    <div className="ml-8 text-xs text-muted-foreground italic">Sem resposta ainda.</div>
                  ) : null}

                  {files.length > 0 && (
                    <div className="ml-8 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {files.length} ficheiro{files.length === 1 ? '' : 's'} anexado{files.length === 1 ? '' : 's'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {files.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors max-w-full"
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{fileNameFromUrl(u)}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.answered_at && (
                    <div className="ml-8 text-[11px] text-muted-foreground">
                      Respondida em {format(new Date(q.answered_at), "d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </EntitySection>
      )}
    </SubPageShell>
  );
}