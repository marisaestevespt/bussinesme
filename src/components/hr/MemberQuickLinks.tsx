import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ExternalLink, Link2, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface QuickLink {
  id: string;
  member_id: string;
  name: string;
  description: string | null;
  url: string;
  tags: string[];
  sort_order: number;
}

interface Props {
  memberId: string;
  readOnly?: boolean;
  compact?: boolean;
}

export function MemberQuickLinks({ memberId, readOnly = false, compact = false }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', url: '', description: '', tags: '' });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['member_quick_links', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_quick_links')
        .select('*')
        .eq('member_id', memberId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as QuickLink[];
    },
  });

  const reset = () => { setDraft({ name: '', url: '', description: '', tags: '' }); setAdding(false); setEditingId(null); };

  const save = async () => {
    if (!draft.name.trim() || !draft.url.trim()) {
      toast.error('Indica nome e link');
      return;
    }
    const tags = draft.tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload = { name: draft.name.trim(), url: draft.url.trim(), description: draft.description.trim() || null, tags };
    if (editingId) {
      const { error } = await supabase.from('member_quick_links').update(payload).eq('id', editingId);
      if (error) { toast.error('Falha ao guardar', { description: error.message }); return; }
      toast.success('Link atualizado');
    } else {
      const { error } = await supabase.from('member_quick_links').insert({ ...payload, member_id: memberId });
      if (error) { toast.error('Falha ao adicionar', { description: error.message }); return; }
      toast.success('Link adicionado');
    }
    reset();
    qc.invalidateQueries({ queryKey: ['member_quick_links', memberId] });
  };

  const remove = async (id: string) => {
    if (!(await confirmDestructive())) return;
    const { error } = await supabase.from('member_quick_links').delete().eq('id', id);
    if (error) { toast.error('Falha ao remover'); return; }
    toast.success('Link removido');
    qc.invalidateQueries({ queryKey: ['member_quick_links', memberId] });
  };

  const startEdit = (l: QuickLink) => {
    setEditingId(l.id);
    setAdding(false);
    setDraft({ name: l.name, url: l.url, description: l.description || '', tags: l.tags.join(', ') });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">A carregar…</p>;

  return (
    <div className="space-y-2">
      {links.length === 0 && !adding && (
        <EmptyHint>Sem links rápidos. {!readOnly && 'Adiciona o teu primeiro abaixo.'}</EmptyHint>
      )}

      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {links.map(l => editingId === l.id ? (
          <Card key={l.id}><CardContent className="p-2 space-y-1.5">
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome" className="h-8 text-sm" />
            <Input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://…" className="h-8 text-sm" />
            <Input value={draft.tags} onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))} placeholder="Etiquetas (separadas por vírgula)" className="h-8 text-sm" />
            <Textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Descrição (opcional)" rows={2} className="text-sm" />
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-7" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
              <Button size="sm" className="h-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
            </div>
          </CardContent></Card>
        ) : (
          <div key={l.id} className="group flex items-start gap-2 rounded-md border border-border/50 p-2 hover:bg-muted/40 transition">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1">
                {l.name}<ExternalLink className="h-3 w-3 opacity-60" />
              </a>
              {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
              {l.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {l.tags.map((t, i) => <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5">{t}</Badge>)}
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                <button onClick={() => startEdit(l)} className="p-1 hover:bg-muted rounded"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                <button onClick={() => remove(l.id)} className="p-1 hover:bg-muted rounded"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && !editingId && (
        <Card><CardContent className="p-2 space-y-1.5">
          <Input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome" className="h-8 text-sm" />
          <Input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://…" className="h-8 text-sm" />
          <Input value={draft.tags} onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))} placeholder="Etiquetas (separadas por vírgula)" className="h-8 text-sm" />
          <Textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Descrição (opcional)" rows={2} className="text-sm" />
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" className="h-7" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        </CardContent></Card>
      )}

      {!readOnly && !adding && !editingId && (
        <Button size="sm" variant="ghost" className="h-7 w-full justify-start" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar link
        </Button>
      )}
    </div>
  );
}