/**
 * ChannelCard — padrão único e sóbrio para qualquer card de canal de marketing.
 *
 * Use SEMPRE este componente em listagens/galerias de canais (Estratégia, Dashboard,
 * Análise, etc.) — não recriar cards de canal à mão com imagens hardcoded.
 *
 * Fallback minimalista: ícone Lucide + nome em superfície neutra.
 * Capa real (cover_url) se houver, com gradiente subtil em background (NÃO preto).
 * Owner vê botões de Upload/Remover capa no hover.
 */
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Upload, X, Globe, Instagram, Youtube, Facebook, Linkedin, Music2,
  Mail, Twitter, AtSign, Headphones, FileText, Send, MessageCircle, Image as ImageIcon, Radio,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const CHANNEL_ICON: Record<string, LucideIcon> = {
  'Instagram': Instagram, 'Youtube': Youtube, 'Facebook': Facebook, 'TikTok': Music2,
  'LinkedIn': Linkedin, 'Pinterest': ImageIcon, 'Website': Globe, 'Email Marketing': Mail,
  'Twitter': Twitter, 'Threads': AtSign, 'Spotify': Headphones, 'Blog': FileText,
  'Podcast': Radio, 'Newsletter': Mail, 'WhatsApp': MessageCircle, 'Telegram': Send,
};

export function getChannelIcon(name: string): LucideIcon {
  return CHANNEL_ICON[name] || Globe;
}

interface ChannelCardProps {
  channel: { id: string; name: string; cover_url?: string | null; link?: string | null };
  to: string;
  isOwner?: boolean;
  /** small (estratégia) | default (dashboard) */
  size?: 'sm' | 'md';
  /** extra info under the name (e.g. hostname or "Sem link") */
  subtitle?: React.ReactNode;
  /** extra controls (e.g. inline edit pencil) */
  extraOverlay?: React.ReactNode;
  /** invalidate queries after upload/remove cover */
  invalidateKeys?: string[];
}

export function ChannelCard({
  channel, to, isOwner, size = 'md', subtitle, extraOverlay,
  invalidateKeys = ['marketing-channels'],
}: ChannelCardProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const Icon = getChannelIcon(channel.name);
  const cover = channel.cover_url;

  const heightClass = size === 'sm' ? 'h-28' : 'h-36';

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${channel.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('channel-covers').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(path);
      const { error: updErr } = await supabase.from('marketing_channels')
        .update({ cover_url: urlData.publicUrl } as any).eq('id', channel.id);
      if (updErr) throw updErr;
      invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast.success('Capa atualizada');
    } catch (err: any) {
      toast.error('Erro ao enviar capa: ' + (err?.message || ''));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const { error } = await supabase.from('marketing_channels')
      .update({ cover_url: null } as any).eq('id', channel.id);
    if (error) { toast.error('Erro ao remover capa'); return; }
    invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  }

  return (
    <div className="relative group">
      <Link
        to={to}
        className={cn(
          'relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hq-transition hover:shadow-md hover:border-primary/30',
          heightClass,
        )}
      >
        {cover ? (
          <>
            <img src={cover} alt={channel.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
            <div className="relative z-10 mt-auto px-3 pb-2.5">
              <p className="text-sm font-semibold text-foreground truncate">{channel.name}</p>
              {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full gap-2 hq-surface-sunken px-3 text-center">
            <Icon className="h-6 w-6 text-muted-foreground/70" />
            <p className="text-sm font-medium text-foreground truncate max-w-full">{channel.name}</p>
            {subtitle && <div className="text-[11px] text-muted-foreground truncate max-w-full">{subtitle}</div>}
          </div>
        )}
      </Link>

      {/* Hover overlay (Owner only) */}
      {isOwner && (
        <div className="absolute top-1.5 right-1.5 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <label
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-md bg-background/90 border border-border shadow-sm cursor-pointer hover:bg-background',
              uploading && 'pointer-events-none opacity-60',
            )}
            title={cover ? 'Alterar capa' : 'Adicionar capa'}
          >
            <Upload className="h-3.5 w-3.5 text-foreground" />
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
          {cover && (
            <button
              type="button"
              onClick={handleRemove}
              title="Remover capa"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-background/90 border border-border shadow-sm hover:bg-background"
            >
              <X className="h-3.5 w-3.5 text-foreground" />
            </button>
          )}
          {extraOverlay}
        </div>
      )}
    </div>
  );
}
