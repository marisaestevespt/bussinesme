import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ViewTabs } from '@/components/ViewTabs';
import { useUserViews, type DefaultView } from '@/hooks/useUserViews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { RichTextEditor } from '@/components/RichTextEditor';

const CATEGORIES = [
  { value: 'cultura', label: 'Guia de Cultura' },
  { value: 'conduta', label: 'Código de Conduta' },
  { value: 'comunicacao', label: 'Política de Comunicação Interna' },
  { value: 'confidencialidade', label: 'Política de Confidencialidade & Proteção de Dados' },
  { value: 'glossario', label: 'Glossário Interno' },
  { value: 'outro', label: 'Outro' },
];

export default function BibliotecaPage() {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('outro');
  const [content, setContent] = useState('');

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

  const createDoc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internal_documents').insert({
        title, category, content, created_by: user?.id,
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
      const { error } = await supabase.from('internal_documents')
        .update({ title, category, content })
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
  }

  function openEdit(doc: any) {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setContent(doc.content || '');
  }

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca de Documentos Internos</h1>
          {isOwner && (
            <Button onClick={() => setShowNew(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Documento
            </Button>
          )}
        </div>

        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum documento interno criado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  {isOwner && <TableHead className="w-20">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => (
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(doc); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteDoc.mutate(doc.id); }}>
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
      </div>

      {/* New Document Dialog */}
      <Dialog open={showNew} onOpenChange={v => { if (!v) resetForm(); setShowNew(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Documento Interno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Guia de Cultura" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

      {/* Edit Document Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={v => { if (!v) { setEditingDoc(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
    </AppLayout>
  );
}
