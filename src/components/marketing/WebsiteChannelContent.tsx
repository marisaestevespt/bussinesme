import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, Plus, Trash2, Upload, Check, Image as ImageIcon, Globe, X,
} from 'lucide-react';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const PAGE_STATUSES = [
  { value: 'por_comecar', label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  { value: 'a_escrever', label: 'A escrever', color: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning' },
  { value: 'em_design', label: 'Em design', color: 'bg-info/15 text-info dark:bg-info/30 dark:text-info' },
  { value: 'pronto', label: 'Pronto', color: 'bg-success/15 text-success dark:bg-success/30 dark:text-success' },
];

interface WebsiteChannelContentProps {
  channelId: string;
  channelName: string;
}

export function WebsiteChannelContent({ channelId, channelName }: WebsiteChannelContentProps) {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [editingPage, setEditingPage] = useState<any>(null);
  const [editCopy, setEditCopy] = useState('');
  const [uploading, setUploading] = useState(false);

  // Fetch website pages
  const { data: pages = [] } = useQuery({
    queryKey: ['website-pages', channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('website_pages')
        .select('*')
        .eq('channel_id', channelId)
        .order('sort_order') as { data: any[] | null };
      return data || [];
    },
  });

  // Fetch files for the editing page
  const { data: pageFiles = [] } = useQuery({
    queryKey: ['website-page-files', editingPage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('website_page_files')
        .select('*')
        .eq('page_id', editingPage!.id)
        .order('created_at', { ascending: false }) as { data: any[] | null };
      return data || [];
    },
    enabled: !!editingPage?.id,
  });

  const createPage = async () => {
    if (!newPageName.trim()) return;
    await supabase.from('website_pages').insert({
      channel_id: channelId, name: newPageName, sort_order: pages.length,
    } as any);
    queryClient.invalidateQueries({ queryKey: ['website-pages', channelId] });
    setShowNewPage(false);
    setNewPageName('');
    toast.success('Página criada');
  };

  const updateStatus = async (pageId: string, status: string) => {
    await supabase.from('website_pages').update({ status } as any).eq('id', pageId);
    queryClient.invalidateQueries({ queryKey: ['website-pages', channelId] });
  };

  const saveCopy = async () => {
    if (!editingPage) return;
    await supabase.from('website_pages').update({ copy_content: editCopy } as any).eq('id', editingPage.id);
    queryClient.invalidateQueries({ queryKey: ['website-pages', channelId] });
    toast.success('Copy guardado');
  };

  const deletePage = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('website_pages').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['website-pages', channelId] });
    toast.success('Página removida');
  };

  const uploadInspiration = async (file: File) => {
    if (!editingPage) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `website/${editingPage.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('content-files').upload(path, file);
    if (error) { toast.error('Erro no upload'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('content-files').getPublicUrl(path);
    const fileType = file.type.startsWith('image/') ? 'image' : 'file';
    await supabase.from('website_page_files').insert({
      page_id: editingPage.id, file_url: urlData.publicUrl, file_name: file.name, file_type: fileType,
    } as any);
    queryClient.invalidateQueries({ queryKey: ['website-page-files', editingPage.id] });
    setUploading(false);
    toast.success('Ficheiro adicionado');
  };

  const deleteFile = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('website_page_files').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['website-page-files', editingPage?.id] });
    toast.success('Ficheiro removido');
  };

  const openPage = (page: any) => {
    setEditingPage(page);
    setEditCopy(page.copy_content || '');
  };

  return (
    <>
      {/* Pages Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Páginas do Website</h2>
          {isOwner && (
            <Button size="sm" onClick={() => setShowNewPage(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Nova Página
            </Button>
          )}
        </div>

        {pages.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground italic">Nenhuma página criada.</CardContent></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Nome da Página</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    {isOwner && <th className="text-right p-3 font-medium text-muted-foreground w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page: any) => {
                    const status = PAGE_STATUSES.find(s => s.value === page.status) || PAGE_STATUSES[0];
                    return (
                      <tr key={page.id} className="border-b last:border-0 hover:bg-muted/20 hq-transition cursor-pointer"
                        onClick={() => openPage(page)}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{page.name}</span>
                          </div>
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          {isOwner ? (
                            <div className="flex gap-1 flex-wrap">
                              {PAGE_STATUSES.map(s => (
                                <Badge key={s.value}
                                  className={cn("text-[10px] cursor-pointer transition-opacity", s.color, page.status !== s.value && "opacity-30 hover:opacity-60")}
                                  onClick={() => updateStatus(page.id, s.value)}>
                                  {s.label}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                          )}
                        </td>
                        {isOwner && (
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={() => deletePage(page.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* New Page Dialog */}
      <Dialog open={showNewPage} onOpenChange={setShowNewPage}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Página do Website</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newPageName} onChange={e => setNewPageName(e.target.value)} placeholder="Nome da página (ex: Home, Sobre, Serviços)"
              onKeyDown={e => e.key === 'Enter' && createPage()} autoFocus />
            <Button className="w-full" disabled={!newPageName.trim()} onClick={createPage}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={!!editingPage} onOpenChange={open => { if (!open) setEditingPage(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {editingPage?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Copy Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Copy da Página</h3>
              <RichTextEditor content={editCopy} onChange={setEditCopy} editable={isOwner} />
              {isOwner && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveCopy}><Check className="h-3.5 w-3.5 mr-1" />Guardar Copy</Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Design Inspirations Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Inspirações de Design</h3>
                {isOwner && (
                  <label className="cursor-pointer">
                    <Button size="sm" variant="outline" asChild>
                      <span>
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {uploading ? 'A carregar...' : 'Carregar'}
                      </span>
                    </Button>
                    <input type="file" className="hidden" accept="image/*,.pdf,.ai,.psd,.fig"
                      onChange={e => { if (e.target.files?.[0]) uploadInspiration(e.target.files[0]); e.target.value = ''; }} />
                  </label>
                )}
              </div>

              {pageFiles.length === 0 ? (
                <EmptyHint>Sem inspirações de design.</EmptyHint>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pageFiles.map((f: any) => (
                    <div key={f.id} className="relative group rounded-lg overflow-hidden border bg-muted/20">
                      {f.file_type === 'image' ? (
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={f.file_url} alt={f.file_name} className="w-full aspect-video object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center aspect-video gap-1 hover:bg-muted/40 transition-colors">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground truncate max-w-[90%]">{f.file_name}</span>
                        </a>
                      )}
                      {isOwner && (
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteFile(f.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
