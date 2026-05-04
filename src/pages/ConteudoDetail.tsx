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
import { Check, Upload, Trash2, FileText, Image as ImageIcon, CalendarIcon, AlertTriangle, GripVertical, ArrowDownAZ } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { ContentBodyTemplate } from '@/components/marketing/ContentBodyTemplate';
import { ContentComments } from '@/components/marketing/ContentComments';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { InlineLoader } from '@/components/ui/loading-skeletons';

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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
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
      const { data } = await supabase
        .from('content_attachments')
        .select('*')
        .eq('content_id', id!)
        .order('sort_order' as any, { ascending: true })
        .order('created_at', { ascending: true }) as { data: ContentAttachment[] | null };
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
    // Determinar próximo sort_order para este tipo
    const sameTypeAttachments = attachments.filter(a => a.file_type === fileType);
    let nextOrder = sameTypeAttachments.length > 0
      ? Math.max(...sameTypeAttachments.map(a => (a as any).sort_order ?? 0)) + 1
      : 0;
    for (const file of Array.from(e.target.files)) {
      const path = `${id}/${fileType}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('content-files').upload(path, file);
      if (error) { toast.error(`Erro: ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('content-files').getPublicUrl(path);
      await supabase.from('content_attachments').insert({
        content_id: id, file_url: publicUrl, file_name: file.name, file_type: fileType,
        sort_order: nextOrder,
      } as any);
      nextOrder += 1;
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

  const applyImageOrder = async (reordered: typeof images) => {
    if (!id) return;
    // Optimistic UI update
    queryClient.setQueryData(['content-attachments', id], (old: any) => {
      if (!old) return old;
      const others = old.filter((a: any) => a.file_type !== 'image');
      const updated = reordered.map((img, idx) => ({ ...img, sort_order: idx }));
      return [...updated, ...others];
    });

    // Persist
    await Promise.all(
      reordered.map((img, idx) =>
        supabase.from('content_attachments').update({ sort_order: idx } as any).eq('id', img.id),
      ),
    );

    // Update cover_url to the new first image immediately
    const newCover = reordered[0]?.file_url || null;
    if (newCover) {
      await supabase.from('content_items').update({ cover_url: newCover } as any).eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['content-item', id] });
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-content-items'] });
      queryClient.invalidateQueries({ queryKey: ['month-all-content'] });
    }
    queryClient.invalidateQueries({ queryKey: ['content-attachments', id] });
  };

  const reorderImages = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || !id) return;
    const ids = images.map(i => i.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...images];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await applyImageOrder(reordered);
  };

  const sortImagesByName = async () => {
    if (images.length < 2) return;
    const sorted = [...images].sort((a, b) =>
      a.file_name.localeCompare(b.file_name, 'pt', { numeric: true, sensitivity: 'base' })
    );
    await applyImageOrder(sorted);
    toast.success('Imagens ordenadas por nome');
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

  // Notion-style row: label fixo à esquerda, valor à direita
  const PropRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-2 border-b border-border/40 last:border-b-0">
      <div className="w-44 shrink-0 text-sm font-medium text-foreground pt-2">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
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
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <div className="flex items-center gap-2">
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
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Check className="h-3.5 w-3.5 mr-1" />{saving ? 'A guardar...' : 'Guardar'}
            </Button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="text-2xl md:text-3xl font-bold border-0 px-0 h-auto focus-visible:ring-0 mb-6 leading-tight" placeholder="Título do conteúdo" />

          {/* Propriedades — campos principais */}
          <div className="mb-8 rounded-xl border border-border/60 bg-card px-5 py-2">
            <PropRow label="Status">
              <Select value={form.status} onValueChange={v => {
                setForm(f => ({ ...f, status: v }));
                setShowResponsibleReminder(true);
              }}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {showResponsibleReminder && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-warning/15 border border-warning/30 dark:bg-warning/30 dark:border-warning">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-warning">O responsável de fase continua o mesmo?</p>
                    <p className="text-[10px] text-warning mt-0.5">Confirma que o responsável de fase está correto para este novo status.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-warning hover:bg-warning/15"
                    onClick={() => setShowResponsibleReminder(false)}>OK</Button>
                </div>
              )}
            </PropRow>

            <PropRow label="Data e Hora">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex-1 justify-start text-sm font-normal hover:bg-muted/50 -ml-2">
                      <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                      {form.scheduled_at ? format(new Date(form.scheduled_at), 'dd/MM/yyyy', { locale: pt }) : 'Data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.scheduled_at ? new Date(form.scheduled_at) : undefined}
                      onSelect={handleDateSelect} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Input type="time" className="h-9 w-24 border-0 hover:bg-muted/50 focus-visible:ring-0"
                  value={form.scheduled_at ? format(new Date(form.scheduled_at), 'HH:mm') : ''}
                  onChange={handleTimeChange} />
              </div>
            </PropRow>

            <PropRow label="Canais">
              <div className="flex flex-wrap gap-1.5 py-2">
                {channels.filter(c => c.is_active).map(ch => {
                  const checked = selectedChannels.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannels(prev => checked ? prev.filter(i => i !== ch.id) : [...prev, ch.id])}
                      className={cn(
                        'text-xs px-2 py-1 rounded-md border transition',
                        checked ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60'
                      )}
                    >
                      {ch.name}
                    </button>
                  );
                })}
              </div>
            </PropRow>

            {(() => {
              const availableAccounts = channelAccounts.filter(a => selectedChannels.includes(a.channel_id));
              if (availableAccounts.length === 0) return null;
              return (
                <PropRow label="Conta">
                  <Select value={form.account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, account_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Sem conta específica" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem conta específica</SelectItem>
                      {availableAccounts.map(acc => {
                        const ch = channels.find(c => c.id === acc.channel_id);
                        const label = `${ch?.name || ''} · ${acc.handle}${acc.label ? ` (${acc.label})` : ''}`;
                        return <SelectItem key={acc.id} value={acc.id}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </PropRow>
              );
            })()}

            <PropRow label="Etapa de Funil">
              <Select value={form.funnel_stage} onValueChange={v => setForm(f => ({ ...f, funnel_stage: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>{FUNNEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Tipo de Conteúdo">
              <Select value={form.content_type} onValueChange={v => setForm(f => ({ ...f, content_type: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>{CONTENT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Formato">
              <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>
                  {getFormatsForChannels(
                    (selectedChannels.length > 0
                      ? selectedChannels.map(chId => channels.find(c => c.id === chId)?.name || '').filter(Boolean)
                      : channels.filter(c => c.is_active).map(c => c.name)
                    )
                  ).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Objetivo">
              <Select value={form.objective} onValueChange={v => setForm(f => ({ ...f, objective: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>{OBJECTIVE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Produto">
              <Select value={form.product_id} onValueChange={v => {
                const prod = products.find((p: any) => p.id === v);
                setForm(f => ({ ...f, product_id: v, product_name: prod?.name || '' }));
              }}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Projeto">
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Vazio" /></SelectTrigger>
                <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Responsável">
              <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                <SelectTrigger className="h-9 border-0 hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-2 -ml-2"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
              </Select>
            </PropRow>

            <PropRow label="Ficheiros">
              <div className="py-1 space-y-1.5">
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {files.map(f => (
                      <div key={f.id} className="group inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted/40 hover:bg-muted/70 border border-transparent hover:border-border/60 transition">
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-foreground hover:text-primary truncate max-w-[220px]">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.file_name}</span>
                        </a>
                        <button
                          type="button"
                          aria-label="Eliminar"
                          onClick={() => deleteAttachment(f.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                  <Upload className="h-3 w-3" />
                  <span>{files.length > 0 ? 'Adicionar ficheiro' : 'Adicionar ficheiros'}</span>
                  <input type="file" multiple className="hidden" onChange={e => uploadFiles(e, 'file')} disabled={uploading} />
                </label>
              </div>
            </PropRow>
          </div>

          {/* Comentários — minimal, logo abaixo dos campos principais */}
          {id && (
            <div className="mb-8 pt-6 border-t border-border/60">
              <ContentComments contentItemId={id} contextLabel={`Conteúdo: ${form.title || 'sem título'}`} />
            </div>
          )}

          <Separator className="mb-6" />

          {/* Conteúdo principal */}
          <div className="space-y-6">
              {/* Designs Finais */}
              <Card className="overflow-hidden border-border/60">
                <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Designs Finais</h3>
                    {images.length > 0 && (
                      <span className="text-xs text-muted-foreground">· {images.length}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {images.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={sortImagesByName} className="text-xs h-8">
                        <ArrowDownAZ className="h-3.5 w-3.5 mr-1" />Ordenar
                      </Button>
                    )}
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild className="h-8"><span><ImageIcon className="h-3.5 w-3.5 mr-1" />Adicionar</span></Button>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => uploadFiles(e, 'image')} disabled={uploading} />
                    </label>
                  </div>
                </div>
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={() => setDragId(img.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverId(img.id); }}
                        onDragLeave={() => setDragOverId(prev => prev === img.id ? null : prev)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragId) reorderImages(dragId, img.id);
                          setDragId(null);
                          setDragOverId(null);
                        }}
                        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                        className={cn(
                          'relative group rounded-lg overflow-hidden border border-border/60 bg-muted/20 cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
                          dragId === img.id && 'opacity-40',
                          dragOverId === img.id && dragId !== img.id && 'ring-2 ring-primary ring-offset-2',
                        )}
                      >
                        {idx === 0 && (
                          <Badge className="absolute top-2 left-2 z-10 text-[9px] px-1.5 py-0 h-4 bg-primary text-primary-foreground shadow">Capa</Badge>
                        )}
                        <div className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 bg-background/85 backdrop-blur rounded p-1 pointer-events-none">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <img src={img.file_url} alt={img.file_name} className="w-full aspect-square object-cover" />
                        <Button variant="destructive" aria-label="Eliminar" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 shadow"
                          onClick={() => deleteAttachment(img.id)}><Trash2 className="h-3 w-3" /></Button>
                        <p className="text-[10px] text-muted-foreground px-1.5 py-1 truncate bg-background/60">{img.file_name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-[3/1] bg-muted/20 rounded-lg flex items-center justify-center border border-dashed border-border/60">
                    <div className="text-center text-muted-foreground/40">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-xs">Nenhum design carregado</p>
                      <p className="text-[10px]">Arrasta para reordenar — a 1ª será a capa</p>
                    </div>
                  </div>
                )}
                </CardContent>
              </Card>

              {/* Format-based Template — cada campo já é o seu próprio card */}
              {form.format && (
                <ContentBodyTemplate
                  format={form.format}
                  value={form.body_template}
                  onChange={val => setForm(f => ({ ...f, body_template: val }))}
                  editable
                />
              )}

              {['reels', 'vlog', 'longo_youtube', 'short_tiktok'].includes(form.format) && (
                <Card className="border-border/60">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Legenda / Copy</h3>
                    </div>
                    <RichTextEditor content={form.copy_content} onChange={v => setForm(f => ({ ...f, copy_content: v }))} editable />
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
