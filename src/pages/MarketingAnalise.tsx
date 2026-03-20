import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BackNavigation } from '@/components/BackNavigation';
import { ChevronLeft, ChevronRight, Trophy, ThumbsDown, TrendingUp, TrendingDown, Target, BarChart3, Filter, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FORMAT_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { useCallback } from 'react';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getPrimaryMetricField(format: string): string {
  const videoFormats = ['reels', 'short_tiktok', 'vlog', 'longo_youtube'];
  return videoFormats.includes(format) ? 'views' : 'reach';
}

export default function MarketingAnalisePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const queryClient = useQueryClient();

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // Channels
  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('*').order('sort_order');
      return (data || []) as MarketingChannel[];
    },
  });
  const activeChannels = channels.filter(c => c.is_active && c.name.toLowerCase() !== 'website');

  // Content items for the month
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

  // Content channel links
  const { data: contentLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  // Content metrics for the month
  const { data: allMetrics = [] } = useQuery({
    queryKey: ['content-metrics-all', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics').select('*').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  // Channel monthly metrics
  const { data: channelMetrics = [] } = useQuery({
    queryKey: ['channel-monthly-metrics-all', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('channel_monthly_metrics').select('*').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  // Marketing objectives (executive_goals with area=marketing)
  const { data: objectives = [] } = useQuery({
    queryKey: ['marketing-objectives', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('executive_goals').select('*')
        .eq('area', 'marketing').eq('month', month).eq('year', year);
      return data || [];
    },
  });

  // Funnels
  const { data: funnels = [] } = useQuery({
    queryKey: ['marketing-funnels-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_funnels').select('id, status');
      return data || [];
    },
  });
  const activeFunnels = funnels.filter((f: any) => f.status === 'ativo' || f.status === 'active').length;

  // Automations
  const { data: automations = [] } = useQuery({
    queryKey: ['marketing-automations-active'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_automations').select('id, status');
      return data || [];
    },
  });
  const activeAutomations = automations.filter((a: any) => a.status === 'ativa' || a.status === 'active' || a.status === 'ativo').length;

  // Monthly analysis
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

  // Top 3 / Worst 3 across all channels
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

  // Channel summary
  const channelSummary = activeChannels.map(ch => {
    const metrics = channelMetrics.find((m: any) => m.channel_id === ch.id) as any;
    const chContentIds = contentLinks.filter(l => l.channel_id === ch.id).map(l => l.content_id);
    const pubCount = publishedContent.filter(c => chContentIds.includes(c.id)).length;
    return {
      id: ch.id, name: ch.name,
      followers: metrics?.followers ?? null,
      growth: metrics?.followers_growth ?? null,
      published: pubCount,
    };
  });

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Análise de Marketing" />
        <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
          <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />

          {/* Month nav */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-base font-semibold capitalize min-w-[160px] text-center">{MONTHS[month - 1]} {year}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          {/* 1. Objectives */}
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

          <Separator />

          {/* 2. Published vs Planned */}
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
                  <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 hq-transition">
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
                  <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 hq-transition">
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

          {/* 4. Channel Summary */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Resumo por Canal</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Canal</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Seguidores</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Crescimento</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Publicações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelSummary.map(ch => (
                      <tr key={ch.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-medium text-foreground">{ch.name}</td>
                        <td className="p-3 text-right text-foreground">{ch.followers?.toLocaleString() ?? '—'}</td>
                        <td className="p-3 text-right">
                          {ch.growth != null ? (
                            <span className={cn("flex items-center justify-end gap-1 font-medium",
                              ch.growth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                              {ch.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {ch.growth >= 0 ? '+' : ''}{ch.growth}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-right text-foreground">{ch.published}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <Separator />

          {/* 5. Funnels & Automations */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/hub/marketing/funis">
              <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
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
              <Card className="hq-transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
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
      </div>
    </AppLayout>
  );
}
