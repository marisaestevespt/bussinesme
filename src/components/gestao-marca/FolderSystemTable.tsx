import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Check, X, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { safeUrl } from '@/lib/url';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface FolderLink {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  sort_order: number;
}

interface Props {
  isOwner: boolean;
}

export function FolderSystemTable({ isOwner }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', url: '', notes: '' });

  const { data: items = [] } = useQuery({
    queryKey: ['brand-folder-links'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_folder_links')
        .select('*')
        .order('sort_order');
      return (data || []) as FolderLink[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brand-folder-links'] });

  const reset = () => { setForm({ title: '', url: '', notes: '' }); setAdding(false); setEditingId(null); };

  const startEdit = (it: FolderLink) => {
    setEditingId(it.id);
    setForm({ title: it.title, url: it.url || '', notes: it.notes || '' });
    setAdding(false);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    if (editingId) {
      const { error } = await supabase.from('brand_folder_links').update({
        title: form.title.trim(),
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
      }).eq('id', editingId);
      if (error) { toast.error('Erro ao guardar'); return; }
    } else {
      const { error } = await supabase.from('brand_folder_links').insert({
        title: form.title.trim(),
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
        sort_order: items.length,
      });
      if (error) { toast.error('Erro ao adicionar'); return; }
    }
    toast.success('Guardado');
    reset();
    invalidate();
  };

  const remove = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('brand_folder_links').delete().eq('id', id);
    invalidate();
  };

  return (
    <div className="space-y-3 group/board">
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Título</TableHead>
              <TableHead className="w-[28%]">Link</TableHead>
              <TableHead>Notas</TableHead>
              {isOwner && <TableHead className="w-[100px] text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && !adding && (
              <TableRow>
                <TableCell colSpan={isOwner ? 4 : 3}>
                  <EmptyHint>Sem pastas. {isOwner ? 'Adiciona a primeira abaixo.' : ''}</EmptyHint>
                </TableCell>
              </TableRow>
            )}
            {items.map(it => (
              editingId === it.id ? (
                <TableRow key={it.id} className="bg-muted/20 align-top">
                  <TableCell><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" /></TableCell>
                  <TableCell><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="h-8 text-sm" /></TableCell>
                  <TableCell><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm min-h-[60px]" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={it.id} className="group align-top">
                  <TableCell className="font-medium text-sm">{it.title}</TableCell>
                  <TableCell className="text-sm">
                    {it.url ? (
                      <a href={safeUrl(it.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[260px]">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{it.url}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">{it.notes || <span className="text-muted-foreground/60 italic text-xs">—</span>}</TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(it)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(it.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            ))}
            {adding && isOwner && (
              <TableRow className="bg-muted/20 align-top">
                <TableCell><Input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Drive da Marca" className="h-8 text-sm" /></TableCell>
                <TableCell><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="h-8 text-sm" /></TableCell>
                <TableCell><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas..." className="text-sm min-h-[60px]" /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {isOwner && !adding && !editingId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setForm({ title: '', url: '', notes: '' }); setAdding(true); }}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover/board:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <Plus className="h-3 w-3 mr-1" />Adicionar pasta
        </Button>
      )}
    </div>
  );
}