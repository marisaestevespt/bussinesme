import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { cn } from '@/lib/utils';

interface Props {
  items: ContentItem[];
  channels: MarketingChannel[];
  contentChannelLinks: ContentChannelLink[];
  calendarOnly?: boolean;
}

function getItemChannels(itemId: string, channels: MarketingChannel[], links: ContentChannelLink[]) {
  const ids = links.filter(l => l.content_id === itemId).map(l => l.channel_id);
  return channels.filter(c => ids.includes(c.id));
}

function ContentRow({ item, channels, links }: { item: ContentItem; channels: MarketingChannel[]; links: ContentChannelLink[] }) {
  const itemChannels = getItemChannels(item.id, channels, links);
  const status = STATUS_OPTIONS.find(s => s.value === item.status);
  return (
    <Link to={`/hub/marketing/conteudos/${item.id}`} className="block">
      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 hq-transition group">
        {item.cover_url && <img src={item.cover_url} className="h-10 w-10 rounded object-cover shrink-0" alt="" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{item.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {itemChannels.map(ch => (
              <Badge key={ch.id} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{ch.name}</Badge>
            ))}
            {item.scheduled_at && (
              <span className="text-[10px] text-muted-foreground">{format(new Date(item.scheduled_at), 'dd MMM', { locale: pt })}</span>
            )}
          </div>
        </div>
        {status && <Badge className={cn("text-[10px] shrink-0", status.color)}>{status.label}</Badge>}
      </div>
    </Link>
  );
}

export function ContentCalendar({ items, channels, contentChannelLinks }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const datedItems = items.filter(i => i.scheduled_at);
  const undatedItems = items.filter(i => !i.scheduled_at);

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: pt });

  return (
    <Tabs defaultValue="geral">
      <TabsList className="mb-4">
        <TabsTrigger value="geral">Calendário Geral</TabsTrigger>
        <TabsTrigger value="status">Por Status</TabsTrigger>
        <TabsTrigger value="canal">Por Canal</TabsTrigger>
        <TabsTrigger value="sem-data">Sem data</TabsTrigger>
      </TabsList>

      <TabsContent value="geral">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-px">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="text-[10px] text-center font-medium text-muted-foreground py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px border rounded-lg overflow-hidden bg-border">
          {days.map(day => {
            const dayItems = datedItems.filter(i => isSameDay(new Date(i.scheduled_at!), day));
            const isCurrentMonth = isSameMonth(day, currentMonth);
            return (
              <div key={day.toISOString()} className={cn("min-h-[80px] p-1 bg-card", !isCurrentMonth && "opacity-40")}>
                <p className={cn("text-[11px] font-medium mb-0.5", isSameDay(day, new Date()) && "text-primary font-bold")}>{format(day, 'd')}</p>
                {dayItems.slice(0, 3).map(item => {
                  const status = STATUS_OPTIONS.find(s => s.value === item.status);
                  return (
                    <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`}
                      className={cn("block text-[9px] truncate px-1 py-0.5 rounded-sm mb-0.5 leading-tight", status?.color || 'bg-muted')}>
                      {item.title}
                    </Link>
                  );
                })}
                {dayItems.length > 3 && <p className="text-[9px] text-muted-foreground pl-1">+{dayItems.length - 3}</p>}
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="status">
        <div className="space-y-6">
          {STATUS_OPTIONS.map(status => {
            const statusItems = items.filter(i => i.status === status.value);
            if (statusItems.length === 0) return null;
            return (
              <div key={status.value}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn(status.color)}>{status.label}</Badge>
                  <span className="text-xs text-muted-foreground">({statusItems.length})</span>
                </div>
                <div className="space-y-0.5">
                  {statusItems.map(item => (
                    <ContentRow key={item.id} item={item} channels={channels} links={contentChannelLinks} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="canal">
        <div className="space-y-6">
          {channels.filter(c => c.is_active).map(channel => {
            const channelItemIds = contentChannelLinks.filter(l => l.channel_id === channel.id).map(l => l.content_id);
            const channelItems = items.filter(i => channelItemIds.includes(i.id));
            if (channelItems.length === 0) return null;
            return (
              <div key={channel.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{channel.name}</Badge>
                  <span className="text-xs text-muted-foreground">({channelItems.length})</span>
                </div>
                <div className="space-y-0.5">
                  {channelItems.map(item => (
                    <ContentRow key={item.id} item={item} channels={channels} links={contentChannelLinks} />
                  ))}
                </div>
              </div>
            );
          })}
          {channels.filter(c => c.is_active).every(channel => {
            const ids = contentChannelLinks.filter(l => l.channel_id === channel.id).map(l => l.content_id);
            return items.filter(i => ids.includes(i.id)).length === 0;
          }) && <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum conteúdo associado a canais.</p>}
        </div>
      </TabsContent>

      <TabsContent value="sem-data">
        {undatedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">Todos os conteúdos têm data atribuída.</p>
        ) : (
          <div className="space-y-0.5">
            {undatedItems.map(item => (
              <ContentRow key={item.id} item={item} channels={channels} links={contentChannelLinks} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
