import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Props {
  type: 'executive' | 'alerts' | 'financial' | 'commercial' | 'marketing';
  title?: string;
  buttonLabel?: string;
  context?: string;
  compact?: boolean;
}

export function AiInsightsPanel({ type, title, buttonLabel, context, compact }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    setLoading(true);
    setVisible(true);
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
          body: JSON.stringify({ type, context }),
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
      setVisible(false);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const close = () => {
    if (abortRef.current) abortRef.current.abort();
    setVisible(false);
    setContent('');
    setLoading(false);
  };

  if (!visible) {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={generate}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {buttonLabel || 'Analisar com AI'}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {title || 'Análise AI'}
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {!loading && content && (
            <Button variant="ghost" size="sm" onClick={generate} className="h-7 px-2 text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Regenerar
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={close} className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !content && (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">A analisar dados...</span>
          </div>
        )}
        {content && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown>{content}</ReactMarkdown>
            {loading && <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
