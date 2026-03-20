import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar, CheckCircle2, Circle, CircleDot } from 'lucide-react';
import type { ContentChannelLink, ContentItem } from '@/lib/marketing-constants';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface Props {
  channelId: string;
  year: number;
  onSelectMonth: (month: number) => void;
}

export function ChannelMonthGallery({ channelId, year, onSelectMonth }: Props) {
  // All content channel links for this channel
  const { data: contentLinks = [] } = useQuery({
    queryKey: ['content-channels'],
    queryFn: async () => {
      const { data } = await supabase.from('content_channels').select('*');
      return (data || []) as ContentChannelLink[];
    },
  });

  const channelContentIds = contentLinks.filter(l => l.channel_id === channelId).map(l => l.content_id);

  // All published content for this channel in this year
  const { data: publishedContent = [] } = useQuery({
    queryKey: ['channel-published-year', channelId, year],
    queryFn: async () => {
      if (channelContentIds.length === 0) return [];
      const { data } = await supabase.from('content_items').select('*')
        .in('id', channelContentIds)
        .eq('status', 'publicado')
        .gte('scheduled_at', `${year}-01-01`)
        .lt('scheduled_at', `${year + 1}-01-01`);
      return (data || []) as ContentItem[];
    },
    enabled: channelContentIds.length > 0,
  });

  // All content metrics for this channel in this year
  const { data: allMetrics = [] } = useQuery({
    queryKey: ['content-metrics-year', channelId, year],
    queryFn: async () => {
      const { data } = await supabase.from('content_metrics')
        .select('content_id, month')
        .eq('channel_id', channelId)
        .eq('year', year);
      return data || [];
    },
  });

  // Build per-month stats
  const monthStats = MONTHS.map((name, i) => {
    const month = i + 1;
    const monthContent = publishedContent.filter(c => {
      if (!c.scheduled_at) return false;
      const d = new Date(c.scheduled_at);
      return d.getMonth() + 1 === month;
    });
    const pubCount = monthContent.length;
    const metricsForMonth = allMetrics.filter((m: any) => m.month === month);
    const contentWithMetrics = new Set(metricsForMonth.map((m: any) => m.content_id));
    const filledCount = monthContent.filter(c => contentWithMetrics.has(c.id)).length;

    let fillStatus: 'empty' | 'partial' | 'complete' = 'empty';
    if (pubCount > 0 && filledCount === pubCount) fillStatus = 'complete';
    else if (filledCount > 0) fillStatus = 'partial';

    return { name, month, pubCount, fillStatus };
  });

  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Análise Mensal</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {monthStats.map(({ name, month, pubCount, fillStatus }) => (
          <Card
            key={month}
            className={cn(
              "cursor-pointer hq-transition hover:shadow-md hover:border-primary/40",
              month === currentMonth && "border-primary/30 bg-primary/5"
            )}
            onClick={() => onSelectMonth(month)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground">
                {pubCount} {pubCount === 1 ? 'publicação' : 'publicações'}
              </span>
              {fillStatus === 'complete' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : fillStatus === 'partial' ? (
                <CircleDot className="h-4 w-4 text-amber-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
