import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Mail, MessageSquare, FileText, Link2, Paperclip, Copy, ExternalLink } from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OnboardingItemProps {
  item: {
    id: string;
    task: string;
    completed: boolean;
    deadline_date?: string | null;
    sop_step_id?: string | null;
  };
  onToggle: (id: string, next: boolean) => void;
}

const TYPE_META: Record<string, { label: string; icon: any }> = {
  email: { label: 'Email', icon: Mail },
  mensagem: { label: 'Mensagem', icon: MessageSquare },
  template: { label: 'Template', icon: FileText },
  documento: { label: 'Documento', icon: Paperclip },
  ficheiro: { label: 'Ficheiro', icon: Paperclip },
  link: { label: 'Link', icon: Link2 },
};

export function OnboardingItem({ item, onToggle }: OnboardingItemProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();

  const { data: docs } = useQuery({
    queryKey: ['onboarding-step-docs', item.sop_step_id],
    queryFn: async () => {
      if (!item.sop_step_id) return [];
      const { data } = await (supabase.from as any)('sop_step_documents')
        .select('*')
        .eq('step_id', item.sop_step_id)
        .order('sort_order', { ascending: true });
      return data || [];
    },
    enabled: !!item.sop_step_id && open,
  });

  const hasDocs = !!item.sop_step_id;
  const overdue = item.deadline_date && isBefore(parseISO(item.deadline_date), today) && !item.completed;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <div className="rounded-md bg-background border hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 p-2.5">
        <Checkbox
          checked={item.completed}
          onCheckedChange={(v) => onToggle(item.id, !!v)}
        />
        <button
          type="button"
          className="flex-1 min-w-0 text-left flex items-center gap-2"
          onClick={() => hasDocs && setOpen((o) => !o)}
          disabled={!hasDocs}
        >
          <span className={cn('text-sm', item.completed && 'line-through text-muted-foreground')}>
            {item.task}
          </span>
          {item.deadline_date && (
            <span className={cn(
              'text-[10px]',
              overdue ? 'text-destructive' : 'text-muted-foreground',
            )}>
              até {format(parseISO(item.deadline_date), 'd MMM', { locale: pt })}
            </span>
          )}
        </button>
        {hasDocs && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1"
            onClick={() => setOpen((o) => !o)}
            aria-label="Ver detalhes"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && hasDocs && (
        <div className="border-t px-3 py-2 bg-muted/20 space-y-2">
          {(!docs || docs.length === 0) && (
            <p className="text-xs text-muted-foreground italic">Sem materiais associados a este passo.</p>
          )}
          {(docs || []).map((d: any) => {
            const meta = TYPE_META[d.document_type] || TYPE_META.documento;
            const Icon = meta.icon;
            return (
              <div key={d.id} className="rounded border bg-background p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                  {d.title && <span className="text-xs font-medium truncate">{d.title}</span>}
                </div>
                {d.subject && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium">Assunto:</span> {d.subject}
                  </div>
                )}
                {d.content && (
                  <div className="text-xs whitespace-pre-wrap bg-muted/40 rounded p-2 max-h-40 overflow-y-auto">
                    {d.content}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {d.content && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleCopy(d.content)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar texto
                    </Button>
                  )}
                  {d.document_type === 'email' && d.content && (
                    <a
                      href={`mailto:?subject=${encodeURIComponent(d.subject || '')}&body=${encodeURIComponent(d.content)}`}
                      className="inline-flex items-center h-6 text-[10px] px-2 rounded hover:bg-muted"
                    >
                      <Mail className="h-3 w-3 mr-1" /> Abrir email
                    </a>
                  )}
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center h-6 text-[10px] px-2 rounded hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir link
                    </a>
                  )}
                  {d.file_url && (
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center h-6 text-[10px] px-2 rounded hover:bg-muted"
                    >
                      <Paperclip className="h-3 w-3 mr-1" /> {d.file_name || 'Abrir ficheiro'}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}