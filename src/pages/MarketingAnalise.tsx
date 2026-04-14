import { useState, useMemo, useCallback } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { YearSelector } from '@/components/YearSelector';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BackNavigation } from '@/components/BackNavigation';
import { ChevronLeft, ChevronRight, Trophy, ThumbsDown, TrendingUp, TrendingDown, Target, BarChart3, Filter, Zap, ArrowLeft, Pencil } from 'lucide-react';
import { MonthNavHeader } from '@/components/MonthNavHeader';
import { cn } from '@/lib/utils';
import { FORMAT_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getPrimaryMetricField(format: string): string {
  const videoFormats = ['reels', 'short_tiktok', 'vlog', 'longo_youtube'];
  return videoFormats.includes(format) ? 'views' : 'reach';
}

// Platform detection from channel name
function detectPlatform(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('instagram')) return 'instagram';
  if (n.includes('youtube')) return 'youtube';
  if (n.includes('tiktok')) return 'tiktok';
  if (n.includes('linkedin')) return 'linkedin';
  if (n.includes('pinterest')) return 'pinterest';
  if (n.includes('email') || n.includes('newsletter')) return 'email';
  return 'generic';
}

// Platform-specific metric columns
function getPlatformMetrics(platform: string, metrics: any): { label: string; value: any }[] {
  if (!metrics) return [];
  const fmt = (v: any) => v != null ? Number(v).toLocaleString('pt-PT') : null;
  const fmtPct = (v: any) => v != null ? `${Number(v).toFixed(1)}%` : null;

  switch (platform) {
    case 'instagram':
      return [
        { label: 'Seguidores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
        { label: 'Impressões', value: fmt(metrics.ig_total_impressions) },
        { label: 'Engagement', value: fmtPct(metrics.ig_engagement_rate) },
        { label: 'Visitas perfil', value: fmt(metrics.ig_profile_visits) },
      ];
    case 'youtube':
      return [
        { label: 'Subscritores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
        { label: 'Visualizações', value: fmt(metrics.yt_total_views) },
        { label: 'Horas visualização', value: metrics.yt_watch_hours != null ? Number(metrics.yt_watch_hours).toLocaleString('pt-PT') : null },
        { label: 'Novos subs', value: fmt(metrics.yt_new_subscribers) },
      ];
    case 'tiktok':
      return [
        { label: 'Seguidores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
        { label: 'Visualizações', value: fmt(metrics.tt_total_views) },
        { label: 'Likes totais', value: fmt(metrics.tt_total_likes) },
      ];
    case 'linkedin':
      return [
        { label: 'Seguidores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
        { label: 'Impressões', value: fmt(metrics.li_total_impressions) },
        { label: 'Visitas página', value: fmt(metrics.li_page_visits) },
      ];
    case 'pinterest':
      return [
        { label: 'Seguidores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
        { label: 'Impressões', value: fmt(metrics.pt_monthly_impressions) },
        { label: 'Cliques', value: fmt(metrics.pt_total_clicks) },
      ];
    case 'email':
      return [
        { label: 'Total lista', value: fmt(metrics.em_list_total) },
        { label: 'Crescimento', value: fmt(metrics.em_list_growth) },
        { label: 'Taxa abertura', value: fmtPct(metrics.em_avg_open_rate) },
        { label: 'Taxa cliques', value: fmtPct(metrics.em_avg_click_rate) },
      ];
    default:
      return [
        { label: 'Seguidores', value: fmt(metrics.followers) },
        { label: 'Crescimento', value: metrics.followers_growth != null ? `${metrics.followers_growth >= 0 ? '+' : ''}${metrics.followers_growth}` : null },
      ];
  }
}

// ─── Month Detail ───
function MonthDetail({ month, year, onBack, onChangeMonth }: { month: number; year: number; onBack: () => void; onChangeMonth: (m: number, y: number) => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isKpiEnabled, isAreaEnabled } = useKpiSettings();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order');
      return (data || []) as MarketingChannel[];
    },
  });
  const activeChannels = channels.filter(c => c.is_active && c.name.toLowerCase() !== 'website');

  const { data: allContent = [] } = useQuery({
    queryKey: ['content-items-month', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*')
        .gte('scheduled_at', startDate).lt('scheduled_at', endDate).order('scheduled_at');
      return (data || []) as ContentItem[];
    },
  });

  const publishedContent = allContent.filter(i => i.status === 'publicado');
  const plannedCount = allContent.length;
  const publishedCount = publishedContent.length;
  const executionRate = plannedCount > 0 ? Math.round((publishedCount / plannedCount) * 100) : 0;

  const { data: contentLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  const { data: allMetrics = [] } = useQuery({
    queryKey: ['content-metrics-all', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics').select('*').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  const { data: channelMetrics = [] } = useQuery({
    queryKey: ['channel-monthly-metrics-all', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics').select('*').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ['marketing-objectives', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('executive_goals').select('*')
        .eq('area', 'marketing').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ['marketing-funnels-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_funnels').select('id, status');
      return data || [];
    },
  });
  const activeFunnels = funnels.filter((f: any) => f.status === 'ativo' || f.status === 'active').length;

  const { data: automations = [] } = useQuery({
    queryKey: ['marketing-automations-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_automations').select('id, status');
      return data || [];
    },
  });
  const activeAutomations = automations.filter((a: any) => a.status === 'ativa' || a.status === 'active' || a.status === 'ativo').length;

  const { data: analysis } = useQuery({
    queryKey: ['marketing-monthly-analysis', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_monthly_analysis')
        .select('*').eq('month', month).eq('year', year).maybeSingle();
      return data;
    },
  });

  const saveAnalysis = useCallback(async (field: string, value: string) => {
    if (analysis?.id) {
      await supabase.from('marketing_monthly_analysis').update({ [field]: value || null } as any).eq('id', analysis.id);
    } else {
      await supabase.from('marketing_monthly_analysis').insert({ month, year, [field]: value || null } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['marketing-monthly-analysis', month, year] });
  }, [analysis, month, year, queryClient]);

  const rankedContent = publishedContent
    .map(item => {
      const metric = allMetrics.find((m: any) => m.content_id === item.id) as any;
      const primaryField = getPrimaryMetricField(item.format || 'estatico');
      const primaryValue = metric?.[primaryField] ?? null;
      return { ...item, primaryValue, primaryField };
    })
    .filter(i => i.primaryValue !== null)
    .sort((a, b) => (b.primaryValue ?? 0) - (a.primaryValue ?? 0));

  const top3 = rankedContent.slice(0, 3);
  const worst3 = rankedContent.length >= 3 ? rankedContent.slice(-3).reverse() : [];

  // Build rich channel summary with platform-specific metrics
  const channelSummary = activeChannels.map(ch => {
    const metrics = channelMetrics.find((m: any) => m.channel_id === ch.id) as any;
    const platform = detectPlatform(ch.name);
    const chContentIds = contentLinks.filter(l => l.channel_id === ch.id).map(l => l.content_id);
    const pubCount = publishedContent.filter(c => chContentIds.includes(c.id)).length;
    const platformMetrics = getPlatformMetrics(platform, metrics);
    const hasData = metrics != null;
    return { id: ch.id, name: ch.name, platform, published: pubCount, platformMetrics, hasData };
  });

  return (
    <div className="w-full space-y-8">
      <MonthNavHeader monthIdx={month - 1} year={year} onBack={onBack} onChangeMonth={(m, y) => onChangeMonth(m + 1, y)} />

      {/* 1. Objectives */}
      {isAreaEnabled('marketing') && isKpiEnabled('marketing', 'objetivos_marketing') && (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Objetivos de Marketing</h2>
        </div>
        {objectives.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground italic">Nenhum objetivo de marketing definido para este mês.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {objectives.map((obj: any) => {
              const target = obj.target_value || 0;
              const current = obj.current_value || 0;
              const pct = target > 0 ? (current / target) * 100 : 0;
              const color = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500';
              const bgColor = pct >= 100 ? 'bg-emerald-50 dark:bg-emerald-950' : pct >= 70 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-red-50 dark:bg-red-950';
              return (
                <Card key={obj.id} className={bgColor}>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-sm font-medium text-foreground">{obj.meta}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Alvo: {target}</span>
                      <span className={cn("text-sm font-bold", color)}>{current} ({Math.round(pct)}%)</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      )}

      <Separator />

      {/* 2. Execution */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Execução de Conteúdos</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-5 text-center">
            <p className="text-2xl font-bold text-foreground">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent></Card>
          <Card><CardContent className="p-5 text-center">
            <p className="text-2xl font-bold text-foreground">{plannedCount}</p>
            <p className="text-xs text-muted-foreground">Planeados</p>
          </CardContent></Card>
          <Card><CardContent className="p-5 text-center">
            <p className={cn("text-2xl font-bold", executionRate >= 80 ? 'text-emerald-600' : executionRate >= 50 ? 'text-amber-600' : 'text-red-500')}>{executionRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de execução</p>
          </CardContent></Card>
        </div>
      </section>

      <Separator />

      {/* 3. Top 3 / Worst 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-semibold">Top 3 Publicações</h3></div>
            {top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sem dados suficientes.</p>
            ) : top3.map((item, i) => (
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
                <span className="text-lg font-bold text-muted-foreground/50 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{FORMAT_OPTIONS.find(f => f.value === item.format)?.label || item.format}</p>
                </div>
                <span className="text-sm font-semibold">{item.primaryValue?.toLocaleString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">3 Piores Publicações</h3></div>
            {worst3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sem dados suficientes.</p>
            ) : worst3.map((item, i) => (
              <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
                <span className="text-lg font-bold text-muted-foreground/50 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{FORMAT_OPTIONS.find(f => f.value === item.format)?.label || item.format}</p>
                </div>
                <span className="text-sm font-semibold">{item.primaryValue?.toLocaleString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* 4. Channel Summary — platform-specific metrics */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Resumo por Canal</h2>
        <div className="space-y-3">
          {channelSummary.map(ch => (
            <Card
              key={ch.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/hub/marketing/canais/${ch.id}?month=${month}&year=${year}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-foreground">{ch.name}</span>
                  <span className="text-xs text-muted-foreground">{ch.published} publicações</span>
                </div>
                {ch.hasData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {ch.platformMetrics.map((pm, i) => (
                      <div key={i} className="text-center">
                        <p className={cn(
                          "text-sm font-bold",
                          pm.label === 'Crescimento' && pm.value
                            ? (pm.value.startsWith('+') ? 'text-emerald-600' : pm.value.startsWith('-') ? 'text-destructive' : 'text-foreground')
                            : 'text-foreground'
                        )}>
                          {pm.value ?? '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{pm.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-xs text-muted-foreground">Sem métricas para este mês</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-primary gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hub/marketing/canais/${ch.id}?month=${month}&year=${year}`);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Preencher métricas
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* 5. Funnels & Automations */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/hub/marketing/funis">
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3"><Filter className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeFunnels}</p>
                <p className="text-xs text-muted-foreground">Funis ativos</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/hub/marketing/automacoes">
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3"><Zap className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeAutomations}</p>
                <p className="text-xs text-muted-foreground">Automações ativas</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Separator />

      {/* 6. Qualitative Analysis */}
      <section className="space-y-3 pb-10">
        <h2 className="text-base font-semibold text-foreground">Análise Qualitativa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">O que correu bem</label>
            <Textarea
              className="min-h-[120px]"
              placeholder="Pontos positivos do mês..."
              defaultValue={analysis?.what_went_well ?? ''}
              key={`well-${analysis?.id || 'new'}-${month}-${year}`}
              onBlur={e => saveAnalysis('what_went_well', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">O que correu mal</label>
            <Textarea
              className="min-h-[120px]"
              placeholder="Pontos a melhorar..."
              defaultValue={analysis?.what_went_wrong ?? ''}
              key={`wrong-${analysis?.id || 'new'}-${month}-${year}`}
              onBlur={e => saveAnalysis('what_went_wrong', e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Gallery ───
export default function MarketingAnalisePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data: yearContent = [] } = useQuery({
    queryKey: ['content-items-year', year],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('id, status, scheduled_at')
        .gte('scheduled_at', `${year}-01-01`).lt('scheduled_at', `${year + 1}-01-01`);
      return (data || []) as Pick<ContentItem, 'id' | 'status' | 'scheduled_at'>[];
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order');
      return (data || []) as MarketingChannel[];
    },
  });
  const activeChannels = channels.filter(c => c.is_active && c.name.toLowerCase() !== 'website');

  // All channel metrics for the year (to find first + latest months with data)
  const { data: yearChannelMetrics = [] } = useQuery({
    queryKey: ['channel-metrics-year', year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics').select('*').eq('year', year).order('month');
      return data || [];
    },
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ['marketing-funnels-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_funnels').select('id, status');
      return data || [];
    },
  });
  const activeFunnels = funnels.filter((f: any) => f.status === 'ativo' || f.status === 'active').length;

  const { data: automations = [] } = useQuery({
    queryKey: ['marketing-automations-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_automations').select('id, status');
      return data || [];
    },
  });
  const activeAutomations = automations.filter((a: any) => a.status === 'ativa' || a.status === 'active' || a.status === 'ativo').length;

  const { data: yearObjectives = [] } = useQuery({
    queryKey: ['marketing-objectives-year', year],
    queryFn: async () => {
      const { data } = await supabase.from('executive_goals').select('*').eq('area', 'marketing').eq('year', year);
      return data || [];
    },
  });

  // Content metrics for the year (for top 3 publications)
  const { data: yearContentMetrics = [] } = useQuery({
    queryKey: ['content-metrics-year', year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics').select('*').eq('year', year);
      return data || [];
    },
  });

  // Full content items for the year (need title, format)
  const { data: yearContentFull = [] } = useQuery({
    queryKey: ['content-items-year-full', year],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('id, title, format, status, scheduled_at')
        .gte('scheduled_at', `${year}-01-01`).lt('scheduled_at', `${year + 1}-01-01`);
      return (data || []) as any[];
    },
  });

  const { data: contentLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  // Traffic creatives for the year
  const { data: trafficCreatives = [] } = useQuery({
    queryKey: ['traffic-creatives-year', year],
    queryFn: async () => {
      const { data } = await supabase.from('traffic_creatives').select('id, status, created_at')
        .gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`);
      return data || [];
    },
  });

  // ─── Annual summary ───
  const annualSummary = useMemo(() => {
    const totalPlanned = yearContent.length;
    const totalPublished = yearContent.filter(c => c.status === 'publicado').length;
    const executionRate = totalPlanned > 0 ? Math.round((totalPublished / totalPlanned) * 100) : 0;

    // Channel growth
    const channelGrowth = activeChannels.map(ch => {
      const chMetrics = (yearChannelMetrics as any[])
        .filter(m => m.channel_id === ch.id && m.followers != null)
        .sort((a, b) => a.month - b.month);
      if (chMetrics.length === 0) {
        return { id: ch.id, name: ch.name, startFollowers: null, currentFollowers: null, growth: null, growthPct: null };
      }
      const startFollowers = chMetrics[0].followers;
      const currentFollowers = chMetrics[chMetrics.length - 1].followers;
      const growth = currentFollowers - startFollowers;
      const growthPct = startFollowers > 0 ? Math.round((growth / startFollowers) * 100) : null;
      return { id: ch.id, name: ch.name, startFollowers, currentFollowers, growth, growthPct };
    });

    // Top 3 publications of the year
    const top3Year = yearContentFull
      .filter(c => c.status === 'publicado')
      .map(item => {
        const metric = yearContentMetrics.find((m: any) => m.content_id === item.id) as any;
        const primaryField = getPrimaryMetricField(item.format || 'estatico');
        const primaryValue = metric?.[primaryField] ?? null;
        const channelId = metric?.channel_id;
        const channelName = channels.find(ch => ch.id === channelId)?.name || '';
        return { ...item, primaryValue, primaryField, channelName };
      })
      .filter(i => i.primaryValue !== null)
      .sort((a, b) => (b.primaryValue ?? 0) - (a.primaryValue ?? 0))
      .slice(0, 3);

    // Best growth channel
    const bestGrowth = channelGrowth
      .filter(c => c.growthPct != null)
      .sort((a, b) => (b.growthPct ?? 0) - (a.growthPct ?? 0))[0] || null;

    // Best avg engagement (Instagram only)
    const igChannels = activeChannels.filter(ch => detectPlatform(ch.name) === 'instagram');
    let bestEngagement: { name: string; avgEngagement: number } | null = null;
    if (igChannels.length > 0) {
      const engagements = igChannels.map(ch => {
        const chMetrics = (yearChannelMetrics as any[])
          .filter(m => m.channel_id === ch.id && m.ig_engagement_rate != null);
        if (chMetrics.length === 0) return null;
        const avg = chMetrics.reduce((s: number, m: any) => s + Number(m.ig_engagement_rate), 0) / chMetrics.length;
        return { name: ch.name, avgEngagement: avg };
      }).filter(Boolean) as { name: string; avgEngagement: number }[];
      if (engagements.length > 0) bestEngagement = engagements.sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
    }

    // Traffic creatives
    const totalCreatives = trafficCreatives.length;
    const creativesInCampaign = trafficCreatives.filter((c: any) => c.status === 'em_campanha').length;

    // Objectives classification
    const objectivesClassified = yearObjectives.map((o: any) => {
      const target = Number(o.target_value) || 0;
      const current = Number(o.current_value);
      let classification: 'superado' | 'atingido' | 'proximo' | 'nao_atingido' | 'sem_dados';
      if (o.current_value == null || o.current_value === '') {
        classification = 'sem_dados';
      } else if (target === 0) {
        classification = 'sem_dados';
      } else if (current > target) {
        classification = 'superado';
      } else if (current === target) {
        classification = 'atingido';
      } else if (current >= target * 0.7) {
        classification = 'proximo';
      } else {
        classification = 'nao_atingido';
      }
      return { ...o, classification, target, current };
    });
    const objectivesAchievedOrSurpassed = objectivesClassified.filter(o => o.classification === 'atingido' || o.classification === 'superado').length;

    return {
      totalPublished, totalPlanned, executionRate, channelGrowth,
      activeFunnels, activeAutomations,
      objectivesAchieved: objectivesAchievedOrSurpassed, objectivesTotal: yearObjectives.length,
      top3Year, bestGrowth, bestEngagement, totalCreatives, creativesInCampaign, objectivesClassified,
    };
  }, [yearContent, activeChannels, yearChannelMetrics, yearObjectives, activeFunnels, activeAutomations, yearContentFull, yearContentMetrics, channels, trafficCreatives]);

  const monthSummaries = useMemo(() => {
    return MONTHS.map((name, idx) => {
      const m = idx + 1;
      const monthContent = yearContent.filter(c => {
        if (!c.scheduled_at) return false;
        return new Date(c.scheduled_at).getMonth() + 1 === m;
      });
      const published = monthContent.filter(c => c.status === 'publicado').length;
      const planned = monthContent.length;
      const rate = planned > 0 ? Math.round((published / planned) * 100) : 0;
      return { name, published, planned, rate };
    });
  }, [yearContent]);

  if (selectedMonth !== null) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader title="Análise de Marketing" />
          <div className="space-y-6">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <MonthDetail month={selectedMonth} year={year} onBack={() => setSelectedMonth(null)} onChangeMonth={(m, y) => { setSelectedMonth(m); setYear(y); }} />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Análise de Marketing" />
        <div className="space-y-6">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          <YearSelector year={year} onChange={setYear} />

          {/* ─── Annual Summary ─── */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Resumo {year}</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.totalPublished} / {annualSummary.totalPlanned}</p>
                  <p className="text-xs text-muted-foreground">Publicados / Planeados</p>
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className={cn("text-2xl font-bold", annualSummary.executionRate >= 80 ? 'text-emerald-600' : annualSummary.executionRate >= 50 ? 'text-amber-600' : 'text-destructive')}>{annualSummary.executionRate}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de execução anual</p>
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.activeFunnels}</p>
                  <p className="text-xs text-muted-foreground">Funis ativos</p>
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.activeAutomations}</p>
                  <p className="text-xs text-muted-foreground">Automações ativas</p>
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.objectivesAchieved} / {annualSummary.objectivesTotal}</p>
                  <p className="text-xs text-muted-foreground">Objetivos atingidos</p>
                </CardContent>
              </Card>
            </div>

            {/* Channel growth — real data */}
            {annualSummary.channelGrowth.length > 0 && (
              <Card className="border-secondary bg-background">
                <CardContent className="p-0">
                  <div className="px-4 py-2 bg-muted/30 text-xs font-medium grid grid-cols-5 gap-2 border-b">
                    <span>Canal</span><span className="text-right">Início do ano</span><span className="text-right">Atual</span><span className="text-right">Crescimento</span><span className="text-right">%</span>
                  </div>
                  {annualSummary.channelGrowth.map(ch => (
                    <div key={ch.id} className="px-4 py-2.5 text-sm grid grid-cols-5 gap-2 border-b last:border-0">
                      <span className="font-medium">{ch.name}</span>
                      <span className="text-right text-muted-foreground">{ch.startFollowers?.toLocaleString() ?? '—'}</span>
                      <span className="text-right text-muted-foreground">{ch.currentFollowers?.toLocaleString() ?? '—'}</span>
                      <span className={cn("text-right font-medium", ch.growth != null && ch.growth >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                        {ch.growth != null ? `${ch.growth >= 0 ? '+' : ''}${ch.growth.toLocaleString()}` : '—'}
                      </span>
                      <span className={cn("text-right font-medium", ch.growthPct != null && ch.growthPct >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                        {ch.growthPct != null ? `${ch.growthPct >= 0 ? '+' : ''}${ch.growthPct}%` : '—'}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Top 3 publications of the year */}
            <Card className="border-secondary bg-background">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-semibold">Top 3 Publicações do Ano</h3></div>
                {annualSummary.top3Year.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sem dados de performance suficientes para este ano.</p>
                ) : annualSummary.top3Year.map((item: any, i: number) => (
                  <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors">
                    <span className="text-lg font-bold text-muted-foreground/50 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{item.channelName || '—'}</span>
                        <span>·</span>
                        <span className="capitalize">{FORMAT_OPTIONS.find((f: any) => f.value === item.format)?.label || item.format}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{item.primaryValue?.toLocaleString('pt-PT')}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Best performing channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Maior crescimento %</p>
                  {annualSummary.bestGrowth ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{annualSummary.bestGrowth.name}</p>
                      <p className="text-emerald-600 font-semibold">+{annualSummary.bestGrowth.growthPct}%</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Maior engagement médio (IG)</p>
                  {annualSummary.bestEngagement ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{annualSummary.bestEngagement.name}</p>
                      <p className="text-primary font-semibold">{annualSummary.bestEngagement.avgEngagement.toFixed(1)}%</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Traffic creatives */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.totalCreatives}</p>
                  <p className="text-xs text-muted-foreground">Criativos criados</p>
                </CardContent>
              </Card>
              <Card className="border-secondary bg-background">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{annualSummary.creativesInCampaign}</p>
                  <p className="text-xs text-muted-foreground">Em campanha</p>
                </CardContent>
              </Card>
            </div>

            {/* Marketing objectives analysis */}
            <Card className="border-secondary bg-background">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Como correu o marketing em {year}</h3>
                  {annualSummary.objectivesClassified.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${annualSummary.objectivesTotal > 0 ? (annualSummary.objectivesAchieved / annualSummary.objectivesTotal) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {annualSummary.objectivesAchieved} de {annualSummary.objectivesTotal} atingidos ou superados
                        </span>
                      </div>
                      <div className="space-y-2">
                        {annualSummary.objectivesClassified.map((o: any) => {
                          const badges: Record<string, { label: string; cls: string }> = {
                            superado: { label: 'Superado', cls: 'bg-emerald-700 text-white' },
                            atingido: { label: 'Atingido', cls: 'bg-emerald-500 text-white' },
                            proximo: { label: 'Próximo', cls: 'bg-amber-500 text-white' },
                            nao_atingido: { label: 'Não atingido', cls: 'bg-destructive text-destructive-foreground' },
                            sem_dados: { label: 'Sem dados', cls: 'bg-muted text-muted-foreground' },
                          };
                          const b = badges[o.classification] || badges.sem_dados;
                          return (
                            <div key={o.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{o.meta}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Alvo: {o.target} · Real: {o.current_value != null && o.current_value !== '' ? o.current : '—'}
                                </p>
                              </div>
                              <Badge className={cn('text-[10px] shrink-0', b.cls)}>{b.label}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">Sem objetivos de marketing definidos para {year}.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {monthSummaries.map((m, idx) => {
              const isCurrent = now.getMonth() === idx && now.getFullYear() === year;
              return (
                <Card
                  key={idx}
                  className={cn(
                    'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
                    isCurrent && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedMonth(idx + 1)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{m.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.published} publicados / {m.planned} planeados
                    </div>
                    {m.planned > 0 && (
                      <p className={cn("text-sm font-bold", m.rate >= 80 ? 'text-emerald-600' : m.rate >= 50 ? 'text-amber-600' : 'text-destructive')}>
                        {m.rate}% execução
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
