import { useState } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/RichTextEditor';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { Pencil, Check, X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { KanbanSection } from './types';

interface Props {
  itemId: string;
  isOwner: boolean;
}

export function KanbanSectionsEditor({ itemId, isOwner }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');

  const { data: sections = [] } = useQuery({
    queryKey: ['brand-kanban-sections', itemId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brand_kanban_sections')
        .select('*')
        .eq('item_id', itemId)
        .order('sort_order');
      return (data || []) as KanbanSection[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brand-kanban-sections', itemId] });

  const addSection = async () => {
    if (!newTitle.trim()) return;
    const { error } = await (supabase as any).from('brand_kanban_sections').insert({
      item_id: itemId,
      title: newTitle.trim(),
      content: null,
      sort_order: sections.length,
    });
    if (error) toast.error('Erro ao adicionar secção');
    else { setNewTitle(''); setAdding(false); invalidate(); }
  };

  const startEdit = (s: KanbanSection) => {
    setEditingId(s.id);
    setEditingTitle(s.title);
    setEditingContent(s.content || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await (supabase as any).from('brand_kanban_sections')
      .update({ title: editingTitle.trim() || 'Sem título', content: editingContent })
      .eq('id', editingId);
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Guardado'); setEditingId(null); invalidate(); }
  };

  const deleteSection = async (id: string) => {
    await (supabase as any).from('brand_kanban_sections').delete().eq('id', id);
    invalidate();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[idx];
    const b = sections[target];
    await Promise.all([
      (supabase as any).from('brand_kanban_sections').update({ sort_order: b.sort_order }).eq('id', a.id),
      (supabase as any).from('brand_kanban_sections').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    invalidate();
  };

  return (
    <div className="space-y-3">
      {sections.length === 0 && !adding && (
        <EmptyHint>Sem secções. {isOwner ? 'Adiciona a primeira abaixo.' : ''}</EmptyHint>
      )}

      {sections.map((s, idx) => (
        <div key={s.id} className="rounded-lg border bg-card overflow-hidden group">
          {editingId === s.id ? (
            <div className="p-3 space-y-2">
              <Input
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                className="h-8 font-semibold"
                placeholder="Título da secção"
              />
              <RichTextEditor content={editingContent} onChange={setEditingContent} editable={true} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5 mr-1" />Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  <Check className="h-3.5 w-3.5 mr-1" />Guardar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
                <h4 className="text-sm font-semibold text-foreground truncate">{s.title}</h4>
                {isOwner && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === sections.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSection(s.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="px-3 py-3 prose prose-sm max-w-none">
                {s.content ? (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.content) }} />
                ) : (
                  <p className="text-xs text-muted-foreground italic m-0">Sem conteúdo.{isOwner ? ' Clica no lápis para editar.' : ''}</p>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {isOwner && (
        adding ? (
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Nome da secção..."
              autoFocus
              className="h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && addSection()}
            />
            <Button size="sm" className="h-8" onClick={addSection}><Check className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setNewTitle(''); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar secção
          </Button>
        )
      )}
    </div>
  );
}