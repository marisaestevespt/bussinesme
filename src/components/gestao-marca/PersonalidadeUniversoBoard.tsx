import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, Pencil, Check, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArchetypesBoard } from './ArchetypesBoard';
import { KanbanSectionsEditor } from './KanbanSectionsEditor';

interface PersonalityImage {
  id: string;
  kind: 'moodboard' | 'element';
  image_url: string;
  file_path: string | null;
  caption: string | null;
  sort_order: number;
}

export function PersonalidadeUniversoBoard({ itemId, isOwner }: { itemId: string; isOwner: boolean }) {
  return (
    <div className="space-y-8">
      {/* Universo de marca — Moodboard */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Universo de marca</h3>
          <p className="text-xs text-muted-foreground">Moodboard visual: imagens, texturas e referências que definem o universo da marca.</p>
        </header>
        <ImageGallery itemId={itemId} kind="moodboard" isOwner={isOwner} layout="moodboard" />
        <UniverseNotes isOwner={isOwner} />
      </section>

      {/* Arquétipos */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Arquétipos</h3>
          <p className="text-xs text-muted-foreground">Arquétipos que orientam personalidade e voz.</p>
        </header>
        <ArchetypesBoard isOwner={isOwner} />
      </section>

      {/* Elementos */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Elementos</h3>
          <p className="text-xs text-muted-foreground">Imagens com legenda/descrição para referência (ex: símbolos, padrões, formas).</p>
        </header>
        <ImageGallery itemId={itemId} kind="element" isOwner={isOwner} layout="elements" />
      </section>

      {/* Outras secções (Como ser vista, Não ser vista, Sentimentos, Palavras…) */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Personalidade & Palavras</h3>
        </header>
        <KanbanSectionsEditor itemId={itemId} isOwner={isOwner} twoColumns hideAttachments />
      </section>
    </div>
  );
}

function ImageGallery({ itemId, kind, isOwner, layout }: { itemId: string; kind: 'moodboard' | 'element'; isOwner: boolean; layout: 'moodboard' | 'elements' }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState('');

  const { data: images = [] } = useQuery({
    queryKey: ['brand-personality-images', kind],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brand_personality_images')
        .select('*')
        .eq('kind', kind)
        .order('sort_order');
      return (data || []) as PersonalityImage[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brand-personality-images', kind] });

  const upload = async (file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `personality/${kind}/${itemId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('brand-section-files').upload(path, file);
    if (upErr) { toast.error('Erro ao carregar imagem'); return; }
    const { data: pub } = supabase.storage.from('brand-section-files').getPublicUrl(path);
    const { error } = await (supabase as any).from('brand_personality_images').insert({
      kind, image_url: pub.publicUrl, file_path: path, caption: null, sort_order: images.length,
    });
    if (error) toast.error('Erro ao guardar imagem'); else invalidate();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try { for (const f of files) await upload(f); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (img: PersonalityImage) => {
    if (img.file_path) await supabase.storage.from('brand-section-files').remove([img.file_path]);
    await (supabase as any).from('brand_personality_images').delete().eq('id', img.id);
    invalidate();
  };

  const saveCaption = async (id: string) => {
    const { error } = await (supabase as any).from('brand_personality_images').update({ caption: draftCaption }).eq('id', id);
    if (error) toast.error('Erro ao guardar'); else { setEditingId(null); invalidate(); }
  };

  const gridClass = layout === 'moodboard'
    ? 'columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid'
    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3';

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/10 p-8 text-center text-xs text-muted-foreground">
          <ImageIcon className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          Sem imagens. {isOwner ? 'Carrega a primeira abaixo.' : ''}
        </div>
      ) : (
        <div className={gridClass}>
          {images.map(img => (
            <div key={img.id} className="group/img relative rounded-lg overflow-hidden border bg-card">
              <img src={img.image_url} alt={img.caption || ''} className="w-full h-auto block" />
              {layout === 'elements' && (
                editingId === img.id ? (
                  <div className="p-2 space-y-1.5 border-t">
                    <Input
                      value={draftCaption}
                      onChange={e => setDraftCaption(e.target.value)}
                      placeholder="Legenda / descrição..."
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveCaption(img.id); }}
                    />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                      <Button size="sm" className="h-6 px-2" onClick={() => saveCaption(img.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 border-t flex items-start justify-between gap-1.5">
                    <p className="text-xs text-foreground flex-1">
                      {img.caption || <span className="italic text-muted-foreground">Sem legenda.</span>}
                    </p>
                    {isOwner && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditingId(img.id); setDraftCaption(img.caption || ''); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => remove(img)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/90 backdrop-blur border opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center hover:text-destructive"
                  aria-label="Remover imagem"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <>
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {uploading ? 'A carregar...' : 'Carregar imagens'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
        </>
      )}
    </div>
  );
}

interface UniverseNote {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

function UniverseNotes({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['brand-universe-notes'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brand_universe_notes')
        .select('*')
        .order('sort_order');
      return (data || []) as UniverseNote[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brand-universe-notes'] });

  const add = async () => {
    if (!newTitle.trim()) return;
    const { error } = await (supabase as any).from('brand_universe_notes').insert({
      title: newTitle.trim(), description: newDesc.trim() || null, sort_order: notes.length,
    });
    if (error) toast.error('Erro ao adicionar');
    else { setNewTitle(''); setNewDesc(''); setAdding(false); invalidate(); }
  };

  const startEdit = (n: UniverseNote) => {
    setEditingId(n.id); setDraftTitle(n.title); setDraftDesc(n.description || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await (supabase as any).from('brand_universe_notes')
      .update({ title: draftTitle.trim() || 'Sem título', description: draftDesc.trim() || null })
      .eq('id', editingId);
    if (error) toast.error('Erro ao guardar');
    else { setEditingId(null); invalidate(); }
  };

  const remove = async (id: string) => {
    await (supabase as any).from('brand_universe_notes').delete().eq('id', id);
    invalidate();
  };

  return (
    <div className="space-y-2 pt-2">
      {notes.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="grid grid-cols-[200px_1fr_auto] gap-3 px-3 py-2 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Título</div>
            <div>Descrição</div>
            <div className="w-6" />
          </div>
          <ul className="divide-y">
            {notes.map(n => (
              <li key={n.id} className="group/note">
                {editingId === n.id ? (
                  <div className="grid grid-cols-[200px_1fr_auto] gap-3 px-3 py-2 items-start">
                    <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} className="h-8 text-sm" autoFocus />
                    <Textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value)} rows={2} className="text-sm min-h-[60px]" />
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[200px_1fr_auto] gap-3 px-3 py-2 items-start">
                    <div className="text-sm font-medium text-foreground">{n.title}</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-line">{n.description || <span className="italic">—</span>}</div>
                    <div className="flex gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                      {isOwner && (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(n)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(n.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && (
        adding ? (
          <div className="grid grid-cols-[200px_1fr_auto] gap-3 items-start rounded-lg border bg-card p-3">
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título..." className="h-8 text-sm" autoFocus />
            <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Descrição..." className="text-sm min-h-[60px]" />
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewTitle(''); setNewDesc(''); }}><X className="h-3.5 w-3.5" /></Button>
              <Button size="icon" className="h-7 w-7" onClick={add}><Check className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar nota
          </Button>
        )
      )}
    </div>
  );
}
