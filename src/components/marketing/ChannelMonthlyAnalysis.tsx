import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

// Platform-specific metric field definitions
type MetricRow = { label: string; field: string; type: 'number' | 'decimal' | 'computed' | 'text' };

const PLATFORM_METRICS: Record<string, MetricRow[]> = {
  instagram: [
    { label: 'Seguidores', field: 'followers', type: 'number' },
    { label: 'Crescimento do mês', field: 'followers_growth', type: 'number' },
    { label: 'Contas alcançadas', field: 'ig_accounts_reached', type: 'number' },
    { label: 'Impressões totais', field: 'ig_total_impressions', type: 'number' },
    { label: 'Visitas ao perfil', field: 'ig_profile_visits', type: 'number' },
    { label: 'Cliques no link da bio', field: 'ig_bio_link_clicks', type: 'number' },
    { label: 'Média de likes', field: 'ig_avg_likes', type: 'decimal' },
    { label: 'Média de comentários', field: 'ig_avg_comments', type: 'decimal' },
    { label: 'Média de guardados', field: 'ig_avg_saves', type: 'decimal' },
    { label: 'Taxa de engagement', field: 'ig_engagement_rate', type: 'computed' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
  youtube: [
    { label: 'Subscritores', field: 'followers', type: 'number' },
    { label: 'Crescimento de subscritores', field: 'followers_growth', type: 'number' },
    { label: 'Visualizações totais do canal', field: 'yt_total_views', type: 'number' },
    { label: 'Horas de visualização totais', field: 'yt_watch_hours', type: 'decimal' },
    { label: 'Novos subscritores do mês', field: 'yt_new_subscribers', type: 'number' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
  tiktok: [
    { label: 'Seguidores', field: 'followers', type: 'number' },
    { label: 'Crescimento do mês', field: 'followers_growth', type: 'number' },
    { label: 'Visualizações totais', field: 'tt_total_views', type: 'number' },
    { label: 'Likes totais', field: 'tt_total_likes', type: 'number' },
    { label: 'Partilhas totais', field: 'tt_total_shares', type: 'number' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
  linkedin: [
    { label: 'Seguidores', field: 'followers', type: 'number' },
    { label: 'Crescimento do mês', field: 'followers_growth', type: 'number' },
    { label: 'Impressões totais', field: 'li_total_impressions', type: 'number' },
    { label: 'Visitas à página', field: 'li_page_visits', type: 'number' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
  pinterest: [
    { label: 'Seguidores', field: 'followers', type: 'number' },
    { label: 'Crescimento do mês', field: 'followers_growth', type: 'number' },
    { label: 'Impressões mensais', field: 'pt_monthly_impressions', type: 'number' },
    { label: 'Cliques totais', field: 'pt_total_clicks', type: 'number' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
  email: [
    { label: 'Total da lista', field: 'em_list_total', type: 'number' },
    { label: 'Crescimento da lista', field: 'em_list_growth', type: 'number' },
    { label: 'Taxa média de abertura (%)', field: 'em_avg_open_rate', type: 'decimal' },
    { label: 'Taxa média de cliques (%)', field: 'em_avg_click_rate', type: 'decimal' },
    { label: 'Notas', field: 'notes', type: 'text' },
  ],
};

// Map channel name to platform key
function getPlatformKey(channelName: string): string | null {
  const n = channelName.toLowerCase().trim();
  if (n.includes('instagram')) return 'instagram';
  if (n.includes('youtube')) return 'youtube';
  if (n.includes('tiktok')) return 'tiktok';
  if (n.includes('linkedin')) return 'linkedin';
  if (n.includes('pinterest')) return 'pinterest';
  if (n.includes('email') || n.includes('newsletter')) return 'email';
  return null; // generic fallback
}

function computeEngagementRate(metrics: any): string {
  if (!metrics) return '—';
  const likes = Number(metrics.ig_avg_likes) || 0;
  const comments = Number(metrics.ig_avg_comments) || 0;
  const saves = Number(metrics.ig_avg_saves) || 0;
  const reached = Number(metrics.ig_accounts_reached) || 0;
  if (reached === 0) return '—';
  return ((likes + comments + saves) / reached * 100).toFixed(2) + '%';
}

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
    const parsed = value === '' ? null : (typeof value === 'string' ? Number(value) : value);
    if (channelMetrics?.id) {
      await supabase.from('channel_monthly_metrics').update({ [field]: field === 'notes' ? (value || null) : parsed } as any).eq('id', channelMetrics.id);
    } else {
      await supabase.from('channel_monthly_metrics').insert({
        channel_id: channelId, month, year, [field]: field === 'notes' ? (value || null) : parsed,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['channel-monthly-metrics', channelId, month, year] });
  }, [channelId, month, year, channelMetrics, queryClient]);

  // After saving IG fields, auto-compute engagement rate
  const saveIgMetricAndComputeEngagement = useCallback(async (field: string, value: any) => {
    await saveChannelMetrics(field, value);
    // Re-fetch and compute
    const { data: fresh } = await supabase.from('channel_monthly_metrics')
      .select('*').eq('channel_id', channelId).eq('month', month).eq('year', year).maybeSingle();
    if (fresh) {
      const likes = Number((fresh as any).ig_avg_likes) || 0;
      const comments = Number((fresh as any).ig_avg_comments) || 0;
      const saves = Number((fresh as any).ig_avg_saves) || 0;
      const reached = Number((fresh as any).ig_accounts_reached) || 0;
      const rate = reached > 0 ? ((likes + comments + saves) / reached * 100) : null;
      await supabase.from('channel_monthly_metrics').update({ ig_engagement_rate: rate !== null ? Number(rate.toFixed(4)) : null } as any).eq('id', fresh.id);
      queryClient.invalidateQueries({ queryKey: ['channel-monthly-metrics', channelId, month, year] });
    }
  }, [saveChannelMetrics, channelId, month, year, queryClient]);

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

  const allFields = new Set<string>();
  publishedContent.forEach(item => {
    const fmt = item.format || 'estatico';
    (FORMAT_FIELDS[fmt] || FORMAT_FIELDS['outro']).forEach(f => allFields.add(f));
  });
  const metricColumns = Array.from(allFields);

  const platformKey = getPlatformKey(channelName);
  const platformRows = platformKey ? PLATFORM_METRICS[platformKey] : null;

  // IG engagement fields for auto-compute trigger
  const igEngagementFields = new Set(['ig_avg_likes', 'ig_avg_comments', 'ig_avg_saves', 'ig_accounts_reached']);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">{MONTHS[month - 1]} {year} — {channelName}</h2>
        </div>
      </div>

      {/* Platform-specific Channel Metrics Table */}
      <Card className="border-secondary bg-background">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Métricas do Canal</h3>
          {platformRows ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2.5 font-medium text-muted-foreground w-1/2">Métrica</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground w-1/2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map(row => {
                    const metricsAny = channelMetrics as any;
                    const val = metricsAny?.[row.field] ?? '';
                    const metricKey = `${row.field}-${channelMetrics?.id || 'new'}`;

                    if (row.type === 'computed') {
                      return (
                        <tr key={row.field} className="border-b last:border-0">
                          <td className="p-2.5 text-muted-foreground">{row.label}</td>
                          <td className="p-2.5">
                            <span className="text-sm font-semibold text-foreground">
                              {computeEngagementRate(metricsAny)}
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    if (row.type === 'text') {
                      return (
                        <tr key={row.field} className="border-b last:border-0">
                          <td className="p-2.5 text-muted-foreground align-top">{row.label}</td>
                          <td className="p-2.5">
                            <Textarea
                              className="min-h-[60px] text-sm"
                              defaultValue={val}
                              key={metricKey}
                              placeholder="Análise qualitativa..."
                              onBlur={e => saveChannelMetrics(row.field, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    }

                    const isGrowthField = row.field === 'followers_growth' || row.field === 'em_list_growth';
                    const numVal = val !== '' && val != null ? Number(val) : null;
                    const saveFn = igEngagementFields.has(row.field) ? saveIgMetricAndComputeEngagement : saveChannelMetrics;

                    return (
                      <tr key={row.field} className="border-b last:border-0">
                        <td className="p-2.5 text-muted-foreground">{row.label}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step={row.type === 'decimal' ? '0.01' : '1'}
                              className="h-8 w-40"
                              defaultValue={val}
                              key={metricKey}
                              onBlur={e => saveFn(row.field, e.target.value)}
                            />
                            {isGrowthField && numVal != null && (
                              <span className={cn("text-xs font-medium flex items-center gap-0.5",
                                numVal >= 0 ? 'text-success' : 'text-red-500')}>
                                {numVal >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {numVal >= 0 ? '+' : ''}{numVal}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Generic fallback for unknown platforms */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2.5 font-medium text-muted-foreground w-1/2">Métrica</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground w-1/2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Seguidores', field: 'followers' },
                    { label: 'Crescimento do mês', field: 'followers_growth' },
                  ].map(row => (
                    <tr key={row.field} className="border-b">
                      <td className="p-2.5 text-muted-foreground">{row.label}</td>
                      <td className="p-2.5">
                        <Input type="number" className="h-8 w-40"
                          defaultValue={(channelMetrics as any)?.[row.field] ?? ''}
                          key={`${row.field}-${channelMetrics?.id || 'new'}`}
                          onBlur={e => saveChannelMetrics(row.field, e.target.value)} />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b last:border-0">
                    <td className="p-2.5 text-muted-foreground align-top">Notas</td>
                    <td className="p-2.5">
                      <Textarea className="min-h-[60px] text-sm"
                        defaultValue={channelMetrics?.notes ?? ''}
                        key={`notes-${channelMetrics?.id || 'new'}`}
                        onBlur={e => saveChannelMetrics('notes', e.target.value)} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
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
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
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
                          <Link to={`/hub/marketing/conteudos/${item.id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate block max-w-[180px]">
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
