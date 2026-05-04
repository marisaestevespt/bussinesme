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
import { NewContentButton } from '@/components/marketing/NewContentButton';
import type { ContentTemplate } from '@/components/marketing/CONTENT_TEMPLATES';
import { STATUS_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Palette, Target, GitBranch, Package, Zap, Filter, TrendingUp, BarChart3, Users,
  Plus, Pencil, Check, X, ExternalLink, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { ChannelCard } from '@/components/marketing/ChannelCard';
import { getPlanningSection } from '@/lib/department-planning';


const MARKETING_360 = [
  // Planeamento sempre primeiro (regra: ver mem://design/department-planning-card.md)
  (() => { const p = getPlanningSection('marketing'); return { title: p.label, desc: p.desc, icon: p.icon, url: p.path }; })(),
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




  const createContent = async (tpl?: ContentTemplate, scheduledAt?: Date) => {
    if (creatingContent) return;
    setCreatingContent(true);
    try {
      const payload: Record<string, any> = {
        title: tpl?.defaultTitle || 'Novo Conteúdo',
        created_by: user?.id,
      };
      if (tpl?.defaultContentType) payload.content_type = tpl.defaultContentType;
      if (tpl?.defaultFormat) payload.format = tpl.defaultFormat;
      if (tpl?.defaultCopy) payload.copy_content = tpl.defaultCopy;
      if (scheduledAt) {
        const d = new Date(scheduledAt);
        d.setHours(12, 0, 0, 0);
        payload.scheduled_at = d.toISOString();
      }

      const { data, error } = await supabase.from('content_items').insert(payload as any).select('id').single() as { data: { id: string } | null; error: any };
      if (error || !data) { toast.error('Erro ao criar'); return; }

      // Link channel if template specifies one and a matching channel exists
      if (tpl?.defaultChannel) {
        const ch = channels.find(c => c.name.toLowerCase() === tpl.defaultChannel!.toLowerCase());
        if (ch) {
          await supabase.from('content_channels').insert({ content_id: data.id, channel_id: ch.id } as any);
        }
      }

      // Tarefa só é criada em ConteudoDetail quando se atribui responsável
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      navigate(`/hub/marketing/conteudos/${data.id}`);
    } finally {
      setCreatingContent(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Marketing e Branding" subtitle="Estratégia de marketing, conteúdo e canais de comunicação." department="marketing" />

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {channels.filter(ch => ch.is_active).map(ch => {
                let hostname: string | null = null;
                if (ch.link) { try { hostname = new URL(ch.link).hostname; } catch {} }
                return (
                  <div key={ch.id} className="relative">
                    <ChannelCard
                      channel={ch}
                      to={`/hub/marketing/canal/${ch.id}`}
                      isOwner={isOwner}
                      subtitle={hostname || (ch.link ? ch.link : <span className="italic">Sem link</span>)}
                      extraOverlay={isOwner ? (
                        <button
                          type="button"
                          aria-label="Editar link"
                          title="Editar link"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-background/90 border border-border shadow-sm hover:bg-background"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingChannelId(ch.id); setEditChannelLink(ch.link || ''); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-foreground" />
                        </button>
                      ) : undefined}
                    />
                    {editingChannelId === ch.id && (
                      <div className="absolute inset-x-0 bottom-0 z-30 bg-card border rounded-b-xl px-3 py-2 flex items-center gap-1 shadow-lg">
                        <Input value={editChannelLink} onChange={e => setEditChannelLink(e.target.value)}
                          className="h-7 text-xs flex-1" placeholder="https://..."
                          onKeyDown={e => e.key === 'Enter' && saveChannelLink()} autoFocus />
                        <Button variant="ghost" aria-label="Confirmar" size="icon" className="h-6 w-6 shrink-0" onClick={saveChannelLink}><Check className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingChannelId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    )}
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
              <NewContentButton onPick={createContent} loading={creatingContent} />
            </div>
            {weekContent.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground italic">Nenhum conteúdo agendado para esta semana.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {weekContent.map(item => {
                  const itemChannels = getItemChannels(item.id);
                  const status = STATUS_OPTIONS.find(s => s.value === item.status);
                  return (
                    <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`}>
                      <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden h-full">
                        <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                          {item.cover_url ? (
                            <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                          )}
                        </div>
                        <CardContent className="p-2 space-y-1.5">
                          <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {itemChannels.map(ch => (
                              <Badge key={ch.id} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{ch.name}</Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-muted-foreground truncate">
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
              <NewContentButton onPick={createContent} loading={creatingContent} />
            </div>
            <ContentCalendar
              items={contentItems}
              channels={channels}
              contentChannelLinks={contentChannelLinks}
              profiles={profiles}
              attachments={contentAttachments}
              onCreateForDate={(d) => createContent(undefined, d)}
            />
          </section>
        </div>
      </div>

    </AppLayout>
  );
}
