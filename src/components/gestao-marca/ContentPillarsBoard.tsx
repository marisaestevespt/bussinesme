import { useState } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Pillar {
  id: string;
  name: string;
  description: string;
  position: number;
}

export function ContentPillarsBoard({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const { data: pillars = [] } = useQuery({
    queryKey: ['brand-content-pillars'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_content_pillars')
        .select('*')
        .order('position', { ascending: true });
      return (data || []) as Pillar[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['brand-content-pillars'] });

  const startEdit = (p: Pillar) => {
    setEditing(p.id);
    setDraftName(p.name);
    setDraftDesc(p.description);
  };

  const addPillar = async () => {
    const { data, error } = await supabase
      .from('brand_content_pillars')
      .insert({ name: '', description: '', position: pillars.length })
      .select()
      .single();
    if (error) { toast.error('Erro ao criar pilar'); return; }
    refresh();
    if (data) startEdit(data as Pillar);
  };

  const save = async (id: string) => {
    const { error } = await supabase
      .from('brand_content_pillars')
      .update({ name: draftName, description: draftDesc })
      .eq('id', id);
    if (error) { toast.error('Erro ao guardar'); return; }
    toast.success('Guardado');
    setEditing(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!(await confirmDestructive())) return;
    if (!confirm('Eliminar este pilar?')) return;
    const { error } = await supabase.from('brand_content_pillars').delete().eq('id', id);
    if (error) { toast.error('Erro ao eliminar'); return; }
    refresh();
  };

  return (
    <div className="space-y-3 group/board">
      {pillars.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Ainda não há pilares de conteúdo.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pillars.map((p, idx) => {
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pilar {idx + 1}
                </span>
                {isOwner && !isEditing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2 flex-1">
                {isEditing ? (
                  <>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Nome do pilar..."
                      className="h-8 text-sm font-semibold"
                    />
                    <RichTextEditor
                      content={draftDesc}
                      onChange={setDraftDesc}
                      editable={true}
                      placeholder="Descrição / como usar este pilar..."
                    />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => save(p.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {p.name ? (
                      <p className="text-base font-semibold text-foreground">{p.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sem nome.</p>
                    )}
                    {p.description ? (
                      <div
                        className="prose prose-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.description) }}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground italic m-0">Sem descrição.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isOwner && (
        <Button
          variant="ghost"
          size="sm"
          onClick={addPillar}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover/board:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <Plus className="h-3 w-3 mr-1" /> Adicionar pilar
        </Button>
      )}
    </div>
  );
}