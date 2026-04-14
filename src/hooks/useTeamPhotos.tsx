import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TeamPhoto {
  id: string;
  full_name: string;
  photo_url: string | null;
  profile_id: string | null;
}

let cachedTeamPhotos: TeamPhoto[] | null = null;

export function useTeamPhotos() {
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_photos'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, photo_url, profile_id');
      cachedTeamPhotos = (data || []) as TeamPhoto[];
      return cachedTeamPhotos;
    },
  });

  /** Resolves the best photo URL for a profile, checking team_members.photo_url first */
  const getPhotoUrl = (profile: { id?: string; full_name?: string | null; avatar_url?: string | null } | null | undefined): string => {
    if (!profile) return '';
    const members = teamMembers.length > 0 ? teamMembers : (cachedTeamPhotos || []);
    const tm = members.find(
      t => (t.profile_id && t.profile_id === profile.id) || (t.full_name && t.full_name === profile.full_name)
    );
    return tm?.photo_url || profile.avatar_url || '';
  };

  return { teamMembers, getPhotoUrl };
}
