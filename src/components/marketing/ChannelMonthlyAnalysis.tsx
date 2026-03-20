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
import { STATUS_OPTIONS, FORMAT_OPTIONS, type ContentItem, type ContentChannelLink } from '@/lib/marketing-constants';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
  views: 'Views', reach: 'Alcance', impressions: 'Impr.', likes: 'Gostos',
  comments: 'Coment.', shares: 'Partilhas', saves: 'Guard.', avg_watch_time: 'T. médio',
  watch_hours: 'H. vistas', new_subscribers: 'Novos subs', ctr: 'CTR',
  story_replies: 'Respostas', story_link_clicks: 'Cl. link', story_exits: 'Saídas',
  pin_link_clicks: 'Cl. link', email_sent: 'Enviados', email_open_rate: 'Tx. abert.',
  email_click_rate: 'Tx. clique', email_unsubscribes: 'Unsubs',
};

function getPrimaryMetricField(fmt: string): string {
  return ['reels', 'short_tiktok', 'vlog', 'longo_youtube'].includes(fmt) ? 'views' : 'reach';
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

  const { data: channelMetrics } = useQuery({
    queryKey: ['channel-monthly-metrics', channelId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics')
        .select('*').eq('channel_id', channelId).eq('month', month).eq('year', year).maybeSingle();
      return data;
    },
  });

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

  const { data: contentMetrics = [] } = useQuery({
    queryKey: ['content-metrics', channelId, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics')
        .select('*').eq('channel_id', channelId).eq('month', month).eq('year', year);
      return data || [];
    },
  });

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

  const saveContentMetric = useCallback(async (contentId: string, fmt: string, field: string, value: any) => {
    const existing = contentMetrics.find((m: any) => m.content_id === contentId);
    if (existing) {
      await supabase.from('content_metrics').update({ [field]: value === '' ? null : Number(value) } as any).eq('id', existing.id);
    } else {
      await supabase.from('content_metrics').insert({
        content_id: contentId, channel_id: channelId, month, year, format: fmt, [field]: value === '' ? null : Number(value),
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['content-metrics', channelId, month, year] });
  }, [channelId, month, year, contentMetrics, queryClient]);

  // Ranking
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

  // Collect all unique metric fields across published content
  const allFields = new Set<string>();
  publishedContent.forEach(item => {
    const fmt = item.format || 'estatico';
    (FORMAT_FIELDS[fmt] || FORMAT_FIELDS['outro']).forEach(f => allFields.add(f));
  });
  const metricColumns = Array.from(allFields);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{MONTHS[month - 1]} {year} — {channelName}</h2>
      </div>

      {/* Channel Metrics */}
      <Card className="border-secondary bg-background">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Métricas do Canal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Seguidores / Subscritores</label>
              <Input type="number" className="h-9 mt-1"
                defaultValue={channelMetrics?.followers ?? ''}
                key={`followers-${channelMetrics?.id || 'new'}`}
                onBlur={e => saveChannelMetrics('followers', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Crescimento do mês</label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" className="h-9"
                  defaultValue={channelMetrics?.followers_growth ?? ''}
                  key={`growth-${channelMetrics?.id || 'new'}`}
                  onBlur={e => saveChannelMetrics('followers_growth', e.target.value ? Number(e.target.value) : null)} />
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
            <label className="text-xs text-muted-foreground">Notas / Análise</label>
            <Textarea className="mt-1 min-h-[80px]"
              defaultValue={channelMetrics?.notes ?? ''}
              key={`notes-${channelMetrics?.id || 'new'}`}
              placeholder="Análise qualitativa do canal este mês..."
              onBlur={e => saveChannelMetrics('notes', e.target.value || null)} />
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

      {/* Metrics Table — compact */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Métricas por Publicação</h3>
          {publishedContent.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum conteúdo publicado neste mês neste canal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap min-w-[140px]">Título</th>
                    <th className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">Data</th>
                    <th className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">Formato</th>
                    {metricColumns.map(col => (
                      <th key={col} className="text-center p-2 font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">
                        {FIELD_LABELS[col] || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {publishedContent.map(item => {
                    const fmt = item.format || 'estatico';
                    const itemFields = new Set(FORMAT_FIELDS[fmt] || FORMAT_FIELDS['outro']);
                    const metric = contentMetrics.find((m: any) => m.content_id === item.id) as any;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-2">
                          <Link to={`/hub/marketing/conteudos/${item.id}`} className="font-medium text-foreground hover:text-primary hq-transition truncate block max-w-[180px]">
                            {item.title}
                          </Link>
                        </td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">
                          {item.scheduled_at ? format(new Date(item.scheduled_at), 'dd/MM', { locale: pt }) : '—'}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {FORMAT_OPTIONS.find(f => f.value === fmt)?.label || fmt}
                          </Badge>
                        </td>
                        {metricColumns.map(col => (
                          <td key={col} className="p-1 text-center">
                            {itemFields.has(col) ? (
                              <Input
                                type="number"
                                step={col.includes('rate') || col === 'ctr' ? '0.01' : '1'}
                                className="h-7 text-xs text-center w-[70px] mx-auto"
                                defaultValue={metric?.[col] ?? ''}
                                key={`${item.id}-${col}-${metric?.id || 'new'}`}
                                onBlur={e => saveContentMetric(item.id, fmt, col, e.target.value)}
                              />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
