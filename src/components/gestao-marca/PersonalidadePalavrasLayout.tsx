import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { KanbanSection } from './types';

const FIXED_SECTIONS = [
  { key: 'como-ser-vista', title: 'Como queremos ser vistos' },
  { key: 'como-nao-ser-vista', title: 'Como NÃO queremos ser vistos' },
  { key: 'palavras-definem', title: 'Palavras que nos definem' },
  { key: 'palavras-afastam', title: 'Palavras que nos afastam' },
  { key: 'sentimento-marca', title: 'Que sentimento queremos gerar com a marca?' },
] as const;

const ROWS: Array<{ left: string; right?: string }> = [
  { left: 'como-ser-vista', right: 'como-nao-ser-vista' },
  { left: 'palavras-definem', right: 'palavras-afastam' },
  { left: 'sentimento-marca' },
];

export function PersonalidadePalavrasLayout({ itemId, isOwner }: { itemId: string; isOwner: boolean }) {
  const qc = useQueryClient();

  const { data: sections = [], isSuccess } = useQuery({
    queryKey: ['brand-kanban-sections', itemId],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_kanban_sections')
        .select('*')
        .eq('item_id', itemId)
        .order('sort_order');
      return (data || []) as KanbanSection[];
    },
  });

  // Ensure fixed sections exist (create missing ones, owner only)
  useEffect(() => {
    if (!isOwner || !isSuccess) return;
    const missing = FIXED_SECTIONS.filter(f => !sections.some(s => s.title === f.title));
    if (missing.length === 0) return;
    (async () => {
      const baseOrder = sections.length;
      const rows = missing.map((m, i) => ({
        item_id: itemId, title: m.title, content: null, sort_order: baseOrder + i,
      }));
      const { error } = await supabase.from('brand_kanban_sections').insert(rows);
      if (!error) qc.invalidateQueries({ queryKey: ['brand-kanban-sections', itemId] });
    })();
  }, [sections, itemId, isOwner, isSuccess, qc]);

  const byKey = (key: string) => {
    const fixed = FIXED_SECTIONS.find(f => f.key === key);
    if (!fixed) return undefined;
    return sections.find(s => s.title === fixed.title);
  };

  return (
    <div className="space-y-6">
      {ROWS.map((row, idx) => (
        <div key={idx}>
          <div className={row.right ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
            <SectionCard itemId={itemId} fixedKey={row.left} section={byKey(row.left)} isOwner={isOwner} />
            {row.right && <SectionCard itemId={itemId} fixedKey={row.right} section={byKey(row.right)} isOwner={isOwner} />}
          </div>
          {idx < ROWS.length - 1 && (
            <div className="mt-6 h-px bg-primary/40" />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionCard({ itemId, fixedKey, section, isOwner }: {
  itemId: string; fixedKey: string; section?: KanbanSection; isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const fixed = FIXED_SECTIONS.find(f => f.key === fixedKey)!;

  const start = () => { setDraft(section?.content || ''); setEditing(true); };

  const save = async () => {
    if (!section) return;
    const { error } = await supabase.from('brand_kanban_sections')
      .update({ content: draft }).eq('id', section.id);
    if (error) toast.error('Erro ao guardar');
    else { setEditing(false); qc.invalidateQueries({ queryKey: ['brand-kanban-sections', itemId] }); }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden group">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
        <h4 className="text-sm font-semibold text-foreground truncate">{fixed.title}</h4>
        {isOwner && !editing && section && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={start}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <RichTextEditor content={draft} onChange={setDraft} editable={true} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5 mr-1" />Cancelar
            </Button>
            <Button size="sm" onClick={save}>
              <Check className="h-3.5 w-3.5 mr-1" />Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 prose prose-sm max-w-none">
          {section?.content ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content) }} />
          ) : (
            <p className="text-xs text-muted-foreground italic m-0">
              Sem conteúdo.{isOwner ? ' Clica no lápis para editar.' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}