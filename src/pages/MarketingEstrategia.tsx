import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Pencil, ExternalLink, Paperclip, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketingChannel } from '@/lib/marketing-constants';
import { BackNavigation } from '@/components/BackNavigation';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { ChannelCard } from '@/components/marketing/ChannelCard';
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

const CHANNEL_EMOJI: Record<string, string> = {
  'Instagram': '📸', 'Youtube': '🎬', 'Facebook': '👥', 'TikTok': '🎵',
  'LinkedIn': '💼', 'Pinterest': '📌', 'Website': '🌐', 'Email Marketing': '📧',
};

export default function MarketingEstrategia() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['strategy-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_settings').select('*') as any;
      return (data || []) as { id: string; key: string; value: string | null }[];
    },
  });

  const { data: editorialLines = [] } = useQuery({
    queryKey: ['strategy-editorial-lines'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_editorial_lines').select('*').order('sort_order') as any;
      return (data || []) as { id: string; pilar: string; descricao: string; tipos_conteudo: string; sort_order: number }[];
    },
  });

  const { data: distCards = [] } = useQuery({
    queryKey: ['strategy-distribution-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_distribution_cards').select('*').order('sort_order') as any;
      return (data || []) as { id: string; column_key: string; title: string; channel: string | null; description: string | null; link_url: string | null; files: any[] | null; sort_order: number }[];
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value || '';

  const upsertSetting = async (key: string, value: string) => {
    const existing = settings.find(s => s.key === key);
    if (existing) {
      await supabase.from('strategy_settings').update({ value } as any).eq('id', existing.id);
    } else {
      await supabase.from('strategy_settings').insert({ key, value } as any);
    }
    qc.invalidateQueries({ queryKey: ['strategy-settings'] });
  };

  const focoValue = getSetting('foco');
  const posicionamentoValue = getSetting('posicionamento');

  const addEditorialLine = async () => {
    await supabase.from('strategy_editorial_lines').insert({ pilar: '', descricao: '', tipos_conteudo: '', sort_order: editorialLines.length } as any);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };
  const updateEditorialLine = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_editorial_lines').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };
  const deleteEditorialLine = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('strategy_editorial_lines').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-editorial-lines'] });
  };

  const addDistCard = async (columnKey: string, title: string, channel: string, description: string) => {
    const colCards = distCards.filter(c => c.column_key === columnKey);
    await supabase.from('strategy_distribution_cards').insert({ column_key: columnKey, title, channel, description, sort_order: colCards.length } as any);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };
  const updateDistCard = async (id: string, field: string, value: string) => {
    await supabase.from('strategy_distribution_cards').update({ [field]: value } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };
  const deleteDistCard = async (id: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('strategy_distribution_cards').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
  };

  const activeChannels = channels.filter(c => c.is_active);

  // Distribution card dialog state
  const [distDialog, setDistDialog] = useState<{ open: boolean; columnKey: string; editId?: string }>({ open: false, columnKey: '' });
  const [distForm, setDistForm] = useState({ title: '', channel: '', description: '', link_url: '', files: [] as { name: string; url: string }[] });
  const [uploading, setUploading] = useState(false);

  const openAddDialog = (columnKey: string) => {
    setDistForm({ title: '', channel: '', description: '', link_url: '', files: [] });
    setDistDialog({ open: true, columnKey });
  };
  const openEditDialog = (card: any) => {
    setDistForm({ title: card.title, channel: card.channel || '', description: card.description || '', link_url: card.link_url || '', files: card.files || [] });
    setDistDialog({ open: true, columnKey: card.column_key, editId: card.id });
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const removeFile = (idx: number) => {
    setDistForm(f => ({ ...f, files: f.files.filter((_, i) => i !== idx) }));
  };
  const saveDistDialog = async () => {
    if (!distForm.title.trim()) return;
    const payload = { title: distForm.title, channel: distForm.channel, description: distForm.description, link_url: distForm.link_url || null, files: distForm.files } as any;
    if (distDialog.editId) {
      await supabase.from('strategy_distribution_cards').update(payload).eq('id', distDialog.editId);
    } else {
      await addDistCard(distDialog.columnKey, distForm.title, distForm.channel, distForm.description);
      // Update the just-created card with link/files
      if (distForm.link_url || distForm.files.length > 0) {
        const { data: latest } = await supabase.from('strategy_distribution_cards').select('id').eq('column_key', distDialog.columnKey).order('created_at', { ascending: false }).limit(1) as any;
        if (latest?.[0]) {
          await supabase.from('strategy_distribution_cards').update({ link_url: distForm.link_url || null, files: distForm.files } as any).eq('id', latest[0].id);
        }
      }
    }
    qc.invalidateQueries({ queryKey: ['strategy-distribution-cards'] });
    setDistDialog({ open: false, columnKey: '' });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Estratégia" subtitle="Marketing 360" />
        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* Foco */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Foco Estratégico</h2>
            <Textarea
              key={`foco-${focoValue}`}
              defaultValue={focoValue}
              onBlur={e => { if (e.target.value !== focoValue) upsertSetting('foco', e.target.value); }}
              placeholder="Define aqui o foco estratégico do teu marketing"
              className="min-h-[80px] resize-y"
              readOnly={!isOwner}
            />
          </section>

          {/* Linha Editorial — full width para os campos terem espaço */}
          <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Linha Editorial</h2>
                {isOwner && <Button variant="outline" size="sm" onClick={addEditorialLine}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
              </div>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm table-fixed">
                    <thead><tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground w-[20%]">Pilar</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-[45%]">Descrição</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-[30%]">Tipos de Conteúdo</th>
                      {isOwner && <th className="w-[5%]" />}
                    </tr></thead>
                    <tbody>
                      {editorialLines.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Nenhum pilar definido.</td></tr>}
                      {editorialLines.map(line => (
                        <tr key={line.id} className="border-b last:border-0 group align-top">
                          <td className="p-2">
                            <Textarea defaultValue={line.pilar} rows={2}
                              className="text-sm border-transparent hover:border-input focus:border-input resize-y min-h-[40px]"
                              onBlur={e => { if (e.target.value !== line.pilar) updateEditorialLine(line.id, 'pilar', e.target.value); }}
                              placeholder="Ex: Educação" readOnly={!isOwner} />
                          </td>
                          <td className="p-2">
                            <Textarea defaultValue={line.descricao} rows={2}
                              className="text-sm border-transparent hover:border-input focus:border-input resize-y min-h-[40px]"
                              onBlur={e => { if (e.target.value !== line.descricao) updateEditorialLine(line.id, 'descricao', e.target.value); }}
                              placeholder="Descrição do pilar" readOnly={!isOwner} />
                          </td>
                          <td className="p-2">
                            <Textarea defaultValue={line.tipos_conteudo} rows={2}
                              className="text-sm border-transparent hover:border-input focus:border-input resize-y min-h-[40px]"
                              onBlur={e => { if (e.target.value !== line.tipos_conteudo) updateEditorialLine(line.id, 'tipos_conteudo', e.target.value); }}
                              placeholder="Tipos de conteúdo" readOnly={!isOwner} />
                          </td>
                          {isOwner && <td className="p-2"><Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteEditorialLine(line.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
          </section>

          {/* Posicionamento */}
          <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Posicionamento da Marca</h2>
              <Card><CardContent className="p-4">
                <Textarea
                  key={`pos-${posicionamentoValue}`}
                  defaultValue={posicionamentoValue}
                  onBlur={e => { if (e.target.value !== posicionamentoValue) upsertSetting('posicionamento', e.target.value); }}
                  placeholder="Define aqui o posicionamento da tua marca"
                  className="min-h-[100px] resize-y"
                  readOnly={!isOwner}
                />
              </CardContent></Card>
          </section>

          {/* Links rápidos — full width colorful cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/hub/marketing/estrategia/publico-alvo" className="group flex items-center gap-4 p-5 rounded-2xl border-2 border-[hsl(351,30%,88%)] bg-[hsl(351,30%,96%)] dark:bg-[hsl(351,25%,14%)] dark:border-[hsl(351,25%,22%)] hover:border-primary/40 hover:shadow-md transition-all">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(351,40%,90%)] dark:bg-[hsl(351,30%,20%)] group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground">Público-Alvo</span>
                <p className="text-xs text-muted-foreground mt-0.5">Personas, dores e jornada</p>
              </div>
            </Link>
            <Link to="/hub/marketing/gestao-marca" className="group flex items-center gap-4 p-5 rounded-2xl border-2 border-[hsl(25,35%,87%)] bg-[hsl(25,35%,95%)] dark:bg-[hsl(25,28%,14%)] dark:border-[hsl(25,25%,22%)] hover:border-primary/40 hover:shadow-md transition-all">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(25,40%,88%)] dark:bg-[hsl(25,30%,20%)] group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎨</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground">Gestão de Marca</span>
                <p className="text-xs text-muted-foreground mt-0.5">Identidade e branding</p>
              </div>
            </Link>
            <Link to="/hub/marketing/recursos-mkt" className="group flex items-center gap-4 p-5 rounded-2xl border-2 border-[hsl(38,40%,85%)] bg-[hsl(38,40%,95%)] dark:bg-[hsl(38,28%,14%)] dark:border-[hsl(38,25%,22%)] hover:border-primary/40 hover:shadow-md transition-all">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(38,45%,86%)] dark:bg-[hsl(38,30%,20%)] group-hover:scale-110 transition-transform">
                <span className="text-2xl">💡</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground">Banco de Ideias</span>
                <p className="text-xs text-muted-foreground mt-0.5">Conteúdos e inspiração</p>
              </div>
            </Link>
          </div>

          <Separator />

          {/* Estratégia por Canal */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Estratégia por Canal</h2>
            {activeChannels.length === 0 ? (
              <EmptyHint>Nenhum canal ativo. Ativa canais nas Definições.</EmptyHint>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeChannels.map(ch => (
                  <ChannelCard
                    key={ch.id}
                    channel={ch}
                    to={`/hub/marketing/estrategia/canal/${ch.id}`}
                    isOwner={isOwner}
                    size="sm"
                  />
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Distribuição de Conteúdo */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Distribuição de Conteúdo</h2>
            <div className="overflow-x-auto -mx-2 px-2 pb-3">
              <div className="flex gap-4 min-w-max">
                {DIST_COLUMNS.map(col => {
                  const colCards = distCards.filter(c => c.column_key === col.key);
                  return (
                    <div key={col.key} className="flex flex-col w-72 shrink-0">
                    <div className={cn('rounded-lg px-3 py-2.5 mb-3 text-center', col.headerBg)}>
                      <span className={cn('text-sm font-semibold uppercase tracking-wider', col.headerText)}>{col.label}</span>
                      <span className={cn('ml-1.5 text-xs font-medium', col.headerText, 'opacity-60')}>({colCards.length})</span>
                    </div>
                    <div className="space-y-3 flex-1 min-h-[120px]">
                      {colCards.map(card => (
                        <Card key={card.id} className={cn('group relative cursor-pointer', col.cardBorder)} onClick={() => isOwner && openEditDialog(card)}>
                          <CardContent className="p-4 space-y-2">
                            <p className="text-sm font-medium text-foreground break-words">{card.title || 'Sem título'}</p>
                            {card.channel && <Badge variant="secondary" className="text-xs px-2 py-0 h-5">{card.channel}</Badge>}
                            {card.description && <p className="text-xs text-muted-foreground break-words line-clamp-3">{card.description}</p>}
                            <div className="flex items-center gap-2">
                              {card.link_url && <ExternalLink className="h-3.5 w-3.5 text-info" />}
                              {(card.files as any[])?.length > 0 && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            {isOwner && <Button variant="ghost" aria-label="Eliminar" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); deleteDistCard(card.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {isOwner && <Button variant="ghost" size="sm" className={cn('w-full mt-3 text-sm', col.addColor)} onClick={() => openAddDialog(col.key)}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Distribution card dialog */}
          <Dialog open={distDialog.open} onOpenChange={open => !open && setDistDialog({ open: false, columnKey: '' })}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{distDialog.editId ? 'Editar Conteúdo' : 'Novo Conteúdo'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <Label className="text-sm">Nome</Label>
                  <Input value={distForm.title} onChange={e => setDistForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Post educativo" />
                </div>
                <div>
                  <Label className="text-sm">Canal</Label>
                  <Select value={distForm.channel} onValueChange={v => setDistForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar canal" /></SelectTrigger>
                    <SelectContent>
                      {activeChannels.map(ch => (
                        <SelectItem key={ch.id} value={ch.name}>{CHANNEL_EMOJI[ch.name] || '📢'} {ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Descrição</Label>
                  <Textarea value={distForm.description} onChange={e => setDistForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes do conteúdo" className="resize-y min-h-[100px]" />
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
                        {isOwner && <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => removeFile(idx)}><X className="h-2.5 w-2.5" /></Button>}
                      </div>
                    ))}
                    {isOwner && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Upload className="h-3 w-3" />
                        {uploading ? 'A enviar...' : 'Adicionar ficheiro'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>
                <Button className="w-full" onClick={saveDistDialog} disabled={!distForm.title.trim() || uploading}>
                  {distDialog.editId ? 'Guardar' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppLayout>
  );
}
