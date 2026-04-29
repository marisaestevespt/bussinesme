import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const TYPE_ICONS: Record<string, string> = {
  mention: '💬',
  task: '✅',
  recommendation: '💡',
  deadline: '⏰',
  birthday: '🎂',
  info: 'ℹ️',
};

function NotificationItem({ n, onRead, onDelete, onNavigate }: { n: any; onRead: (id: string) => void; onDelete: (id: string) => void; onNavigate: (n: any) => void }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors group ${!n.read ? 'bg-primary/5' : ''}`}
      onClick={() => onNavigate(n)}
    >
      <span className="text-base mt-0.5 shrink-0">{TYPE_ICONS[n.type] || TYPE_ICONS.info}</span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={`text-sm leading-tight ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>{n.title}</p>
        {n.message && <p className="text-xs text-muted-foreground whitespace-normal break-words">{n.message}</p>}
        <p className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!n.read && (
          <button onClick={e => { e.stopPropagation(); onRead(n.id); }} title="Marcar como lida">
            <Check className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(n.id); }} title="Remover">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  const handleClick = (n: any) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  const renderList = (items: any[]) =>
    items.length === 0 ? (
      <EmptyHint>Sem notificações</EmptyHint>
    ) : (
      <div className="divide-y">
        {items.map(n => (
          <NotificationItem
            key={n.id}
            n={n}
            onRead={id => markAsRead.mutate(id)}
            onDelete={id => deleteNotification.mutate(id)}
            onNavigate={handleClick}
          />
        ))}
      </div>
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-24px)] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <Tabs defaultValue="unread">
          <TabsList className="w-full justify-start px-4 pt-2 gap-2">
            <TabsTrigger value="unread" className="text-xs">
              Não lidas {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs">
              Lidas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="unread" className="mt-0">
            <ScrollArea className="h-80">{renderList(unread)}</ScrollArea>
          </TabsContent>
          <TabsContent value="read" className="mt-0">
            <ScrollArea className="h-80">{renderList(read)}</ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
