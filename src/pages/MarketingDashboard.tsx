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
  const [showNewContent, setShowNewContent] = useState(false);
  const [newContentTitle, setNewContentTitle] = useState('');

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
    if (!newContentTitle.trim()) return;
    const { data, error } = await supabase.from('content_items').insert({
      title: newContentTitle, created_by: user?.id,
    } as any).select('id').single() as { data: { id: string } | null; error: any };
    if (error || !data) { toast.error('Erro ao criar'); return; }
    toast.success('Conteúdo criado');
    queryClient.invalidateQueries({ queryKey: ['content-items'] });
    setShowNewContent(false);
    setNewContentTitle('');
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

          {/* Section 2: Plataformas e Canais */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Plataformas e Canais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Table */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Canais e Links</h3>
                    {isOwner && (
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowAddChannel(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Canal
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {channels.map(ch => (
                      <div key={ch.id} className="flex items-center gap-2 text-sm group">
                        <span className="font-medium text-foreground w-24 shrink-0">{ch.name}</span>
                        {editingChannelId === ch.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input value={editChannelLink} onChange={e => setEditChannelLink(e.target.value)}
                              className="h-7 text-xs flex-1" placeholder="https://..."
                              onKeyDown={e => e.key === 'Enter' && saveChannelLink()} autoFocus />
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveChannelLink}><Check className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingChannelId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <>
                            {ch.link ? (
                              <a href={ch.link} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline truncate flex-1 flex items-center gap-1">
                                <ExternalLink className="h-3 w-3 shrink-0" />{ch.link}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic flex-1">Sem link</span>
                            )}
                            {isOwner && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={() => { setEditingChannelId(ch.id); setEditChannelLink(ch.link || ''); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Active channels as filter buttons */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Canais Ativos</h3>
                  <div className="space-y-2">
                    {channels.filter(ch => ch.is_active).map(ch => {
                      const count = contentChannelLinks.filter(l => l.channel_id === ch.id).length;
                      return (
                        <Link key={ch.id} to={`/hub/marketing?canal=${ch.id}`}>
                          <div className="flex items-center justify-between p-2 rounded-md hq-transition hover:bg-muted/60 cursor-pointer group">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-sm text-foreground font-medium group-hover:text-primary">{ch.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
                          </div>
                        </Link>
                      );
                    })}
                    {channels.filter(ch => !ch.is_active).length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-[11px] text-muted-foreground mb-1.5">Inativos</p>
                        {channels.filter(ch => !ch.is_active).map(ch => (
                          <div key={ch.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                              <span className="text-sm text-muted-foreground">{ch.name}</span>
                            </div>
                            {isOwner && (
                              <Switch checked={false} onCheckedChange={v => toggleChannel(ch.id, v)} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Section 3: Weekly Content */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Conteúdos a sair esta semana</h2>
              <Button size="sm" onClick={() => setShowNewContent(true)}>
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
            <h2 className="text-xl font-semibold text-foreground">Calendário de Conteúdos</h2>
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

      {/* New Content Dialog */}
      <Dialog open={showNewContent} onOpenChange={setShowNewContent}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newContentTitle} onChange={e => setNewContentTitle(e.target.value)} placeholder="Título do conteúdo" onKeyDown={e => e.key === 'Enter' && createContent()} autoFocus />
            <Button className="w-full" disabled={!newContentTitle.trim()} onClick={createContent}>Criar e Abrir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
