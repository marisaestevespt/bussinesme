import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2, ExternalLink, Paperclip, X, Upload } from 'lucide-react';
import { BackNavigation } from '@/components/BackNavigation';
import type { MarketingChannel } from '@/lib/marketing-constants';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const DIST_COLUMNS = [
  { key: 'segunda', label: 'Segunda', headerBg: 'bg-[hsl(351,30%,94%)] dark:bg-[hsl(351,30%,15%)]', headerText: 'text-[hsl(351,40%,45%)] dark:text-[hsl(351,40%,65%)]', addColor: 'text-[hsl(351,35%,55%)]', cardBorder: 'border-l-[3px] border-[hsl(351,40%,70%)]' },
  { key: 'terca', label: 'Terça', headerBg: 'bg-[hsl(25,35%,93%)] dark:bg-[hsl(25,30%,15%)]', headerText: 'text-[hsl(25,50%,45%)] dark:text-[hsl(25,50%,65%)]', addColor: 'text-[hsl(25,45%,55%)]', cardBorder: 'border-l-[3px] border-[hsl(25,50%,70%)]' },
  { key: 'quarta', label: 'Quarta', headerBg: 'bg-[hsl(33,30%,92%)] dark:bg-[hsl(33,25%,15%)]', headerText: 'text-[hsl(33,40%,42%)] dark:text-[hsl(33,40%,62%)]', addColor: 'text-[hsl(33,35%,52%)]', cardBorder: 'border-l-[3px] border-[hsl(33,40%,65%)]' },
  { key: 'quinta', label: 'Quinta', headerBg: 'bg-[hsl(10,35%,93%)] dark:bg-[hsl(10,30%,15%)]', headerText: 'text-[hsl(10,45%,48%)] dark:text-[hsl(10,45%,65%)]', addColor: 'text-[hsl(10,40%,55%)]', cardBorder: 'border-l-[3px] border-[hsl(10,45%,70%)]' },
  { key: 'sexta', label: 'Sexta', headerBg: 'bg-[hsl(18,30%,92%)] dark:bg-[hsl(18,25%,15%)]', headerText: 'text-[hsl(18,40%,44%)] dark:text-[hsl(18,40%,64%)]', addColor: 'text-[hsl(18,35%,54%)]', cardBorder: 'border-l-[3px] border-[hsl(18,40%,68%)]' },
  { key: 'sabado', label: 'Sábado', headerBg: 'bg-[hsl(200,30%,93%)] dark:bg-[hsl(200,25%,15%)]', headerText: 'text-[hsl(200,40%,45%)] dark:text-[hsl(200,40%,65%)]', addColor: 'text-[hsl(200,35%,55%)]', cardBorder: 'border-l-[3px] border-[hsl(200,40%,70%)]' },
  { key: 'domingo', label: 'Domingo', headerBg: 'bg-[hsl(160,28%,92%)] dark:bg-[hsl(160,22%,15%)]', headerText: 'text-[hsl(160,35%,40%)] dark:text-[hsl(160,35%,60%)]', addColor: 'text-[hsl(160,30%,50%)]', cardBorder: 'border-l-[3px] border-[hsl(160,35%,65%)]' },
  { key: 'mensal', label: 'Mensal', headerBg: 'bg-[hsl(270,25%,93%)] dark:bg-[hsl(270,20%,15%)]', headerText: 'text-[hsl(270,30%,48%)] dark:text-[hsl(270,30%,65%)]', addColor: 'text-[hsl(270,25%,55%)]', cardBorder: 'border-l-[3px] border-[hsl(270,30%,70%)]' },
];

export default function MarketingChannelStrategy() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: channel } = useQuery({
    queryKey: ['marketing-channel', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').eq('id', channelId!).maybeSingle() as { data: MarketingChannel | null };
      return data;
    },
    enabled: !!channelId,
  });

  const { data: detail } = useQuery({
    queryKey: ['strategy-channel-detail', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_details').select('*').eq('channel_id', channelId!).maybeSingle() as any;
      return data as { id: string; positioning: string | null; periodicity: string | null; notes: string | null } | null;
    },
    enabled: !!channelId,
  });

  const { data: formats = [] } = useQuery({
    queryKey: ['strategy-channel-formats', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_formats').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; formato: string; objetivo: string; exemplos: string; sort_order: number }[];
    },
    enabled: !!channelId,
  });

  const { data: frames = [] } = useQuery({
    queryKey: ['strategy-channel-frames', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_frames').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; nome: string; formato: string; frequencia: string; notas: string; sort_order: number }[];
    },
    enabled: !!channelId,
  });

  // Local state
  const [positioning, setPositioning] = useState('');
  const [periodicity, setPeriodicity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (detail) {
      setPositioning(detail.positioning || '');
      setPeriodicity(detail.periodicity || '');
      setNotes(detail.notes || '');
    }
  }, [detail]);

  const saveDetail = async (field: string, value: string) => {
    if (detail) {
      await supabase.from('strategy_channel_details').update({ [field]: value } as any).eq('id', detail.id);
    } else {
      await supabase.from('strategy_channel_details').insert({ channel_id: channelId, [field]: value } as any);
    }
    qc.invalidateQueries({ queryKey: ['strategy-channel-detail', channelId] });
  };

  // Formats CRUD
  const addFormat = async () => {
    await supabase.from('strategy_channel_formats').insert({
      channel_id: channelId, formato: '', objetivo: '', exemplos: '', sort_order: formats.length,
    } as any);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  const updateFormat = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_channel_formats').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  const deleteFormat = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('strategy_channel_formats').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-formats', channelId] });
  };

  // Frames CRUD
  const addFrame = async () => {
    await supabase.from('strategy_channel_frames').insert({
      channel_id: channelId, nome: '', formato: '', frequencia: '', notas: '', sort_order: frames.length,
    } as any);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  const updateFrame = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_channel_frames').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  const deleteFrame = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('strategy_channel_frames').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-channel-frames', channelId] });
  };

  // Distribution cards for this channel
  const { data: distCards = [] } = useQuery({
    queryKey: ['strategy-distribution-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_distribution_cards').select('*').order('sort_order') as any;
      return (data || []) as { id: string; column_key: string; title: string; channel: string | null; description: string | null; link_url: string | null; files: any[] | null; sort_order: number }[];
    },
  });

  const channelDistCards = distCards.filter(c => c.channel === channel?.name);

  const [distDialog, setDistDialog] = useState<{ open: boolean; columnKey: string; editId?: string }>({ open: false, columnKey: '' });
  const [distForm, setDistForm] = useState({ title: '', description: '', link_url: '', files: [] as { name: string; url: string }[] });
  const [uploading, setUploading] = useState(false);

  const openAddDist = (columnKey: string) => {
    setDistForm({ title: '', description: '', link_url: '', files: [] });
    setDistDialog({ open: true, columnKey });
  };
  const openEditDist = (card: any) => {
    setDistForm({ title: card.title, description: card.description || '', link_url: card.link_url || '', files: card.files || [] });
    setDistDialog({ open: true, columnKey: card.column_key, editId: card.id });
  };
  const handleDistFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `dist-cards/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('content-files').upload(path, file);
    if (error) { toast.error('Erro ao enviar ficheiro'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('content-files').getPublicUrl(path);
    setDistForm(f => ({ ...f, files: [...f.files, { name: file.name, url: urlData.publicUrl }] }));
    setUploading(false);
    e.target.value = '';
  };
  const removeDistFile = (idx: number) => {
    setDistForm(f => ({ ...f, files: f.files.filter((_, i) => i !== idx) }));
  };
  const saveDist = async () => {
    if (!distForm.title.trim() || !channel) return;
    const payload = { title: distForm.title, description: distForm.description, link_url: distForm.link_url || null, files: distForm.files } as any;
    if (distDialog.editId) {
      await supabase.from('strategy_distribution_cards').update(payload).eq('id', distDialog.editId);
    } else {
      const colCards = channelDistCards.filter(c => c.column_key === distDialog.columnKey);
      await supabase.from('strategy_distribution_cards').insert({ ...payload, column_key: distDialog.columnKey, channel: channel.name, sort_order: colCards.length } as any);
    }
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
    setDistDialog({ open: false, columnKey: '' });
  };
  const deleteDist = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('strategy_distribution_cards').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };

  if (!channel) return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <InlineLoader />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title={channel.name} subtitle="Estratégia por Canal" />

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing/estrategia" parentLabel="Estratégia" />

          {/* Callout - Posicionamento do Canal */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <Textarea
                value={positioning}
                onChange={e => setPositioning(e.target.value)}
                onBlur={() => saveDetail('positioning', positioning)}
                placeholder="Define o papel deste canal no teu negócio"
                className="min-h-[60px] resize-none bg-transparent border-none text-base"
                readOnly={!isOwner}
              />
            </CardContent>
          </Card>

          {/* Periodicidade */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Periodicidade</h2>
            <Textarea
              value={periodicity}
              onChange={e => setPeriodicity(e.target.value)}
              onBlur={() => saveDetail('periodicity', periodicity)}
              placeholder="Define a frequência de publicação neste canal"
              className="min-h-[60px] resize-none"
              readOnly={!isOwner}
            />
          </section>

          <Separator />

          {/* Formatos e Funções Validados */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Formatos e Funções Validados</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={addFormat}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Formato</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Objetivo Principal</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Exemplos</th>
                      {isOwner && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {formats.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Nenhum formato definido.</td></tr>
                    )}
                    {formats.map(f => (
                      <tr key={f.id} className="border-b last:border-0 group">
                        <td className="p-2">
                          <Input value={f.formato} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'formato', e.target.value)}
                            placeholder="Ex: Reels" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.objetivo} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'objetivo', e.target.value)}
                            placeholder="Objetivo" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.exemplos} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFormat(f.id, 'exemplos', e.target.value)}
                            placeholder="Exemplos" readOnly={!isOwner} />
                        </td>
                        {isOwner && (
                          <td className="p-2">
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteFormat(f.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Quadros Fixos de Conteúdo */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Quadros Fixos de Conteúdo</h2>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={addFrame}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Nome do Quadro</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Formato</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Frequência</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Notas</th>
                      {isOwner && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {frames.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground italic">Nenhum quadro definido.</td></tr>
                    )}
                    {frames.map(f => (
                      <tr key={f.id} className="border-b last:border-0 group">
                        <td className="p-2">
                          <Input value={f.nome} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'nome', e.target.value)}
                            placeholder="Nome" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.formato} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'formato', e.target.value)}
                            placeholder="Formato" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.frequencia} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'frequencia', e.target.value)}
                            placeholder="Frequência" readOnly={!isOwner} />
                        </td>
                        <td className="p-2">
                          <Input value={f.notas} className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                            onChange={e => updateFrame(f.id, 'notas', e.target.value)}
                            placeholder="Notas" readOnly={!isOwner} />
                        </td>
                        {isOwner && (
                          <td className="p-2">
                            <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteFrame(f.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Distribuição de Conteúdo deste canal */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Distribuição de Conteúdo</h2>
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
              {DIST_COLUMNS.map(col => {
                const colCards = channelDistCards.filter(c => c.column_key === col.key);
                return (
                  <div key={col.key} className="flex flex-col">
                    <div className={cn('rounded-lg px-1.5 py-1.5 mb-2 text-center', col.headerBg)}>
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wider', col.headerText)}>{col.label}</span>
                      {colCards.length > 0 && <span className={cn('ml-1 text-[9px] font-medium opacity-60', col.headerText)}>({colCards.length})</span>}
                    </div>
                    <div className="space-y-2 flex-1 min-h-[80px]">
                      {colCards.map(card => (
                        <Card key={card.id} className={cn('group relative cursor-pointer', col.cardBorder)} onClick={() => isOwner && openEditDist(card)}>
                          <CardContent className="p-2 space-y-0.5">
                            <p className="text-[11px] font-medium text-foreground truncate">{card.title}</p>
                            {card.description && <p className="text-[9px] text-muted-foreground truncate">{card.description}</p>}
                            <div className="flex items-center gap-1">
                              {card.link_url && <ExternalLink className="h-2 w-2 text-info" />}
                              {(card.files as any[])?.length > 0 && <Paperclip className="h-2 w-2 text-muted-foreground" />}
                            </div>
                            {isOwner && <Button variant="ghost" aria-label="Eliminar" size="icon" className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); deleteDist(card.id); }}><Trash2 className="h-2.5 w-2.5 text-destructive" /></Button>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {isOwner && <Button variant="ghost" size="sm" className="w-full mt-1 text-[10px] text-muted-foreground h-6" onClick={() => openAddDist(col.key)}><Plus className="h-2.5 w-2.5 mr-0.5" />Adicionar</Button>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Distribution dialog */}
          <Dialog open={distDialog.open} onOpenChange={open => !open && setDistDialog({ open: false, columnKey: '' })}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{distDialog.editId ? 'Editar Conteúdo' : 'Novo Conteúdo'} — {channel.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={distForm.title} onChange={e => setDistForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Post educativo" />
                </div>
                <div>
                  <Label className="text-xs">Dia</Label>
                  <Select value={distDialog.columnKey} onValueChange={v => setDistDialog(d => ({ ...d, columnKey: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIST_COLUMNS.map(col => (
                        <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={distForm.description} onChange={e => setDistForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes" className="resize-none min-h-[60px]" />
                </div>
                <div>
                  <Label className="text-xs">Link</Label>
                  <Input value={distForm.link_url} onChange={e => setDistForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Ficheiros</Label>
                  <div className="space-y-2 mt-1">
                    {distForm.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                        <a href={file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">{file.name}</a>
                        {isOwner && <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => removeDistFile(idx)}><X className="h-2.5 w-2.5" /></Button>}
                      </div>
                    ))}
                    {isOwner && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Upload className="h-3 w-3" />
                        {uploading ? 'A enviar...' : 'Adicionar ficheiro'}
                        <input type="file" className="hidden" onChange={handleDistFileUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>
                <Button className="w-full" onClick={saveDist} disabled={!distForm.title.trim() || uploading}>
                  {distDialog.editId ? 'Guardar' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />

          {/* Notas livres */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notas</h2>
            <RichTextEditor
              content={notes}
              onChange={(val) => { setNotes(val); }}
              editable={isOwner}
            />
            {isOwner && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => saveDetail('notes', notes)}>
                Guardar notas
              </Button>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
