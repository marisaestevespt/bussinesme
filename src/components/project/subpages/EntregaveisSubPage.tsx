import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Upload, Download, Trash2 } from 'lucide-react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  entregaveisText: string;
  onTextChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  onBack: () => void;
}

export function EntregaveisSubPage({ projectId, entregaveisText, onTextChange, onSave, saving, dirty, onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data: files = [], refetch } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('project-files').list(projectId, { sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
    },
  });

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const path = `${projectId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('project-files').upload(path, file);
        if (error) throw error;
      }
      toast.success(`${arr.length} ficheiro(s) carregado(s)`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar ficheiro');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) uploadFiles(e.target.files); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };

  const handleDelete = async (fileName: string) => {
    const { error } = await supabase.storage.from('project-files').remove([`${projectId}/${fileName}`]);
    if (error) { toast.error(error.message); return; }
    toast.success('Ficheiro eliminado');
    refetch();
  };

  const getFileUrl = (fileName: string) => supabase.storage.from('project-files').getPublicUrl(`${projectId}/${fileName}`).data.publicUrl;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
    return '📎';
  };

  const displayName = (name: string) => name.replace(/^\d+_/, '');

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <h2 className="text-xl font-bold">Entregáveis</h2>
          </div>
          <div>
            <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'A carregar...' : 'Carregar ficheiros'}
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Notas, links e descrição dos entregáveis</Label>
          <MentionTextarea value={entregaveisText} onChange={onTextChange} rows={6} placeholder="Descreve os entregáveis, adiciona links, referências..." />
        </div>

        {dirty && <Button onClick={onSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>}

        <Separator />

        <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
          <Label className="text-xs text-muted-foreground mb-2 block">Ficheiros</Label>
          {files.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl transition-colors cursor-pointer", dragging ? "border-primary bg-primary/5" : "border-border")} onClick={() => fileInputRef.current?.click()}>
              <Upload className={cn("h-10 w-10 mb-3 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm text-muted-foreground">{dragging ? 'Larga os ficheiros aqui' : 'Arrasta ficheiros ou clica para carregar'}</p>
              <p className="text-xs text-muted-foreground mt-1">Suporta qualquer tipo de ficheiro</p>
            </div>
          ) : (
            <>
              <div className={cn("border rounded-lg divide-y divide-border mb-3", dragging && "ring-2 ring-primary")}>
                {files.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 border border-border/50 transition-colors">
                    <span className="text-lg">{getFileIcon(f.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName(f.name)}</p>
                      <p className="text-xs text-muted-foreground">{f.metadata?.size ? formatFileSize(f.metadata.size) : ''} {f.created_at ? `• ${format(new Date(f.created_at), 'd MMM yyyy', { locale: pt })}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={getFileUrl(f.name)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Download className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(f.name)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              {dragging && (
                <div className="flex items-center justify-center py-4 text-sm text-primary font-medium border-2 border-dashed border-primary rounded-lg bg-primary/5">
                  <Upload className="h-4 w-4 mr-2" /> Larga os ficheiros aqui
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}