import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Trash2, Pencil, Search, Upload, Link2, ExternalLink, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { RichTextEditor } from '@/components/RichTextEditor';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const DEFAULT_CATEGORIES = [
  { value: 'cultura', label: 'Guia de Cultura' },
  { value: 'conduta', label: 'Código de Conduta' },
  { value: 'comunicacao', label: 'Política de Comunicação Interna' },
  { value: 'confidencialidade', label: 'Política de Confidencialidade & Proteção de Dados' },
  { value: 'glossario', label: 'Glossário Interno' },
  { value: 'outro', label: 'Outro' },
];

export function BibliotecaSection() {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('outro');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ['internal_documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_documents')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const allCategories = useMemo(() => {
    const existing = new Set(DEFAULT_CATEGORIES.map(c => c.value));
    const extras: { value: string; label: string }[] = [];
    documents.forEach(d => {
      if (d.category && !existing.has(d.category)) {
        existing.add(d.category);
        extras.push({ value: d.category, label: d.category });
      }
    });
    return [...DEFAULT_CATEGORIES, ...extras];
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(d => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  const createDoc = useMutation({
    mutationFn: async () => {
      const finalUrl = fileUrl || linkUrl || null;
      const docType = fileUrl ? 'ficheiro' : linkUrl ? 'link' : 'texto';
      const { error } = await supabase.from('internal_documents').insert({
        title, category, content, created_by: user?.id, file_url: finalUrl, doc_type: docType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal_documents'] });
      setShowNew(false);
      resetForm();
      toast.success('Documento criado');
    },
    onError: () => toast.error('Erro ao criar documento'),
  });

  const updateDoc = useMutation({
    mutationFn: async () => {
      const finalUrl = fileUrl || linkUrl || null;
      const docType = fileUrl ? 'ficheiro' : linkUrl ? 'link' : 'texto';
      const { error } = await supabase.from('internal_documents')
        .update({ title, category, content, file_url: finalUrl, doc_type: docType })
        .eq('id', editingDoc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal_documents'] });
      setEditingDoc(null);
      resetForm();
      toast.success('Documento atualizado');
    },
    onError: () => toast.error('Erro ao atualizar documento'),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('internal_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal_documents'] });
      toast.success('Documento eliminado');
    },
  });

  function resetForm() {
    setTitle('');
    setCategory('outro');
    setContent('');
    setNewCategory('');
    setFileUrl('');
    setLinkUrl('');
  }

  function openEdit(doc: any) {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setContent(doc.content || '');
    setNewCategory('');
    setFileUrl(doc.doc_type === 'ficheiro' ? (doc.file_url || '') : '');
    setLinkUrl(doc.doc_type === 'link' ? (doc.file_url || '') : '');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('library-files').upload(path, file);
    if (error) { toast.error('Erro ao fazer upload'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(path);
    setFileUrl(urlData.publicUrl);
    setUploading(false);
    toast.success('Ficheiro carregado');
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    setCategory(trimmed);
    setNewCategory('');
  }

  const getCategoryLabel = (val: string) => allCategories.find(c => c.value === val)?.label || val;

  const categorySelector = (
    <div className="space-y-2">
      <Label>Categoria</Label>
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {allCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          placeholder="Nova categoria..."
          className="h-8 text-sm"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
        />
        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleAddCategory} disabled={!newCategory.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const fileAndLinkFields = (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Ficheiro</Label>
        {fileUrl ? (
          <div className="flex items-center gap-2 mt-1 p-2 rounded-md bg-muted/30 border border-border/50 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">
              {fileUrl.split('/').pop()}
            </a>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setFileUrl('')}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="mt-1">
            <Input type="file" onChange={handleFileUpload} disabled={uploading} className="h-9 text-sm" />
            {uploading && <p className="text-xs text-muted-foreground mt-1">A carregar...</p>}
          </div>
        )}
      </div>
      <div>
        <Label className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Link externo</Label>
        <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="mt-1" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="kpi-display-sm mt-1">Biblioteca de Documentos Internos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Cultura, políticas, glossário e outros documentos internos da equipa.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar documento..."
              className="pl-9 h-9"
            />
          </div>
          {isOwner && (
            <Button onClick={() => setShowNew(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Documento
            </Button>
          )}
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{search ? 'Nenhum documento encontrado.' : 'Nenhum documento interno criado.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead>Última Atualização</TableHead>
                {isOwner && <TableHead className="w-20">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map(doc => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(doc)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary hover:underline">
                        {doc.doc_type === 'link' ? <><ExternalLink className="h-3.5 w-3.5" /> Link</> : <><Download className="h-3.5 w-3.5" /> Ficheiro</>}
                      </a>
                    ) : (
                      <span>Texto</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{getCategoryLabel(doc.category)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(doc.created_at), "d MMM yyyy", { locale: pt })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(doc.updated_at), "d MMM yyyy", { locale: pt })}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(doc); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteDoc.mutate(doc.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={v => { if (!v) resetForm(); setShowNew(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Documento Interno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Guia de Cultura" />
            </div>
            {categorySelector}
            {fileAndLinkFields}
            <div>
              <Label>Conteúdo</Label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>
            <Button className="w-full" disabled={!title.trim()} onClick={() => createDoc.mutate()}>
              Criar Documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDoc} onOpenChange={v => { if (!v) { setEditingDoc(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            {categorySelector}
            {fileAndLinkFields}
            <div>
              <Label>Conteúdo</Label>
              <RichTextEditor content={content} onChange={setContent} editable={isOwner} />
            </div>
            {isOwner && (
              <Button className="w-full" disabled={!title.trim()} onClick={() => updateDoc.mutate()}>
                Guardar Alterações
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}