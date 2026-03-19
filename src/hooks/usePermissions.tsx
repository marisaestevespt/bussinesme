import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ModuleKey } from '@/lib/modules';

export function usePermissions() {
  const { user, isOwner } = useAuth();
  const [allowedModules, setAllowedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllowedModules(new Set());
      setLoading(false);
      return;
    }

    if (isOwner) {
      // Owner has access to everything
      setAllowedModules(new Set(['*']));
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Check if user's team_member has department = 'admin' (full access like owner)
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (profile) {
        const { data: teamMember } = await supabase.from('team_members').select('department').eq('profile_id', profile.id).maybeSingle();
        if (teamMember?.department === 'admin') {
          setAllowedModules(new Set(['*']));
          setLoading(false);
          return;
        }
      }

      // Get user's custom role via members table
      const { data: member } = await supabase
        .from('members')
        .select('custom_role_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        setAllowedModules(new Set());
        setLoading(false);
        return;
      }

      const { data: permissions } = await supabase
        .from('role_permissions')
        .select('module_key')
        .eq('custom_role_id', member.custom_role_id)
        .eq('can_view', true);

      setAllowedModules(new Set(permissions?.map(p => p.module_key) || []));
      setLoading(false);
    };

    fetchPermissions();
  }, [user, isOwner]);

  const canAccess = (moduleKey: ModuleKey | string): boolean => {
    if (moduleKey === 'hub-equipa') return true; // Always accessible
    if (isOwner) return true;
    return allowedModules.has(moduleKey);
  };

  return { canAccess, loading };
}
