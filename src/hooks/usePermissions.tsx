import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { MODULES, type ModuleKey } from '@/lib/modules';

// Sempre acessíveis a qualquer membro autenticado, independentemente da role.
// Cobrem Secretária, Hub e tudo o que for "Transversais" (Agenda, Reuniões, Projetos, Tarefas, Clientes, Mural, Acessos, Processos).
const ALWAYS_ALLOWED: Set<string> = new Set([
  'comeca-aqui',
  'hub-equipa',
  ...Object.entries(MODULES)
    .filter(([, m]) => (m as any).section === 'transversais')
    .map(([k]) => k),
]);

// Mapeia o nome do departamento do team_member para a moduleKey correspondente.
// Nem todos têm equivalência 1:1, por isso explicitamos.
const DEPT_TO_MODULE: Record<string, string[]> = {
  marketing: ['marketing'],
  financeiro: ['financeiro'],
  comercial: ['comercial'],
  clientes: ['clientes', 'customer-success'],
  equipa: ['equipa', 'recursos-humanos'],
  operacao: ['operacao'],
  administrativo: ['administrativo'],
  produtos: ['produtos'],
  rh: ['recursos-humanos', 'equipa'],
  'recursos-humanos': ['recursos-humanos', 'equipa'],
  'customer-success': ['customer-success', 'clientes'],
};

export function usePermissions() {
  const { user, isOwner } = useAuth();
  const { impersonating } = useImpersonation();
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

    // When impersonating, compute permissions as the target member.
    // Otherwise, the real Owner sees everything.
    if (isOwner && !impersonating) {
      setAllowedModules(new Set(['*']));
      setGrantedPages(new Set());
      setUserDepartments(['admin']);
      setUserRoleTitle('Owner');
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      let depts: string[] = [];

      let teamMemberId: string | null = null;
      let teamMember: any = null;

      if (impersonating) {
        // Look up team_member directly by impersonated member id
        const { data: tm } = await supabase
          .from('team_members')
          .select('id, department, departments, role_title, custom_role_id')
          .eq('id', impersonating.member_id)
          .maybeSingle();
        teamMember = tm;
      } else {
        const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
        if (profile) {
          const { data: tm } = await supabase
            .from('team_members')
            .select('id, department, departments, role_title, custom_role_id')
            .eq('profile_id', profile.id)
            .maybeSingle();
          teamMember = tm;
        }
      }

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
            if (!impersonating) {
              const { data: grants } = await supabase
                .from('page_access_grants')
                .select('page_path')
                .eq('user_id', user.id);
              setGrantedPages(new Set(grants?.map(g => g.page_path) || []));
            } else {
              setGrantedPages(new Set());
            }
            return;
          }

          // Use custom_role_id directly from team_members
          // eslint-disable-next-line no-var
          var customRoleIdFromTM: string | null = teamMember.custom_role_id ?? null;
        }

      // Get user's custom role from team_members (set above)
      let customRoleId: string | null = typeof customRoleIdFromTM !== 'undefined' ? customRoleIdFromTM : null;

      // Fallback: if no custom_role_id, auto-assign based on departments
      if (!customRoleId && depts.length > 0 && teamMemberId && !impersonating) {
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
      if (impersonating?.user_id) {
        const { data: grants } = await supabase
          .from('page_access_grants')
          .select('page_path')
          .eq('user_id', impersonating.user_id);
        setGrantedPages(new Set(grants?.map(g => g.page_path) || []));
      } else if (!impersonating) {
        const { data: grants } = await supabase
          .from('page_access_grants')
          .select('page_path')
          .eq('user_id', user.id);
        setGrantedPages(new Set(grants?.map(g => g.page_path) || []));
      } else {
        setGrantedPages(new Set());
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user, isOwner, impersonating]);

  const canAccess = (moduleKey: ModuleKey | string): boolean => {
    if (isOwner && !impersonating) return true;
    if (allowedModules.has('*')) return true;

    // 1. Defaults sempre acessíveis (Secretária, Hub, Transversais)
    if (ALWAYS_ALLOWED.has(moduleKey)) return true;

    // 2. Departamento(s) do membro
    for (const dept of userDepartments) {
      const mods = DEPT_TO_MODULE[dept] ?? [dept];
      if (mods.includes(moduleKey)) return true;
    }

    // 3. Páginas extra concedidas via role (configuração manual)
    return allowedModules.has(moduleKey);
  };

  const hasPageAccess = (pagePath: string): boolean => {
    if (isOwner && !impersonating) return true;
    if (allowedModules.has('*')) return true;
    return grantedPages.has(pagePath);
  };

  return { canAccess, hasPageAccess, userDepartments, userRoleTitle, loading };
}
