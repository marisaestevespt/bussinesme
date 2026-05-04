import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  STATUS_OPTIONS, FUNNEL_OPTIONS, CONTENT_TYPE_OPTIONS, FORMAT_OPTIONS, OBJECTIVE_OPTIONS,
  getFormatsForChannels,
  type ContentItem, type MarketingChannel, type ContentChannelLink, type ContentAttachment,
} from '@/lib/marketing-constants';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Check, Upload, Trash2, FileText, Image as ImageIcon, CalendarIcon, AlertTriangle } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { ContentBodyTemplate } from '@/components/marketing/ContentBodyTemplate';
import { ContentComments } from '@/components/marketing/ContentComments';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyHint, InlineLoader } from '@/components/ui/loading-skeletons';

export default function ConteudoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [form, setForm] = useState({
    title: '', scheduled_at: null as string | null, status: 'por_planear',
    funnel_stage: '', content_type: '', format: '', objective: '',
    product_name: '', product_id: '', project_id: '', assigned_to: '', copy_content: '',
    body_template: null as Record<string, any> | null,
    account_id: '' as string,
  });
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showResponsibleReminder, setShowResponsibleReminder] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['content-item', id],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*').eq('id', id!).maybeSingle() as { data: ContentItem | null };
      return data;
    },
    enabled: !!id,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const { data: channelAccounts = [] } = useQuery({
    queryKey: ['marketing-channel-accounts-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_channel_accounts' as any)
        .select('id, channel_id, handle, label')
        .order('sort_order');
      return (data || []) as unknown as Array<{ id: string; channel_id: string; handle: string; label: string | null }>;
    },
  });

  const { data: itemChannelLinks = [] } = useQuery({
    queryKey: ['content-item-channels', id],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*').eq('content_id', id!) as { data: ContentChannelLink[] | null };
      return data || [];
    },
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['content-attachments', id],
    queryFn: async () => {
      const { data } = await supabase.from('content_attachments').select('*').eq('content_id', id!).order('created_at') as { data: ContentAttachment[] | null };
      return data || [];
    },
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').is('archived_at', null);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').order('name');
      return data || [];
    },
  });

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title, scheduled_at: item.scheduled_at, status: item.status,
        funnel_stage: item.funnel_stage || '', content_type: item.content_type || '',
        format: item.format || '', objective: item.objective || '',
        product_name: item.product_name || '', product_id: (item as any).product_id || '',
        project_id: item.project_id || '',
        assigned_to: item.assigned_to || '', copy_content: item.copy_content || '',
        body_template: (item as any).body_template || null,
        account_id: (item as any).account_id || '',
      });
    }
  }, [item]);

  useEffect(() => {
    setSelectedChannels(itemChannelLinks.map(l => l.channel_id));
  }, [itemChannelLinks]);

  const getStatusLabel = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt?.label || status;
  };

  const syncContentTask = async (contentId: string, contentTitle: string, status: string, assignedTo: string | null) => {
    // Find existing active task for this content
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id, assigned_to, status')
      .eq('content_id', contentId)
      .neq('status', 'done');

    const taskName = `[Conteúdo] ${contentTitle} — ${getStatusLabel(status)}`;

    if (existingTasks && existingTasks.length > 0) {
      // Update existing task: reassign + update name with current phase
      const task = existingTasks[0];
      await supabase.from('tasks').update({
        name: taskName,
        assigned_to: assignedTo || task.assigned_to,
        tag: 'Conteúdo',
        updated_at: new Date().toISOString(),
      } as any).eq('id', task.id);
    } else if (assignedTo) {
      // Create new task linked to content
      await supabase.from('tasks').insert({
        name: taskName,
        assigned_to: assignedTo,
        content_id: contentId,
        tag: 'Conteúdo',
        department: 'marketing',
        status: 'por_comecar',
        priority: 'media',
      } as any);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const firstImage = attachments.find(a => a.file_type === 'image');
      const autoCover = firstImage?.file_url || null;
      const { error: updateErr } = await supabase.from('content_items').update({
        title: form.title, scheduled_at: form.scheduled_at, status: form.status,
        funnel_stage: form.funnel_stage || null, content_type: form.content_type || null,
        format: form.format || null, objective: form.objective || null,
        product_name: form.product_name || null, product_id: form.product_id || null,
        project_id: form.project_id || null,
        assigned_to: form.assigned_to || null, copy_content: form.copy_content || null,
        cover_url: autoCover,
        body_template: form.body_template || null,
        account_id: form.account_id || null,
      } as any).eq('id', id);
      if (updateErr) throw updateErr;
      await supabase.from('content_channels').delete().eq('content_id', id);
      if (selectedChannels.length > 0) {
        await supabase.from('content_channels').insert(
          selectedChannels.map(chId => ({ content_id: id, channel_id: chId })) as any
        );
      }

      // Sync content task (create or update)
      if (form.status !== 'publicado') {
        await syncContentTask(id, form.title, form.status, form.assigned_to || null);
      } else {
        // Mark task as done when content is published
        const { data: activeTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('content_id', id)
          .neq('status', 'done');
        if (activeTasks?.length) {
          await supabase.from('tasks').update({
            status: 'done',
            updated_at: new Date().toISOString(),
          }).eq('id', activeTasks[0].id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['content-item', id] });
      queryClient.invalidateQueries({ queryKey: ['content-item-channels', id] });
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      queryClient.invalidateQueries({ queryKey: ['content-channels'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Guardado');
    } catch (err: any) {
      console.error('Content save error:', err);
      toast.error(err?.message || 'Erro ao guardar conteúdo');
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'file') => {
    if (!e.target.files?.length || !id) return;
    setUploading(true);
    let firstUploadedUrl: string | null = null;
    for (const file of Array.from(e.target.files)) {
      const path = `${id}/${fileType}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('content-files').upload(path, file);
      if (error) { toast.error(`Erro: ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('content-files').getPublicUrl(path);
      await supabase.from('content_attachments').insert({
        content_id: id, file_url: publicUrl, file_name: file.name, file_type: fileType,
      } as any);
      if (fileType === 'image' && !firstUploadedUrl) firstUploadedUrl = publicUrl;
    }
    // Auto-set cover_url to the first image if there isn't one yet, so the
    // gallery card on Secretária shows the cover immediately (no need to
    // press "Guardar" first).
    if (fileType === 'image' && firstUploadedUrl) {
      const currentCover = (item as any)?.cover_url;
      const hasExistingImage = attachments.some(a => a.file_type === 'image');
      if (!currentCover || !hasExistingImage) {
        await supabase.from('content_items').update({ cover_url: firstUploadedUrl } as any).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['content-item', id] });
        queryClient.invalidateQueries({ queryKey: ['content-items'] });
        queryClient.invalidateQueries({ queryKey: ['my-content-items'] });
        queryClient.invalidateQueries({ queryKey: ['month-all-content'] });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['content-attachments', id] });
    setUploading(false);
    toast.success('Carregado');
    e.target.value = '';
  };

  const deleteAttachment = async (attId: string) => {
    await supabase.from('content_attachments').delete().eq('id', attId);
    queryClient.invalidateQueries({ queryKey: ['content-attachments', id] });
  };

  const images = attachments.filter(a => a.file_type === 'image');
  const files = attachments.filter(a => a.file_type === 'file');
  const statusOpt = STATUS_OPTIONS.find(s => s.value === form.status);

  if (isLoading) return (
    <AppLayout><div className="flex items-center justify-center min-h-screen"><InlineLoader /></div></AppLayout>
  );
  if (!item) return (
    <AppLayout><div className="p-8 text-center text-muted-foreground">Conteúdo não encontrado.</div></AppLayout>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1"><label className="text-xs text-muted-foreground font-medium">{label}</label>{children}</div>
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const existing = form.scheduled_at ? new Date(form.scheduled_at) : new Date();
    date.setHours(existing.getHours(), existing.getMinutes());
    setForm(f => ({ ...f, scheduled_at: date.toISOString() }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    const date = form.scheduled_at ? new Date(form.scheduled_at) : new Date();
    date.setHours(h || 0, m || 0);
    setForm(f => ({ ...f, scheduled_at: date.toISOString() }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <EntityHeroHeader
          icon={parseIcon((item as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('content_items').update({ icon: next as any } as any).eq('id', id!);
            queryClient.invalidateQueries({ queryKey: ['content-item', id] });
          }}
          coverUrl={(item as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('content_items').update({ cover_url: url } as any).eq('id', id!);
            queryClient.invalidateQueries({ queryKey: ['content-item', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`content/${id}`}
          disabled={!isOwner}
        />
        <div className="w-full py-8 px-6 flex flex-col items-center gap-1" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>Conteúdo</p>
          {statusOpt && <Badge className={cn("text-xs", statusOpt.color)}>{statusOpt.label}</Badge>}
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar conteúdo?',
                  description: 'Métricas, anexos e canais associados serão eliminados permanentemente.',
                  confirmText: 'Eliminar',
                  variant: 'destructive',
                });
                if (!ok) return;
                const { error: errChannels } = await supabase.from('content_channels').delete().eq('content_id', id!);
                const { error: errMetrics } = await supabase.from('content_metrics').delete().eq('content_id', id!);
                const { error: errAttach } = await supabase.from('content_attachments').delete().eq('content_id', id!);
                const { error } = await supabase.from('content_items').delete().eq('id', id!);
                if (error) { toast.error('Erro ao eliminar conteúdo'); return; }
                queryClient.invalidateQueries({ queryKey: ['content-items'] });
                toast.success('Conteúdo eliminado');
                navigate('/hub/marketing');
              }}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </div>

          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="text-2xl font-bold border-0 px-0 h-auto focus-visible:ring-0 mb-6" placeholder="Título do conteúdo" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main */}
            <div className="lg:col-span-2 space-y-6">
              {/* Designs Finais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Designs Finais</h3>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild><span><ImageIcon className="h-3.5 w-3.5 mr-1" />Adicionar</span></Button>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => uploadFiles(e, 'image')} disabled={uploading} />
                  </label>
                </div>
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border">
                        {idx === 0 && (
                          <Badge className="absolute top-2 left-2 z-10 text-[9px] bg-primary text-primary-foreground">Capa</Badge>
                        )}
                        <img src={img.file_url} alt={img.file_name} className="w-full aspect-square object-cover" />
                        <Button variant="destructive" aria-label="Eliminar" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteAttachment(img.id)}><Trash2 className="h-3 w-3" /></Button>
                        <p className="text-[10px] text-muted-foreground p-1 truncate">{img.file_name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground/40">
                      <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-xs">Nenhum design carregado</p>
                      <p className="text-[10px]">A 1ª imagem será usada como capa</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Format-based Template */}
              {form.format && (
                <>
                  <ContentBodyTemplate
                    format={form.format}
                    value={form.body_template}
                    onChange={val => setForm(f => ({ ...f, body_template: val }))}
                    editable
                  />
                  <Separator />
                </>
              )}


              {/* Ficheiros */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Ficheiros</h3>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild><span><FileText className="h-3.5 w-3.5 mr-1" />Adicionar</span></Button>
                    <input type="file" multiple className="hidden" onChange={e => uploadFiles(e, 'file')} disabled={uploading} />
                  </label>
                </div>
                {files.length > 0 ? (
                  <div className="space-y-2">
                    {files.map(f => (
                      <div key={f.id} className="flex items-center gap-2 group">
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline flex-1 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />{f.file_name}
                        </a>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteAttachment(f.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint>Nenhum ficheiro.</EmptyHint>
                )}
              </div>

              <Separator />

              {/* Copy / Guião */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Copy / Guião</h3>
                <RichTextEditor content={form.copy_content} onChange={v => setForm(f => ({ ...f, copy_content: v }))} editable />
              </div>

              <Separator />

              {/* Comentários */}
              {id && <ContentComments contentItemId={id} />}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
              </Button>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <Field label="Status">
                    <Select value={form.status} onValueChange={v => {
                      setForm(f => ({ ...f, status: v }));
                      setShowResponsibleReminder(true);
                    }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {showResponsibleReminder && (
                      <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-warning/15 border border-warning/30 dark:bg-warning/30 dark:border-warning">
                        <AlertTriangle className="h-4 w-4 text-warning dark:text-warning shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-warning dark:text-warning">O responsável de fase continua o mesmo?</p>
                          <p className="text-[10px] text-warning dark:text-warning mt-0.5">Confirma que o responsável de fase está correto para este novo status.</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-warning dark:text-warning hover:bg-warning/15 dark:hover:bg-warning/20"
                          onClick={() => setShowResponsibleReminder(false)}>OK</Button>
                      </div>
                    )}
                  </Field>

                  <Field label="Data e Hora">
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
                            <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                            {form.scheduled_at ? format(new Date(form.scheduled_at), 'dd/MM/yyyy', { locale: pt }) : 'Data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={form.scheduled_at ? new Date(form.scheduled_at) : undefined}
                            onSelect={handleDateSelect} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <Input type="time" className="h-9 w-24"
                        value={form.scheduled_at ? format(new Date(form.scheduled_at), 'HH:mm') : ''}
                        onChange={handleTimeChange} />
                    </div>
                  </Field>

                  <Field label="Canais">
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {channels.filter(c => c.is_active).map(ch => (
                        <label key={ch.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={selectedChannels.includes(ch.id)}
                            onCheckedChange={checked => setSelectedChannels(prev =>
                              checked ? [...prev, ch.id] : prev.filter(i => i !== ch.id)
                            )} />
                          {ch.name}
                        </label>
                      ))}
                    </div>
                  </Field>

                  {(() => {
                    const availableAccounts = channelAccounts.filter(a => selectedChannels.includes(a.channel_id));
                    if (availableAccounts.length === 0) return null;
                    return (
                      <Field label="Conta">
                        <Select value={form.account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, account_id: v === 'none' ? '' : v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Sem conta específica" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem conta específica</SelectItem>
                            {availableAccounts.map(acc => {
                              const ch = channels.find(c => c.id === acc.channel_id);
                              const label = `${ch?.name || ''} · ${acc.handle}${acc.label ? ` (${acc.label})` : ''}`;
                              return <SelectItem key={acc.id} value={acc.id}>{label}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                    );
                  })()}

                  <Field label="Etapa de Funil">
                    <Select value={form.funnel_stage} onValueChange={v => setForm(f => ({ ...f, funnel_stage: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {FUNNEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Tipo de Conteúdo">
                    <Select value={form.content_type} onValueChange={v => setForm(f => ({ ...f, content_type: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Formato">
                    <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {getFormatsForChannels(
                          (selectedChannels.length > 0
                            ? selectedChannels.map(chId => channels.find(c => c.id === chId)?.name || '').filter(Boolean)
                            : channels.filter(c => c.is_active).map(c => c.name)
                          )
                        ).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Objetivo">
                    <Select value={form.objective} onValueChange={v => setForm(f => ({ ...f, objective: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {OBJECTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Produto associado">
                    <Select value={form.product_id} onValueChange={v => {
                      const prod = products.find((p: any) => p.id === v);
                      setForm(f => ({ ...f, product_id: v, product_name: prod?.name || '' }));
                    }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Projeto">
                    <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Responsável de Fase">
                    <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
