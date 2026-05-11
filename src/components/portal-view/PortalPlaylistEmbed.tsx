import { Music } from 'lucide-react';

interface Props {
  url: string;
  brandColor?: string;
}

/**
 * Detect platform and build an embeddable URL.
 * Suporta: Spotify (track/album/playlist/episode/show),
 * YouTube (video/playlist), SoundCloud, Apple Music.
 */
function buildEmbed(url: string): { src: string; height: number; platform: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');

    // Spotify
    if (host.includes('spotify.com')) {
      // /playlist/ID, /album/ID, /track/ID, /episode/ID, /show/ID
      const parts = u.pathname.split('/').filter(Boolean);
      const idxType = parts.findIndex(p => ['playlist', 'album', 'track', 'episode', 'show'].includes(p));
      if (idxType >= 0 && parts[idxType + 1]) {
        const type = parts[idxType];
        const id = parts[idxType + 1];
        const isCompact = type === 'track' || type === 'episode';
        return {
          src: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
          height: isCompact ? 152 : 380,
          platform: 'Spotify',
        };
      }
    }

    // YouTube
    if (host.includes('youtube.com') || host === 'youtu.be') {
      const playlistId = u.searchParams.get('list');
      if (playlistId) {
        return { src: `https://www.youtube.com/embed/videoseries?list=${playlistId}`, height: 380, platform: 'YouTube' };
      }
      const v = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
      if (v) return { src: `https://www.youtube.com/embed/${v}`, height: 215, platform: 'YouTube' };
    }

    // SoundCloud
    if (host.includes('soundcloud.com')) {
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
        height: 166,
        platform: 'SoundCloud',
      };
    }

    // Apple Music
    if (host.includes('music.apple.com')) {
      const embedUrl = url.replace('music.apple.com', 'embed.music.apple.com');
      return { src: embedUrl, height: 380, platform: 'Apple Music' };
    }

    return null;
  } catch {
    return null;
  }
}

export function PortalPlaylistEmbed({ url, brandColor }: Props) {
  const embed = buildEmbed(url);
  if (!embed) return null;

  return (
    <section
      className="rounded-2xl border bg-card overflow-hidden shadow-sm"
      style={brandColor ? { borderColor: `hsla(${brandColor}, 0.2)` } : undefined}
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Music className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Playlist · {embed.platform}
        </span>
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