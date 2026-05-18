import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Upload, ExternalLink, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface ProductDocument {
  id: string;
  name: string;
  url: string | null;
  file_url: string | null;
  file_path: string | null;
  file_type: string | null;
  tags: string[] | null;
  sort_order: number | null;
}

interface Props {
  productId: string;
  documents: ProductDocument[];
  isOwner: boolean;
  onBack: () => void;
}

export function ArchiveDocumentsView({ productId, documents, isOwner, onBack }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['product-documents', productId] });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return documents;
    return documents.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [documents, search]);

  const addRow = async () => {
    const { error } = await supabase.from('product_documents' as 'clients').insert({
      product_id: productId,
      name: 'Novo documento',
      sort_order: documents.length,
    } as never);
    if (error) toast.error('Erro ao adicionar');
    else { toast.success('Linha adicionada'); refresh(); }
  };

  const updateField = async (id: string, patch: Partial<ProductDocument>) => {
    const { error } = await supabase.from('product_documents' as 'clients').update(patch as never).eq('id', id);
    if (error) toast.error('Erro ao atualizar');
    else refresh();
  };

  const deleteRow = async (doc: ProductDocument) => {
    if (!(await confirmDestructive())) return;
    if (doc.file_path) {
      await supabase.storage.from('product-files').remove([doc.file_path]);
    }
    const { error } = await supabase.from('product_documents' as 'clients').delete().eq('id', doc.id);
    if (error) toast.error('Erro ao eliminar');
    else { toast.success('Removido'); refresh(); }
  };

  const handleUpload = async (doc: ProductDocument, file: File) => {
    const path = `documents/${productId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('product-files').upload(path, file);
    if (upErr) { toast.error('Erro ao enviar ficheiro'); return; }
    const { data: urlData } = supabase.storage.from('product-files').getPublicUrl(path);
    if (doc.file_path) {
      await supabase.storage.from('product-files').remove([doc.file_path]);
    }
    await updateField(doc.id, {
      file_url: urlData.publicUrl,
      file_path: path,
      file_type: file.type || 'application/octet-stream',
      name: doc.name === 'Novo documento' ? file.name : doc.name,
    });
    toast.success('Ficheiro carregado');
  };

  const addTag = (doc: ProductDocument, tag: string) => {
    const t = tag.trim();
    if (!t) return;
    const tags = Array.from(new Set([...(doc.tags || []), t]));
    updateField(doc.id, { tags });
  };

  const removeTag = (doc: ProductDocument, tag: string) => {
    updateField(doc.id, { tags: (doc.tags || []).filter(t => t !== tag) });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Arquivo
        </Button>
        {isOwner && (
          <Button size="sm" onClick={addRow} className="gap-2">
            <Plus className="h-4 w-4" /> Novo documento
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou etiqueta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Nome</TableHead>
              <TableHead className="w-[24%]">Link</TableHead>
              <TableHead className="w-[18%]">Ficheiro</TableHead>
              <TableHead>Etiquetas</TableHead>
              {isOwner && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 5 : 4} className="text-center text-muted-foreground py-8 text-sm">
                  Sem documentos. {isOwner && 'Clica em "Novo documento" para começar.'}
                </TableCell>
              </TableRow>
            ) : filtered.map(doc => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isOwner={isOwner}
                onUpdate={(patch) => updateField(doc.id, patch)}
                onDelete={() => deleteRow(doc)}
                onUpload={(file) => handleUpload(doc, file)}
                onAddTag={(tag) => addTag(doc, tag)}
                onRemoveTag={(tag) => removeTag(doc, tag)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DocumentRow({ doc, isOwner, onUpdate, onDelete, onUpload, onAddTag, onRemoveTag }: {
  doc: ProductDocument;
  isOwner: boolean;
  onUpdate: (patch: Partial<ProductDocument>) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState('');

  return (
    <TableRow>
      <TableCell>
        <Input
          defaultValue={doc.name}
          onBlur={e => e.target.value !== doc.name && onUpdate({ name: e.target.value })}
          readOnly={!isOwner}
          className="h-8 border-none shadow-none focus-visible:ring-1"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            placeholder="https://..."
            defaultValue={doc.url || ''}
            onBlur={e => e.target.value !== (doc.url || '') && onUpdate({ url: e.target.value || null })}
            readOnly={!isOwner}
            className="h-8 border-none shadow-none focus-visible:ring-1"
          />
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>
        {doc.file_url ? (
          <div className="flex items-center gap-1">
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[140px]">
              Ver ficheiro
            </a>
            {isOwner && (
              <label className="cursor-pointer">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <span><Upload className="h-3 w-3" /></span>
                </Button>
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
              </label>
            )}
          </div>
        ) : isOwner ? (
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="h-7 gap-1" asChild>
              <span><Upload className="h-3 w-3" /> Carregar</span>
            </Button>
            <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {(doc.tags || []).map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              {tag}
              {isOwner && (
                <button onClick={() => onRemoveTag(tag)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
          {isOwner && (
            <Input
              placeholder="+ etiqueta"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  onAddTag(tagInput);
                  setTagInput('');
                }
              }}
              className="h-7 w-24 text-xs border-dashed"
            />
          )}
        </div>
      </TableCell>
      {isOwner && (
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
