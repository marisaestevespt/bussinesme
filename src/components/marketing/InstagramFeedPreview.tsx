import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, Clock, Film, Layers, Grid3x3, Bookmark, UserSquare2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/lib/marketing-constants';

interface Props {
  items: ContentItem[];
}

export function InstagramFeedPreview({ items }: Props) {
  const navigate = useNavigate();
  const now = new Date();

  const { data: settings } = useQuery({
    queryKey: ['business-settings-ig-preview'],
    queryFn: async () => {
      const { data } = await supabase.from('business_settings').select('business_name, logo_url').maybeSingle();
      return data as { business_name: string | null; logo_url: string | null } | null;
    },
  });

  // Mostra publicados + qualquer conteúdo planeado/agendado para este canal.
  // Ordem: publicados (mais recente primeiro) → agendados futuros (mais próximo primeiro)
  // → restantes planeados sem data.
  const feedItems = [...items]
    .sort((a, b) => {
      const aPub = a.status === 'publicado';
      const bPub = b.status === 'publicado';
      if (aPub && !bPub) return -1;
      if (!aPub && bPub) return 1;
      const aT = a.scheduled_at ? new Date(a.scheduled_at).getTime() : null;
      const bT = b.scheduled_at ? new Date(b.scheduled_at).getTime() : null;
      if (aPub && bPub) return (bT ?? 0) - (aT ?? 0);
      if (aT === null && bT === null) return 0;
      if (aT === null) return 1;
      if (bT === null) return -1;
      return aT - bT;
    })
    .slice(0, 30);

  const handle = (settings?.business_name || 'business')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '');

  const publishedCount = feedItems.filter(i => i.status === 'publicado').length;

  return (
    <div className="max-w-[420px] mx-auto rounded-xl border border-border bg-background overflow-hidden shadow-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground">{handle}</span>
        <div className="flex items-center gap-1 text-foreground">
          <span className="text-lg leading-none">+</span>
          <span className="text-lg leading-none">≡</span>
        </div>
      </div>

      {/* Profile header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-5">
          {/* Avatar with story ring */}
          <div className="rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
            <div className="rounded-full p-[2px] bg-background">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
                  {(settings?.business_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          {/* Stats */}
          <div className="flex-1 grid grid-cols-3 text-center text-foreground">
            <div>
              <div className="text-base font-semibold">{publishedCount}</div>
              <div className="text-[11px] text-muted-foreground">publicações</div>
            </div>
            <div>
              <div className="text-base font-semibold">—</div>
              <div className="text-[11px] text-muted-foreground">seguidores</div>
            </div>
            <div>
              <div className="text-base font-semibold">—</div>
              <div className="text-[11px] text-muted-foreground">a seguir</div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold text-foreground">{settings?.business_name || 'Business'}</p>
          <p className="text-[12px] text-muted-foreground">Preview do feed planeado ✨</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="text-xs font-semibold py-1.5 rounded-md bg-muted text-foreground hover:bg-muted/80 hq-transition">
            Editar perfil
          </button>
          <button className="text-xs font-semibold py-1.5 rounded-md bg-muted text-foreground hover:bg-muted/80 hq-transition">
            Partilhar perfil
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-border">
        <div className="flex-1 flex items-center justify-center py-2.5 border-t-2 border-foreground -mt-px">
          <Grid3x3 className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 flex items-center justify-center py-2.5 text-muted-foreground/60">
          <Film className="h-5 w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center py-2.5 text-muted-foreground/60">
          <Bookmark className="h-5 w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center py-2.5 text-muted-foreground/60">
          <UserSquare2 className="h-5 w-5" />
        </div>
      </div>

      {/* Grid */}
      {feedItems.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground italic">
          Sem conteúdos para mostrar.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {feedItems.map(item => {
            const isPublished = item.status === 'publicado';
            const isScheduled = !isPublished && !!item.scheduled_at && new Date(item.scheduled_at) >= now;
            const isDraft = !isPublished && !isScheduled;
            const isReel = item.format === 'reels';
            const isCarousel = item.format === 'carrossel';
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/hub/marketing/conteudos/${item.id}`)}
                className="relative aspect-square bg-muted overflow-hidden group"
                title={item.title}
              >
                {item.cover_url ? (
                  <img
                    src={item.cover_url}
                    alt={item.title}
                    className="h-full w-full object-cover hq-transition group-hover:opacity-90"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                {/* Format indicator (top-right) */}
                {(isReel || isCarousel) && (
                  <div className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                    {isReel ? <Film className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}