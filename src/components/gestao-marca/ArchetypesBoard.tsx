import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Archetype {
  id: string;
  slot: 'dominante' | 'secundario' | 'auxiliar';
  archetype: string | null;
  notes: string | null;
}

const SLOTS = [
  { key: 'dominante', label: 'Dominante', emoji: '👑' },
  { key: 'secundario', label: 'Secundário', emoji: '✨' },
  { key: 'auxiliar', label: 'Auxiliar', emoji: '🌿' },
] as const;

const ARCHETYPES = [
  'Inocente', 'Sábio', 'Herói', 'Fora-da-Lei', 'Explorador', 'Criador',
  'Governante', 'Mago', 'Amante', 'Cuidador', 'Bobo da Corte', 'Comum',
];

export function ArchetypesBoard({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftArchetype, setDraftArchetype] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  const { data: rows = [] } = useQuery({
    queryKey: ['brand-archetypes'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('brand_archetypes').select('*');
      return (data || []) as Archetype[];
    },
  });

  const bySlot = (slot: string) => rows.find(r => r.slot === slot);

  const startEdit = (row: Archetype) => {
    setEditing(row.slot);
    setDraftArchetype(row.archetype || '');
    setDraftNotes(row.notes || '');
  };

  const save = async (slot: string) => {
    const { error } = await (supabase as any).from('brand_archetypes')
      .update({ archetype: draftArchetype || null, notes: draftNotes })
      .eq('slot', slot);
    if (error) { toast.error('Erro ao guardar'); return; }
    toast.success('Guardado');
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['brand-archetypes'] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {SLOTS.map(s => {
        const row = bySlot(s.key);
        if (!row) return null;
        const isEditing = editing === s.key;
        return (
          <div key={s.key} className="rounded-lg border bg-card overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.emoji} {s.label}
              </h4>
              {isOwner && !isEditing && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(row)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="p-3 space-y-2 flex-1">
              {isEditing ? (
                <>
                  <Select value={draftArchetype} onValueChange={setDraftArchetype}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Escolher arquétipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ARCHETYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <RichTextEditor content={draftNotes} onChange={setDraftNotes} editable={true} placeholder="Como aplicar à marca..." />
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => save(s.key)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {row.archetype ? (
                    <p className="text-base font-semibold text-foreground">{row.archetype}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sem arquétipo definido.</p>
                  )}
                  {row.notes ? (
                    <div
                      className="prose prose-sm max-w-none text-sm [&_p:empty]:min-h-[1em] [&_p]:my-2"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(row.notes) }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic m-0">Sem notas.</p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}