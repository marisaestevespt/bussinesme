import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Props {
  itemId: string;
  initial: string;
  isOwner: boolean;
  onSaved?: (value: string) => void;
}

function parse(raw: string): { promessa: string; funcao: string } {
  if (!raw) return { promessa: '', funcao: '' };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && ('promessa' in p || 'funcao' in p)) {
      return { promessa: p.promessa || '', funcao: p.funcao || '' };
    }
  } catch {}
  return { promessa: raw, funcao: '' };
}

export function PromessaFuncaoEditor({ itemId, initial, isOwner, onSaved }: Props) {
  const qc = useQueryClient();
  const [state, setState] = useState(() => parse(initial));

  useEffect(() => { setState(parse(initial)); }, [initial]);

  const persist = async (next: { promessa: string; funcao: string }) => {
    const serialized = JSON.stringify(next);
    const { error } = await supabase.from('brand_kanban_items').update({ content: serialized } as any).eq('id', itemId);
    if (error) { toast.error('Erro ao guardar'); return; }
    qc.invalidateQueries({ queryKey: ['brand-kanban-items'] });
    onSaved?.(serialized);
  };

  const renderField = (label: string, fieldKey: 'promessa' | 'funcao', placeholder: string) => {
    const value = state[fieldKey];
    return (
      <div className="rounded-lg border bg-card p-5 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
        {isOwner ? (
          <Textarea
            value={value}
            onChange={e => setState(prev => ({ ...prev, [fieldKey]: e.target.value }))}
            onBlur={() => persist(state)}
            placeholder={placeholder}
            className="min-h-[120px] text-base border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background resize-y px-2"
          />
        ) : value ? (
          <p className="text-base text-foreground whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Por definir.</p>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {renderField('A nossa promessa', 'promessa', 'O que prometemos entregar...')}
      {renderField('A nossa função', 'funcao', 'A função que cumprimos no mercado...')}
    </div>
  );
}