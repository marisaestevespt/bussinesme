import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const AI_PAGES: Record<string, { type: string; title: string }> = {
  '/secretaria': { type: 'alerts', title: 'Alertas Inteligentes' },
  '/hub-equipa': { type: 'alerts', title: 'Alertas Inteligentes' },
  '/executive': { type: 'executive', title: 'Briefing Executivo AI' },
  '/hub/comercial': { type: 'commercial', title: 'Análise Comercial AI' },
  '/hub/financeiro': { type: 'financial', title: 'Análise Financeira AI' },
};

export function AiInsightsButton() {
  const location = useLocation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Only show on specific pages
  const pageConfig = AI_PAGES[location.pathname];
  if (!pageConfig) return null;

  const generate = async () => {
    setLoading(true);
    setContent('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/ai-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type: pageConfig.type }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar insights');
      }

      if (!resp.body) throw new Error('Sem resposta');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error(err.message || 'Erro ao gerar análise AI');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!content && !loading) generate();
  };

  const handleClose = () => {
    setOpen(false);
    if (abortRef.current) abortRef.current.abort();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" aria-label="Insights" size="icon" className="h-8 w-8" onClick={handleOpen}>
            <Sparkles className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pageConfig.title}</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {pageConfig.title}
            </DialogTitle>
            {!loading && content && (
              <Button variant="ghost" size="sm" onClick={generate} className="h-7 px-2 gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" /> Regenerar
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto px-5 py-4">
            {loading && !content && (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">A analisar dados...</span>
              </div>
            )}
            {!loading && !content && (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm">Clica para gerar a análise</span>
                <Button size="sm" onClick={generate} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Gerar análise
                </Button>
              </div>
            )}
            {content && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1.5 [&_p]:text-sm [&_p]:mb-2 [&_li]:text-sm [&_ul]:space-y-1 [&_ol]:space-y-1 [&_strong]:text-foreground [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-r-lg [&_blockquote]:py-1 [&_blockquote]:px-3">
                <ReactMarkdown>{content}</ReactMarkdown>
                {loading && <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5 rounded-sm" />}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
