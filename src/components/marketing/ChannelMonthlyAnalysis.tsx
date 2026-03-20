import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, TrendingUp, TrendingDown, Trophy, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FORMAT_OPTIONS, type ContentItem, type ContentChannelLink } from '@/lib/marketing-constants';
import { Link } from 'react-router-dom';

const FORMAT_FIELDS: Record<string, string[]> = {
  reels: ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'avg_watch_time'],
  carrossel: ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves'],
  estatico: ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves'],
  stories: ['impressions', 'story_replies', 'story_link_clicks', 'story_exits'],
  longo_youtube: ['views', 'watch_hours', 'likes', 'comments', 'shares', 'new_subscribers', 'ctr'],
  vlog: ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'avg_watch_time'],
  short_tiktok: ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'avg_watch_time'],
  post_linkedin: ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves'],
  pin: ['reach', 'impressions', 'likes', 'shares', 'saves', 'pin_link_clicks'],
  email: ['email_sent', 'email_open_rate', 'email_click_rate', 'email_unsubscribes'],
  outro: ['reach', 'likes', 'comments', 'shares'],
};

const FIELD_LABELS: Record<string, string> = {
  views: 'Visualizações', reach: 'Alcance', impressions: 'Impressões', likes: 'Gostos',
  comments: 'Comentários', shares: 'Partilhas', saves: 'Guardados', avg_watch_time: 'Tempo médio',
  watch_hours: 'Horas vistas', new_subscribers: 'Novos subs', ctr: 'CTR (%)',
  story_replies: 'Respostas', story_link_clicks: 'Cliques link', story_exits: 'Saídas',
  pin_link_clicks: 'Cliques link', email_sent: 'Enviados', email_open_rate: 'Taxa abertura (%)',
  email_click_rate: 'Taxa clique (%)', email_unsubscribes: 'Unsubscribes',
};

function getPrimaryMetricField(format: string): string {
  const videoFormats = ['reels', 'short_tiktok', 'vlog', 'longo_youtube'];
  return videoFormats.includes(format) ? 'views' : 'reach';
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  channelId: string;
  channelName: string;
  month: number;
  year: number;
  onBack: () => void;
}

export function ChannelMonthlyAnalysis({ channelId, channelName, month, year, onBack }: Props) {
  const queryClient = useQueryClient();

  // Channel metrics
  const { data: channelMetrics } = useQuery({
    queryKey: ['channel-monthly-metrics', channelId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics')
        .select('*').eq('channel_id', channelId).eq('month', month).eq('year', year).maybeSingle();
      return data;
    },
  });

  // Published content for this channel+month
  const { data: contentLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  const channelContentIds = contentLinks.filter(l => l.channel_id === channelId).map(l => l.content_id);

  const { data: publishedContent = [] } = useQuery({
    queryKey: ['channel-published-content', channelId, month, year],
    queryFn: async () => {
      if (channelContentIds.length === 0) return [];
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      const { data } = await supabase.from('content_items').select('*')
        .in('id', channelContentIds)
        .eq('status', 'publicado')
        .gte('scheduled_at', startDate).lt('scheduled_at', endDate)
        .order('scheduled_at');
      return (data || []) as ContentItem[];
    },
    enabled: channelContentIds.length > 0,
  });

  // Content metrics for this channel+month
  const { data: contentMetrics = [] } = useQuery({
    queryKey: ['content-metrics', channelId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics')
        .select('*').eq('channel_id', channelId).eq('month', month).eq('year', year);
      return data || [];
    },
  });

  // Save channel metrics
  const saveChannelMetrics = useCallback(async (field: string, value: any) => {
    if (channelMetrics?.id) {
      await supabase.from('channel_monthly_metrics').update({ [field]: value } as any).eq('id', channelMetrics.id);
    } else {
      await supabase.from('channel_monthly_metrics').insert({
        channel_id: channelId, month, year, [field]: value,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['channel-monthly-metrics', channelId, month, year] });
  }, [channelId, month, year, channelMetrics, queryClient]);

  // Save content metric
  const saveContentMetric = useCallback(async (contentId: string, format: string, field: string, value: any) => {
    const existing = contentMetrics.find((m: any) => m.content_id === contentId);
    if (existing) {
      await supabase.from('content_metrics').update({ [field]: value === '' ? null : Number(value) } as any).eq('id', existing.id);
    } else {
      await supabase.from('content_metrics').insert({
        content_id: contentId, channel_id: channelId, month, year, format, [field]: value === '' ? null : Number(value),
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['content-metrics', channelId, month, year] });
  }, [channelId, month, year, contentMetrics, queryClient]);

  // Top 3 / Worst 3
  const rankedContent = publishedContent
    .map(item => {
      const metric = contentMetrics.find((m: any) => m.content_id === item.id) as any;
      const primaryField = getPrimaryMetricField(item.format || 'estatico');
      const primaryValue = metric?.[primaryField] ?? null;
      return { ...item, primaryValue, primaryField };
    })
    .filter(i => i.primaryValue !== null)
    .sort((a, b) => (b.primaryValue ?? 0) - (a.primaryValue ?? 0));

  const top3 = rankedContent.slice(0, 3);
  const worst3 = rankedContent.length >= 3 ? rankedContent.slice(-3).reverse() : [];

  return (
    <section className="space-y-6">
      {/* Header with back */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{MONTHS[month - 1]} {year} — {channelName}</h2>
      </div>

      {/* Channel Metrics Card */}
      <Card className="border-secondary bg-background">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Métricas do Canal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Seguidores / Subscritores</label>
              <Input
                type="number"
                className="h-9 mt-1"
                defaultValue={channelMetrics?.followers ?? ''}
                key={`followers-${channelMetrics?.id || 'new'}`}
                onBlur={e => saveChannelMetrics('followers', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Crescimento do mês</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  className="h-9"
                  defaultValue={channelMetrics?.followers_growth ?? ''}
                  key={`growth-${channelMetrics?.id || 'new'}`}
                  onBlur={e => saveChannelMetrics('followers_growth', e.target.value ? Number(e.target.value) : null)}
                />
                {channelMetrics?.followers_growth != null && (
                  <span className={cn("text-sm font-medium flex items-center gap-0.5",
                    (channelMetrics.followers_growth as number) >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {(channelMetrics.followers_growth as number) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {(channelMetrics.followers_growth as number) >= 0 ? '+' : ''}{channelMetrics.followers_growth as number}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas / Análise do canal</label>
            <Textarea
              className="mt-1 min-h-[80px]"
              defaultValue={channelMetrics?.notes ?? ''}
              key={`notes-${channelMetrics?.id || 'new'}`}
              placeholder="Análise qualitativa do canal este mês..."
              onBlur={e => saveChannelMetrics('notes', e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Top 3 / Worst 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">Top 3 Publicações</h3>
            </div>
            {top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sem métricas registadas este mês.</p>
            ) : top3.map((item, i) => (
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 hq-transition">
                <span className="text-lg font-bold text-muted-foreground/50 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{FORMAT_OPTIONS.find(f => f.value === item.format)?.label || item.format}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{item.primaryValue?.toLocaleString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">3 Piores Publicações</h3>
            </div>
            {worst3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sem métricas registadas este mês.</p>
            ) : worst3.map((item, i) => (
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 hq-transition">
                <span className="text-lg font-bold text-muted-foreground/50 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{FORMAT_OPTIONS.find(f => f.value === item.format)?.label || item.format}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{item.primaryValue?.toLocaleString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Metrics Table */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Métricas por Publicação</h3>
          {publishedContent.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum conteúdo publicado neste mês neste canal.</p>
          ) : (
            <div className="space-y-6">
              {publishedContent.map(item => {
                const format = item.format || 'estatico';
                const fields = FORMAT_FIELDS[format] || FORMAT_FIELDS['outro'];
                const metric = contentMetrics.find((m: any) => m.content_id === item.id) as any;
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link to={`/hub/marketing/conteudos/${item.id}`} className="text-sm font-medium text-foreground hover:text-primary hq-transition truncate">
                        {item.title}
                      </Link>
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                        {FORMAT_OPTIONS.find(f => f.value === format)?.label || format}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {fields.map(field => (
                        <div key={field}>
                          <label className="text-[10px] text-muted-foreground">{FIELD_LABELS[field] || field}</label>
                          <Input
                            type="number"
                            step={field.includes('rate') || field === 'ctr' ? '0.01' : '1'}
                            className="h-8 text-xs mt-0.5"
                            defaultValue={metric?.[field] ?? ''}
                            key={`${item.id}-${field}-${metric?.id || 'new'}`}
                            onBlur={e => saveContentMetric(item.id, format, field, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
