import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { ContentCalendar } from '@/components/marketing/ContentCalendar';
import { STATUS_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Plus, FileText, Trash2,
  Check, Image as ImageIcon, ExternalLink, Target,
} from 'lucide-react';
import { WebsiteChannelContent } from '@/components/marketing/WebsiteChannelContent';
import { ChannelMonthGallery } from '@/components/marketing/ChannelMonthGallery';
import { ChannelMonthlyAnalysis } from '@/components/marketing/ChannelMonthlyAnalysis';
import { InstagramFeedPreview } from '@/components/marketing/InstagramFeedPreview';
import { BackNavigation } from '@/components/BackNavigation';
import { InlineLoader } from '@/components/ui/loading-skeletons';

const DIST_DAY_LABELS: Record<string, string> = {
  segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta',
  sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo', mensal: 'Mensal',
};

function ChannelDistributionCards({ channelName }: { channelName: string }) {
  const { data: distCards = [] } = useQuery({
    queryKey: ['strategy-distribution-cards'],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_distribution_cards').select('*').order('sort_order') as any;
      return (data || []) as { id: string; column_key: string; title: string; channel: string | null; description: string | null; sort_order: number }[];
    },
  });

  const filtered = distCards.filter(c => c.channel === channelName);
  if (filtered.length === 0) return null;

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, card) => {
    (acc[card.column_key] = acc[card.column_key] || []).push(card);
    return acc;
  }, {});

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Distribuição de Conteúdo</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Object.entries(grouped).map(([key, cards]) => (
          <div key={key} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{DIST_DAY_LABELS[key] || key}</p>
            {cards.map(card => (
              <Card key={card.id} className="border-l-[3px] border-primary/40">
                <CardContent className="p-2.5 space-y-1">
                  <p className="text-xs font-medium text-foreground">{card.title}</p>
                  {card.description && <p className="text-[10px] text-muted-foreground">{card.description}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number } | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Fetch channel
  const { data: channel } = useQuery({
    queryKey: ['marketing-channel', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').eq('id', channelId!).maybeSingle();
      return data as MarketingChannel | null;
    },
    enabled: !!channelId,
  });

  // Fetch all channels (for calendar component)
  const { data: allChannels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order');
      return (data || []) as MarketingChannel[];
    },
  });

  // Fetch channel pages
  const { data: pages = [] } = useQuery({
    queryKey: ['channel-pages', channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('channel_pages')
        .select('*')
        .eq('channel_id', channelId!)
        .order('sort_order') as { data: any[] | null };
      return data || [];
    },
    enabled: !!channelId,
  });

  // Fetch content items linked to this channel
  const { data: contentChannelLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  const { data: allContentItems = [] } = useQuery({
    queryKey: ['content-items'],
    queryFn: async () => {
      // Limita a 1000 items para evitar carregar dataset completo (P2: performance audit)
      const { data } = await supabase
        .from('content_items')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(1000);
      return (data || []) as ContentItem[];
    },
  });

  // Fetch strategy data for this channel
  const { data: strategyDetail } = useQuery({
    queryKey: ['strategy-channel-detail', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_details').select('*').eq('channel_id', channelId!).maybeSingle() as any;
      return data as { id: string; positioning: string | null; periodicity: string | null; notes: string | null } | null;
    },
    enabled: !!channelId,
  });

  const { data: strategyFormats = [] } = useQuery({
    queryKey: ['strategy-channel-formats', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_formats').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; formato: string; objetivo: string; exemplos: string }[];
    },
    enabled: !!channelId,
  });

  const { data: strategyFrames = [] } = useQuery({
    queryKey: ['strategy-channel-frames', channelId],
    queryFn: async () => {
      const { data } = await supabase.from('strategy_channel_frames').select('*').eq('channel_id', channelId!).order('sort_order') as any;
      return (data || []) as { id: string; nome: string; formato: string; frequencia: string; notas: string }[];
    },
    enabled: !!channelId,
  });

  const hasStrategy = !!(strategyDetail?.positioning || strategyDetail?.periodicity || strategyFormats.length > 0 || strategyFrames.length > 0);

  // Filter content for this channel
  const channelContentIds = contentChannelLinks
    .filter(l => l.channel_id === channelId)
    .map(l => l.content_id);
  const channelContent = allContentItems.filter(i => channelContentIds.includes(i.id));

  // Channel pages
  const createPage = async () => {
    if (!newPageTitle.trim() || !channelId) return;
    await supabase.from('channel_pages').insert({
      channel_id: channelId, title: newPageTitle, sort_order: pages.length,
    } as any);
    queryClient.invalidateQueries({ queryKey: ['channel-pages', channelId] });
    setShowNewPage(false);
    setNewPageTitle('');
    toast.success('Página criada');
  };

  const savePage = async () => {
    if (!editingPageId) return;
    await supabase.from('channel_pages').update({ content: editingContent } as any).eq('id', editingPageId);
    queryClient.invalidateQueries({ queryKey: ['channel-pages', channelId] });
    setEditingPageId(null);
    toast.success('Página guardada');
  };

  const deletePage = async (id: string) => {
    await supabase.from('channel_pages').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['channel-pages', channelId] });
    toast.success('Página removida');
  };

  const isWebsite = channel?.name?.toLowerCase() === 'website';
  const isInstagram = channel?.name?.toLowerCase() === 'instagram';

  if (!channel) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <InlineLoader />
        </div>
      </AppLayout>
    );
  }

  const editingPage = pages.find((p: any) => p.id === editingPageId);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="w-full py-10 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'hsl(var(--primary-foreground) / 0.7)' }}>
            Marketing e Branding
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary-foreground">
            {channel.name}
          </h1>
        </div>

        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {isWebsite ? (
            <WebsiteChannelContent channelId={channelId!} channelName={channel.name} />
          ) : (
            <>
              {/* Section 1: Month Gallery or Month Detail */}
              {selectedMonth ? (
                <ChannelMonthlyAnalysis
                  channelId={channelId!}
                  channelName={channel.name}
                  month={selectedMonth.month}
                  year={selectedMonth.year}
                  onBack={() => setSelectedMonth(null)}
                />
              ) : (
                <ChannelMonthGallery
                  channelId={channelId!}
                  year={currentYear}
                  onYearChange={setCurrentYear}
                  onSelectMonth={(month) => setSelectedMonth({ month, year: currentYear })}
                />
              )}

              <Separator />

              {/* Strategy + Pages (left) and Instagram Feed Preview (right) */}
              <div className={isInstagram ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}>
                <div className={isInstagram ? "lg:col-span-2 space-y-6" : "space-y-6"}>
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                  {isOwner && (
                    <Button size="sm" variant="outline" onClick={() => setShowNewPage(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Nova Página
                    </Button>
                  )}
                </div>
                {pages.length === 0 ? (
                  <Card><CardContent className="p-6 text-center text-sm text-muted-foreground italic">Nenhuma página criada.</CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pages.map((p: any) => (
                      <Card key={p.id} className="hq-transition hover:shadow-md cursor-pointer group relative"
                        onClick={() => { setEditingPageId(p.id); setEditingContent(p.content || ''); }}>
                        <CardContent className="p-5 flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-2.5">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.updated_at && format(new Date(p.updated_at), 'dd MMM yyyy', { locale: pt })}
                            </p>
                          </div>
                        </CardContent>
                        {isOwner && (
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Estratégia
                  </h2>
                  <Link to={`/hub/marketing/estrategia/canal/${channelId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />Editar Estratégia
                    </Button>
                  </Link>
                </div>

                {!hasStrategy ? (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground italic">
                      Nenhuma estratégia definida para este canal.{' '}
                      <Link to={`/hub/marketing/estrategia/canal/${channelId}`} className="text-primary hover:underline">
                        Definir agora
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {strategyDetail?.positioning && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Posicionamento</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{strategyDetail.positioning}</p>
                        </CardContent>
                      </Card>
                    )}

                    {strategyDetail?.periodicity && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Periodicidade</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{strategyDetail.periodicity}</p>
                      </div>
                    )}

                    {strategyFormats.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Formatos e Funções Validados</p>
                        <Card>
                          <CardContent className="p-0">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Formato</th>
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Objetivo</th>
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Exemplos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {strategyFormats.map(f => (
                                  <tr key={f.id} className="border-b last:border-0">
                                    <td className="p-2.5 text-sm">{f.formato || '—'}</td>
                                    <td className="p-2.5 text-sm">{f.objetivo || '—'}</td>
                                    <td className="p-2.5 text-sm text-muted-foreground">{f.exemplos || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {strategyFrames.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Quadros Fixos de Conteúdo</p>
                        <Card>
                          <CardContent className="p-0">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Formato</th>
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Frequência</th>
                                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Notas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {strategyFrames.map(f => (
                                  <tr key={f.id} className="border-b last:border-0">
                                    <td className="p-2.5 text-sm font-medium">{f.nome || '—'}</td>
                                    <td className="p-2.5 text-sm">{f.formato || '—'}</td>
                                    <td className="p-2.5 text-sm">{f.frequencia || '—'}</td>
                                    <td className="p-2.5 text-sm text-muted-foreground">{f.notas || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Distribution cards for this channel */}
              <ChannelDistributionCards channelName={channel.name} />

                </div>
                {isInstagram && (
                  <aside className="lg:col-span-1">
                    <div className="lg:sticky lg:top-4 space-y-3">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">Preview do Feed</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Simulação do feed Instagram
                        </p>
                      </div>
                      <InstagramFeedPreview items={channelContent} />
                    </div>
                  </aside>
                )}
              </div>

              <Separator />

              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Calendário — {channel.name}</h2>
                <ContentCalendar
                  items={channelContent}
                  channels={allChannels}
                  contentChannelLinks={contentChannelLinks}
                  calendarOnly
                />
              </section>

              <Separator />

              {/* Section 4: Content Table */}
              <section className="space-y-4 pb-10">
                <h2 className="text-lg font-semibold text-foreground">Todos os Conteúdos — {channel.name}</h2>
                {channelContent.length === 0 ? (
                  <Card><CardContent className="p-8 text-center text-sm text-muted-foreground italic">Nenhum conteúdo associado a este canal.</CardContent></Card>
                ) : (
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Formato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {channelContent.map(item => {
                            const status = STATUS_OPTIONS.find(s => s.value === item.status);
                            return (
                              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 hq-transition cursor-pointer"
                                onClick={() => navigate(`/hub/marketing/conteudos/${item.id}`)}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {item.cover_url ? (
                                      <img src={item.cover_url} className="h-8 w-8 rounded object-cover shrink-0" alt="" />
                                    ) : (
                                      <div className="h-8 w-8 rounded bg-muted/40 flex items-center justify-center shrink-0">
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                      </div>
                                    )}
                                    <span className="font-medium text-foreground">{item.title}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  {item.scheduled_at ? format(new Date(item.scheduled_at), 'dd MMM yyyy HH:mm', { locale: pt }) : '—'}
                                </td>
                                <td className="p-3">
                                  {status && <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>}
                                </td>
                                <td className="p-3 text-muted-foreground capitalize">{item.format || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* New Page Dialog */}
      <Dialog open={showNewPage} onOpenChange={setShowNewPage}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Página</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} placeholder="Título da página"
              onKeyDown={e => e.key === 'Enter' && createPage()} autoFocus />
            <Button className="w-full" disabled={!newPageTitle.trim()} onClick={createPage}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      <Dialog open={!!editingPageId} onOpenChange={open => { if (!open) setEditingPageId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPage?.title}</DialogTitle></DialogHeader>
          <RichTextEditor content={editingContent} onChange={setEditingContent} editable={isOwner} />
          {isOwner && (
            <div className="flex justify-end mt-4">
              <Button onClick={savePage}><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
