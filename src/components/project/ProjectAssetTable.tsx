import { useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Link as LinkIcon, Download, Trash2, ExternalLink, FileText, Image as ImageIcon, FileVideo, FileArchive, File as FileIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Asset {
  id: string;
  project_id: string;
  page_key: string;
  kind: 'file' | 'link';
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  category: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  pageKey: string;
  categories?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
}

function fileIcon(mime: string | null, name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return ImageIcon;
  if (mime?.startsWith('video/') || ['mp4','mov','avi','mkv'].includes(ext)) return FileVideo;
  if (['zip','rar','7z','tar','gz'].includes(ext)) return FileArchive;
  if (['pdf','doc','docx','txt','md'].includes(ext)) return FileText;
  return FileIcon;
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectAssetTable({ projectId, pageKey, categories = [], emptyTitle = 'Sem ficheiros nem links', emptyDescription = 'Carrega ficheiros ou adiciona links externos para começar.' }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload dialog state
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileForm, setFileForm] = useState<{ title: string; description: string; category: string }>({ title: '', description: '', category: '' });
  const [uploading, setUploading] = useState(false);

  // Link dialog state
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '', category: '' });

  const { data: assets = [], refetch } = useQuery({
    queryKey: ['project-assets', projectId, pageKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assets')
        .select('*')
        .eq('project_id', projectId)
        .eq('page_key', pageKey)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Asset[];
    },
  });

  const allCategories = Array.from(new Set([...categories, ...assets.map(a => a.category).filter(Boolean) as string[]]));

  const handleFilePicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setPendingFiles(arr);
    setFileForm({
      title: arr.length === 1 ? arr[0].name.replace(/\.[^.]+$/, '') : '',
      description: '',
      category: '',
    });
    setFileDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUpload = async () => {
    if (pendingFiles.length === 0) return;
    if (pendingFiles.length === 1 && !fileForm.title.trim()) {
      toast.error('Dá um nome ao ficheiro');
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const path = `${projectId}/${pageKey}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('project-assets').upload(path, file);
        if (upErr) throw upErr;
        const title = pendingFiles.length === 1
          ? fileForm.title.trim()
          : file.name;
        const { error: insErr } = await supabase.from('project_assets').insert({
          project_id: projectId,
          page_key: pageKey,
          kind: 'file',
          title,
          description: fileForm.description.trim() || null,
          category: fileForm.category.trim() || null,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${pendingFiles.length} ficheiro(s) carregado(s)`);
      setFileDialogOpen(false);
      setPendingFiles([]);
      setFileForm({ title: '', description: '', category: '' });
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar');
    } finally {
      setUploading(false);
    }
  };

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkForm.title.trim() || !linkForm.url.trim()) throw new Error('Nome e URL obrigatórios');
      const url = linkForm.url.startsWith('http') ? linkForm.url : `https://${linkForm.url}`;
      const { error } = await supabase.from('project_assets').insert({
        project_id: projectId,
        page_key: pageKey,
        kind: 'link',
        title: linkForm.title.trim(),
        url,
        description: linkForm.description.trim() || null,
        category: linkForm.category.trim() || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Link adicionado');
      setLinkOpen(false);
      setLinkForm({ title: '', url: '', description: '', category: '' });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Asset> }) => {
      const { error } = await supabase.from('project_assets').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const deleteAsset = useMutation({
    mutationFn: async (a: Asset) => {
      await requireConfirm();
      if (a.kind === 'file' && a.storage_path) {
        await supabase.storage.from('project-assets').remove([a.storage_path]);
      }
      const { error } = await supabase.from('project_assets').delete().eq('id', a.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Removido'); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fileUrl = (a: Asset) => a.storage_path
    ? supabase.storage.from('project-assets').createSignedUrl(a.storage_path, 60 * 60).then(r => r.data?.signedUrl)
    : Promise.resolve(a.url || '');

  const openAsset = async (a: Asset) => {
    const url = await fileUrl(a);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInputRef} type="file" multiple onChange={e => handleFilePicked(e.target.files)} className="hidden" />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-3.5 w-3.5" /> Carregar ficheiros
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)} className="gap-2">
          <LinkIcon className="h-3.5 w-3.5" /> Adicionar link
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-muted-foreground">
          <Upload className="h-10 w-10 mb-3 mx-auto" />
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="text-xs mt-1">{emptyDescription}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Origem</TableHead>
                <TableHead className="hidden lg:table-cell w-[160px]">Categoria</TableHead>
                <TableHead className="hidden md:table-cell w-[110px]">Data</TableHead>
                <TableHead className="hidden sm:table-cell w-[80px] text-right">Tamanho</TableHead>
                <TableHead className="w-[90px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(a => {
                const Icon = a.kind === 'link' ? ExternalLink : fileIcon(a.mime_type, a.title);
                return (
                  <TableRow key={a.id} className="group">
                    <TableCell>
                      <div className={cn('rounded-md p-1.5 ring-1 inline-flex', a.kind === 'link' ? 'bg-blue-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-muted ring-border text-foreground/70')}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={a.title}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          if (v && v !== a.title) updateField.mutate({ id: a.id, patch: { title: v } });
                        }}
                        className="h-8 border-0 bg-transparent px-1 focus-visible:ring-1 font-medium"
                      />
                      {a.description && <p className="text-xs text-muted-foreground px-1 mt-0.5 line-clamp-1">{a.description}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.kind === 'link' ? (
                        <a href={a.url || '#'} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary truncate inline-block max-w-[220px] align-middle">
                          {a.url}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ficheiro</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Input
                        defaultValue={a.category || ''}
                        placeholder="—"
                        list={`cats-${pageKey}`}
                        onBlur={e => {
                          const v = e.target.value.trim();
                          if (v !== (a.category || '')) updateField.mutate({ id: a.id, patch: { category: v || null } });
                        }}
                        className="h-8 border-0 bg-transparent px-1 focus-visible:ring-1 text-xs"
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(a.created_at), 'd MMM yyyy', { locale: pt })}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                      {a.kind === 'file' ? formatSize(a.size_bytes) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openAsset(a)}>
                          {a.kind === 'link' ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteAsset.mutate(a)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <datalist id={`cats-${pageKey}`}>
        {allCategories.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* File upload dialog (asks for name before upload) */}
      <Dialog open={fileDialogOpen} onOpenChange={(o) => { if (!o && !uploading) { setFileDialogOpen(false); setPendingFiles([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Carregar {pendingFiles.length > 1 ? `${pendingFiles.length} ficheiros` : 'ficheiro'}</DialogTitle>
            <DialogDescription>
              {pendingFiles.length === 1
                ? 'Confirma o nome e adiciona detalhes opcionais antes de carregar.'
                : 'Os nomes serão os dos ficheiros. Categoria e descrição aplicam-se a todos.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingFiles.length === 1 && (
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={fileForm.title} onChange={e => setFileForm({ ...fileForm, title: e.target.value })} placeholder="Nome a apresentar" />
                <p className="text-[11px] text-muted-foreground mt-1 truncate">Ficheiro: {pendingFiles[0]?.name}</p>
              </div>
            )}
            {pendingFiles.length > 1 && (
              <div className="rounded-md bg-muted/50 p-2 max-h-32 overflow-y-auto space-y-0.5">
                {pendingFiles.map((f, i) => <p key={i} className="text-xs text-muted-foreground truncate">{f.name}</p>)}
              </div>
            )}
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={fileForm.description} onChange={e => setFileForm({ ...fileForm, description: e.target.value })} placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={fileForm.category} onChange={e => setFileForm({ ...fileForm, category: e.target.value })} placeholder="Opcional" list={`cats-${pageKey}`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setFileDialogOpen(false); setPendingFiles([]); }} disabled={uploading}>Cancelar</Button>
            <Button onClick={confirmUpload} disabled={uploading} className="gap-1">
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'A carregar...' : 'Carregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar link</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={linkForm.title} onChange={e => setLinkForm({ ...linkForm, title: e.target.value })} placeholder="Ex: Briefing no Notion" />
            </div>
            <div>
              <Label className="text-xs">URL *</Label>
              <Input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={linkForm.category} onChange={e => setLinkForm({ ...linkForm, category: e.target.value })} placeholder="Opcional" list={`cats-${pageKey}`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button onClick={() => addLink.mutate()} disabled={addLink.isPending} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}