import { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/RichTextEditor';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { Pencil, Check, X, Plus, Trash2, ChevronUp, ChevronDown, Link2, Upload, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { KanbanSection } from './types';

interface SectionAttachment {
  id: string;
  section_id: string;
  kind: 'link' | 'file';
  label: string;
  url: string;
  file_path: string | null;
  file_type: string | null;
  sort_order: number;
}

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

  const sectionIds = sections.map(s => s.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ['brand-kanban-section-attachments', itemId, sectionIds.join(',')],
    enabled: sectionIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brand_kanban_section_attachments')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order');
      return (data || []) as SectionAttachment[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brand-kanban-sections', itemId] });
  const invalidateAttachments = () => qc.invalidateQueries({ queryKey: ['brand-kanban-section-attachments', itemId] });

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

  // Attachment helpers
  const addLink = async (sectionId: string, label: string, url: string) => {
    if (!label.trim() || !url.trim()) return;
    const count = attachments.filter(a => a.section_id === sectionId).length;
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const { error } = await (supabase as any).from('brand_kanban_section_attachments').insert({
      section_id: sectionId, kind: 'link', label: label.trim(), url: safeUrl, sort_order: count,
    });
    if (error) toast.error('Erro ao adicionar link');
    else invalidateAttachments();
  };

  const uploadFile = async (sectionId: string, file: File) => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${itemId}/${sectionId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('brand-section-files').upload(path, file);
    if (upErr) { toast.error('Erro ao carregar ficheiro'); return; }
    const { data: pub } = supabase.storage.from('brand-section-files').getPublicUrl(path);
    const count = attachments.filter(a => a.section_id === sectionId).length;
    const { error } = await (supabase as any).from('brand_kanban_section_attachments').insert({
      section_id: sectionId, kind: 'file', label: file.name, url: pub.publicUrl,
      file_path: path, file_type: file.type, sort_order: count,
    });
    if (error) toast.error('Erro ao guardar ficheiro');
    else { toast.success('Ficheiro carregado'); invalidateAttachments(); }
  };

  const deleteAttachment = async (att: SectionAttachment) => {
    if (att.kind === 'file' && att.file_path) {
      await supabase.storage.from('brand-section-files').remove([att.file_path]);
    }
    await (supabase as any).from('brand_kanban_section_attachments').delete().eq('id', att.id);
    invalidateAttachments();
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
              <SectionAttachments
                sectionId={s.id}
                isOwner={isOwner}
                items={attachments.filter(a => a.section_id === s.id)}
                onAddLink={addLink}
                onUpload={uploadFile}
                onDelete={deleteAttachment}
              />
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

function SectionAttachments({
  sectionId, isOwner, items, onAddLink, onUpload, onDelete,
}: {
  sectionId: string;
  isOwner: boolean;
  items: SectionAttachment[];
  onAddLink: (sectionId: string, label: string, url: string) => void | Promise<void>;
  onUpload: (sectionId: string, file: File) => void | Promise<void>;
  onDelete: (att: SectionAttachment) => void | Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try { await onUpload(sectionId, f); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (items.length === 0 && !isOwner) return null;

  return (
    <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(a => (
            <div key={a.id} className="group/att inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hq-transition hover:shadow-sm">
              {a.kind === 'link' ? <Link2 className="h-3 w-3 text-muted-foreground shrink-0" /> : <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[180px] text-foreground hover:underline">
                {a.label}
              </a>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onDelete(a)}
                  className="ml-1 opacity-0 group-hover/att:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {isOwner && (
        <div className="flex items-center gap-1.5">
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                <Link2 className="h-3 w-3 mr-1" />Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2" align="start">
              <Input
                value={linkLabel}
                onChange={e => setLinkLabel(e.target.value)}
                placeholder="Nome (ex: Site da marca)"
                className="h-8 text-xs"
                autoFocus
              />
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="URL (https://...)"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={!linkLabel.trim() || !linkUrl.trim()}
                onClick={async () => {
                  await onAddLink(sectionId, linkLabel, linkUrl);
                  setLinkLabel(''); setLinkUrl(''); setLinkOpen(false);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />Adicionar
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" />{uploading ? 'A carregar...' : 'Ficheiro'}
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  );
}