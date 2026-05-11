import { useState } from 'react';
import { Music, X, ChevronDown } from 'lucide-react';

/**
 * Detect platform and build an embeddable URL.
 * Suporta: Spotify (track/album/playlist/episode/show),
 * YouTube (video/playlist), SoundCloud, Apple Music.
 */
interface Props {
  url: string;
  brandColor?: string;
}

function buildEmbed(url: string, autoplay: boolean): { src: string; height: number; platform: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');

    // Spotify
    if (host.includes('spotify.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const idxType = parts.findIndex(p => ['playlist', 'album', 'track', 'episode', 'show'].includes(p));
      if (idxType >= 0 && parts[idxType + 1]) {
        const type = parts[idxType];
        const id = parts[idxType + 1];
        // Force compact (~80px) Spotify player for all types
        return {
          src: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0${autoplay ? '&autoplay=1' : ''}`,
          height: 80,
          platform: 'Spotify',
        };
      }
    }

    // YouTube
    if (host.includes('youtube.com') || host === 'youtu.be') {
      const ap = autoplay ? '&autoplay=1&mute=1' : '';
      const playlistId = u.searchParams.get('list');
      if (playlistId) {
        return { src: `https://www.youtube.com/embed/videoseries?list=${playlistId}${ap}`, height: 200, platform: 'YouTube' };
      }
      const v = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
      if (v) return { src: `https://www.youtube.com/embed/${v}?${ap.slice(1)}`, height: 200, platform: 'YouTube' };
    }

    // SoundCloud
    if (host.includes('soundcloud.com')) {
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=${autoplay ? 'true' : 'false'}&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`,
        height: 120,
        platform: 'SoundCloud',
      };
    }

    // Apple Music
    if (host.includes('music.apple.com')) {
      const embedUrl = url.replace('music.apple.com', 'embed.music.apple.com');
      return { src: embedUrl, height: 175, platform: 'Apple Music' };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Floating mini-player no canto inferior direito do portal.
 * - Estado inicial: pill compacto com ícone Music (clica para abrir).
 * - Estado expandido: player compacto (~80-200px) com botão para fechar/minimizar.
 * - Autoplay: tenta arrancar automaticamente (browsers bloqueiam áudio sem
 *   interação; YouTube fica em mute, Spotify pode requerer clique no play).
 */
export function PortalPlaylistEmbed({ url, brandColor }: Props) {
  const [open, setOpen] = useState(false);
  const embed = buildEmbed(url, open);
  if (!embed) return null;

  const accent = brandColor ? `hsl(${brandColor})` : 'hsl(var(--primary))';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir playlist ${embed.platform}`}
        className="fixed bottom-4 right-4 z-40 group flex items-center gap-2 rounded-full border bg-card/95 backdrop-blur px-3 py-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        style={{ borderColor: brandColor ? `hsla(${brandColor}, 0.3)` : undefined }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: accent, color: 'white' }}
        >
          <Music className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium pr-1 hidden sm:inline">Tocar playlist</span>
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: accent }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: accent }} />
        </span>
      </button>
    );
  }

  return (
    <section
      className="fixed bottom-4 right-4 z-40 w-[320px] sm:w-[360px] rounded-xl border bg-card overflow-hidden shadow-2xl"
      style={brandColor ? { borderColor: `hsla(${brandColor}, 0.3)` } : undefined}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <Music className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
            {embed.platform}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Minimizar playlist"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </header>
      <iframe
        title={`Playlist ${embed.platform}`}
        src={embed.src}
        width="100%"
        height={embed.height}
        frameBorder={0}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className="block bg-background"
      />
    </section>
  );
}