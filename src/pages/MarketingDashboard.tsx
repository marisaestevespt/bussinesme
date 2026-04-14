import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ContentCalendar } from '@/components/marketing/ContentCalendar';
import { STATUS_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Palette, Target, GitBranch, Package, Zap, Filter, TrendingUp, BarChart3, Users,
  Plus, Pencil, Check, X, ExternalLink, Image as ImageIcon, Loader2,
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
  { title: 'Análise', desc: 'Análise mensal de marketing', icon: BarChart3, url: '/hub/marketing/analise' },
];

export default function MarketingDashboard() {
  const { isOwner, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelLink, setEditChannelLink] = useState('');
  const [creatingContent, setCreatingContent] = useState(false);
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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
      return data || [];
    },
  });

  const { data: contentAttachments = [] } = useQuery({
    queryKey: ['content-attachments-all'],
    queryFn: async () => {
      const { data } = await supabase.from('content_attachments').select('*');
      return (data || []) as { id: string; content_id: string; file_url: string; file_name: string; file_type: string }[];
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




  const createContent = async () => {
    if (creatingContent) return;
    setCreatingContent(true);
    try {
      const { data, error } = await supabase.from('content_items').insert({
        title: 'Novo Conteúdo', created_by: user?.id,
      } as any).select('id').single() as { data: { id: string } | null; error: any };
      if (error || !data) { toast.error('Erro ao criar'); return; }
      // Auto-create production task linked to content (fire-and-forget)
      supabase.from('tasks').insert({
        name: '[Conteúdo] Novo Conteúdo — Em ideia',
        content_id: data.id,
        tag: 'Conteúdo',
        department: 'marketing',
        status: 'por_comecar',
        priority: 'media',
        created_by: user?.id,
      } as any).then(() => queryClient.invalidateQueries({ queryKey: ['content-items'] }));
      navigate(`/hub/marketing/conteudos/${data.id}`);
    } finally {
      setCreatingContent(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Marketing e Branding" subtitle="Estratégia de marketing, conteúdo e canais de comunicação." />

        <div className="space-y-6">

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

          {/* Section 2b: Canais e Links */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Canais</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {channels.filter(ch => ch.is_active).map(ch => {
                const emoji = CHANNEL_EMOJI[ch.name] || '📢';
                return (
                  <div key={ch.id} className="group relative flex flex-col rounded-xl border bg-card overflow-hidden">
                    <Link to={`/hub/marketing/canal/${ch.id}`}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-muted/50 hq-transition text-center flex-1">
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-sm font-medium text-foreground">{ch.name}</span>
                    </Link>
                    <div className="border-t px-3 py-2 flex items-center gap-1.5 min-h-[36px]">
                      {editingChannelId === ch.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <Input value={editChannelLink} onChange={e => setEditChannelLink(e.target.value)}
                            className="h-7 text-xs flex-1" placeholder="https://..."
                            onKeyDown={e => e.key === 'Enter' && saveChannelLink()} autoFocus />
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={saveChannelLink}><Check className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingChannelId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : ch.link ? (
                        <a href={ch.link} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 truncate flex-1">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{new URL(ch.link).hostname}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic flex-1">Sem link</span>
                      )}
                      {isOwner && editingChannelId !== ch.id && (
                        <Button variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 hq-transition shrink-0"
                          onClick={() => { setEditingChannelId(ch.id); setEditChannelLink(ch.link || ''); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
            <ContentCalendar items={contentItems} channels={channels} contentChannelLinks={contentChannelLinks} profiles={profiles} attachments={contentAttachments} />
          </section>
        </div>
      </div>

    </AppLayout>
  );
}
