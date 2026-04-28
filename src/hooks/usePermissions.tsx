import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ModuleKey } from '@/lib/modules';

export function usePermissions() {
  const { user, isOwner } = useAuth();
  const [allowedModules, setAllowedModules] = useState<Set<string>>(new Set());
  const [grantedPages, setGrantedPages] = useState<Set<string>>(new Set());
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [userRoleTitle, setUserRoleTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllowedModules(new Set());
      setGrantedPages(new Set());
      setUserDepartments([]);
      setUserRoleTitle('');
      setLoading(false);
      return;
    }

    if (isOwner) {
      setAllowedModules(new Set(['*']));
      setGrantedPages(new Set());
      setUserDepartments(['admin']);
      setUserRoleTitle('Owner');
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      let depts: string[] = [];

      let teamMemberId: string | null = null;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (profile) {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('id, department, departments, role_title, custom_role_id')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (teamMember) {
          teamMemberId = teamMember.id;
          depts = Array.isArray(teamMember.departments) && teamMember.departments.length > 0
            ? teamMember.departments as string[]
            : (teamMember.department ? [teamMember.department] : []);
          setUserDepartments(depts);
          setUserRoleTitle(teamMember.role_title || '');

          if (depts.includes('admin')) {
            setAllowedModules(new Set(['*']));
            setLoading(false);
            const { data: grants } = await supabase
              .from('page_access_grants')
              .select('page_path')
              .eq('user_id', user.id);
            setGrantedPages(new Set(grants?.map(g => g.page_path) || []));
            return;
          }

          // Use custom_role_id directly from team_members
          // eslint-disable-next-line no-var
          var customRoleIdFromTM: string | null = teamMember.custom_role_id ?? null;
        }
      }

      // Get user's custom role from team_members (set above)
      let customRoleId: string | null = typeof customRoleIdFromTM !== 'undefined' ? customRoleIdFromTM : null;

      // Fallback: if no custom_role_id, auto-assign based on departments
      if (!customRoleId && depts.length > 0 && teamMemberId) {
        const deptRoleName = `dept_${[...depts].sort().join('_')}`;
        const { data: roleByName } = await supabase
          .from('custom_roles')
          .select('id')
          .eq('name', deptRoleName)
          .maybeSingle();

        if (roleByName?.id) {
          customRoleId = roleByName.id;
          // Persist on team_members for next time
          await supabase.from('team_members').update({ custom_role_id: roleByName.id }).eq('id', teamMemberId);
        }
      }

      if (customRoleId) {
        const { data: permissions } = await supabase
          .from('role_permissions')
          .select('module_key')
          .eq('custom_role_id', customRoleId)
          .eq('can_view', true);

        setAllowedModules(new Set(permissions?.map(p => p.module_key) || []));
      } else {
        setAllowedModules(new Set());
      }

      // Fetch per-page exceptional access grants
      const { data: grants } = await supabase
        .from('page_access_grants')
        .select('page_path')
        .eq('user_id', user.id);

      setGrantedPages(new Set(grants?.map(g => g.page_path) || []));
      setLoading(false);
    };

    fetchPermissions();
  }, [user, isOwner]);

  const canAccess = (moduleKey: ModuleKey | string): boolean => {
    if (moduleKey === 'hub-equipa') return true;
    if (isOwner) return true;
    if (allowedModules.has('*')) return true;
    return allowedModules.has(moduleKey);
  };

  const hasPageAccess = (pagePath: string): boolean => {
    if (isOwner) return true;
    if (allowedModules.has('*')) return true;
    return grantedPages.has(pagePath);
  };

  return { canAccess, hasPageAccess, userDepartments, userRoleTitle, loading };
}
