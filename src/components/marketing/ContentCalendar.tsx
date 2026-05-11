import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { STATUS_OPTIONS, FORMAT_OPTIONS, CONTENT_TYPE_OPTIONS, type ContentItem, type MarketingChannel, type ContentChannelLink } from '@/lib/marketing-constants';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { TagBadge } from '@/components/shared/TagBadge';

export interface ProfileInfo { id: string; full_name: string | null; avatar_url: string | null; }
export interface AttachmentInfo { id: string; content_id: string; file_url: string; file_name: string; file_type: string; }

interface Props {
  items: ContentItem[];
  channels: MarketingChannel[];
  contentChannelLinks: ContentChannelLink[];
  calendarOnly?: boolean;
  profiles?: ProfileInfo[];
  attachments?: AttachmentInfo[];
  onCreateForDate?: (date: Date) => void;
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
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {itemChannels.map(ch => (
            <TagBadge
              key={ch.id}
              scope="marketing_channel"
              value={ch.name}
              label={ch.name}
              className="text-[10px] px-1.5 py-0 h-4"
              stopPropagation
            />
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
  const isPublished = item.status === 'publicado';
  const itemChannels = getItemChannels(item.id, channels, links);
  const formatLabel = FORMAT_OPTIONS.find(f => f.value === item.format)?.label;
  const typeLabel = CONTENT_TYPE_OPTIONS.find(t => t.value === item.content_type)?.label;
  const time = item.scheduled_at ? format(new Date(item.scheduled_at), 'HH:mm') : null;
  const assignee = profiles?.find(p => p.id === item.assigned_to);
  const coverImage = item.cover_url;
  const { getPhotoUrl } = useTeamPhotos();

  return (
    <Link to={`/hub/marketing/conteudos/${item.id}`}
      className={cn(
        "block rounded border transition-colors flex flex-col overflow-hidden",
        isPublished
          ? "border-success/40 bg-success/10 hover:bg-success/20 dark:border-success/40 dark:bg-success/10 dark:hover:bg-success/20"
          : "border-border bg-muted/30 hover:bg-muted/60"
      )}>
      {/* Cover image (mantida — a forma de visualização que o user gosta) */}
      {coverImage && (
        <div className="w-full aspect-[3/1] overflow-hidden shrink-0">
          <img src={coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-1.5 flex flex-col items-start gap-1">
        {/* Título + hora (estilo Notion: título destacado em cima) */}
        <div className="flex items-start justify-between gap-1 w-full">
          <p
            title={item.title}
            className="text-[11px] font-semibold leading-snug text-foreground line-clamp-3 break-words min-w-0 flex-1"
          >
            {item.title}
          </p>
          {time && <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{time}</span>}
        </div>
        {/* Status pill (estilo Notion: pequeno, com bolinha e à esquerda) */}
        {status && (
          <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full leading-none font-medium self-start max-w-full", status.color)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 shrink-0" />
            <span className="truncate">{status.label}</span>
          </span>
        )}
        {/* Canais — todos, em pílulas inline */}
        {itemChannels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {itemChannels.map(ch => (
              <TagBadge
                key={ch.id}
                scope="marketing_channel"
                value={ch.name}
                label={ch.name}
                className="text-[10px] px-1.5 py-0 h-4 rounded-full"
                stopPropagation
              />
            ))}
          </div>
        )}
        {/* Formato */}
        {formatLabel && item.format && (
          <TagBadge
            scope="marketing_format"
            value={item.format}
            label={formatLabel}
            className="text-[10px] px-1.5 py-0 h-4 rounded-full self-start max-w-full"
            stopPropagation
          />
        )}
        {/* Tipo de conteúdo (funil) */}
        {typeLabel && item.content_type && (
          <TagBadge
            scope="marketing_content_type"
            value={item.content_type}
            label={typeLabel}
            className="text-[10px] px-1.5 py-0 h-4 rounded-full self-start max-w-full"
            stopPropagation
          />
        )}
        {/* Assignee — avatar + nome no rodapé, estilo Notion */}
        {assignee && (
          <div className="flex items-center gap-1 pt-0.5">
            <Avatar className="h-4 w-4">
              <AvatarImage src={getPhotoUrl(assignee)} />
              <AvatarFallback className="text-[7px]">{assignee.full_name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground truncate">{assignee.full_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ContentCalendar({ items, channels, contentChannelLinks, calendarOnly, profiles, attachments, onCreateForDate }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDrop = useCallback(async (newStatus: string) => {
    if (!draggingId) return;
    const item = items.find(i => i.id === draggingId);
    if (!item || item.status === newStatus) { setDraggingId(null); setDragOverStatus(null); return; }
    await supabase.from('content_items').update({ status: newStatus } as any).eq('id', draggingId);
    queryClient.invalidateQueries({ queryKey: ['content-items'] });
    setDraggingId(null);
    setDragOverStatus(null);
    const label = STATUS_OPTIONS.find(s => s.value === newStatus)?.label;
    toast.success(`Movido para "${label}"`);
  }, [draggingId, items, queryClient]);

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
        <Button variant="ghost" aria-label="Anterior" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <Button variant="ghost" aria-label="Seguinte" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
            <div key={day.toISOString()} className={cn("group/day relative min-h-[130px] p-1.5 bg-card flex flex-col", !isCurrentMonth && "opacity-40")}>
              <div className="flex items-center justify-between mb-1 shrink-0">
                <p className={cn("text-xs font-medium", isSameDay(day, new Date()) && "text-primary font-bold")}>{format(day, 'd')}</p>
                {onCreateForDate && (
                  <button
                    type="button"
                    aria-label={`Adicionar conteúdo em ${format(day, 'd MMM', { locale: pt })}`}
                    onClick={(e) => { e.stopPropagation(); onCreateForDate(day); }}
                    className="opacity-0 group-hover/day:opacity-100 hq-transition h-5 w-5 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                {dayItems.slice(0, 4).map(item => (
                  <CalendarDayItem key={item.id} item={item} channels={channels} links={contentChannelLinks} profiles={profiles} attachments={attachments} />
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
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_OPTIONS.map(status => {
            const statusItems = items.filter(i => i.status === status.value);
            return (
              <div key={status.value} className="flex flex-col min-w-[220px] max-w-[260px] shrink-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                  <span className="text-xs text-muted-foreground">({statusItems.length})</span>
                </div>
                <div
                  className={cn(
                    "flex-1 rounded-lg border bg-muted/20 p-2 space-y-2 min-h-[120px] transition-colors",
                    dragOverStatus === status.value && "border-primary bg-primary/5"
                  )}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(status.value); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={e => { e.preventDefault(); handleDrop(status.value); }}
                >
                  {statusItems.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic text-center pt-6">Vazio</p>
                  ) : (
                    statusItems.map(item => {
                      const itemChannels = getItemChannels(item.id, channels, contentChannelLinks);
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingId(item.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                          className={cn("cursor-grab active:cursor-grabbing", draggingId === item.id && "opacity-40")}
                        >
                          <Link to={`/hub/marketing/conteudos/${item.id}`} className="block" draggable={false}>
                            <div className="rounded-md border bg-card p-2.5 hover:shadow-sm hq-transition space-y-2">
                              {item.cover_url && (
                                <img src={item.cover_url} alt="" className="w-full aspect-video rounded object-cover pointer-events-none" draggable={false} />
                              )}
                              <p className="text-xs font-medium text-foreground leading-tight truncate">{item.title}</p>
                              <div className="flex items-center gap-1 flex-wrap">
                                {itemChannels.slice(0, 2).map(ch => (
                                  <TagBadge
                                    key={ch.id}
                                    scope="marketing_channel"
                                    value={ch.name}
                                    label={ch.name}
                                    className="text-[9px] px-1 py-0 h-3.5"
                                    stopPropagation
                                  />
                                ))}
                              </div>
                              {item.scheduled_at && (
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(item.scheduled_at), 'dd MMM HH:mm', { locale: pt })}
                                </p>
                              )}
                            </div>
                          </Link>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="canal">
        <div className="space-y-2">
          {channels.filter(c => c.is_active).map(channel => {
            const channelItemIds = contentChannelLinks.filter(l => l.channel_id === channel.id).map(l => l.content_id);
            const channelItems = items.filter(i => channelItemIds.includes(i.id));
            return (
              <Collapsible key={channel.id} defaultOpen={channelItems.length > 0}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-muted/50 hq-transition group">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                  <TagBadge scope="marketing_channel" value={channel.name} label={channel.name} stopPropagation />
                  <span className="text-xs text-muted-foreground">({channelItems.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {channelItems.length === 0 ? (
                    <EmptyHint>Nenhum conteúdo</EmptyHint>
                  ) : (
                    <div className="space-y-0.5 pl-6">
                      {channelItems.map(item => (
                        <ContentRow key={item.id} item={item} channels={channels} links={contentChannelLinks} />
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="sem-data">
        {undatedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">Todos os conteúdos têm data atribuída.</p>
        ) : (
          <div className="space-y-0.5">
            {undatedItems.map(item => {
              const itemChannels = getItemChannels(item.id, channels, contentChannelLinks);
              const formatLabel = FORMAT_OPTIONS.find(f => f.value === item.format)?.label;
              return (
                <Link key={item.id} to={`/hub/marketing/conteudos/${item.id}`} className="block">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 hq-transition">
                    <p className="text-sm font-medium truncate text-foreground flex-1 min-w-0">{item.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {itemChannels.map(ch => (
                        <TagBadge
                          key={ch.id}
                          scope="marketing_channel"
                          value={ch.name}
                          label={ch.name}
                          className="text-[10px] px-1.5 py-0 h-4"
                          stopPropagation
                        />
                      ))}
                      {formatLabel && item.format && (
                        <TagBadge
                          scope="marketing_format"
                          value={item.format}
                          label={formatLabel}
                          className="text-[10px] px-1.5 py-0 h-4"
                          stopPropagation
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
