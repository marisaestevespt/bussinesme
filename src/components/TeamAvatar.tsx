import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { cn } from '@/lib/utils';

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface TeamAvatarProps {
  profile?: { id?: string; full_name?: string | null; avatar_url?: string | null } | null;
  /** Shortcut: pass name directly when no profile object */
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Avatar that automatically resolves the best photo from team_members.photo_url,
 * falling back to profiles.avatar_url, then initials.
 */
export function TeamAvatar({ profile, name, className, fallbackClassName }: TeamAvatarProps) {
  const { getPhotoUrl } = useTeamPhotos();
  const displayName = profile?.full_name || name || null;
  const photoUrl = profile ? getPhotoUrl(profile) : getPhotoUrl({ full_name: name });

  return (
    <Avatar className={cn('h-6 w-6', className)}>
      {photoUrl && <AvatarImage src={photoUrl} />}
      <AvatarFallback className={cn('text-[9px]', fallbackClassName)}>
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
