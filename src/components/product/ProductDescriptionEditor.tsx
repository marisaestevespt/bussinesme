import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  persistedValue: string;
  isOwner: boolean;
  productId: string | undefined;
  onSave: (v: string) => Promise<void>;
  isSaving: boolean;
}

/**
 * Description editor with explicit view/edit modes.
 * - Default: read-only static text.
 * - Edit: textarea with Save/Cancel.
 * - After save: returns to static view.
 */
export function ProductDescriptionEditor({ value, onChange, persistedValue, isOwner, productId, onSave, isSaving }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Sync draft with persisted value when entering edit or product changes
  useEffect(() => {
    if (!editing) setDraft(persistedValue);
  }, [persistedValue, editing, productId]);

  const handleSave = async () => {
    try {
      await onSave(draft);
      onChange(draft);
      setEditing(false);
      toast.success('Descrição guardada');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao guardar descrição');
    }
  };

  const handleCancel = () => {
    setDraft(persistedValue);
    onChange(persistedValue);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group relative">
        {persistedValue ? (
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {persistedValue}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">
            {isOwner ? 'Sem descrição. Clica em "Editar" para adicionar.' : 'Sem descrição.'}
          </p>
        )}
        {isOwner && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDraft(persistedValue); setEditing(true); }}
            className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity gap-1 h-7"
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Descrição do produto..."
        className="min-h-[160px] resize-y text-sm leading-relaxed"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving} className="gap-1">
          <X className="h-3 w-3" /> Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
          <Check className="h-3 w-3" /> Guardar
        </Button>
      </div>
    </div>
  );
}
