import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  itemId: string;
  initial: string;
  isOwner: boolean;
  placeholder?: string;
  onSaved?: (value: string) => void;
}

export function SingleLineEditor({ itemId, initial, isOwner, placeholder, onSaved }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  useEffect(() => { setValue(initial); }, [initial]);

  const save = async () => {
    const { error } = await supabase.from('brand_kanban_items').update({ content: value } as any).eq('id', itemId);
    if (error) { toast.error('Erro ao guardar'); return; }
    toast.success('Guardado');
    setEditing(false);
    qc.invalidateQueries({ queryKey: ['brand-kanban-items'] });
    onSaved?.(value);
  };

  if (editing && isOwner) {
    return (
      <div className="flex gap-2 items-start">
        <Textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="text-base min-h-[120px]"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
            if (e.key === 'Escape') { setValue(initial); setEditing(false); }
          }}
        />
        <Button size="sm" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => { setValue(initial); setEditing(false); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 flex items-center justify-between gap-3 group">
      {value ? (
        <p className="text-lg font-medium text-foreground italic flex-1 whitespace-pre-line">"{value}"</p>
      ) : (
        <p className="text-sm text-muted-foreground italic flex-1">{placeholder || 'Sem frase definida.'}</p>
      )}
      {isOwner && (
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}