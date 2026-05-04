import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/lib/marketing-constants';

interface Props {
  items: ContentItem[];
}

export function InstagramFeedPreview({ items }: Props) {
  const navigate = useNavigate();
  const now = new Date();

  // Publicados + agendados futuros, ordenados do mais recente para o mais antigo
  const feedItems = items
    .filter(i => {
      if (!i.scheduled_at) return false;
      const isPublished = i.status === 'publicado';
      const isFutureScheduled = new Date(i.scheduled_at) >= now && i.status !== 'publicado';
      return isPublished || isFutureScheduled;
    })
    .sort((a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime())
    .slice(0, 24);

  if (feedItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground italic">
          Sem conteúdos publicados ou agendados para mostrar no feed.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="grid grid-cols-3 gap-0.5 bg-border/50 p-0.5 rounded-md overflow-hidden">
        {feedItems.map(item => {
          const isFuture = item.status !== 'publicado';
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/hub/marketing/conteudos/${item.id}`)}
              className="relative aspect-square bg-muted overflow-hidden group hq-transition"
              title={item.title}
            >
              {item.cover_url ? (
                <img
                  src={item.cover_url}
                  alt={item.title}
                  className={cn(
                    "h-full w-full object-cover hq-transition group-hover:scale-105",
                    isFuture && "opacity-70"
                  )}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              {isFuture && (
                <div className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow-sm">
                  <Clock className="h-3 w-3 text-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 hq-transition" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground/60" />
          Publicado
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Agendado
        </span>
      </div>
    </div>
  );
}