import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  itemId: string;
  initial: string;
  isOwner: boolean;
  placeholder?: string;
  onSaved?: (value: string) => void;
}

function parseBullets(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string');
  } catch {}
  return raw.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}

export function BulletListEditor({ itemId, initial, isOwner, placeholder, onSaved }: Props) {
  const qc = useQueryClient();
  const [bullets, setBullets] = useState<string[]>(() => parseBullets(initial));
  const [draft, setDraft] = useState('');

  useEffect(() => { setBullets(parseBullets(initial)); }, [initial]);

  const persist = async (next: string[]) => {
    const serialized = JSON.stringify(next);
    setBullets(next);
    const { error } = await supabase.from('brand_kanban_items').update({ content: serialized } as any).eq('id', itemId);
    if (error) { toast.error('Erro ao guardar'); return; }
    qc.invalidateQueries({ queryKey: ['brand-kanban-items'] });
    onSaved?.(serialized);
  };

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    persist([...bullets, v]);
    setDraft('');
  };

  const update = (idx: number, value: string) => {
    const next = [...bullets];
    next[idx] = value;
    setBullets(next);
  };

  const commit = (idx: number) => {
    const v = bullets[idx]?.trim() || '';
    if (!v) {
      persist(bullets.filter((_, i) => i !== idx));
    } else {
      const next = [...bullets];
      next[idx] = v;
      persist(next);
    }
  };

  const remove = (idx: number) => persist(bullets.filter((_, i) => i !== idx));

  return (
    <div className="rounded-lg border bg-card p-5 space-y-2">
      {bullets.length === 0 && !isOwner && (
        <p className="text-sm text-muted-foreground italic">Sem crenças definidas.</p>
      )}
      <ul className="space-y-1.5">
        {bullets.map((b, idx) => (
          <li key={idx} className="flex items-start gap-2 group">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground/60 shrink-0" />
            {isOwner ? (
              <Textarea
                value={b}
                onChange={e => update(idx, e.target.value)}
                onBlur={() => commit(idx)}
                rows={2}
                className="min-h-[40px] border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background px-2 py-1 text-sm resize-y"
              />
            ) : (
              <span className="text-sm text-foreground py-1 whitespace-pre-line">{b}</span>
            )}
            {isOwner && (
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => remove(idx)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder || 'Nova crença...'}
            rows={2}
            className="min-h-[40px] text-sm resize-y"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
          />
          <Button size="sm" className="h-8" onClick={add} disabled={!draft.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}