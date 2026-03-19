import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ContentCalendar } from '@/components/marketing/ContentCalendar';
import { STATUS_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Palette, Target, GitBranch, Package, Zap, Filter, TrendingUp,
  Plus, Pencil, Check, X, ExternalLink, Image as ImageIcon,
} from 'lucide-react';

const CHANNEL_EMOJI: Record<string, string> = {
  'Instagram': '📸',
  'Youtube': '🎬',
  'Facebook': '👥',
  'TikTok': '🎵',
  'LinkedIn': '💼',
  'Pinterest': '📌',
  'Website': '🌐',
  'Email Marketing': '📧',
  'Twitter': '🐦',
  'Threads': '🧵',
  'Spotify': '🎧',
  'Blog': '📝',
  'Podcast': '🎙️',
  'Newsletter': '✉️',
  'WhatsApp': '💬',
  'Telegram': '✈️',
};

const MARKETING_360 = [
  { title: 'Gestão de Marca', desc: 'Branding, identidade e posicionamento', icon: Palette, url: '/hub/marketing/gestao-marca' },
  { title: 'Estratégia', desc: 'Planeamento estratégico', icon: Target, url: '/hub/marketing/estrategia' },
  { title: 'Processos', desc: 'Workflows de marketing', icon: GitBranch, url: '/hub/marketing/processos-mkt' },
  { title: 'Recursos', desc: 'Materiais e recursos', icon: Package, url: '/hub/marketing/recursos-mkt' },
  { title: 'Automações', desc: 'Automatizações e integrações', icon: Zap, url: '/hub/marketing/automacoes' },
  { title: 'Funis', desc: 'Funis de conversão', icon: Filter, url: '/hub/marketing/funis' },
  { title: 'Tráfego Pago', desc: 'Campanhas e ads', icon: TrendingUp, url: '/hub/marketing/trafego-pago' },
];

export default function MarketingDashboard() {
  const { isOwner, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelLink, setEditChannelLink] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  // Queries
  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order') as { data: MarketingChannel[] | null };
      return data || [];
    },
  });

  const { data: contentItems = [] } = useQuery({
    queryKey: ['content-items'],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*').order('scheduled_at') as { data: ContentItem[] | null };
      return data || [];
    },
  });

  const { data: contentChannelLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*') as { data: ContentChannelLink[] | null };
      return data || [];
    },
  });

  // Week content
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekContent = contentItems.filter(item => {
    if (!item.scheduled_at || item.status === 'publicado') return false;
    return isWithinInterval(new Date(item.scheduled_at), { start: weekStart, end: weekEnd });
  });

  // Channel helpers
  const getItemChannels = (itemId: string) => {
    const ids = contentChannelLinks.filter(l => l.content_id === itemId).map(l => l.channel_id);
    return channels.filter(c => ids.includes(c.id));
  };

  const saveChannelLink = async () => {
    if (!editingChannelId) return;
    await supabase.from('marketing_channels').update({ link: editChannelLink } as any).eq('id', editingChannelId);
    queryClient.invalidateQueries({ queryKey: ['marketing-channels'] });
    setEditingChannelId(null);
    toast.success('Link atualizado');
  };

  const toggleChannel = async (id: string, active: boolean) => {
    await supabase.from('marketing_channels').update({ is_active: active } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['marketing-channels'] });
  };

  const addChannel = async () => {
    if (!newChannelName.trim()) return;
    await supabase.from('marketing_channels').insert({ name: newChannelName, sort_order: channels.length } as any);
    queryClient.invalidateQueries({ queryKey: ['marketing-channels'] });
    setShowAddChannel(false);
    setNewChannelName('');
    toast.success('Canal adicionado');
  };

  const createContent = async () => {
    const { data, error } = await supabase.from('content_items').insert({
      title: 'Novo Conteúdo', created_by: user?.id,
    } as any).select('id').single() as { data: { id: string } | null; error: any };
    if (error || !data) { toast.error('Erro ao criar'); return; }
    queryClient.invalidateQueries({ queryKey: ['content-items'] });
    navigate(`/hub/marketing/conteudos/${data.id}`);
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <div className="w-full py-12 px-6 flex flex-col items-center gap-2" style={{ background: 'hsl(var(--primary))' }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'hsl(var(--primary-foreground))' }}>
            Marketing e Branding
          </h1>
        </div>

        <div className="max-w-6xl mx-auto w-full px-4 py-10 space-y-12">

          {/* Section 1: Marketing 360 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Marketing 360</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {MARKETING_360.map(item => (
                <Link key={item.url} to={item.url}>
                  <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer h-full">
                    <CardContent className="flex flex-col items-center text-center p-5 gap-3">
                      <div className="rounded-full bg-primary/10 p-3">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <Separator />

          {/* Section 2: Onde estamos presentes */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Onde estamos presentes</h2>
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">Seleciona os canais onde o teu negócio está presente. Apenas os canais ativos aparecerão no calendário de conteúdos.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {channels.map(ch => {
                    const emoji = CHANNEL_EMOJI[ch.name] || '📢';
                    return (
                      <div
                        key={ch.id}
                        className={cn(
                          "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 hq-transition cursor-pointer select-none",
                          ch.is_active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card opacity-60 hover:opacity-80"
                        )}
                        onClick={() => isOwner && toggleChannel(ch.id, !ch.is_active)}
                      >
                        <span className="text-2xl">{emoji}</span>
                        <span className="text-xs font-medium text-foreground text-center">{ch.name}</span>
                        {isOwner && (
                          <Switch
                            checked={ch.is_active}
                            onCheckedChange={v => toggleChannel(ch.id, v)}
                            className="absolute top-2 right-2 scale-75"
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                        {ch.is_active && (
                          <div className="absolute top-2 left-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddChannel(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar canal
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Section 2b: Canais e Links */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Canais e Links</h2>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="space-y-2">
                  {channels.filter(ch => ch.is_active).map(ch => {
                    const emoji = CHANNEL_EMOJI[ch.name] || '📢';
                    const count = contentChannelLinks.filter(l => l.channel_id === ch.id).length;
                    return (
                      <div key={ch.id} className="flex items-center gap-3 text-sm group p-2 rounded-lg hover:bg-muted/40 hq-transition">
                        <span className="text-base">{emoji}</span>
                        <Link to={`/hub/marketing/canal/${ch.id}`} className="font-medium text-foreground hover:text-primary shrink-0">
                          {ch.name}
                        </Link>
                        <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{count}</Badge>
                        <div className="flex-1 min-w-0">
                          {editingChannelId === ch.id ? (
                            <div className="flex items-center gap-1">
                              <Input value={editChannelLink} onChange={e => setEditChannelLink(e.target.value)}
                                className="h-7 text-xs flex-1" placeholder="https://..."
                                onKeyDown={e => e.key === 'Enter' && saveChannelLink()} autoFocus />
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveChannelLink}><Check className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingChannelId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <>
                              {ch.link ? (
                                <a href={ch.link} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3 shrink-0" />{ch.link}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem link</span>
                              )}
                            </>
                          )}
                        </div>
                        {isOwner && editingChannelId !== ch.id && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => { setEditingChannelId(ch.id); setEditChannelLink(ch.link || ''); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Section 3: Weekly Content */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Conteúdos a sair esta semana</h2>
              <Button size="sm" onClick={createContent}>
                <Plus className="h-3.5 w-3.5 mr-1" />Novo Conteúdo
              </Button>
            </div>
            {weekContent.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground italic">Nenhum conteúdo agendado para esta semana.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {weekContent.map(item => {
                  const itemChannels = getItemChannels(item.id);
                  const status = STATUS_OPTIONS.find(s => s.value === item.status);
                  return (
                    <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`}>
                      <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden h-full">
                        <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                          {item.cover_url ? (
                            <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          )}
                        </div>
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {itemChannels.map(ch => (
                              <Badge key={ch.id} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{ch.name}</Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {item.scheduled_at && format(new Date(item.scheduled_at), 'dd MMM HH:mm', { locale: pt })}
                            </span>
                            {status && <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* Section 4: Content Calendar */}
          <section className="space-y-4 pb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Calendário de Conteúdos</h2>
              <Button size="sm" onClick={createContent}>
                <Plus className="h-3.5 w-3.5 mr-1" />Novo Conteúdo
              </Button>
            </div>
            <ContentCalendar items={contentItems} channels={channels} contentChannelLinks={contentChannelLinks} />
          </section>
        </div>
      </div>

      {/* Add Channel Dialog */}
      <Dialog open={showAddChannel} onOpenChange={setShowAddChannel}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Canal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="Nome do canal" onKeyDown={e => e.key === 'Enter' && addChannel()} />
            <Button className="w-full" disabled={!newChannelName.trim()} onClick={addChannel}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
