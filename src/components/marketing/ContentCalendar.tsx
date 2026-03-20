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
import { STATUS_OPTIONS, FORMAT_OPTIONS, CONTENT_TYPE_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface ProfileInfo { id: string; full_name: string | null; avatar_url: string | null; }
export interface AttachmentInfo { id: string; content_id: string; file_url: string; file_name: string; file_type: string; }

interface Props {
  items: ContentItem[];
  channels: MarketingChannel[];
  contentChannelLinks: ContentChannelLink[];
  calendarOnly?: boolean;
  profiles?: ProfileInfo[];
  attachments?: AttachmentInfo[];
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

function CalendarDayItem({ item, channels, links, profiles, attachments }: { item: ContentItem; channels: MarketingChannel[]; links: ContentChannelLink[]; profiles?: ProfileInfo[]; attachments?: AttachmentInfo[] }) {
  const status = STATUS_OPTIONS.find(s => s.value === item.status);
  const itemChannels = getItemChannels(item.id, channels, links);
  const formatLabel = FORMAT_OPTIONS.find(f => f.value === item.format)?.label;
  const typeLabel = CONTENT_TYPE_OPTIONS.find(t => t.value === item.content_type)?.label;
  const time = item.scheduled_at ? format(new Date(item.scheduled_at), 'HH:mm') : null;
  const assignee = profiles?.find(p => p.id === item.assigned_to);
  const images = (attachments || []).filter(a => a.content_id === item.id && a.file_type.startsWith('image'));
  const coverImage = item.cover_url || (images.length > 0 ? images[0].file_url : null);

  return (
    <Link to={`/hub/marketing/conteudos/${item.id}`}
      className="block rounded border bg-muted/30 hover:bg-muted/60 transition-colors h-full flex flex-col overflow-hidden">
      {/* Cover image */}
      {coverImage && (
        <div className="w-full aspect-[16/9] overflow-hidden shrink-0">
          <img src={coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-1.5 flex flex-col gap-px flex-1">
        {/* Title + time */}
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-medium truncate leading-tight text-foreground">{item.title}</p>
          {time && <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{time}</span>}
        </div>
        {/* Status */}
        {status && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm leading-none font-medium text-center w-full block", status.color)}>{status.label}</span>}
        {/* Canal + Formato */}
        <div className="flex items-center gap-1">
          {itemChannels.slice(0, 1).map(ch => (
            <span key={ch.id} className="text-[10px] px-1 py-0.5 rounded-sm leading-none bg-secondary text-secondary-foreground">{ch.name}</span>
          ))}
          {formatLabel && <span className="text-[10px] px-1 py-0.5 rounded-sm leading-none bg-accent text-accent-foreground">{formatLabel}</span>}
        </div>
        {/* Tipo de conteúdo */}
        {typeLabel && <span className="text-[10px] px-1.5 py-0.5 rounded-sm leading-none bg-muted text-muted-foreground text-center w-full block">{typeLabel}</span>}
        {/* Assignee */}
        {assignee && (
          <div className="flex items-center gap-1 mt-px">
            <Avatar className="h-4 w-4">
              <AvatarImage src={assignee.avatar_url || undefined} />
              <AvatarFallback className="text-[7px]">{assignee.full_name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground truncate">{assignee.full_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ContentCalendar({ items, channels, contentChannelLinks, calendarOnly, profiles, attachments }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const datedItems = items.filter(i => i.scheduled_at);
  const undatedItems = items.filter(i => !i.scheduled_at);

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: pt });

  const calendarGrid = (
    <>
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
          <div key={d} className="text-[11px] text-center font-medium text-primary-foreground bg-primary py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px border rounded-lg overflow-hidden bg-border/50">
        {days.map(day => {
          const dayItems = datedItems.filter(i => isSameDay(new Date(i.scheduled_at!), day));
          const isCurrentMonth = isSameMonth(day, currentMonth);
          return (
            <div key={day.toISOString()} className={cn("min-h-[130px] p-1.5 bg-card flex flex-col", !isCurrentMonth && "opacity-40")}>
              <p className={cn("text-xs font-medium mb-1 shrink-0", isSameDay(day, new Date()) && "text-primary font-bold")}>{format(day, 'd')}</p>
              <div className="flex flex-col gap-1 flex-1">
                {dayItems.slice(0, 4).map(item => (
                  <div key={item.id} className="flex-1 min-h-0">
                    <CalendarDayItem key={item.id} item={item} channels={channels} links={contentChannelLinks} profiles={profiles} attachments={attachments} />
                  </div>
                ))}
              </div>
              {dayItems.length > 4 && <p className="text-[9px] text-muted-foreground pl-1 shrink-0">+{dayItems.length - 4}</p>}
            </div>
          );
        })}
      </div>
    </>
  );

  if (calendarOnly) return calendarGrid;

  return (
    <Tabs defaultValue="geral">
      <TabsList className="mb-4">
        <TabsTrigger value="geral">Calendário Geral</TabsTrigger>
        <TabsTrigger value="status">Por Status</TabsTrigger>
        <TabsTrigger value="canal">Por Canal</TabsTrigger>
        <TabsTrigger value="sem-data">Sem data</TabsTrigger>
      </TabsList>

      <TabsContent value="geral">
        {calendarGrid}
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
