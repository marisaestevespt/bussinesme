import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  /** Optional list of category suggestions for this page. */
  categories?: string[];
  /** Empty state title/description. */
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

export function ProjectAssetGallery({ projectId, pageKey, categories = [], emptyTitle = 'Sem ficheiros nem links', emptyDescription = 'Carrega ficheiros ou adiciona links externos para começar.' }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '', category: '' });
  const [filterCat, setFilterCat] = useState<string>('all');

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
  const filtered = filterCat === 'all' ? assets : assets.filter(a => (a.category || '') === filterCat);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const path = `${projectId}/${pageKey}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('project-assets').upload(path, file);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from('project_assets').insert({
          project_id: projectId,
          page_key: pageKey,
          kind: 'file',
          title: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${arr.length} ficheiro(s) carregado(s)`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkForm.title.trim() || !linkForm.url.trim()) throw new Error('Título e URL obrigatórios');
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

  const updateCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string | null }) => {
      const { error } = await supabase.from('project_assets').update({ category }).eq('id', id);
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

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInputRef} type="file" multiple onChange={e => e.target.files && uploadFiles(e.target.files)} className="hidden" />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
          <Upload className="h-3.5 w-3.5" /> {uploading ? 'A carregar...' : 'Carregar ficheiros'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)} className="gap-2">
          <LinkIcon className="h-3.5 w-3.5" /> Adicionar link
        </Button>
        {allCategories.length > 0 && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-8 w-[180px] ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Drop zone / grid */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'rounded-xl border border-dashed border-border/70 transition-colors',
          dragging && 'border-primary bg-primary/5',
          filtered.length === 0 && 'p-10 text-center'
        )}
      >
        {filtered.length === 0 ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center w-full text-muted-foreground hover:text-foreground transition-colors">
            <Upload className={cn('h-10 w-10 mb-3', dragging && 'text-primary')} />
            <p className="text-sm font-medium">{dragging ? 'Larga aqui' : emptyTitle}</p>
            <p className="text-xs mt-1">{emptyDescription}</p>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {filtered.map(a => {
              const Icon = a.kind === 'link' ? ExternalLink : fileIcon(a.mime_type, a.title);
              return (
                <div key={a.id} className="group relative flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 hover:border-border hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className={cn('rounded-md p-2 ring-1 shrink-0', a.kind === 'link' ? 'bg-blue-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-muted ring-border text-foreground/70')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => openAsset(a)} className="text-left w-full">
                        <p className="text-sm font-medium leading-tight truncate group-hover:text-primary transition-colors">{a.title}</p>
                      </button>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        {a.kind === 'file' && a.size_bytes && <span>{formatSize(a.size_bytes)}</span>}
                        <span>{format(new Date(a.created_at), 'd MMM yyyy', { locale: pt })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    {/* Category quick edit */}
                    <Input
                      defaultValue={a.category || ''}
                      placeholder="+ categoria"
                      list={`cats-${pageKey}`}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v !== (a.category || '')) updateCategory.mutate({ id: a.id, category: v || null });
                      }}
                      className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-1"
                    />
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openAsset(a)}>
                        {a.kind === 'link' ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteAsset.mutate(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {a.category && (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 py-0">{a.category}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <datalist id={`cats-${pageKey}`}>
        {allCategories.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* Add link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar link</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Título *</Label>
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